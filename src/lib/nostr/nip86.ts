import { createAuthorizationHeader } from './nip98';
import { normalizeRelayUrl, relayHttpUrl } from './relay-url';
import type { Signer } from './signer';

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
	| 'listblockedips'
	// Relays that follow NIP-86 PR #2439 ("assign/unassign method") and the
	// companion additions report these as well.
	| 'assignmethod'
	| 'unassignmethod'
	| 'listmethodassignees'
	| 'unbanevent'
	| 'unallowevent'
	| 'listallowedevents'
	| 'listdisallowedkinds'
	| 'listclaims'
	| 'createclaim'
	| 'deleteclaim';

/**
 * Methods an ordinary pubkey can be granted with `assignmethod`: the
 * moderation verbs and the read-only lists. Permission management, roles and
 * invite claims stay with the relay admins.
 */
export const GRANTABLE_METHODS: Nip86Method[] = [
	'banpubkey',
	'unbanpubkey',
	'listbannedpubkeys',
	'allowpubkey',
	'unallowpubkey',
	'listallowedpubkeys',
	'allowkind',
	'disallowkind',
	'listallowedkinds',
	'listdisallowedkinds',
	'blockip',
	'unblockip',
	'listblockedips',
	'banevent',
	'allowevent',
	'unallowevent',
	'unbanevent',
	'listbannedevents',
	'listallowedevents',
	'listeventsneedingmoderation'
];

/** The longest invite claim relays accept. */
export const MAX_CLAIM_LENGTH = 128;

export function isGrantableMethod(method: string): boolean {
	return (GRANTABLE_METHODS as string[]).includes(method);
}

/**
 * Checks an invite claim the way relays do: not empty, no leading or trailing
 * whitespace, no control characters and at most 128 characters. The claim is
 * returned untouched, because relays match it exactly.
 */
export function validateClaim(claim: string): string {
	if (claim.trim() === '') {
		throw new Error('the claim must not be empty');
	}
	if (claim !== claim.trim()) {
		throw new Error('the claim must not start or end with whitespace');
	}
	if ([...claim].length > MAX_CLAIM_LENGTH) {
		throw new Error(`the claim must be at most ${MAX_CLAIM_LENGTH} characters`);
	}
	if ([...claim].some(isControlCharacter)) {
		throw new Error('the claim must not contain control characters');
	}
	return claim;
}

/** Matches Rust's `char::is_control()`: C0, DEL and C1. */
function isControlCharacter(character: string): boolean {
	const code = character.codePointAt(0) ?? 0;
	return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
}

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
/** The relay does not answer NIP-86 requests at this address at all. */
export class Nip86UnsupportedError extends Nip86Error {}

export interface Nip86ClientOptions {
	/** Relay URL as the user typed it; ws(s) or http(s). */
	relayUrl: string;
	signer: Signer;
	/** Replaceable for tests. */
	fetch?: typeof globalThis.fetch;
	/** Fixed timestamp for tests; production uses the current time. */
	created_at?: number;
	/** How long to wait for the relay; defaults to 15 seconds. */
	timeoutMs?: number;
	/** Own abort signal; replaces the default timeout. */
	signal?: AbortSignal;
}

export interface Nip86Client {
	call<T = unknown>(method: Nip86Method | string, params?: unknown[]): Promise<T>;
	/** Method names this relay claims to implement. */
	supportedMethods(): Promise<string[]>;
}

/**
 * Calls one management method. The `payload` tag commits to the exact body that
 * is sent. The `u` tag follows NIP-98 (the absolute request URL); relays that
 * only accept the websocket form get a second try before giving up.
 */
export async function callNip86<T = unknown>(
	options: Nip86ClientOptions,
	method: Nip86Method | string,
	params: unknown[] = []
): Promise<T> {
	const relayUrl = normalizeRelayUrl(options.relayUrl);
	const endpoint = relayHttpUrl(relayUrl);
	const body = JSON.stringify({ method, params } satisfies Nip86Request);
	const fetchFn = options.fetch ?? globalThis.fetch;
	const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 15_000);

	async function send(uTag: string): Promise<Response> {
		try {
			return await fetchFn(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': NIP86_CONTENT_TYPE,
					Authorization: await createAuthorizationHeader(options.signer, {
						url: uTag,
						method: 'POST',
						body,
						created_at: options.created_at
					})
				},
				body,
				signal
			});
		} catch (cause) {
			throw new Nip86Error(describeTransportFailure(cause), { cause });
		}
	}

	/** Relays often explain a rejection in the body; keep that for the message. */
	async function reasonOf(response: Response): Promise<string> {
		const text = await response.text().catch(() => '');
		if (!text) return '';
		try {
			const payload: unknown = JSON.parse(text);
			if (typeof payload === 'object' && payload !== null) {
				const error = (payload as { error?: unknown }).error;
				if (typeof error === 'string' && error !== '') return `: ${error}`;
			}
		} catch {
			// Not JSON: fall through to the raw text.
		}
		const detail = text.trim().slice(0, 120);
		return detail ? `: ${detail}` : '';
	}

	let response = await send(endpoint);
	if (response.status === 401 || response.status === 403) {
		// NIP-86 calls the u tag "the relay URL", so some relays compare it
		// against the websocket URL instead of the request URL.
		const firstReason = await reasonOf(response);
		response = await send(relayUrl);
		if (response.status === 401 || response.status === 403) {
			const reason = (await reasonOf(response)) || firstReason;
			throw new Nip86AuthError(`relay rejected the request (HTTP ${response.status})${reason}`);
		}
	}

	if (response.status === 404 || response.status === 405) {
		throw new Nip86UnsupportedError(
			`the relay has no management API at this address (HTTP ${response.status})`
		);
	}

	const text = await response.text();
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch (cause) {
		throw new Nip86UnsupportedError(`the relay returned invalid JSON (HTTP ${response.status})`, {
			cause
		});
	}
	if (typeof payload !== 'object' || payload === null) {
		throw new Nip86UnsupportedError(
			`the relay returned ${text.trim().slice(0, 60) || 'an empty body'} instead of a NIP-86 response (HTTP ${response.status})`
		);
	}

	// Relays such as khatru answer 200 and put failures into `error`.
	const { result, error } = payload as Nip86Response;
	if (typeof error === 'string' && error !== '') {
		if (/not supported|not known|unknown method/i.test(error)) {
			throw new Nip86UnsupportedError(error);
		}
		throw new Nip86Error(error);
	}
	if (!response.ok) {
		throw new Nip86Error(`relay returned HTTP ${response.status}`);
	}
	// A NIP-86 response always carries `result` or `error`; anything else is some
	// other endpoint answering on the same address.
	if (!('result' in payload)) {
		throw new Nip86UnsupportedError('the relay did not answer as a NIP-86 endpoint');
	}
	return result as T;
}

/** Turns fetch failures into something a person can read. */
function describeTransportFailure(cause: unknown): string {
	const message = cause instanceof Error ? cause.message : String(cause);
	if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
		return 'the relay did not answer in time';
	}
	return `could not reach the relay: ${message}`;
}

/** Client bound to one relay and one admin key. */
export function createNip86Client(options: Nip86ClientOptions): Nip86Client {
	return {
		call: (method, params) => callNip86(options, method, params),
		supportedMethods: () => callNip86<string[]>(options, 'supportedmethods')
	};
}
