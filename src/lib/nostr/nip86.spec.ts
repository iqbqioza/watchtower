import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import { sha256Hex } from './hash';
import {
	NIP86_CONTENT_TYPE,
	Nip86AuthError,
	Nip86Error,
	Nip86UnsupportedError,
	callNip86,
	createNip86Client,
	isGrantableMethod,
	validateClaim
} from './nip86';
import { LocalSigner } from './signer';

// BIP-340 test vector 0 secret key; the relay never sees it in production.
const signer = new LocalSigner(
	hexToBytes('0000000000000000000000000000000000000000000000000000000000000003')
);
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';
const CREATED_AT = 1_700_000_000;

interface Captured {
	url: string;
	init: RequestInit;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': NIP86_CONTENT_TYPE }
	});
}

function fakeFetch(...responses: Array<() => Response>): {
	calls: Captured[];
	fetch: typeof globalThis.fetch;
} {
	const calls: Captured[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		const index = Math.min(calls.length - 1, responses.length - 1);
		return responses[index]();
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

function uTagOf(call: Captured): string {
	const encoded = headersOf(call).Authorization.slice('Nostr '.length);
	const event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
	const tag = (event.tags as string[][]).find(([name]) => name === 'u');
	return tag?.[1] ?? '';
}

function headersOf(call: Captured): Record<string, string> {
	return call.init.headers as Record<string, string>;
}

describe('callNip86', () => {
	it('posts to the https endpoint of the relay with signed headers', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		const result = await callNip86(
			{ relayUrl: RELAY_URL, signer, fetch, created_at: CREATED_AT },
			'banpubkey',
			[PUBKEY, 'spam']
		);

		expect(result).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://relay.example.com/');
		expect(calls[0].init.method).toBe('POST');
		expect(headersOf(calls[0])['Content-Type']).toBe(NIP86_CONTENT_TYPE);
		expect(headersOf(calls[0]).Authorization).toMatch(/^Nostr [A-Za-z0-9+/]+={0,2}$/);
	});

	it('signs the exact body that is sent, with the request URL in the u tag', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		const params = [PUBKEY, 'spam'];
		await callNip86(
			{ relayUrl: RELAY_URL, signer, fetch, created_at: CREATED_AT },
			'banpubkey',
			params
		);

		const body = calls[0].init.body as string;
		expect(body).toBe(JSON.stringify({ method: 'banpubkey', params }));

		const encoded = headersOf(calls[0]).Authorization.slice('Nostr '.length);
		const event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
		expect(verifyEvent(event)).toBe(true);
		expect(event.created_at).toBe(CREATED_AT);
		expect(event.tags).toContainEqual(['u', 'https://relay.example.com/']);
		expect(event.tags).toContainEqual(['method', 'POST']);
		expect(event.tags).toContainEqual(['payload', sha256Hex(body)]);
	});

	it('accepts a relay URL written as https', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		await callNip86({ relayUrl: 'https://relay.example.com', signer, fetch }, 'supportedmethods');

		expect(calls[0].url).toBe('https://relay.example.com/');
		expect(uTagOf(calls[0])).toBe('https://relay.example.com/');
	});

	it('retries with the relay URL for relays that want the websocket form', async () => {
		const { calls, fetch } = fakeFetch(
			() => jsonResponse({ error: 'unauthorized' }, 401),
			() => jsonResponse({ result: ['banpubkey'] })
		);
		const result = await callNip86(
			{ relayUrl: RELAY_URL, signer, fetch, created_at: CREATED_AT },
			'supportedmethods'
		);

		expect(result).toEqual(['banpubkey']);
		expect(calls).toHaveLength(2);
		expect(uTagOf(calls[0])).toBe('https://relay.example.com/');
		expect(uTagOf(calls[1])).toBe(RELAY_URL);
		// The body must stay identical, because the payload tag commits to it.
		expect(calls[1].init.body).toBe(calls[0].init.body);
	});

	it('returns the result of the call', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ result: ['banpubkey', 'blockip'] }));
		const methods = await createNip86Client({
			relayUrl: RELAY_URL,
			signer,
			fetch
		}).supportedMethods();

		expect(methods).toEqual(['banpubkey', 'blockip']);
	});

	it('reports a missing authorization as an auth error', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ error: 'unauthorized' }, 401));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toBeInstanceOf(Nip86AuthError);
		expect(calls).toHaveLength(2);
	});

	it('turns the error field of a 200 response into an error', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ error: 'invalid auth event payload hash' }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(new Nip86Error('invalid auth event payload hash'));
	});

	it('rejects responses that are not JSON', async () => {
		const { fetch } = fakeFetch(() => new Response('<html>boom</html>', { status: 500 }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(/invalid JSON/);
	});

	it('rejects JSON responses with an error status', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ result: null }, 500));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(/HTTP 500/);
	});

	it('reports a body that is not a JSON object instead of crashing', async () => {
		const { fetch } = fakeFetch(() => new Response('null', { status: 200 }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(/returned null/);
	});

	it('keeps the reason the relay gave for rejecting the request', async () => {
		const { fetch } = fakeFetch(() =>
			jsonResponse({ error: 'invalid auth event payload hash' }, 401)
		);
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(/invalid auth event payload hash/);
	});

	it('gives up on a relay that never answers', async () => {
		const fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
			})) as typeof globalThis.fetch;

		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch, timeoutMs: 20 }, 'supportedmethods')
		).rejects.toThrow(/did not answer in time/);
	});

	it('reports a relay that cannot be reached', async () => {
		const fetch = (async () => {
			throw new TypeError('fetch failed');
		}) as typeof globalThis.fetch;

		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toThrow(/could not reach the relay/);
	});

	it('flags an address without a management API', async () => {
		const { fetch } = fakeFetch(() => new Response('<!doctype html>', { status: 404 }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toBeInstanceOf(Nip86UnsupportedError);
	});

	it('flags a response that is not a NIP-86 answer', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ name: 'just a NIP-11 document' }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toBeInstanceOf(Nip86UnsupportedError);
	});

	it('flags a relay that does not know the method', async () => {
		const { fetch } = fakeFetch(() =>
			jsonResponse({ error: 'method supportedmethods is not supported' })
		);
		await expect(
			callNip86({ relayUrl: RELAY_URL, signer, fetch }, 'supportedmethods')
		).rejects.toBeInstanceOf(Nip86UnsupportedError);
	});
});

