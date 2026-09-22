import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageLike } from './storage';
import { parseThemeMode, resolveTheme, ThemeStore, THEME_STORAGE_KEY } from './theme.svelte.js';

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

	get stored(): Record<string, string> {
		return Object.fromEntries(this.#items);
	}
}

afterEach(() => vi.unstubAllGlobals());

describe('parseThemeMode', () => {
	it('accepts the three modes and falls back to system', () => {
		expect(parseThemeMode('light')).toBe('light');
		expect(parseThemeMode('dark')).toBe('dark');
		expect(parseThemeMode('system')).toBe('system');
		expect(parseThemeMode(null)).toBe('system');
		expect(parseThemeMode('sepia')).toBe('system');
	});
});

describe('resolveTheme', () => {
	it('follows the system preference only in system mode', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});
});

describe('ThemeStore', () => {
	it('starts from the stored mode and applies it to the document', () => {
		const toggle = vi.fn();
		vi.stubGlobal('document', { documentElement: { classList: { toggle } } });
		vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {} }));
		const storage = new MemoryStorage();
		storage.setItem(THEME_STORAGE_KEY, 'light');

		const store = new ThemeStore(storage);
		store.start();

		expect(store.mode).toBe('light');
		expect(toggle).toHaveBeenCalledWith('dark', false);
	});

	it('remembers the chosen mode', () => {
		const toggle = vi.fn();
		vi.stubGlobal('document', { documentElement: { classList: { toggle } } });
		vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {} }));
		const storage = new MemoryStorage();

		const store = new ThemeStore(storage);
		store.set('dark');

		expect(store.mode).toBe('dark');
		expect(storage.stored[THEME_STORAGE_KEY]).toBe('dark');
		expect(toggle).toHaveBeenCalledWith('dark', true);
	});

	it('works without storage or a document, for example in tests', () => {
		const store = new ThemeStore(null);
		expect(() => store.start()).not.toThrow();
		expect(store.mode).toBe('system');
	});
});
