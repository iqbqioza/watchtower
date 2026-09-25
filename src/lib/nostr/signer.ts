import { finalizeEvent, getEventId, isNostrEvent, nowSeconds, verifyEvent } from './event';
import { pubkeyFromSecretKey, pubkeyHexFromInput } from './keys';
import type { EventTemplate, NostrEvent } from './types';

/** Anything that can sign events for a fixed account. */
export interface Signer {
	/** Hex public key of the account that signs. */
	getPublicKey(): Promise<string>;
	signEvent(template: EventTemplate): Promise<NostrEvent>;
}

/** The part of `window.nostr` this app uses (NIP-07). */
export interface Nip07Provider {
	getPublicKey(): Promise<string>;
	signEvent(event: EventTemplate): Promise<NostrEvent>;
	/** Set by window.nostr.js, the in-page fallback signer; extensions omit it. */
	isWnj?: boolean;
}

/** The browser extension, or null when none is installed. */
export function browserNostrProvider(): Nip07Provider | null {
	const candidate = (globalThis as { nostr?: Partial<Nip07Provider> }).nostr;
	if (typeof candidate?.getPublicKey === 'function' && typeof candidate?.signEvent === 'function') {
		return candidate as Nip07Provider;
	}
	return null;
}

/** True when `window.nostr` comes from window.nostr.js rather than an extension. */
export function isFallbackProvider(
	provider: Nip07Provider | null = browserNostrProvider()
): boolean {
	return provider?.isWnj === true;
}

/**
 * window.nostr.js mounts a floating widget and takes over `window.nostr`. It
 * steps aside when the extension assigns the property, but extensions that
 * redefine it leave the widget behind, so ask the library to tear the widget
 * down whenever the provider in use is not its own.
 */
export function releaseFallbackWidget(): void {
	const teardown = (globalThis as { destroyWnj?: unknown }).destroyWnj;
	if (typeof teardown !== 'function' || isFallbackProvider()) return;
	try {
		(teardown as () => void)();
	} catch {
		// The widget was already gone.
	}
}

/**
 * Extensions differ in what they resolve with: the event itself, the event as
 * a JSON string, or a wrapper around it. The signature is verified afterwards,
 * so unwrapping is safe.
 */
function coerceSignedEvent(value: unknown): NostrEvent | null {
	if (isNostrEvent(value)) return value;

	if (typeof value === 'string') {
		try {
			const parsed: unknown = JSON.parse(value);
			return isNostrEvent(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}

	if (typeof value === 'object' && value !== null && 'event' in value) {
		const inner = (value as { event?: unknown }).event;
		return isNostrEvent(inner) ? inner : null;
	}

	return recoverSignedEvent(value);
}

/** How far around the current time to look for a dropped timestamp. */
const TIMESTAMP_SEARCH_SECONDS = 300;

/**
 * Some extensions answer without `created_at`. The id commits to the
 * timestamp, so it can be recovered by trying the seconds around now.
 */
function recoverSignedEvent(value: unknown): NostrEvent | null {
	if (typeof value !== 'object' || value === null) return null;
	const event = value as Record<string, unknown>;
	if (
		typeof event.id !== 'string' ||
		typeof event.pubkey !== 'string' ||
		typeof event.sig !== 'string' ||
		typeof event.kind !== 'number' ||
		typeof event.content !== 'string' ||
		!Array.isArray(event.tags)
	) {
		return null;
	}

	const now = nowSeconds();
	for (let offset = 0; offset <= TIMESTAMP_SEARCH_SECONDS; offset++) {
		for (const created_at of offset === 0 ? [now] : [now - offset, now + offset]) {
			const candidate = { ...event, created_at } as unknown as NostrEvent;
			if (getEventId(candidate) === event.id) {
				return candidate;
			}
		}
	}
	return null;
}

/** Shape summary for error messages: signed events are public data. */
function describeValue(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value !== 'object') return typeof value;
	const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
	return `{ ${entries
		.map(([key, entry]) => `${key}: ${entry === null ? 'null' : typeof entry}`)
		.join(', ')} }`;
}

/** Signs with a browser extension. The key never reaches this page. */
export class Nip07Signer implements Signer {
	#provider: Nip07Provider;
	#expectedPubkey: string | null;
	#onActivity: ((pending: boolean) => void) | undefined;

	constructor(
		provider: Nip07Provider,
		expectedPubkey: string | null = null,
		onActivity?: (pending: boolean) => void
	) {
		this.#provider = provider;
		this.#expectedPubkey = expectedPubkey;
		this.#onActivity = onActivity;
	}

	async getPublicKey(): Promise<string> {
		this.#onActivity?.(true);
		try {
			const returned: unknown = await this.#provider.getPublicKey();
			if (typeof returned !== 'string') {
				throw new Error('the browser extension did not return a public key');
			}
			// Extensions should answer with hex, but npub is accepted as well.
			return pubkeyHexFromInput(returned);
		} finally {
			this.#onActivity?.(false);
		}
	}

	async signEvent(template: EventTemplate): Promise<NostrEvent> {
		this.#onActivity?.(true);
		try {
			const returned: unknown = await this.#provider.signEvent({
				kind: template.kind,
				created_at: template.created_at ?? nowSeconds(),
				tags: template.tags ?? [],
				content: template.content ?? ''
			});

			if (returned === null || returned === undefined) {
				throw new Error('the browser extension did not approve the request');
			}

			const signed = coerceSignedEvent(returned);
			if (!signed) {
				throw new Error(
					`the browser extension returned something that is not a signed event (${describeValue(returned)})`
				);
			}
			if (!verifyEvent(signed)) {
				throw new Error('the browser extension returned an event with an invalid signature');
			}
			if (this.#expectedPubkey !== null && signed.pubkey.toLowerCase() !== this.#expectedPubkey) {
				throw new Error('the browser extension now signs with a different key; sign in again');
			}
			return signed;
		} finally {
			this.#onActivity?.(false);
		}
	}
}

/** Signs in this page; used by tests and by tools that run without a browser. */
export class LocalSigner implements Signer {
	#secretKey: Uint8Array;

	constructor(secretKey: Uint8Array) {
		this.#secretKey = secretKey;
	}

	async getPublicKey(): Promise<string> {
		return pubkeyFromSecretKey(this.#secretKey);
	}

	async signEvent(template: EventTemplate): Promise<NostrEvent> {
		return finalizeEvent(this.#secretKey, template);
	}
}
