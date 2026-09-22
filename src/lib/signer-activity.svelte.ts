/**
 * Tracks whether this app is waiting for the browser extension. While a
 * signature is pending the extension usually shows a prompt, so the UI says so
 * instead of looking stuck.
 */
class SignerActivity {
	pending = $state(false);
	#count = 0;

	begin(): void {
		this.#count += 1;
		this.pending = true;
	}

	end(): void {
		this.#count = Math.max(0, this.#count - 1);
		this.pending = this.#count > 0;
	}
}

export const signerActivity = new SignerActivity();
