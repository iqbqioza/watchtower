import { parseRelayMessage } from './relay-message';
import { normalizeRelayUrl } from './relay-url';
import type { NostrEvent, NostrFilter } from './types';

const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

/** Replaceable for tests. */
export type WebSocketFactory = (url: string) => WebSocket;

export interface RelayClientOptions {
	WebSocket?: WebSocketFactory;
	/** Warnings from the relay, such as rate limits. */
	onNotice?: (message: string) => void;
	/** Called when the connection drops without an explicit close. */
	onDisconnect?: (reason: string) => void;
	/**
	 * Signs a NIP-42 challenge. Without it the client stays anonymous and the
	 * relay may refuse to send events.
	 */
	auth?: (challenge: string) => NostrEvent | null | Promise<NostrEvent | null>;
	/** How the relay reacted to our authentication event. */
	onAuth?: (state: 'required' | 'ok' | 'failed') => void;
}

export interface SubscriptionHandlers {
	onEvent?: (event: NostrEvent) => void;
	/** End of stored events: everything older is now being streamed live. */
	onEose?: () => void;
	/** The relay refused or ended the subscription. */
	onClosed?: (message: string) => void;
}

export interface RelaySubscription {
	readonly id: string;
	close(): void;
}

interface SubscriptionRecord {
	handlers: SubscriptionHandlers;
	filters: NostrFilter[];
}

/** Minimal NIP-01 client: connect, subscribe, receive events, close. */
export class RelayClient {
	readonly url: string;
	#WebSocket: WebSocketFactory;
	#socket: WebSocket | null = null;
	#connecting: Promise<void> | null = null;
	#counter = 0;
	#subscriptions = new Map<string, SubscriptionRecord>();
	#onNotice: ((message: string) => void) | undefined;
	#onDisconnect: ((reason: string) => void) | undefined;
	#auth: ((challenge: string) => NostrEvent | null | Promise<NostrEvent | null>) | undefined;
	#onAuth: ((state: 'required' | 'ok' | 'failed') => void) | undefined;
	#authEventId: string | null = null;
	#authenticated = false;
	#authRequested = false;
	#closing = false;

	constructor(url: string, options: RelayClientOptions = {}) {
		this.url = normalizeRelayUrl(url);
		this.#WebSocket = options.WebSocket ?? ((relayUrl) => new WebSocket(relayUrl));
		this.#onNotice = options.onNotice;
		this.#onDisconnect = options.onDisconnect;
		this.#auth = options.auth;
		this.#onAuth = options.onAuth;
	}

	get connected(): boolean {
		return this.#socket?.readyState === SOCKET_OPEN;
	}

	/** True once the relay accepted our NIP-42 event. */
	get authenticated(): boolean {
		return this.#authenticated;
	}

	/**
	 * True when the relay asked for NIP-42 authentication. Until it is
	 * accepted, relays answer REQs with an EOSE that carries no events.
	 */
	get authRequested(): boolean {
		return this.#authRequested;
	}

	/** Opens the connection; resolves once the relay is ready. */
	connect(): Promise<void> {
		if (this.connected) return Promise.resolve();
		if (this.#connecting) return this.#connecting;

		const socket = this.#WebSocket(this.url);
		this.#socket = socket;
		this.#closing = false;

		socket.addEventListener('message', (event) => {
			this.#handleMessage((event as MessageEvent).data);
		});
		socket.addEventListener('close', (event) => {
			this.#handleClose((event as CloseEvent).reason ?? '');
		});

		this.#connecting = new Promise<void>((resolve, reject) => {
			const onOpen = () => {
				cleanup();
				resolve();
			};
			const onError = () => {
				cleanup();
				reject(new Error(`could not connect to ${this.url}`));
			};
			const onClose = () => {
				cleanup();
				reject(new Error(`connection to ${this.url} closed before it opened`));
			};
			const cleanup = () => {
				socket.removeEventListener('open', onOpen);
				socket.removeEventListener('error', onError);
				socket.removeEventListener('close', onClose);
			};

			socket.addEventListener('open', onOpen);
			socket.addEventListener('error', onError);
			socket.addEventListener('close', onClose);
		}).finally(() => {
			this.#connecting = null;
		});

