import { npubFromPubkey, pubkeyFromSecretKey } from './nostr/keys';
import { normalizeRelayUrl } from './nostr/relay-url';
import {
	browserStorage,
	parseSession,
	SESSION_STORAGE_KEY,
	serializeSession,
	type StorageLike
} from './session';

/**
 * Session of the current tab: the secret key behind the logged in nsec and the
 * relay it manages. The key is kept in sessionStorage, so it survives reloads
 * and disappears when the tab is closed.
 */
export class SessionStore {
	secretKey = $state<Uint8Array | null>(null);
	relayUrl = $state('');
	#storage: StorageLike | null;
	#restored = false;

	constructor(storage: StorageLike | null = browserStorage()) {
		this.#storage = storage;
	}

	/** Loads the stored session once; later calls do nothing. */
	restore(): void {
		if (this.#restored) return;
		this.#restored = true;
		const stored = parseSession(this.#storage?.getItem(SESSION_STORAGE_KEY) ?? null);
		if (!stored) return;
		this.secretKey = stored.secretKey;
		this.relayUrl = stored.relayUrl;
	}

	/** Validates the key and the relay URL, then keeps them for this tab. */
	signIn(secretKey: Uint8Array, relayUrl: string): void {
		// Both throw before anything is changed when the input is unusable.
		pubkeyFromSecretKey(secretKey);
		const normalized = normalizeRelayUrl(relayUrl);

		this.secretKey = secretKey;
		this.relayUrl = normalized;
		try {
			this.#storage?.setItem(SESSION_STORAGE_KEY, serializeSession(secretKey, normalized));
		} catch {
			// Private mode or a full quota: the in-memory session still works.
		}
	}

	signOut(): void {
		this.secretKey = null;
		this.relayUrl = '';
		try {
			this.#storage?.removeItem(SESSION_STORAGE_KEY);
		} catch {
			// The in-memory session is already gone, which is what matters.
		}
	}

	/** Hex public key of the logged in user. */
	get pubkey(): string | null {
		return this.secretKey ? pubkeyFromSecretKey(this.secretKey) : null;
	}

	/** NIP-19 form of the public key, for display. */
	get npub(): string | null {
		const pubkey = this.pubkey;
		return pubkey ? npubFromPubkey(pubkey) : null;
	}

	get isAuthenticated(): boolean {
		return this.secretKey !== null && this.relayUrl !== '';
	}
}

export const session = new SessionStore();
