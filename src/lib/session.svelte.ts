import { npubFromPubkey } from './nostr/keys';
import { normalizeRelayUrl } from './nostr/relay-url';
import { browserNostrProvider, Nip07Signer, type Nip07Provider, type Signer } from './nostr/signer';
import { parseSession, SESSION_STORAGE_KEY, serializeSession } from './session';
import { signerActivity } from './signer-activity.svelte.js';
import { browserStorage, type StorageLike } from './storage';

/**
 * Session of the current tab: which account signs and which relay it manages.
 * The key stays in the browser extension (NIP-07) and never reaches this page.
 */
export class SessionStore {
	pubkey = $state<string | null>(null);
	relayUrl = $state('');
	#storage: StorageLike | null;
	#provider: () => Nip07Provider | null;
	#restored = false;

	constructor(
		storage: StorageLike | null = browserStorage('session'),
		provider: () => Nip07Provider | null = browserNostrProvider
	) {
		this.#storage = storage;
		this.#provider = provider;
	}

	/** Loads the stored session once; later calls do nothing. */
	restore(): void {
		if (this.#restored) return;
		this.#restored = true;
		const stored = parseSession(this.#storage?.getItem(SESSION_STORAGE_KEY) ?? null);
		if (!stored) return;
		this.pubkey = stored.pubkey;
		this.relayUrl = stored.relayUrl;
	}

	/** Asks the browser extension for its key and keeps it for this tab. */
	async signIn(relayUrl: string): Promise<void> {
		const provider = this.#provider();
		if (!provider) {
			throw new Error('no NIP-07 browser extension was found');
		}

		const pubkey = await this.#signer(provider).getPublicKey();
		const normalized = normalizeRelayUrl(relayUrl);

		this.pubkey = pubkey;
		this.relayUrl = normalized;
		try {
			this.#storage?.setItem(SESSION_STORAGE_KEY, serializeSession(pubkey, normalized));
		} catch {
			// Private mode or a full quota: the in-memory session still works.
		}
	}

	signOut(): void {
		this.pubkey = null;
		this.relayUrl = '';
		try {
			this.#storage?.removeItem(SESSION_STORAGE_KEY);
		} catch {
			// The in-memory session is already gone, which is what matters.
		}
	}

	/** Signer for the account of this session, or null when it cannot sign. */
	get signer(): Signer | null {
		const pubkey = this.pubkey;
		const provider = this.#provider();
		if (!pubkey || !provider) return null;
		return this.#signer(provider, pubkey);
	}

	/** Wraps the extension so the UI can show that a prompt is open. */
	#signer(provider: Nip07Provider, expectedPubkey: string | null = null): Nip07Signer {
		return new Nip07Signer(provider, expectedPubkey, (pending) => {
			if (pending) signerActivity.begin();
			else signerActivity.end();
		});
	}

	/** NIP-19 form of the public key, for display. */
	get npub(): string | null {
		return this.pubkey ? npubFromPubkey(this.pubkey) : null;
	}

	get isAuthenticated(): boolean {
		return this.pubkey !== null && this.relayUrl !== '';
	}
}

export const session = new SessionStore();