describe('grantable methods', () => {
	it('accepts the moderation verbs and read-only lists', () => {
		expect(isGrantableMethod('banpubkey')).toBe(true);
		expect(isGrantableMethod('banevent')).toBe(true);
		expect(isGrantableMethod('listallowedevents')).toBe(true);
	});

	it('refuses anything that could escalate permissions', () => {
		expect(isGrantableMethod('supportedmethods')).toBe(false);
		expect(isGrantableMethod('assignmethod')).toBe(false);
		expect(isGrantableMethod('createrole')).toBe(false);
		expect(isGrantableMethod('changerelayname')).toBe(false);
		expect(isGrantableMethod('listclaims')).toBe(false);
	});
});

describe('validateClaim', () => {
	it('accepts a plain invite code untouched', () => {
		expect(validateClaim('invite-for-alice')).toBe('invite-for-alice');
	});

	it('refuses empty, padded, too long and control characters', () => {
		expect(() => validateClaim('')).toThrow(/must not be empty/);
		expect(() => validateClaim('   ')).toThrow(/must not be empty/);
		expect(() => validateClaim(' padded')).toThrow(/whitespace/);
		expect(() => validateClaim('padded ')).toThrow(/whitespace/);
		expect(() => validateClaim('a'.repeat(129))).toThrow(/at most 128/);
		expect(() => validateClaim('bad\u0007claim')).toThrow(/control characters/);
		expect(() => validateClaim('bad\u009bclaim')).toThrow(/control characters/);
	});

	it('counts characters, not bytes', () => {
		expect(validateClaim('あ'.repeat(128))).toHaveLength(128);
		expect(() => validateClaim('あ'.repeat(129))).toThrow(/at most 128/);
	});
});
