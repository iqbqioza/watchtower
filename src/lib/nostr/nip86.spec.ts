import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import { sha256Hex } from './hash';
import {
	NIP86_CONTENT_TYPE,
	Nip86AuthError,
	Nip86Error,
	callNip86,
	createNip86Client
} from './nip86';

// BIP-340 test vector 0 secret key.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
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

function fakeFetch(response: () => Response): {
	calls: Captured[];
	fetch: typeof globalThis.fetch;
} {
	const calls: Captured[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return response();
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

function headersOf(call: Captured): Record<string, string> {
	return call.init.headers as Record<string, string>;
}

describe('callNip86', () => {
	it('posts to the https endpoint of the relay with signed headers', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		const result = await callNip86(
			{ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch, created_at: CREATED_AT },
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

	it('signs the exact body that is sent, with the relay URL in the u tag', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		const params = [PUBKEY, 'spam'];
		await callNip86(
			{ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch, created_at: CREATED_AT },
			'banpubkey',
			params
		);

		const body = calls[0].init.body as string;
		expect(body).toBe(JSON.stringify({ method: 'banpubkey', params }));

		const encoded = headersOf(calls[0]).Authorization.slice('Nostr '.length);
		const event = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
		expect(verifyEvent(event)).toBe(true);
		expect(event.created_at).toBe(CREATED_AT);
		expect(event.tags).toContainEqual(['u', RELAY_URL]);
		expect(event.tags).toContainEqual(['method', 'POST']);
		expect(event.tags).toContainEqual(['payload', sha256Hex(body)]);
	});

	it('accepts a relay URL written as https', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ result: true }));
		await callNip86(
			{ relayUrl: 'https://relay.example.com', secretKey: SECRET_KEY, fetch },
			'supportedmethods'
		);

		expect(calls[0].url).toBe('https://relay.example.com/');
		const event = JSON.parse(
			Buffer.from(headersOf(calls[0]).Authorization.slice('Nostr '.length), 'base64').toString(
				'utf8'
			)
		);
		expect(event.tags).toContainEqual(['u', RELAY_URL]);
	});

	it('returns the result of the call', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ result: ['banpubkey', 'blockip'] }));
		const methods = await createNip86Client({
			relayUrl: RELAY_URL,
			secretKey: SECRET_KEY,
			fetch
		}).supportedMethods();

		expect(methods).toEqual(['banpubkey', 'blockip']);
	});

	it('reports a missing authorization as an auth error', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ error: 'missing auth' }, 401));
		await expect(
			callNip86({ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch }, 'supportedmethods')
		).rejects.toBeInstanceOf(Nip86AuthError);
	});

	it('turns the error field of a 200 response into an error', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ error: 'invalid auth event payload hash' }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch }, 'supportedmethods')
		).rejects.toThrow(new Nip86Error('invalid auth event payload hash'));
	});

	it('rejects responses that are not JSON', async () => {
		const { fetch } = fakeFetch(() => new Response('<html>boom</html>', { status: 500 }));
		await expect(
			callNip86({ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch }, 'supportedmethods')
		).rejects.toThrow(/invalid JSON/);
	});

	it('rejects JSON responses with an error status', async () => {
		const { fetch } = fakeFetch(() => jsonResponse({ result: null }, 500));
		await expect(
			callNip86({ relayUrl: RELAY_URL, secretKey: SECRET_KEY, fetch }, 'supportedmethods')
		).rejects.toThrow(/HTTP 500/);
	});
});
