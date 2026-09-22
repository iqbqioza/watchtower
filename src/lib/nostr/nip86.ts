import { createAuthorizationHeader } from './nip98';
import { managementUrl, normalizeRelayUrl } from './relay-url';

/** Content type that relays expect for management calls (NIP-86). */
export const NIP86_CONTENT_TYPE = 'application/nostr+json+rpc';

/** Methods defined by NIP-86. Relays report which of them they support. */
export type Nip86Method =
	| 'supportedmethods'
	| 'banpubkey'
	| 'unbanpubkey'
	| 'listbannedpubkeys'
	| 'allowpubkey'
	| 'unallowpubkey'
	| 'listallowedpubkeys'
	| 'createrole'
	| 'editrole'
	| 'deleterole'
	| 'assignrole'
	| 'unassignrole'
	| 'listeventsneedingmoderation'
	| 'allowevent'
	| 'banevent'
	| 'listbannedevents'
	| 'changerelayname'
	| 'changerelaydescription'
	| 'changerelayicon'
	| 'allowkind'
	| 'disallowkind'
	| 'listallowedkinds'
	| 'blockip'
	| 'unblockip'
	| 'listblockedips';

/** JSON-RPC style request body. */
export interface Nip86Request {
	method: string;
	params: unknown[];
}

/** JSON-RPC style response body. Relays report failures in `error`. */
export interface Nip86Response {
	result?: unknown;
	error?: string;
}

export class Nip86Error extends Error {}
export class Nip86AuthError extends Nip86Error {}

export interface Nip86ClientOptions {
	/** Relay URL as the user typed it; ws(s) or http(s). */
	relayUrl: string;
	secretKey: Uint8Array;
	/** Replaceable for tests. */
	fetch?: typeof globalThis.fetch;
	/** Fixed timestamp for tests; production uses the current time. */
	created_at?: number;
}

export interface Nip86Client {
	call<T = unknown>(method: Nip86Method | string, params?: unknown[]): Promise<T>;
	/** Method names this relay claims to implement. */
	supportedMethods(): Promise<string[]>;
}

/**
 * Calls one management method. The `u` tag carries the relay URL (NIP-86) and
 * the `payload` tag the sha256 of the exact body that is sent.
 */
export async function callNip86<T = unknown>(
	options: Nip86ClientOptions,
	method: Nip86Method | string,
	params: unknown[] = []
): Promise<T> {
	const relayUrl = normalizeRelayUrl(options.relayUrl);
	const body = JSON.stringify({ method, params } satisfies Nip86Request);
	const fetchFn = options.fetch ?? globalThis.fetch;

	const response = await fetchFn(managementUrl(relayUrl), {
		method: 'POST',
		headers: {
			'Content-Type': NIP86_CONTENT_TYPE,
			Authorization: createAuthorizationHeader(options.secretKey, {
				url: relayUrl,
				method: 'POST',
				body,
				created_at: options.created_at
			})
		},
		body
	});

	if (response.status === 401 || response.status === 403) {
		throw new Nip86AuthError(`relay rejected the request (HTTP ${response.status})`);
	}

	const text = await response.text();
	let payload: Nip86Response;
	try {
		payload = JSON.parse(text) as Nip86Response;
	} catch (cause) {
		throw new Nip86Error(`relay returned invalid JSON (HTTP ${response.status})`, { cause });
	}

	// Relays such as khatru answer 200 and put failures into `error`.
	if (typeof payload?.error === 'string' && payload.error !== '') {
		throw new Nip86Error(payload.error);
	}
	if (!response.ok) {
		throw new Nip86Error(`relay returned HTTP ${response.status}`);
	}
	return payload.result as T;
}

/** Client bound to one relay and one admin key. */
export function createNip86Client(options: Nip86ClientOptions): Nip86Client {
	return {
		call: (method, params) => callNip86(options, method, params),
		supportedMethods: () => callNip86<string[]>(options, 'supportedmethods')
	};
}
