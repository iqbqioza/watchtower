import { createAuthEvent } from './nostr/nip42';
import { RelayClient, type RelayClientOptions } from './nostr/relay';
import { session } from './session.svelte.js';

export type RelayConnectionStatus =
	'offline' | 'connecting' | 'connected' | 'authenticated' | 'failed';

type ClientFactory = (url: string, options: RelayClientOptions) => RelayClient;

/**
 * One websocket connection for the whole admin panel. It is opened as soon as
 * the panel mounts, reconnects by itself and signs NIP-42 challenges.
 */
export class RelayConnection {
	status = $state<RelayConnectionStatus>('offline');
	/** Last NOTICE from the relay, such as a rate limit warning. */
	notice = $state<string | null>(null);
	#client: RelayClient | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#key = '';
	#factory: ClientFactory;
	#retryDelayMs: number;

	constructor(
		factory: ClientFactory = (url, options) => new RelayClient(url, options),
		retryDelayMs = 5000
	) {
		this.#factory = factory;
		this.#retryDelayMs = retryDelayMs;
	}

	/** The connection to use for subscriptions, or null while it is down. */
	get client(): RelayClient | null {
		return this.#client?.connected ? this.#client : null;
	}

	/** Connects for the current session; does nothing while already connected. */
	start(): void {
		const secretKey = session.secretKey;
		if (!session.isAuthenticated || !secretKey) {
			this.stop();
			return;
		}

		const key = `${session.relayUrl}|${session.pubkey ?? ''}`;
		if (
			this.#client &&
			this.#key === key &&
			this.status !== 'offline' &&
			this.status !== 'failed'
		) {
			return;
		}

		this.#dispose();
		this.#key = key;
		const relayUrl = session.relayUrl;
		const client = this.#factory(relayUrl, {
			// NIP-42: the relay asks before it sends anything.
			auth: (challenge) => createAuthEvent(secretKey, relayUrl, challenge),
			onAuth: (state) => {
				if (this.#client !== client) return;
				if (state === 'ok') this.status = 'authenticated';
				else if (state === 'failed') this.status = 'failed';
			},
			onNotice: (message) => (this.notice = message),
			onDisconnect: () => {
				if (this.#client === client) this.#scheduleRetry();
			}
		});

		this.#client = client;
		this.status = 'connecting';
		client.connect().then(
			() => {
				if (this.#client === client && this.status === 'connecting') {
					this.status = 'connected';
				}
			},
			() => {
				if (this.#client === client) this.#scheduleRetry();
			}
		);
	}

	/** Closes the connection, for example when signing out. */
	stop(): void {
		this.#dispose();
	}

	#dispose(): void {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		const client = this.#client;
		this.#client = null;
		this.#key = '';
		client?.close();
		this.status = 'offline';
	}

	#scheduleRetry(): void {
		this.status = 'offline';
		if (this.#timer !== null) return;
		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.start();
		}, this.#retryDelayMs);
	}
}

export const relayConnection = new RelayConnection();
