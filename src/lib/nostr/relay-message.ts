import { isNostrEvent } from './event';
import type { NostrEvent } from './types';

/** Messages a relay can send that this client understands. */
export type RelayMessage =
	| { type: 'event'; subscriptionId: string; event: NostrEvent }
	| { type: 'eose'; subscriptionId: string }
	| { type: 'closed'; subscriptionId: string; message: string }
	| { type: 'notice'; message: string }
	| { type: 'ok'; eventId: string; accepted: boolean; message: string }
	| { type: 'auth'; challenge: string };

/** Parses a relay message, returning null for anything unsupported or malformed. */
export function parseRelayMessage(raw: string): RelayMessage | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed) || typeof parsed[0] !== 'string') return null;

	const [label, ...rest] = parsed as [string, ...unknown[]];
	switch (label) {
		case 'EVENT': {
			const [subscriptionId, event] = rest;
			if (typeof subscriptionId !== 'string' || !isNostrEvent(event)) return null;
			return { type: 'event', subscriptionId, event };
		}
		case 'EOSE': {
			const [subscriptionId] = rest;
			if (typeof subscriptionId !== 'string') return null;
			return { type: 'eose', subscriptionId };
		}
		case 'CLOSED': {
			const [subscriptionId, message] = rest;
			if (typeof subscriptionId !== 'string') return null;
			return {
				type: 'closed',
				subscriptionId,
				message: typeof message === 'string' ? message : ''
			};
		}
		case 'NOTICE': {
			const [message] = rest;
			if (typeof message !== 'string') return null;
			return { type: 'notice', message };
		}
		case 'OK': {
			const [eventId, accepted, message] = rest;
			if (typeof eventId !== 'string' || typeof accepted !== 'boolean') return null;
			return { type: 'ok', eventId, accepted, message: typeof message === 'string' ? message : '' };
		}
		case 'AUTH': {
			const [challenge] = rest;
			if (typeof challenge !== 'string') return null;
			return { type: 'auth', challenge };
		}
		default:
			return null;
	}
}
