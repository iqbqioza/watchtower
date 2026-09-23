import type { RelayClient } from './relay';
import type { NostrEvent, NostrFilter } from './types';

export interface QueryOptions {
	/** How long to wait for the relay before using what arrived. */
	timeoutMs?: number;
}

/**
 * Runs one REQ and resolves with the events that arrive before EOSE. Relays
 * that gate reads answer EOSE without events until NIP-42 is accepted, so such
 * an EOSE is ignored: the client re-sends the REQ after authentication.
 */
export function queryEvents(
	connection: RelayClient,
	filters: NostrFilter[],
	options: QueryOptions = {}
): Promise<NostrEvent[]> {
	return new Promise<NostrEvent[]>((resolve, reject) => {
		// The client sends the REQ again once the relay accepts the auth event,
		// so the same event can arrive twice: keep one copy per id.
		const events = new Map<string, NostrEvent>();
		const timer = setTimeout(
			() => finish(() => resolve([...events.values()])),
			options.timeoutMs ?? 8000
		);

		const subscription = connection.subscribe(filters, {
			onEvent: (event) => events.set(event.id, event),
			onEose: () => {
				if (!connection.authenticated && connection.authRequested) return;
				finish(() => resolve([...events.values()]));
			},
			onClosed: (message) =>
				finish(() => reject(new Error(message || 'the subscription was closed')))
		});

		function finish(settle: () => void): void {
			clearTimeout(timer);
			subscription.close();
			settle();
		}
	});
}
