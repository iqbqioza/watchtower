import { browserStorage, type StorageLike } from './storage';

export const THEME_STORAGE_KEY = 'tower.theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Reads a stored preference, falling back to the system setting. */
export function parseThemeMode(value: string | null): ThemeMode {
	return value === 'light' || value === 'dark' ? value : 'system';
}

/** Applies the mode to the system preference to get the theme to show. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
	if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
	return mode;
}

/** Theme choice of the browser, kept in localStorage and applied to <html>. */
export class ThemeStore {
	mode = $state<ThemeMode>('system');
	#storage: StorageLike | null;
	#started = false;

	constructor(storage: StorageLike | null = browserStorage('local')) {
		this.#storage = storage;
	}

	/** Applies the stored mode and follows later system changes. Call once. */
	start(): void {
		if (this.#started) return;
		this.#started = true;
		this.mode = parseThemeMode(this.#storage?.getItem(THEME_STORAGE_KEY) ?? null);
		this.#apply();

		globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.mode === 'system') this.#apply();
		});
	}

	set(mode: ThemeMode): void {
		this.mode = mode;
		try {
			this.#storage?.setItem(THEME_STORAGE_KEY, mode);
		} catch {
			// Private mode: the choice simply does not survive a reload.
		}
		this.#apply();
	}

	#apply(): void {
		const systemPrefersDark =
			globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
		const dark = resolveTheme(this.mode, systemPrefersDark) === 'dark';
		globalThis.document?.documentElement.classList.toggle('dark', dark);
	}
}

export const theme = new ThemeStore();
