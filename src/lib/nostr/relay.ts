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

/** Minimal NIP-01 client: connect, subscribe, receive events, close. */
export class RelayClient {
	readonly url: string;
	#WebSocket: WebSocketFactory;
	#socket: WebSocket | null = null;
	#connecting: Promise<void> | null = null;
	#counter = 0;
	#subscriptions = new Map<string, SubscriptionHandlers>();
	#onNotice: ((message: string) => void) | undefined;
	#onDisconnect: ((reason: string) => void) | undefined;
	#closing = false;

	constructor(url: string, options: RelayClientOptions = {}) {
		this.url = normalizeRelayUrl(url);
		this.#WebSocket = options.WebSocket ?? ((relayUrl) => new WebSocket(relayUrl));
		this.#onNotice = options.onNotice;
		this.#onDisconnect = options.onDisconnect;
	}

	get connected(): boolean {
		return this.#socket?.readyState === SOCKET_OPEN;
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
		this.#subscriptions.set(id, handlers);
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
				this.#subscriptions.get(message.subscriptionId)?.onEvent?.(message.event);
				break;
			case 'eose':
				this.#subscriptions.get(message.subscriptionId)?.onEose?.();
				break;
			case 'closed': {
				const handlers = this.#subscriptions.get(message.subscriptionId);
				this.#subscriptions.delete(message.subscriptionId);
				handlers?.onClosed?.(message.message);
				break;
			}
			case 'notice':
				this.#onNotice?.(message.message);
				break;
			default:
				// OK and AUTH are not used yet.
				break;
		}
	}

	#handleClose(reason: string): void {
		const intentional = this.#closing;
		this.#closing = false;
		this.#socket = null;
		this.#subscriptions.clear();
		if (!intentional) {
			this.#onDisconnect?.(reason || 'relay connection closed');
		}
	}
}
