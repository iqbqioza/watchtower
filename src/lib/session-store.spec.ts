import { finalizeEvent } from './nostr/event';
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import type { Nip07Provider } from './nostr/signer';
import type { EventTemplate } from './nostr/types';
import { SESSION_STORAGE_KEY, type StorageLike } from './session';
import { SessionStore } from './session.svelte.js';
import { signerActivity } from './signer-activity.svelte.js';

// BIP-340 test vector 0 secret key.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';

class MemoryStorage implements StorageLike {
	#items = new Map<string, string>();

	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.#items.set(key, value);
	}

	removeItem(key: string): void {
		this.#items.delete(key);
	}

	/** Test helper: what is actually persisted. */
	get stored(): string | null {
		return this.getItem(SESSION_STORAGE_KEY);
	}
}

function extension(overrides: Partial<Nip07Provider> = {}): Nip07Provider {
	return {
		getPublicKey: async () => PUBKEY,
		signEvent: async (template: EventTemplate) => finalizeEvent(SECRET_KEY, template),
		...overrides
	};
}

describe('SessionStore', () => {
	it('is anonymous until someone signs in', () => {
		const store = new SessionStore(new MemoryStorage(), () => extension());
		expect(store.isAuthenticated).toBe(false);
		expect(store.pubkey).toBeNull();
		expect(store.npub).toBeNull();
		expect(store.signer).toBeNull();
	});

	it('keeps the account from the extension, never the key', async () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage, () => extension());

		await store.signIn(RELAY_URL);

		expect(store.isAuthenticated).toBe(true);
		expect(store.pubkey).toBe(PUBKEY);
		expect(store.npub).toMatch(/^npub1/);
		expect(storage.stored).toContain(PUBKEY);
		expect(storage.stored).not.toContain('secret');
	});

	it('normalizes the relay URL before storing it', async () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage, () => extension());

		await store.signIn('https://relay.example.com');

		expect(store.relayUrl).toBe(RELAY_URL);
		expect(storage.stored).toContain(RELAY_URL);
	});

	it('gives a signer bound to the stored account', async () => {
		const store = new SessionStore(new MemoryStorage(), () => extension());
		await store.signIn(RELAY_URL);

		const signer = store.signer;

		expect(signer).not.toBeNull();
		expect(await signer?.getPublicKey()).toBe(PUBKEY);
	});

	it('restores a stored session exactly once', async () => {
		const storage = new MemoryStorage();
		await new SessionStore(storage, () => extension()).signIn(RELAY_URL);

		const store = new SessionStore(storage, () => extension());
		store.restore();
		expect(store.pubkey).toBe(PUBKEY);
		expect(store.relayUrl).toBe(RELAY_URL);

		// A later change is not overwritten by a second restore call.
		store.signOut();
		store.restore();
		expect(store.isAuthenticated).toBe(false);
	});

	it('ignores corrupted storage', () => {
		const storage = new MemoryStorage();
		storage.setItem(SESSION_STORAGE_KEY, '{"signer":"nip07","pubkey":"nope"}');

		const store = new SessionStore(storage, () => extension());
		store.restore();
		expect(store.isAuthenticated).toBe(false);
	});

	it('clears memory and storage on sign out', async () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage, () => extension());
		await store.signIn(RELAY_URL);

		store.signOut();

		expect(store.isAuthenticated).toBe(false);
		expect(store.pubkey).toBeNull();
		expect(store.relayUrl).toBe('');
		expect(storage.stored).toBeNull();
	});

	it('refuses to sign in without an extension or with a broken key', async () => {
		const missing = new SessionStore(new MemoryStorage(), () => null);
		await expect(missing.signIn(RELAY_URL)).rejects.toThrow(/no NIP-07/);
		expect(missing.isAuthenticated).toBe(false);

		const storage = new MemoryStorage();
		const broken = new SessionStore(storage, () =>
			extension({ getPublicKey: async () => 'not-a-key' })
		);
		await expect(broken.signIn(RELAY_URL)).rejects.toThrow(/valid bech32|32 bytes of hex/);
		expect(storage.stored).toBeNull();

		const badRelay = new SessionStore(new MemoryStorage(), () => extension());
		await expect(badRelay.signIn('http://')).rejects.toThrow(/not a valid URL/);
		expect(badRelay.isAuthenticated).toBe(false);
	});

	it('works without storage, for example in private mode', async () => {
		const store = new SessionStore(null, () => extension());
		await store.signIn(RELAY_URL);
		expect(store.signer).not.toBeNull();

		store.signOut();
		expect(store.isAuthenticated).toBe(false);
	});

	it('reports pending extension prompts through the shared activity state', async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => (release = resolve));
		const slowProvider = extension({
			signEvent: async (template: EventTemplate) => {
				await gate;
				return finalizeEvent(SECRET_KEY, template);
			}
		});
		const store = new SessionStore(new MemoryStorage(), () => slowProvider);
		await store.signIn(RELAY_URL);
		expect(signerActivity.pending).toBe(false);

		const signing = store.signer?.signEvent({ kind: 1 });
		expect(signerActivity.pending).toBe(true);

		release();
		await signing;
		expect(signerActivity.pending).toBe(false);
	});

	it('has no signer when the extension went away', async () => {
		let provider: Nip07Provider | null = extension();
		const store = new SessionStore(new MemoryStorage(), () => provider);
		await store.signIn(RELAY_URL);
		expect(store.signer).not.toBeNull();

		// The extension was uninstalled or disabled in another profile.
		provider = null;
		expect(store.isAuthenticated).toBe(true);
		expect(store.signer).toBeNull();
	});
});
