/** The part of the Storage API this project needs. */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** The given storage when it is usable; null during SSR or when blocked. */
export function browserStorage(kind: 'local' | 'session'): StorageLike | null {
	try {
		return kind === 'local'
			? (globalThis.localStorage ?? null)
			: (globalThis.sessionStorage ?? null);
	} catch {
		return null;
	}
}
