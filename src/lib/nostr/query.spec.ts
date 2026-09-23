import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from './event';
import { queryEvents } from './query';
import type { RelayClient, SubscriptionHandlers } from './relay';
import type { NostrFilter } from './types';

const SECRET_KEY = hexToBytes('00'.repeat(31) + '03');
const EVENT = finalizeEvent(SECRET_KEY, { kind: 1, created_at: 1_700_000_000, content: 'hi' });

interface FakeConnection {
	authenticated: boolean;
	authRequested: boolean;
	closes: number;
	filters: NostrFilter[] | null;
	handlers: SubscriptionHandlers | null;
	connection: RelayClient;
}

function fakeConnection(): FakeConnection {
	const state = {
		authenticated: true,
		authRequested: false,
		closes: 0,
		filters: null,
		handlers: null
	} as FakeConnection;

	state.connection = {
		get authenticated() {
			return state.authenticated;
		},
		get authRequested() {
			return state.authRequested;
		},
		subscribe: (filters: NostrFilter[], handlers: SubscriptionHandlers) => {
			state.filters = filters;
			state.handlers = handlers;
			return {
				id: 'sub-1',
				close: () => {
					state.closes += 1;
				}
			};
		}
	} as unknown as RelayClient;
	return state;
}

describe('queryEvents', () => {
	it('collects events until EOSE and closes the subscription', async () => {
		const state = fakeConnection();

		const promise = queryEvents(state.connection, [{ kinds: [1] }]);
		state.handlers?.onEvent?.(EVENT);
		state.handlers?.onEose?.();

		await expect(promise).resolves.toEqual([EVENT]);
		expect(state.filters).toEqual([{ kinds: [1] }]);
		expect(state.closes).toBe(1);
	});

	it('waits for authentication before trusting an EOSE', async () => {
		const state = fakeConnection();
		state.authenticated = false;
		state.authRequested = true;

		const promise = queryEvents(state.connection, [{ kinds: [1] }]);
		let settled = false;
		void promise.then(() => (settled = true));

		state.handlers?.onEose?.();
		await Promise.resolve();
		expect(settled).toBe(false);

		// The client re-sends the REQ once the relay accepts the auth event.
		state.authenticated = true;
		state.handlers?.onEose?.();

		await expect(promise).resolves.toEqual([]);
	});

	it('keeps one copy of an event that arrives twice', async () => {
		const state = fakeConnection();

		const promise = queryEvents(state.connection, [{ kinds: [1] }]);
		state.handlers?.onEvent?.(EVENT);
		state.handlers?.onEvent?.(EVENT); // e.g. the REQ was sent again after auth
		state.handlers?.onEose?.();

		await expect(promise).resolves.toEqual([EVENT]);
	});

	it('uses what arrived when the relay is slow', async () => {
		vi.useFakeTimers();
		try {
			const state = fakeConnection();
			const promise = queryEvents(state.connection, [{ kinds: [1] }], { timeoutMs: 500 });
			state.handlers?.onEvent?.(EVENT);

			await vi.advanceTimersByTimeAsync(500);

			await expect(promise).resolves.toEqual([EVENT]);
			expect(state.closes).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('reports a subscription the relay closes', async () => {
		const state = fakeConnection();
		const promise = queryEvents(state.connection, [{ kinds: [1] }]);

		state.handlers?.onClosed?.('auth-required: please authenticate');

		await expect(promise).rejects.toThrow(/auth-required/);
		expect(state.closes).toBe(1);
	});

	it('reports a connection that is not ready', async () => {
		const connection = {
			subscribe: () => {
				throw new Error('relay is not connected');
			}
		} as unknown as RelayClient;

		await expect(queryEvents(connection, [{ kinds: [1] }])).rejects.toThrow(/not connected/);
	});
});
