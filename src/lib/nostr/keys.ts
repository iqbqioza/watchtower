import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { bech32 } from '@scure/base';

const SECRET_KEY_BYTES = 32;
const PUBKEY_BYTES = 32;
const PUBKEY_HEX = /^[0-9a-f]{64}$/;

/** Decodes a NIP-19 `nsec1...` string into a 32-byte secret key. */
export function secretKeyFromNsec(nsec: string): Uint8Array {
	const { bytes } = decodeBech32(nsec.trim().toLowerCase(), 'nsec');
	if (bytes.length !== SECRET_KEY_BYTES) {
		throw new Error('nsec must encode a 32-byte secret key');
	}
	assertUsableSecretKey(bytes);
	return bytes;
}

/** Encodes a secret key as a NIP-19 `nsec1...` string. */
export function nsecFromSecretKey(secretKey: Uint8Array): string {
	assertUsableSecretKey(secretKey);
	return bech32.encodeFromBytes('nsec', secretKey);
}

/** Derives the x-only public key (32-byte hex) from a secret key. */
export function pubkeyFromSecretKey(secretKey: Uint8Array): string {
	assertUsableSecretKey(secretKey);
	return bytesToHex(schnorr.getPublicKey(secretKey));
}

/** Encodes a public key as a NIP-19 `npub1...` string. */
export function npubFromPubkey(pubkey: string): string {
	return bech32.encodeFromBytes('npub', pubkeyToBytes(pubkey));
}

/** Decodes a NIP-19 `npub1...` string into a 32-byte hex public key. */
export function pubkeyFromNpub(npub: string): string {
	const { bytes } = decodeBech32(npub.trim().toLowerCase(), 'npub');
	if (bytes.length !== PUBKEY_BYTES) {
		throw new Error('npub must encode a 32-byte public key');
	}
	return bytesToHex(bytes);
}

/** Validates and converts a 64-character hex public key. */
export function pubkeyToBytes(pubkey: string): Uint8Array {
	const value = pubkey.trim().toLowerCase();
	if (!PUBKEY_HEX.test(value)) {
		throw new Error('public key must be 32 bytes of hex');
	}
	return hexToBytes(value);
}

function decodeBech32(
	value: string,
	expectedPrefix: string
): { prefix: string; bytes: Uint8Array } {
	if (!value) {
		throw new Error(`${expectedPrefix} must not be empty`);
	}
	let decoded;
	try {
		decoded = bech32.decodeToBytes(value);
	} catch (cause) {
		throw new Error(`${expectedPrefix} is not valid bech32`, { cause });
	}
	if (decoded.prefix !== expectedPrefix) {
		throw new Error(`expected an ${expectedPrefix} string, got ${decoded.prefix}`);
	}
	return decoded;
}

function assertUsableSecretKey(secretKey: Uint8Array): void {
	if (secretKey.length !== SECRET_KEY_BYTES) {
		throw new Error('secret key must be 32 bytes');
	}
	try {
		schnorr.getPublicKey(secretKey);
	} catch (cause) {
		// Zero or >= the curve order: no valid public key exists.
		throw new Error('secret key is out of range', { cause });
	}
}
