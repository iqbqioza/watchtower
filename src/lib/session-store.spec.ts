import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { SESSION_STORAGE_KEY, type StorageLike } from './session';
import { SessionStore } from './session.svelte.js';

const SECRET_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000003';
const SECRET_KEY = hexToBytes(SECRET_KEY_HEX);
const PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
const RELAY_URL = 'wss://relay.example.com/';

class MemoryStorage implements StorageLike {
	#items = new Map<string, string>();

	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.#items.set(key, value);
	}

	removeItem(key: string): void {
		this.#items.delete(key);
	}

	/** Test helper: what is actually persisted. */
	get stored(): string | null {
		return this.getItem(SESSION_STORAGE_KEY);
	}
}

describe('SessionStore', () => {
	it('is anonymous until someone signs in', () => {
		const store = new SessionStore(new MemoryStorage());
		expect(store.isAuthenticated).toBe(false);
		expect(store.pubkey).toBeNull();
		expect(store.npub).toBeNull();
	});

	it('keeps the key in memory and in session storage after sign in', () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage);

		store.signIn(SECRET_KEY, RELAY_URL);

		expect(store.isAuthenticated).toBe(true);
		expect(store.pubkey).toBe(PUBKEY);
		expect(store.npub).toMatch(/^npub1/);
		expect(JSON.parse(storage.stored ?? '')).toEqual({
			secretKey: SECRET_KEY_HEX,
			relayUrl: RELAY_URL
		});
	});

	it('normalizes the relay URL before storing it', () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage);

		store.signIn(SECRET_KEY, 'https://relay.example.com');

		expect(store.relayUrl).toBe(RELAY_URL);
		expect(storage.stored).toContain(RELAY_URL);
	});

	it('restores a stored session exactly once', () => {
		const storage = new MemoryStorage();
		new SessionStore(storage).signIn(SECRET_KEY, RELAY_URL);

		const store = new SessionStore(storage);
		store.restore();
		expect(store.pubkey).toBe(PUBKEY);
		expect(store.relayUrl).toBe(RELAY_URL);

		// A later change is not overwritten by a second restore call.
		store.signOut();
		store.restore();
		expect(store.isAuthenticated).toBe(false);
	});

	it('ignores corrupted storage', () => {
		const storage = new MemoryStorage();
		storage.setItem(SESSION_STORAGE_KEY, '{"secretKey":"nope"}');

		const store = new SessionStore(storage);
		store.restore();
		expect(store.isAuthenticated).toBe(false);
	});

	it('clears memory and storage on sign out', () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage);
		store.signIn(SECRET_KEY, RELAY_URL);

		store.signOut();

		expect(store.isAuthenticated).toBe(false);
		expect(store.secretKey).toBeNull();
		expect(store.relayUrl).toBe('');
		expect(storage.stored).toBeNull();
	});

	it('refuses to sign in with an unusable key or relay URL', () => {
		const storage = new MemoryStorage();
		const store = new SessionStore(storage);

		expect(() => store.signIn(new Uint8Array(32), RELAY_URL)).toThrow(/out of range/);
		expect(() => store.signIn(SECRET_KEY, 'http://')).toThrow(/not a valid URL/);
		expect(store.isAuthenticated).toBe(false);
		expect(storage.stored).toBeNull();
	});

	it('works without storage, for example in private mode', () => {
		const store = new SessionStore(null);
		store.signIn(SECRET_KEY, RELAY_URL);
		expect(store.isAuthenticated).toBe(true);
		store.signOut();
		expect(store.isAuthenticated).toBe(false);
	});
});
