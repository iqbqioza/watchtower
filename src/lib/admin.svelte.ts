import {
	Nip86AuthError,
	createNip86Client,
	type Nip86Client,
	type Nip86Method
} from './nostr/nip86';
import { session } from './session.svelte.js';

/** Turns errors from the management API into something a person can act on. */
export function describeError(cause: unknown): string {
	if (cause instanceof Nip86AuthError) {
		return `${cause.message}. Check that this key is allowed to manage the relay.`;
	}
	return cause instanceof Error ? cause.message : String(cause);
}

/** State shared by the management screens: the client and its method list. */
class AdminStore {
	methods = $state<string[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	#loadedFor: string | null = null;

	get client(): Nip86Client | null {
		const signer = session.signer;
		if (!signer) return null;
		return createNip86Client({ relayUrl: session.relayUrl, signer });
	}

	supports(method: Nip86Method | string): boolean {
		return this.methods.includes(method);
	}

	/** Loads the method list when needed; false when the relay cannot be asked. */
	async ensure(): Promise<boolean> {
		await this.load();
		return this.error === null && this.methods.length > 0;
	}

	/** Asks the relay which methods it supports. Cached per relay and key. */
	async load(force = false): Promise<void> {
		const client = this.client;
		if (!client) return;

		const key = `${session.relayUrl}|${session.pubkey ?? ''}`;
		if (!force && this.#loadedFor === key) return;

		this.loading = true;
		this.error = null;
		try {
			this.methods = await client.supportedMethods();
			this.#loadedFor = key;
		} catch (cause) {
			this.methods = [];
			this.#loadedFor = null;
			this.error = describeError(cause);
		} finally {
			this.loading = false;
		}
	}

	async call<T>(method: Nip86Method | string, params: unknown[] = []): Promise<T> {
		const client = this.client;
		if (!client) throw new Error('not signed in to a relay');
		return client.call<T>(method, params);
	}
}

export const admin = new AdminStore();
