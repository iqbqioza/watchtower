import { describe, expect, it } from 'vitest';
import { parseRelayMessage } from './relay-message';

const EVENT = {
	id: 'e'.repeat(64),
	pubkey: 'f'.repeat(64),
	sig: 'a'.repeat(128),
	created_at: 1_700_000_000,
	kind: 1,
	tags: [['t', 'tower']],
	content: 'hello'
};

describe('parseRelayMessage', () => {
	it('parses a NIP-01 event', () => {
		expect(parseRelayMessage(JSON.stringify(['EVENT', 'sub', EVENT]))).toEqual({
			type: 'event',
			subscriptionId: 'sub',
			event: EVENT
		});
	});

	it('parses EOSE, CLOSED and NOTICE', () => {
		expect(parseRelayMessage(JSON.stringify(['EOSE', 'sub']))).toEqual({
			type: 'eose',
			subscriptionId: 'sub'
		});
		expect(parseRelayMessage(JSON.stringify(['CLOSED', 'sub', 'slow down']))).toEqual({
			type: 'closed',
			subscriptionId: 'sub',
			message: 'slow down'
		});
		expect(parseRelayMessage(JSON.stringify(['NOTICE', 'be nice']))).toEqual({
			type: 'notice',
			message: 'be nice'
		});
	});

	it('parses OK and AUTH', () => {
		expect(parseRelayMessage(JSON.stringify(['OK', 'id', true, 'saved']))).toEqual({
			type: 'ok',
			eventId: 'id',
			accepted: true,
			message: 'saved'
		});
		expect(parseRelayMessage(JSON.stringify(['AUTH', 'challenge']))).toEqual({
			type: 'auth',
			challenge: 'challenge'
		});
	});

	it('uses an empty string when an optional message is missing', () => {
		expect(parseRelayMessage(JSON.stringify(['CLOSED', 'sub']))).toEqual({
			type: 'closed',
			subscriptionId: 'sub',
			message: ''
		});
		expect(parseRelayMessage(JSON.stringify(['OK', 'id', false]))).toEqual({
			type: 'ok',
			eventId: 'id',
			accepted: false,
			message: ''
		});
	});

	it('ignores malformed and unknown messages', () => {
		expect(parseRelayMessage('not json')).toBeNull();
		expect(parseRelayMessage('{}')).toBeNull();
		expect(parseRelayMessage('[]')).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['EVENT', 'sub']))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['EVENT', 'sub', { id: 1 }]))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['EVENT', 7, EVENT]))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['EOSE']))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['NOTICE', 42]))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['OK', 'id', 'yes']))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['AUTH']))).toBeNull();
		expect(parseRelayMessage(JSON.stringify(['WHATEVER']))).toBeNull();
	});
});
