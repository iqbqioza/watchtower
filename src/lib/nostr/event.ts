import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { sha256Hex } from './hash';
import type { EventTemplate, NostrEvent, SerializableEvent } from './types';

/**
 * NIP-01 canonical serialization. The id is the sha256 of exactly this string,
 * so it must stay identical to what relays hash.
 */
export function serializeEvent(event: SerializableEvent): string {
	return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
}

/** NIP-01 event id: sha256 of the canonical serialization, as lowercase hex. */
export function getEventId(event: SerializableEvent): string {
	return sha256Hex(serializeEvent(event));
}

/**
 * BIP-340 schnorr signature over a 32-byte message hash.
 * `auxRandom` is only passed by tests that need the spec's deterministic output;
 * production signing uses fresh randomness from the noble CSPRNG.
 */
export function signSchnorr(
	messageHash: Uint8Array,
	secretKey: Uint8Array,
	auxRandom?: Uint8Array
): string {
	return bytesToHex(schnorr.sign(messageHash, secretKey, auxRandom));
}

/** Fills in pubkey, created_at, id and sig to produce a signed event. */
export function finalizeEvent(secretKey: Uint8Array, template: EventTemplate): NostrEvent {
	const event: SerializableEvent = {
		pubkey: bytesToHex(schnorr.getPublicKey(secretKey)),
		created_at: template.created_at ?? Math.floor(Date.now() / 1000),
		kind: template.kind,
		tags: template.tags ?? [],
		content: template.content ?? ''
	};
	const id = getEventId(event);
	return { ...event, id, sig: signSchnorr(hexToBytes(id), secretKey) };
}

/** Checks the id and the schnorr signature. Malformed input counts as invalid. */
export function verifyEvent(event: NostrEvent): boolean {
	try {
		if (getEventId(event) !== event.id) return false;
		return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
	} catch {
		return false;
	}
}
