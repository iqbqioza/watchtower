import { describe, expect, it } from 'vitest';
import { initialIndex, moveIndex, type SelectOption } from './select';

const OPTIONS: SelectOption[] = [
	{ value: 'moderator', label: 'Moderator' },
	{ value: 'curator', label: 'Curator' },
	{ value: 'admin', label: 'Admin' }
];

describe('initialIndex', () => {
	it('points at the chosen option', () => {
		expect(initialIndex(OPTIONS, 'curator')).toBe(1);
	});

	it('falls back to the first option', () => {
		expect(initialIndex(OPTIONS, '')).toBe(0);
		expect(initialIndex(OPTIONS, 'gone')).toBe(0);
	});

	it('stays empty without options', () => {
		expect(initialIndex([], 'anything')).toBe(-1);
	});
});

describe('moveIndex', () => {
	it('moves inside the list', () => {
		expect(moveIndex(0, 1, 3)).toBe(1);
		expect(moveIndex(2, -1, 3)).toBe(1);
	});

	it('stops at both ends', () => {
		expect(moveIndex(2, 1, 3)).toBe(2);
		expect(moveIndex(0, -1, 3)).toBe(0);
	});

	it('starts at the top when nothing is highlighted', () => {
		expect(moveIndex(-1, 1, 3)).toBe(0);
		expect(moveIndex(-1, -1, 3)).toBe(0);
	});

	it('has nothing to move without options', () => {
		expect(moveIndex(0, 1, 0)).toBe(-1);
	});
});
