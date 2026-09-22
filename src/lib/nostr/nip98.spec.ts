import { createHash } from 'node:crypto';
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import {
	createAuthorizationHeader,
	createHttpAuthEvent,
	HTTP_AUTH_KIND,
	httpAuthTemplate,
	type HttpAuthRequest
} from './nip98';
import { LocalSigner } from './signer';

// BIP-340 test vector 0 secret key; the relay never sees it in production.
const signer = new LocalSigner(
	hexToBytes('0000000000000000000000000000000000000000000000000000000000000003')
);
const RELAY_URL = 'wss://relay.example.com/';
const BODY = JSON.stringify({ method: 'supportedmethods', params: [] });
const CREATED_AT = 1_700_000_000;
const REQUEST: HttpAuthRequest = {
	url: RELAY_URL,
	method: 'POST',
	body: BODY,
	created_at: CREATED_AT
};

function sha256Hex(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function nonceOf(template: { tags?: string[][] }): string | undefined {
	return template.tags?.find(([tag]) => tag === 'nonce')?.[1];
}

function payloadOf(template: { tags?: string[][] }): string | undefined {
	return template.tags?.find(([tag]) => tag === 'payload')?.[1];
}

describe('httpAuthTemplate', () => {
	it('tags the url, the method, the body hash and a nonce', () => {
		const template = httpAuthTemplate({ ...REQUEST, nonce: 'test-nonce' });

		expect(template).toEqual({
			kind: HTTP_AUTH_KIND,
			created_at: CREATED_AT,
			tags: [
				['u', RELAY_URL],
				['method', 'POST'],
				['payload', sha256Hex(BODY)],
				['nonce', 'test-nonce']
			],
			content: ''
		});
	});

	it('omits the payload tag when there is no body', () => {
		const template = httpAuthTemplate({ url: RELAY_URL, method: 'get' });

		expect(template.tags?.slice(0, 2)).toEqual([
			['u', RELAY_URL],
			['method', 'GET']
		]);
		expect(payloadOf(template)).toBeUndefined();
	});

	it('adds a random nonce so repeated calls are not rejected as replays', () => {
		const first = httpAuthTemplate(REQUEST);
		const second = httpAuthTemplate(REQUEST);

		expect(nonceOf(first)).toMatch(/^[0-9a-f]{16}$/);
		expect(nonceOf(first)).not.toBe(nonceOf(second));
	});

	it('changes the payload tag when the body changes', () => {
		const before = httpAuthTemplate(REQUEST);
		const after = httpAuthTemplate({ ...REQUEST, body: `${BODY} ` });

		expect(payloadOf(before)).not.toBe(payloadOf(after));
	});
});

describe('createHttpAuthEvent', () => {
	it('signs the template with the signer', async () => {
		const event = await createHttpAuthEvent(signer, { ...REQUEST, nonce: 'test-nonce' });

		expect(event.kind).toBe(HTTP_AUTH_KIND);
		expect(event.content).toBe('');
		expect(event.created_at).toBe(CREATED_AT);
		expect(event.tags).toContainEqual(['payload', sha256Hex(BODY)]);
		expect(event.tags).toContainEqual(['nonce', 'test-nonce']);
		expect(verifyEvent(event)).toBe(true);
	});

	it('produces a fresh event for every call', async () => {
		const first = await createHttpAuthEvent(signer, REQUEST);
		const second = await createHttpAuthEvent(signer, REQUEST);

		expect(first.id).not.toBe(second.id);
		expect(verifyEvent(first)).toBe(true);
		expect(verifyEvent(second)).toBe(true);
	});
});

describe('createAuthorizationHeader', () => {
	it('prefixes the base64 encoded event with "Nostr "', async () => {
		const header = await createAuthorizationHeader(signer, REQUEST);
		const [scheme, encoded] = header.split(' ');

		expect(scheme).toBe('Nostr');
		expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
	});

	it('round trips to a verifiable event over the exact body', async () => {
		const header = await createAuthorizationHeader(signer, REQUEST);
		const decoded = JSON.parse(
			Buffer.from(header.slice('Nostr '.length), 'base64').toString('utf8')
		);

		expect(decoded.tags).toContainEqual(['payload', sha256Hex(BODY)]);
		expect(verifyEvent(decoded)).toBe(true);
	});
});
