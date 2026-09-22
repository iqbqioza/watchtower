import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import { CLIENT_AUTH_KIND, clientAuthTemplate, createAuthEvent } from './nip42';
import { LocalSigner } from './signer';

// BIP-340 test vector 0 secret key and its public key.
const signer = new LocalSigner(
	hexToBytes('0000000000000000000000000000000000000000000000000000000000000003')
);
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';
const CREATED_AT = 1_700_000_000;

describe('clientAuthTemplate', () => {
	it('carries the relay and the challenge', () => {
		expect(clientAuthTemplate(RELAY_URL, 'challenge-1', CREATED_AT)).toEqual({
			kind: CLIENT_AUTH_KIND,
			created_at: CREATED_AT,
			tags: [
				['relay', RELAY_URL],
				['challenge', 'challenge-1']
			],
			content: ''
		});
	});

	it('normalizes http relay URLs into their websocket form', () => {
		const template = clientAuthTemplate('https://relay.example.com', 'challenge-1');

		expect(template.tags).toContainEqual(['relay', RELAY_URL]);
	});
});

describe('createAuthEvent', () => {
	it('signs a NIP-42 event for the challenge', async () => {
		const event = await createAuthEvent(signer, RELAY_URL, 'challenge-1', CREATED_AT);

		expect(event.kind).toBe(CLIENT_AUTH_KIND);
		expect(event.pubkey).toBe(PUBKEY);
		expect(event.content).toBe('');
		expect(event.created_at).toBe(CREATED_AT);
		expect(event.tags).toEqual([
			['relay', RELAY_URL],
			['challenge', 'challenge-1']
		]);
		expect(verifyEvent(event)).toBe(true);
	});

	it('uses the current time when no timestamp is given', async () => {
		const before = Math.floor(Date.now() / 1000);
		const event = await createAuthEvent(signer, RELAY_URL, 'challenge-1');

		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(verifyEvent(event)).toBe(true);
	});
});
