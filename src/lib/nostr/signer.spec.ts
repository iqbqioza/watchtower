import { hexToBytes } from '@noble/hashes/utils.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, verifyEvent } from './event';
import { browserNostrProvider, LocalSigner, Nip07Signer, type Nip07Provider } from './signer';
import type { EventTemplate } from './types';

// BIP-340 test vector 0 secret key and one other key, for account switches.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
const OTHER_SECRET_KEY = hexToBytes(
	'0000000000000000000000000000000000000000000000000000000000000005'
);
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';

function extension(overrides: Partial<Nip07Provider> = {}): Nip07Provider {
	return {
		getPublicKey: vi.fn(async () => PUBKEY.toUpperCase()),
		signEvent: vi.fn(async (template: EventTemplate) => finalizeEvent(SECRET_KEY, template)),
		...overrides
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('LocalSigner', () => {
	it('reports its public key and signs templates', async () => {
		const signer = new LocalSigner(SECRET_KEY);

		expect(await signer.getPublicKey()).toBe(PUBKEY);
		const event = await signer.signEvent({
			kind: 27235,
			tags: [['u', 'wss://relay.example.com/']]
		});
		expect(event.pubkey).toBe(PUBKEY);
		expect(verifyEvent(event)).toBe(true);
	});
});

describe('Nip07Signer', () => {
	it('normalizes the public key reported by the extension', async () => {
		expect(await new Nip07Signer(extension()).getPublicKey()).toBe(PUBKEY);
	});

	it('signs the template through the extension', async () => {
		const provider = extension();
		const signer = new Nip07Signer(provider, PUBKEY);

		const event = await signer.signEvent({ kind: 1, content: 'hello' });

		expect(verifyEvent(event)).toBe(true);
		expect(provider.signEvent).toHaveBeenCalledWith({
			kind: 1,
			created_at: expect.any(Number),
			tags: [],
			content: 'hello'
		});
	});

	it('recovers created_at when the extension drops it', async () => {
		vi.useFakeTimers();
		try {
			const created = finalizeEvent(SECRET_KEY, {
				kind: 1,
				created_at: 1_700_000_000,
				content: 'hello'
			});
			const withoutTime = {
				id: created.id,
				pubkey: created.pubkey,
				sig: created.sig,
				kind: created.kind,
				tags: created.tags,
				content: created.content
			};
			const dropped = extension({ signEvent: async () => withoutTime as never });
			vi.setSystemTime(1_700_000_010 * 1000);

			const event = await new Nip07Signer(dropped, PUBKEY).signEvent({ kind: 1 });

			expect(event.created_at).toBe(1_700_000_000);
			expect(verifyEvent(event)).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('gives up when the dropped timestamp cannot be recovered', async () => {
		vi.useFakeTimers();
		try {
			const created = finalizeEvent(SECRET_KEY, { kind: 1, created_at: 1_700_000_000 });
			const withoutTime = {
				id: created.id,
				pubkey: created.pubkey,
				sig: created.sig,
				kind: created.kind,
				tags: created.tags,
				content: created.content
			};
			const dropped = extension({ signEvent: async () => withoutTime as never });
			// Far away from the timestamp baked into the id.
			vi.setSystemTime(1_800_000_000 * 1000);

			await expect(new Nip07Signer(dropped, PUBKEY).signEvent({ kind: 1 })).rejects.toThrow(
				/not a signed event/
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('rejects events that do not verify', async () => {
		const tampered = extension({
			signEvent: async (template: EventTemplate) => ({
				...finalizeEvent(SECRET_KEY, template),
				content: 'tampered'
			})
		});

		await expect(new Nip07Signer(tampered, PUBKEY).signEvent({ kind: 1 })).rejects.toThrow(
			/invalid signature/
		);
	});

	it('rejects anything that is not a signed event and says what came back', async () => {
		const broken = extension({
			signEvent: async () => ({ kind: 1, note: 'not signed' }) as never
		});

		await expect(new Nip07Signer(broken, PUBKEY).signEvent({ kind: 1 })).rejects.toThrow(
			/not a signed event \(\{ kind: number, note: string \}\)/
		);
	});

	it('treats a dismissed prompt as not approved', async () => {
		const dismissed = extension({ signEvent: async () => undefined as never });

		await expect(new Nip07Signer(dismissed, PUBKEY).signEvent({ kind: 1 })).rejects.toThrow(
			/did not approve/
		);
	});

	it('accepts a signed event that comes back as a JSON string', async () => {
		const stringy = extension({
			signEvent: async (template: EventTemplate) =>
				JSON.stringify(finalizeEvent(SECRET_KEY, template)) as never
		});

		const event = await new Nip07Signer(stringy, PUBKEY).signEvent({ kind: 1, content: 'hello' });

		expect(event.content).toBe('hello');
		expect(verifyEvent(event)).toBe(true);
	});

	it('accepts a signed event wrapped in an object', async () => {
		const wrapped = extension({
			signEvent: async (template: EventTemplate) =>
				({ event: finalizeEvent(SECRET_KEY, template) }) as never
		});

		const event = await new Nip07Signer(wrapped, PUBKEY).signEvent({ kind: 1, content: 'hello' });

		expect(verifyEvent(event)).toBe(true);
	});

	it('notices when the extension switched accounts', async () => {
		const switched = extension({
			signEvent: async (template: EventTemplate) => finalizeEvent(OTHER_SECRET_KEY, template)
		});

		await expect(new Nip07Signer(switched, PUBKEY).signEvent({ kind: 1 })).rejects.toThrow(
			/different key/
		);
	});

	it('accepts an npub and rejects nonsense from the extension', async () => {
		const npub = 'npub1lycg5qvjtrp3qjf5f7zl382j9x6nrjz9sdhenvyxq8c3808qxmus6gq266';
		expect(
			await new Nip07Signer(extension({ getPublicKey: async () => npub })).getPublicKey()
		).toBe(PUBKEY);

		const broken = extension({ getPublicKey: async () => 'not-a-key' });
		await expect(new Nip07Signer(broken).getPublicKey()).rejects.toThrow();
	});

	it('tells the caller while a prompt is open', async () => {
		const activity: boolean[] = [];
		const signer = new Nip07Signer(extension(), PUBKEY, (pending) => activity.push(pending));

		await signer.signEvent({ kind: 1 });

		expect(activity).toEqual([true, false]);
	});

	it('clears the pending flag when the extension refuses', async () => {
		const activity: boolean[] = [];
		const refused = extension({
			signEvent: async () => {
				throw new Error('the user denied the request');
			}
		});

		await expect(
			new Nip07Signer(refused, PUBKEY, (pending) => activity.push(pending)).signEvent({ kind: 1 })
		).rejects.toThrow(/denied/);
		expect(activity).toEqual([true, false]);
	});

	it('also reports activity while the public key is requested', async () => {
		const activity: boolean[] = [];

		await new Nip07Signer(extension(), null, (pending) => activity.push(pending)).getPublicKey();

		expect(activity).toEqual([true, false]);
	});
});

describe('browserNostrProvider', () => {
	it('finds an injected extension', () => {
		vi.stubGlobal('nostr', extension());
		expect(browserNostrProvider()).not.toBeNull();
	});

	it('returns null when nothing is injected', () => {
		expect(browserNostrProvider()).toBeNull();
	});

	it('ignores incomplete injections', () => {
		vi.stubGlobal('nostr', { getPublicKey: async () => PUBKEY });
		expect(browserNostrProvider()).toBeNull();
	});
});
