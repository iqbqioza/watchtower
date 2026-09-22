import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { verifyEvent } from './event';
import { CLIENT_AUTH_KIND, createAuthEvent } from './nip42';

// BIP-340 test vector 0 secret key and its public key.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';
const CREATED_AT = 1_700_000_000;

describe('createAuthEvent', () => {
	it('builds a NIP-42 event that carries the relay and the challenge', () => {
		const event = createAuthEvent(SECRET_KEY, RELAY_URL, 'challenge-1', CREATED_AT);

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

	it('normalizes http relay URLs into their websocket form', () => {
		const event = createAuthEvent(SECRET_KEY, 'https://relay.example.com', 'challenge-1');

		expect(event.tags).toContainEqual(['relay', RELAY_URL]);
	});

	it('uses the current time when no timestamp is given', () => {
		const before = Math.floor(Date.now() / 1000);
		const event = createAuthEvent(SECRET_KEY, RELAY_URL, 'challenge-1');

		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(verifyEvent(event)).toBe(true);
	});
});
