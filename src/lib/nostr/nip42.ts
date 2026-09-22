import { nowSeconds } from './event';
import { normalizeRelayUrl } from './relay-url';
import type { Signer } from './signer';
import type { EventTemplate, NostrEvent } from './types';

/** NIP-42 kind for client authentication events. */
export const CLIENT_AUTH_KIND = 22242;

/**
 * The unsigned NIP-42 event for a challenge. The relay tag must be the
 * websocket URL of the connection.
 */
export function clientAuthTemplate(
	relayUrl: string,
	challenge: string,
	created_at?: number
): EventTemplate {
	return {
		kind: CLIENT_AUTH_KIND,
		created_at: created_at ?? nowSeconds(),
		tags: [
			['relay', normalizeRelayUrl(relayUrl)],
			['challenge', challenge]
		],
		content: ''
	};
}

/** NIP-42 event that proves to a relay that the client holds the key. */
export async function createAuthEvent(
	signer: Signer,
	relayUrl: string,
	challenge: string,
	created_at?: number
): Promise<NostrEvent> {
	return signer.signEvent(clientAuthTemplate(relayUrl, challenge, created_at));
}
