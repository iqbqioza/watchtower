import { describe, expect, it } from 'vitest';
import { fetchRelayInformation, NIP11_ACCEPT, parseRelayInformation } from './nip11';

const RELAY_URL = 'wss://relay.example.com/';

interface Captured {
	url: string;
	init: RequestInit;
}

function fakeFetch(response: () => Response): {
	calls: Captured[];
	fetch: typeof globalThis.fetch;
} {
	const calls: Captured[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return response();
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': NIP11_ACCEPT }
	});
}

describe('parseRelayInformation', () => {
	it('keeps the fields the app shows', () => {
		const information = parseRelayInformation({
			name: 'iqbqioza',
			description: 'Beyond the theory.',
			icon: 'https://example.com/icon.png',
			pubkey: 'f'.repeat(64),
			supported_nips: [1, 11, 86],
			software: 'khatru',
			version: '0.1.0'
		});

		expect(information.name).toBe('iqbqioza');
		expect(information.software).toBe('khatru');
		expect(information.supported_nips).toEqual([1, 11, 86]);
	});

	it('drops wrong types but keeps unknown fields', () => {
		const information = parseRelayInformation({
			name: 42,
			description: 'kept',
			supported_nips: ['1', 2],
			custom: 'kept as well'
		});

		expect(information.name).toBeUndefined();
		expect(information.description).toBe('kept');
		expect(information.supported_nips).toBeUndefined();
		expect(information.custom).toBe('kept as well');
	});

	it('rejects documents that are not objects', () => {
		expect(() => parseRelayInformation(null)).toThrow(/JSON object/);
		expect(() => parseRelayInformation('relay')).toThrow(/JSON object/);
		expect(() => parseRelayInformation([1, 2])).toThrow(/JSON object/);
	});
});

describe('fetchRelayInformation', () => {
	it('asks the HTTP endpoint of the relay for the document', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ name: 'Tower relay' }));

		const information = await fetchRelayInformation(RELAY_URL, { fetch });

		expect(calls[0].url).toBe('https://relay.example.com/');
		expect((calls[0].init.headers as Record<string, string>).Accept).toBe(NIP11_ACCEPT);
		expect(information.name).toBe('Tower relay');
	});

	it('accepts a relay URL that is already HTTP', async () => {
		const { calls, fetch } = fakeFetch(() => jsonResponse({ name: 'Tower relay' }));

		await fetchRelayInformation('https://relay.example.com', { fetch });

		expect(calls[0].url).toBe('https://relay.example.com/');
	});

	it('reports HTTP errors', async () => {
		const { fetch } = fakeFetch(() => new Response('nope', { status: 404 }));
		await expect(fetchRelayInformation(RELAY_URL, { fetch })).rejects.toThrow(/HTTP 404/);
	});

	it('reports documents that are not JSON', async () => {
		const { fetch } = fakeFetch(() => new Response('<html></html>', { status: 200 }));
		await expect(fetchRelayInformation(RELAY_URL, { fetch })).rejects.toThrow(/not JSON/);
	});
});
