import { normalizePubkeyHex } from './nostr/keys';
import { normalizeRelayUrl } from './nostr/relay-url';
import type { StorageLike } from './storage';

export const SESSION_STORAGE_KEY = 'tower.session';

/** Ways this app can sign. The key itself never lives in this app. */
export type SignerKind = 'nip07';

/** A session as it is kept for the current tab. */
export interface StoredSession {
	signer: SignerKind;
	pubkey: string;
	relayUrl: string;
}

/** Stores the account and the relay; no key material. */
export function serializeSession(pubkey: string, relayUrl: string): string {
	return JSON.stringify({
		signer: 'nip07',
		pubkey: normalizePubkeyHex(pubkey),
		relayUrl: normalizeRelayUrl(relayUrl)
	} satisfies StoredSession);
}

/** Reads a stored session, ignoring anything that is malformed or no longer valid. */
export function parseSession(raw: string | null): StoredSession | null {
	if (!raw) return null;
	try {
		const stored = JSON.parse(raw) as { signer?: unknown; pubkey?: unknown; relayUrl?: unknown };
		if (
			stored.signer !== 'nip07' ||
			typeof stored.pubkey !== 'string' ||
			typeof stored.relayUrl !== 'string'
		) {
			return null;
		}
		return {
			signer: 'nip07',
			pubkey: normalizePubkeyHex(stored.pubkey),
			relayUrl: normalizeRelayUrl(stored.relayUrl)
		};
	} catch {
		return null;
	}
}

export type { StorageLike };
