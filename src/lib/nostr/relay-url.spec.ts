import { describe, expect, it } from 'vitest';
import { normalizeRelayUrl, relayHttpUrl } from './relay-url';

describe('normalizeRelayUrl', () => {
	it('accepts ws and wss URLs and lowercases the host', () => {
		expect(normalizeRelayUrl('wss://relay.example.com')).toBe('wss://relay.example.com/');
		expect(normalizeRelayUrl('  wss://Relay.Example.com  ')).toBe('wss://relay.example.com/');
		expect(normalizeRelayUrl('ws://localhost:7777')).toBe('ws://localhost:7777/');
	});

	it('converts http and https URLs into their websocket form', () => {
		expect(normalizeRelayUrl('https://relay.example.com')).toBe('wss://relay.example.com/');
		expect(normalizeRelayUrl('http://localhost:7777')).toBe('ws://localhost:7777/');
	});

	it('keeps paths and drops fragments', () => {
		expect(normalizeRelayUrl('wss://relay.example.com/nostr')).toBe(
			'wss://relay.example.com/nostr'
		);
		expect(normalizeRelayUrl('wss://relay.example.com/nostr#frag')).toBe(
			'wss://relay.example.com/nostr'
		);
	});

	it('rejects empty, relative and unsupported URLs', () => {
		expect(() => normalizeRelayUrl('   ')).toThrow(/must not be empty/);
		expect(() => normalizeRelayUrl('relay.example.com')).toThrow(/not a valid URL/);
		expect(() => normalizeRelayUrl('ftp://relay.example.com')).toThrow(/ws:\/\//);
	});
});

describe('relayHttpUrl', () => {
	it('swaps the websocket scheme for its HTTP counterpart', () => {
		expect(relayHttpUrl('wss://relay.example.com/')).toBe('https://relay.example.com/');
		expect(relayHttpUrl('ws://localhost:7777/')).toBe('http://localhost:7777/');
	});

	it('keeps the path of the relay URL', () => {
		expect(relayHttpUrl('https://relay.example.com/nostr')).toBe('https://relay.example.com/nostr');
	});
});
