import { describe, expect, it } from 'vitest';
import { parseSession, serializeSession } from './session';

const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';

describe('serializeSession', () => {
	it('stores the account and the relay, without any key material', () => {
		const stored = serializeSession(PUBKEY.toUpperCase(), ' https://relay.example.com ');

		expect(JSON.parse(stored)).toEqual({
			signer: 'nip07',
			pubkey: PUBKEY,
			relayUrl: RELAY_URL
		});
		expect(stored).not.toContain('secret');
	});

	it('rejects keys and relay URLs that cannot be used', () => {
		expect(() => serializeSession('nope', RELAY_URL)).toThrow(/32 bytes of hex/);
		expect(() => serializeSession(PUBKEY, 'not-a-url')).toThrow(/not a valid URL/);
	});
});

describe('parseSession', () => {
	it('round trips a stored session', () => {
		expect(parseSession(serializeSession(PUBKEY, RELAY_URL))).toEqual({
			signer: 'nip07',
			pubkey: PUBKEY,
			relayUrl: RELAY_URL
		});
	});

	it('converts http relay URLs into their websocket form', () => {
		const raw = JSON.stringify({
			signer: 'nip07',
			pubkey: PUBKEY,
			relayUrl: 'https://relay.example.com'
		});

		expect(parseSession(raw)?.relayUrl).toBe(RELAY_URL);
	});

	it('ignores malformed sessions and the old nsec format', () => {
		expect(parseSession(null)).toBeNull();
		expect(parseSession('')).toBeNull();
		expect(parseSession('{')).toBeNull();
		// Sessions of the nsec era stored a secret key and must not be trusted.
		expect(parseSession(JSON.stringify({ secretKey: PUBKEY, relayUrl: RELAY_URL }))).toBeNull();
		expect(
			parseSession(JSON.stringify({ signer: 'nsec', pubkey: PUBKEY, relayUrl: RELAY_URL }))
		).toBeNull();
		expect(
			parseSession(JSON.stringify({ signer: 'nip07', pubkey: 'nope', relayUrl: RELAY_URL }))
		).toBeNull();
		expect(
			parseSession(
				JSON.stringify({ signer: 'nip07', pubkey: PUBKEY, relayUrl: 'ftp://relay.example.com' })
			)
		).toBeNull();
	});
});
