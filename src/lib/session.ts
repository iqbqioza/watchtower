import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { pubkeyFromSecretKey } from './nostr/keys';
import { normalizeRelayUrl } from './nostr/relay-url';
import type { StorageLike } from './storage';

export const SESSION_STORAGE_KEY = 'tower.session';

/** A session as it is kept for the current tab. */
export interface StoredSession {
	secretKey: Uint8Array;
	relayUrl: string;
}

/** Encodes the secret key as hex: sessionStorage only holds strings. */
export function serializeSession(secretKey: Uint8Array, relayUrl: string): string {
	return JSON.stringify({
		secretKey: bytesToHex(secretKey),
		relayUrl: normalizeRelayUrl(relayUrl)
	});
}

/** Reads a stored session, ignoring anything that is malformed or no longer valid. */
export function parseSession(raw: string | null): StoredSession | null {
	if (!raw) return null;
	try {
		const stored = JSON.parse(raw) as { secretKey?: unknown; relayUrl?: unknown };
		if (typeof stored.secretKey !== 'string' || typeof stored.relayUrl !== 'string') {
			return null;
		}
		const secretKey = hexToBytes(stored.secretKey);
		// Rejects wrong lengths and keys outside the curve order.
		pubkeyFromSecretKey(secretKey);
		return { secretKey, relayUrl: normalizeRelayUrl(stored.relayUrl) };
	} catch {
		return null;
	}
}

export type { StorageLike };
