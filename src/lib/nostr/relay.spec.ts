import { describe, expect, it, vi } from 'vitest';
import { RelayClient } from './relay';
import type { NostrEvent, NostrFilter } from './types';

const EVENT: NostrEvent = {
	id: 'e'.repeat(64),
	pubkey: 'f'.repeat(64),
	sig: 'a'.repeat(128),
	created_at: 1_700_000_000,
	kind: 1,
	tags: [],
	content: 'hello'
};

const FILTER: NostrFilter = { kinds: [1], limit: 1 };

class FakeSocket {
	readyState = 0;
	sent: string[] = [];
	#listeners = new Map<string, Set<(event: unknown) => void>>();

	addEventListener(type: string, listener: (event: unknown) => void): void {
		const listeners = this.#listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.#listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: (event: unknown) => void): void {
		this.#listeners.get(type)?.delete(listener);
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		if (this.readyState === 3) return;
		this.readyState = 3;
		this.emit('close', { code: 1000, reason: '' });
	}

	open(): void {
		this.readyState = 1;
		this.emit('open', {});
	}

	message(data: string): void {
		this.emit('message', { data });
	}

	error(): void {
		this.emit('error', {});
	}

	drop(reason = 'network error'): void {
		this.readyState = 3;
		this.emit('close', { code: 1006, reason });
	}

	emit(type: string, event: unknown): void {
		for (const listener of this.#listeners.get(type) ?? []) {
			listener(event);
		}
	}

	get lastSent(): unknown {
		return JSON.parse(this.sent.at(-1) ?? 'null');
	}
}

function createClient(
	options: { onNotice?: (m: string) => void; onDisconnect?: (r: string) => void } = {}
) {
	const sockets: FakeSocket[] = [];
	const urls: string[] = [];
	const client = new RelayClient('wss://relay.example.com', {
		...options,
		WebSocket: (url) => {
			urls.push(url);
			const socket = new FakeSocket();
			sockets.push(socket);
			return socket as unknown as WebSocket;
		}
	});
	return { client, sockets, urls };
}

describe('RelayClient.connect', () => {
	it('connects to the normalized URL and resolves when the relay is ready', async () => {
		const { client, sockets, urls } = createClient();
		const connected = client.connect();

		expect(urls).toEqual(['wss://relay.example.com/']);
		expect(sockets).toHaveLength(1);
		expect(client.connected).toBe(false);

		sockets[0].open();
		await connected;
		expect(client.connected).toBe(true);
	});

	it('does not open a second socket while one is connected', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		await client.connect();
		expect(sockets).toHaveLength(1);
	});

	it('fails when the relay cannot be reached', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].error();

		await expect(connected).rejects.toThrow(/could not connect to wss:\/\/relay.example.com\//);
	});

	it('fails when the connection closes before it opened', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].drop('try again later');

		await expect(connected).rejects.toThrow(/closed before it opened/);
	});
});

describe('RelayClient.subscribe', () => {
	it('sends a REQ with a generated subscription id and the filters', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const subscription = client.subscribe([FILTER]);
		expect(subscription.id).toBe('tower-1');
		expect(sockets[0].lastSent).toEqual(['REQ', 'tower-1', FILTER]);
	});

	it('routes events and EOSE to the matching subscription', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const onEvent = vi.fn();
		const onEose = vi.fn();
		const subscription = client.subscribe([FILTER], { onEvent, onEose });

		sockets[0].message(JSON.stringify(['EVENT', subscription.id, EVENT]));
		sockets[0].message(JSON.stringify(['EOSE', subscription.id]));

		expect(onEvent).toHaveBeenCalledWith(EVENT);
		expect(onEose).toHaveBeenCalledOnce();
	});

	it('ignores messages of other subscriptions and malformed ones', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const onEvent = vi.fn();
		client.subscribe([FILTER], { onEvent });

		expect(() => {
			sockets[0].message(JSON.stringify(['EVENT', 'other', EVENT]));
			sockets[0].message('not json');
		}).not.toThrow();
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('sends CLOSE and stops delivering events', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const onEvent = vi.fn();
		const subscription = client.subscribe([FILTER], { onEvent });
		subscription.close();

		expect(sockets[0].lastSent).toEqual(['CLOSE', subscription.id]);
		sockets[0].message(JSON.stringify(['EVENT', subscription.id, EVENT]));
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('reports a CLOSED message from the relay and drops the subscription', async () => {
		const { client, sockets } = createClient();
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const onClosed = vi.fn();
		const onEvent = vi.fn();
		const subscription = client.subscribe([FILTER], { onEvent, onClosed });

		sockets[0].message(JSON.stringify(['CLOSED', subscription.id, 'too much']));
		expect(onClosed).toHaveBeenCalledWith('too much');

		sockets[0].message(JSON.stringify(['EVENT', subscription.id, EVENT]));
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('throws when the relay is not connected', () => {
		const { client } = createClient();
		expect(() => client.subscribe([FILTER])).toThrow(/not connected/);
	});
});

describe('RelayClient notices and disconnects', () => {
	it('reports NOTICE messages', async () => {
		const onNotice = vi.fn();
		const { client, sockets } = createClient({ onNotice });
		const connected = client.connect();
		sockets[0].open();
		await connected;

		sockets[0].message(JSON.stringify(['NOTICE', 'rate limited']));
		expect(onNotice).toHaveBeenCalledWith('rate limited');
	});

	it('reports an unexpected disconnect and forgets the subscriptions', async () => {
		const onDisconnect = vi.fn();
		const { client, sockets } = createClient({ onDisconnect });
		const connected = client.connect();
		sockets[0].open();
		await connected;

		const onEvent = vi.fn();
		const subscription = client.subscribe([FILTER], { onEvent });

		sockets[0].drop('network error');
		expect(onDisconnect).toHaveBeenCalledWith('network error');
		expect(client.connected).toBe(false);

		sockets[0].message(JSON.stringify(['EVENT', subscription.id, EVENT]));
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('stays quiet when the client closes the connection itself', async () => {
		const onDisconnect = vi.fn();
		const { client, sockets } = createClient({ onDisconnect });
		const connected = client.connect();
		sockets[0].open();
		await connected;

		client.close();

		expect(sockets[0].readyState).toBe(3);
		expect(onDisconnect).not.toHaveBeenCalled();
	});
});
