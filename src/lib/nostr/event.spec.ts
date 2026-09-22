import { createHash } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { finalizeEvent, getEventId, serializeEvent, signSchnorr, verifyEvent } from './event';

// BIP-340 test vector 0: secret key 3, message 32 zero bytes, zero auxiliary randomness.
const SECRET_KEY = '0000000000000000000000000000000000000000000000000000000000000003';
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const VECTOR_MESSAGE = '00'.repeat(32);
const VECTOR_SIGNATURE =
	'e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca821525f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0';

const secretKey = hexToBytes(SECRET_KEY);

describe('signSchnorr', () => {
	it('matches the BIP-340 test vector when auxiliary randomness is zeroed', () => {
		const signature = signSchnorr(hexToBytes(VECTOR_MESSAGE), secretKey, new Uint8Array(32));
		expect(signature).toBe(VECTOR_SIGNATURE);
	});
});

describe('serializeEvent', () => {
	it('is the NIP-01 array with no extra whitespace', () => {
		const serialized = serializeEvent({
			pubkey: PUBKEY,
			created_at: 1_700_000_000,
			kind: 1,
			tags: [['t', 'tower']],
			content: 'hello'
		});
		expect(serialized).toBe(
			'[0,"f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",1700000000,1,[["t","tower"]],"hello"]'
		);
	});

	it('keeps multi-byte characters as UTF-8', () => {
		const serialized = serializeEvent({
			pubkey: PUBKEY,
			created_at: 1,
			kind: 1,
			tags: [],
			content: '塔'
		});
		expect(Buffer.from(serialized, 'utf8').toString('utf8')).toBe(serialized);
		expect(serialized).toContain('塔');
	});
});

describe('getEventId', () => {
	it('is the sha256 of the canonical serialization', () => {
		const event = {
			pubkey: PUBKEY,
			created_at: 1_700_000_000,
			kind: 1,
			tags: [['t', 'tower']],
			content: 'hello'
		};
		const expected = createHash('sha256').update(serializeEvent(event), 'utf8').digest('hex');
		expect(getEventId(event)).toBe(expected);
	});
});

describe('finalizeEvent', () => {
	it('fills in the public key, id, signature and defaults', () => {
		const before = Math.floor(Date.now() / 1000);
		const event = finalizeEvent(secretKey, { kind: 1, content: 'hello' });

		expect(event.pubkey).toBe(PUBKEY);
		expect(event.kind).toBe(1);
		expect(event.content).toBe('hello');
		expect(event.tags).toEqual([]);
		expect(event.id).toBe(getEventId(event));
		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(event.created_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
		expect(
			schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey))
		).toBe(true);
	});

	it('keeps the given created_at and tags', () => {
		const event = finalizeEvent(secretKey, {
			kind: 27235,
			created_at: 1,
			tags: [['u', 'wss://relay.example.com/']]
		});
		expect(event.created_at).toBe(1);
		expect(event.tags).toEqual([['u', 'wss://relay.example.com/']]);
		expect(event.content).toBe('');
	});
});

describe('verifyEvent', () => {
	it('accepts a freshly signed event', () => {
		expect(verifyEvent(finalizeEvent(secretKey, { kind: 1, content: 'hello' }))).toBe(true);
	});

	it('rejects tampered content', () => {
		const event = finalizeEvent(secretKey, { kind: 1, content: 'hello' });
		expect(verifyEvent({ ...event, content: 'goodbye' })).toBe(false);
	});

	it('rejects a signature for a different message', () => {
		const event = finalizeEvent(secretKey, { kind: 1, content: 'hello' });
		expect(verifyEvent({ ...event, sig: VECTOR_SIGNATURE })).toBe(false);
	});

	it('rejects malformed hex instead of throwing', () => {
		const event = finalizeEvent(secretKey, { kind: 1, content: 'hello' });
		expect(verifyEvent({ ...event, sig: 'not-hex' })).toBe(false);
		expect(bytesToHex(hexToBytes(event.id))).toBe(event.id);
	});
});
