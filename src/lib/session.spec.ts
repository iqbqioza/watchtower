import { hexToBytes } from '@noble/hashes/utils.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { parseSession, serializeSession } from './session';

// BIP-340 test vector 0 secret key.
const SECRET_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000003';
const SECRET_KEY = hexToBytes(SECRET_KEY_HEX);
const RELAY_URL = 'wss://relay.example.com/';

describe('serializeSession', () => {
	it('stores the secret key as hex and the normalized relay URL', () => {
		expect(JSON.parse(serializeSession(SECRET_KEY, ' https://relay.example.com '))).toEqual({
			secretKey: SECRET_KEY_HEX,
			relayUrl: RELAY_URL
		});
	});

	it('refuses to store a session with an invalid relay URL', () => {
		expect(() => serializeSession(SECRET_KEY, 'not-a-url')).toThrow(/not a valid URL/);
	});
});

describe('parseSession', () => {
	it('round trips a stored session', () => {
		const parsed = parseSession(serializeSession(SECRET_KEY, RELAY_URL));
		expect(parsed && bytesToHex(parsed.secretKey)).toBe(SECRET_KEY_HEX);
		expect(parsed?.relayUrl).toBe(RELAY_URL);
	});

	it('converts http relay URLs into their websocket form', () => {
		const raw = JSON.stringify({
			secretKey: SECRET_KEY_HEX,
			relayUrl: 'https://relay.example.com'
		});
		expect(parseSession(raw)?.relayUrl).toBe(RELAY_URL);
	});

	it('returns null for missing, malformed or invalid sessions', () => {
		expect(parseSession(null)).toBeNull();
		expect(parseSession('')).toBeNull();
		expect(parseSession('{')).toBeNull();
		expect(parseSession(JSON.stringify({ relayUrl: RELAY_URL }))).toBeNull();
		expect(parseSession(JSON.stringify({ secretKey: SECRET_KEY_HEX }))).toBeNull();
		expect(parseSession(JSON.stringify({ secretKey: 'nope', relayUrl: RELAY_URL }))).toBeNull();
		expect(
			parseSession(
				JSON.stringify({ secretKey: SECRET_KEY_HEX, relayUrl: 'ftp://relay.example.com' })
			)
		).toBeNull();
		// The all-zero key has no public key, so a stored session that holds it is unusable.
		expect(
			parseSession(JSON.stringify({ secretKey: '00'.repeat(32), relayUrl: RELAY_URL }))
		).toBeNull();
	});
});
