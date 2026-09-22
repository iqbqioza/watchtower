import { base64 } from '@scure/base';
import { bytesToHex, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { finalizeEvent } from './event';
import { sha256Hex } from './hash';
import type { NostrEvent } from './types';

/** NIP-98 HTTP Auth event kind. */
export const HTTP_AUTH_KIND = 27235;

/** Details of the HTTP request an authorization header is created for. */
export interface HttpAuthRequest {
	/** Absolute URL of the request, put into the `u` tag. */
	url: string;
	/** HTTP method, put into the `method` tag. */
	method: string;
	/** Exact request body; hashed into the `payload` tag when present. */
	body?: string;
	created_at?: number;
	/** Fixed nonce for tests; production uses random bytes. */
	nonce?: string;
}

/** NIP-98 event that authorizes one HTTP request. */
export function createHttpAuthEvent(secretKey: Uint8Array, request: HttpAuthRequest): NostrEvent {
	const tags = [
		['u', request.url],
		['method', request.method.toUpperCase()]
	];
	if (request.body !== undefined) {
		tags.push(['payload', sha256Hex(request.body)]);
	}
	// Relays that remember used auth events answer 401 when the same event is
	// sent twice, and two calls in the same second would otherwise share an id.
	tags.push(['nonce', request.nonce ?? bytesToHex(randomBytes(8))]);
	return finalizeEvent(secretKey, {
		kind: HTTP_AUTH_KIND,
		created_at: request.created_at,
		tags,
		content: ''
	});
}

/** `Authorization` header value: the signed event, base64 encoded after `Nostr `. */
export function createAuthorizationHeader(secretKey: Uint8Array, request: HttpAuthRequest): string {
	const event = createHttpAuthEvent(secretKey, request);
	return `Nostr ${base64.encode(utf8ToBytes(JSON.stringify(event)))}`;
}