		return this.#connecting;
	}

	/** Sends a REQ and reports matching events through the handlers. */
	subscribe(filters: NostrFilter[], handlers: SubscriptionHandlers = {}): RelaySubscription {
		const id = `tower-${++this.#counter}`;
		this.#subscriptions.set(id, { handlers, filters });
		this.#send(['REQ', id, ...filters]);
		return {
			id,
			close: () => this.#closeSubscription(id)
		};
	}

	/** Closes the connection and forgets every subscription. */
	close(): void {
		this.#closing = true;
		const socket = this.#socket;
		this.#socket = null;
		this.#subscriptions.clear();
		this.#authenticated = false;
		this.#authRequested = false;
		this.#authEventId = null;
		if (socket && socket.readyState !== SOCKET_CLOSED) {
			socket.close();
		}
	}

	#send(message: unknown[]): void {
		const socket = this.#socket;
		if (!socket || socket.readyState !== SOCKET_OPEN) {
			throw new Error('relay is not connected');
		}
		socket.send(JSON.stringify(message));
	}

	/** Sends every open REQ again, which is what a relay expects after auth. */
	#resubscribe(): void {
		if (!this.connected) return;
		for (const [id, record] of this.#subscriptions) {
			this.#socket?.send(JSON.stringify(['REQ', id, ...record.filters]));
		}
	}

	#closeSubscription(id: string): void {
		if (!this.#subscriptions.delete(id)) return;
		if (this.#socket?.readyState === SOCKET_OPEN) {
			this.#socket.send(JSON.stringify(['CLOSE', id]));
		}
	}

	#handleMessage(raw: unknown): void {
		if (typeof raw !== 'string') return;
		const message = parseRelayMessage(raw);
		if (!message) return;

		switch (message.type) {
			case 'event':
				this.#subscriptions.get(message.subscriptionId)?.handlers.onEvent?.(message.event);
				break;
			case 'eose':
				this.#subscriptions.get(message.subscriptionId)?.handlers.onEose?.();
				break;
			case 'closed':
				this.#handleClosed(message.subscriptionId, message.message);
				break;
			case 'auth':
				void this.#handleAuth(message.challenge);
				break;
			case 'ok':
				this.#handleOk(message.eventId, message.accepted);
				break;
			case 'notice':
				this.#onNotice?.(message.message);
				break;
			default:
				break;
		}
	}

	#handleClosed(subscriptionId: string, message: string): void {
		const record = this.#subscriptions.get(subscriptionId);
		if (!record) return;
		if (message.startsWith('auth-required')) {
			// Keep the subscription: the REQ is sent again once the relay has
			// accepted our authentication event.
			this.#authRequested = true;
			return;
		}
		this.#subscriptions.delete(subscriptionId);
		record.handlers.onClosed?.(message);
	}

	async #handleAuth(challenge: string): Promise<void> {
		this.#authRequested = true;
		const auth = this.#auth;
		if (!auth) {
			this.#onAuth?.('required');
			return;
		}
		try {
			const event = await auth(challenge);
			if (!event) {
				this.#onAuth?.('required');
				return;
			}
			// Signing can take a moment (an extension may ask the user) and the
			// connection can be gone by then.
			if (this.#socket?.readyState !== SOCKET_OPEN) return;
			this.#authEventId = event.id;
			this.#send(['AUTH', event]);
		} catch {
			this.#onAuth?.('failed');
		}
	}

	#handleOk(eventId: string, accepted: boolean): void {
		if (eventId !== this.#authEventId) return;
		this.#authEventId = null;
		this.#authenticated = accepted;
		this.#onAuth?.(accepted ? 'ok' : 'failed');
		if (accepted) {
			this.#resubscribe();
		}
	}

	#handleClose(reason: string): void {
		const intentional = this.#closing;
		this.#closing = false;
		this.#socket = null;
		this.#subscriptions.clear();
		this.#authenticated = false;
		this.#authRequested = false;
		this.#authEventId = null;
		if (!intentional) {
			this.#onDisconnect?.(reason || 'relay connection closed');
		}
	}
}
