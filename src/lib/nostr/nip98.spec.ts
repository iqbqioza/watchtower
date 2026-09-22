import { createHash } from 'node:crypto';
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import { createAuthorizationHeader, createHttpAuthEvent, HTTP_AUTH_KIND } from './nip98';

// BIP-340 test vector 0 secret key; only used to sign in these tests.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
const RELAY_URL = 'wss://relay.example.com/';
const BODY = JSON.stringify({ method: 'supportedmethods', params: [] });
const CREATED_AT = 1_700_000_000;

function sha256Hex(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('createHttpAuthEvent', () => {
	it('builds a NIP-98 event that commits to url, method and body', () => {
		const event = createHttpAuthEvent(SECRET_KEY, {
			url: RELAY_URL,
			method: 'post',
			body: BODY,
			created_at: CREATED_AT,
			nonce: 'test-nonce'
		});

		expect(event.kind).toBe(HTTP_AUTH_KIND);
		expect(event.content).toBe('');
		expect(event.created_at).toBe(CREATED_AT);
		expect(event.tags).toEqual([
			['u', RELAY_URL],
			['method', 'POST'],
			['payload', sha256Hex(BODY)],
			['nonce', 'test-nonce']
		]);
		expect(verifyEvent(event)).toBe(true);
	});

	it('omits the payload tag when there is no body', () => {
		const event = createHttpAuthEvent(SECRET_KEY, { url: RELAY_URL, method: 'GET' });

		expect(event.tags.slice(0, 2)).toEqual([
			['u', RELAY_URL],
			['method', 'GET']
		]);
		expect(event.tags.some(([tag]) => tag === 'payload')).toBe(false);
	});

	it('adds a random nonce so that repeated calls are not rejected as replays', () => {
		const request = { url: RELAY_URL, method: 'POST', body: BODY, created_at: CREATED_AT };
		const first = createHttpAuthEvent(SECRET_KEY, request);
		const second = createHttpAuthEvent(SECRET_KEY, request);

		const nonce = (event: { tags: string[][] }): string | undefined =>
			event.tags.find(([tag]) => tag === 'nonce')?.[1];
		expect(nonce(first)).toMatch(/^[0-9a-f]{16}$/);
		expect(nonce(first)).not.toBe(nonce(second));
		expect(first.id).not.toBe(second.id);
		expect(verifyEvent(first)).toBe(true);
		expect(verifyEvent(second)).toBe(true);
	});

	it('changes the payload tag when the body changes', () => {
		const before = createHttpAuthEvent(SECRET_KEY, { url: RELAY_URL, method: 'POST', body: BODY });
		const after = createHttpAuthEvent(SECRET_KEY, {
			url: RELAY_URL,
			method: 'POST',
			body: `${BODY} `
		});

		const payload = (event: { tags: string[][] }): string | undefined =>
			event.tags.find(([tag]) => tag === 'payload')?.[1];
		expect(payload(before)).not.toBe(payload(after));
	});
});

describe('createAuthorizationHeader', () => {
	it('prefixes the base64 encoded event with "Nostr "', () => {
		const header = createAuthorizationHeader(SECRET_KEY, {
			url: RELAY_URL,
			method: 'POST',
			body: BODY,
			created_at: CREATED_AT
		});
		const [scheme, encoded] = header.split(' ');

		expect(scheme).toBe('Nostr');
		expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
	});

	it('round trips to a verifiable event over the exact body', () => {
		const header = createAuthorizationHeader(SECRET_KEY, {
			url: RELAY_URL,
			method: 'POST',
			body: BODY,
			created_at: CREATED_AT
		});
		const encoded = header.slice('Nostr '.length);
		const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

		expect(decoded.tags).toContainEqual(['payload', sha256Hex(BODY)]);
		expect(verifyEvent(decoded)).toBe(true);
	});
});
