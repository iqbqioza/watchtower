import { hexToBytes } from '@noble/hashes/utils.js';
import { finalizeEvent } from './nostr/event';
import { pubkeyFromSecretKey } from './nostr/keys';
import type { RelayClient, RelayClientOptions } from './nostr/relay';
import type { EventTemplate } from './nostr/types';
import { RelayConnection } from './relay-connection.svelte.js';
import { session } from './session.svelte.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// BIP-340 test vector 0 secret key; it plays the part of the extension key.
const SECRET_KEY = hexToBytes('0000000000000000000000000000000000000000000000000000000000000003');
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';

const extension = {
	getPublicKey: vi.fn(async () => PUBKEY),
	signEvent: vi.fn(async (template: EventTemplate) => finalizeEvent(SECRET_KEY, template))
};

interface FakeClient {
	connected: boolean;
	options: RelayClientOptions;
	connect: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
}

function createFactory(): {
	clients: FakeClient[];
	factory: (url: string, options: RelayClientOptions) => RelayClient;
} {
	const clients: FakeClient[] = [];
	const factory = (_url: string, options: RelayClientOptions) => {
		const client: FakeClient = {
			connected: false,
			options,
			connect: vi.fn(async () => {
				client.connected = true;
			}),
			close: vi.fn(() => {
				client.connected = false;
			})
		};
		clients.push(client);
		return client as unknown as RelayClient;
	};
	return { clients, factory };
}

beforeEach(() => {
	vi.stubGlobal('nostr', extension);
});

afterEach(() => {
	session.signOut();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('RelayConnection', () => {
	it('connects for the signed in session', async () => {
		await session.signIn(RELAY_URL);
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);

		connection.start();
		expect(connection.status).toBe('connecting');
		expect(clients).toHaveLength(1);

		await vi.waitFor(() => expect(connection.status).toBe('connected'));
		expect(connection.client).not.toBeNull();
	});

	it('signs the NIP-42 challenge with the session account', async () => {
		await session.signIn(RELAY_URL);
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);
		connection.start();

		const signed = await clients[0].options.auth?.('challenge-1');

		expect(signed?.kind).toBe(22242);
		expect(signed?.pubkey).toBe(PUBKEY);
		expect(signed?.tags).toContainEqual(['relay', RELAY_URL]);
		expect(signed?.tags).toContainEqual(['challenge', 'challenge-1']);
	});

	it('reports the authenticated state from the relay', async () => {
		await session.signIn(RELAY_URL);
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);
		connection.start();
		await vi.waitFor(() => expect(connection.status).toBe('connected'));

		clients[0].options.onAuth?.('ok');
		expect(connection.status).toBe('authenticated');

		clients[0].options.onAuth?.('failed');
		expect(connection.status).toBe('failed');
	});

	it('keeps one client while it stays connected', async () => {
		await session.signIn(RELAY_URL);
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);
		connection.start();
		await vi.waitFor(() => expect(connection.status).toBe('connected'));

		connection.start();
		expect(clients).toHaveLength(1);
	});

	it('reconnects after the relay drops the connection', async () => {
		vi.useFakeTimers();
		try {
			await session.signIn(RELAY_URL);
			const { clients, factory } = createFactory();
			const connection = new RelayConnection(factory, 1000);
			connection.start();
			await vi.advanceTimersByTimeAsync(0);
			expect(clients).toHaveLength(1);

			clients[0].connected = false;
			clients[0].options.onDisconnect?.('network error');

			expect(connection.status).toBe('offline');
			expect(connection.client).toBeNull();

			await vi.advanceTimersByTimeAsync(1000);
			expect(clients).toHaveLength(2);
			expect(connection.status).toBe('connected');
		} finally {
			vi.useRealTimers();
		}
	});

	it('stays closed after an explicit stop', async () => {
		vi.useFakeTimers();
		try {
			await session.signIn(RELAY_URL);
			const { clients, factory } = createFactory();
			const connection = new RelayConnection(factory, 1000);
			connection.start();
			await vi.advanceTimersByTimeAsync(0);

			connection.stop();
			expect(clients[0].close).toHaveBeenCalled();
			expect(connection.status).toBe('offline');

			await vi.advanceTimersByTimeAsync(5000);
			expect(clients).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not connect without a session', () => {
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);

		connection.start();

		expect(clients).toHaveLength(0);
		expect(connection.status).toBe('offline');
	});

	it('stays offline when the extension is gone', async () => {
		await session.signIn(RELAY_URL);
		vi.stubGlobal('nostr', undefined);

		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);
		connection.start();

		expect(clients).toHaveLength(0);
		expect(connection.status).toBe('offline');
	});

	it('signs the challenge through the extension, not the page', async () => {
		await session.signIn(RELAY_URL);
		const { clients, factory } = createFactory();
		const connection = new RelayConnection(factory);
		connection.start();

		await clients[0].options.auth?.('challenge-1');

		expect(extension.signEvent).toHaveBeenCalledOnce();
		expect(await session.signer?.getPublicKey()).toBe(PUBKEY);
		expect(pubkeyFromSecretKey(SECRET_KEY)).toBe(PUBKEY);
	});
});
