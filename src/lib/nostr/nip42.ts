import { finalizeEvent } from './event';
import { normalizeRelayUrl } from './relay-url';
import type { NostrEvent } from './types';

/** NIP-42 kind for client authentication events. */
export const CLIENT_AUTH_KIND = 22242;

/**
 * NIP-42 event that proves to a relay that the client holds the key.
 * The relay tag must be the websocket URL of the connection.
 */
export function createAuthEvent(
	secretKey: Uint8Array,
	relayUrl: string,
	challenge: string,
	created_at?: number
): NostrEvent {
	return finalizeEvent(secretKey, {
		kind: CLIENT_AUTH_KIND,
		created_at,
		tags: [
			['relay', normalizeRelayUrl(relayUrl)],
			['challenge', challenge]
		],
		content: ''
	});
}
