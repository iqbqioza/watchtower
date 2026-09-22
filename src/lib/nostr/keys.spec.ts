import { bytesToHex } from '@noble/hashes/utils.js';
import { bech32 } from '@scure/base';
import { describe, expect, it } from 'vitest';
import {
	nsecFromSecretKey,
	npubFromPubkey,
	pubkeyFromNpub,
	pubkeyFromSecretKey,
	pubkeyToBytes,
	secretKeyFromNsec
} from './keys';

// BIP-340 test vector 0: secret key 3 and its x-only public key.
const SECRET_KEY = '0000000000000000000000000000000000000000000000000000000000000003';
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
// Both bech32 strings were produced by an independent BIP-173 implementation,
// so these tests catch encoding mistakes instead of re-checking the same code.
const NSEC = 'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqps52s3re';
const NPUB = 'npub1lycg5qvjtrp3qjf5f7zl382j9x6nrjz9sdhenvyxq8c3808qxmus6gq266';

describe('secretKeyFromNsec', () => {
	it('decodes a known nsec into the raw 32-byte secret key', () => {
		expect(bytesToHex(secretKeyFromNsec(NSEC))).toBe(SECRET_KEY);
	});

	it('accepts uppercase input and surrounding whitespace', () => {
		expect(bytesToHex(secretKeyFromNsec(`  ${NSEC.toUpperCase()}  `))).toBe(SECRET_KEY);
	});

	it('rejects an npub', () => {
		expect(() => secretKeyFromNsec(NPUB)).toThrow(/expected an nsec string/);
	});

	it('rejects a broken checksum', () => {
		const broken = `${NSEC.slice(0, -1)}q`;
		expect(() => secretKeyFromNsec(broken)).toThrow(/not valid bech32/);
	});

	it('rejects a payload that is not 32 bytes', () => {
		const short = bech32.encodeFromBytes('nsec', new Uint8Array(31));
		expect(() => secretKeyFromNsec(short)).toThrow(/32-byte secret key/);
	});

	it('rejects the zero secret key, which has no public key', () => {
		const zero = bech32.encodeFromBytes('nsec', new Uint8Array(32));
		expect(() => secretKeyFromNsec(zero)).toThrow(/out of range/);
	});

	it('rejects empty input', () => {
		expect(() => secretKeyFromNsec('   ')).toThrow(/must not be empty/);
	});
});

describe('encoding keys', () => {
	it('encodes the secret key back into the same nsec', () => {
		expect(nsecFromSecretKey(secretKeyFromNsec(NSEC))).toBe(NSEC);
	});

	it('derives the public key of the test vector', () => {
		expect(pubkeyFromSecretKey(secretKeyFromNsec(NSEC))).toBe(PUBKEY);
	});

	it('encodes and decodes npub round trip', () => {
		expect(npubFromPubkey(PUBKEY)).toBe(NPUB);
		expect(pubkeyFromNpub(NPUB)).toBe(PUBKEY);
	});

	it('rejects an invalid secret key length', () => {
		expect(() => nsecFromSecretKey(new Uint8Array(31))).toThrow(/32 bytes/);
	});
});

describe('pubkeyToBytes', () => {
	it('accepts hex of either case', () => {
		expect(bytesToHex(pubkeyToBytes(PUBKEY.toUpperCase()))).toBe(PUBKEY);
	});

	it('rejects values that are not 32 bytes of hex', () => {
		expect(() => pubkeyToBytes('deadbeef')).toThrow(/32 bytes of hex/);
		expect(() => pubkeyToBytes(`z${PUBKEY.slice(1)}`)).toThrow(/32 bytes of hex/);
	});
});
