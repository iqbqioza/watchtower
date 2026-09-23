import { describe, expect, it } from 'vitest';
import { confirmDialog } from './confirm.svelte.js';

describe('confirmDialog', () => {
	it('starts closed', () => {
		expect(confirmDialog.open).toBe(false);
	});

	it('opens with the question and resolves true when confirmed', async () => {
		const answer = confirmDialog.ask({ title: 'Ban pubkey', message: 'really?' });

		expect(confirmDialog.open).toBe(true);
		expect(confirmDialog.title).toBe('Ban pubkey');
		expect(confirmDialog.message).toBe('really?');
		expect(confirmDialog.confirmLabel).toBe('Confirm');
		expect(confirmDialog.danger).toBe(true);

		confirmDialog.settle(true);

		await expect(answer).resolves.toBe(true);
		expect(confirmDialog.open).toBe(false);
	});

	it('resolves false when the operator backs out', async () => {
		const answer = confirmDialog.ask({
			title: 'Delete role',
			message: 'sure?',
			confirmLabel: 'Delete'
		});

		confirmDialog.settle(false);

		await expect(answer).resolves.toBe(false);
	});

	it('can carry a non dangerous confirmation', async () => {
		const answer = confirmDialog.ask({ title: 'Continue', message: 'ok?', danger: false });

		expect(confirmDialog.danger).toBe(false);
		confirmDialog.settle(true);
		await expect(answer).resolves.toBe(true);
	});

	it('answers the previous question when a new one is asked', async () => {
		const first = confirmDialog.ask({ title: 'First', message: 'one' });
		const second = confirmDialog.ask({ title: 'Second', message: 'two' });

		await expect(first).resolves.toBe(false);
		expect(confirmDialog.title).toBe('Second');

		confirmDialog.settle(true);
		await expect(second).resolves.toBe(true);
	});

	it('ignores settling while nothing is asked', () => {
		expect(() => confirmDialog.settle(true)).not.toThrow();
		expect(confirmDialog.open).toBe(false);
	});
});
