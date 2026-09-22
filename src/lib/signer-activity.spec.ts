import { describe, expect, it } from 'vitest';
import { signerActivity } from './signer-activity.svelte.js';

describe('signerActivity', () => {
	it('is idle to begin with', () => {
		expect(signerActivity.pending).toBe(false);
	});

	it('stays pending until every signature finished', () => {
		signerActivity.begin();
		expect(signerActivity.pending).toBe(true);

		signerActivity.begin();
		signerActivity.end();
		expect(signerActivity.pending).toBe(true);

		signerActivity.end();
		expect(signerActivity.pending).toBe(false);
	});

	it('does not go below zero', () => {
		signerActivity.end();
		signerActivity.end();
		expect(signerActivity.pending).toBe(false);

		signerActivity.begin();
		expect(signerActivity.pending).toBe(true);
		signerActivity.end();
	});
});
