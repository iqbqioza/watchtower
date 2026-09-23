export interface ConfirmRequest {
	title: string;
	message: string;
	/** Text of the confirming button. */
	confirmLabel?: string;
	/** Paint the confirming button as dangerous; true by default. */
	danger?: boolean;
}

/**
 * Asks for confirmation with a modal dialog. Screens call
 * `await confirmDialog.ask({...})` and act only when it resolves true.
 */
class ConfirmStore {
	open = $state(false);
	title = $state('');
	message = $state('');
	confirmLabel = $state('Confirm');
	danger = $state(true);
	#resolve: ((confirmed: boolean) => void) | null = null;

	ask(request: ConfirmRequest): Promise<boolean> {
		// A second question while one is open must not leave the first hanging.
		this.#resolve?.(false);

		this.title = request.title;
		this.message = request.message;
		this.confirmLabel = request.confirmLabel ?? 'Confirm';
		this.danger = request.danger ?? true;
		this.open = true;

		return new Promise((resolve) => {
			this.#resolve = resolve;
		});
	}

	settle(confirmed: boolean): void {
		this.open = false;
		this.#resolve?.(confirmed);
		this.#resolve = null;
	}
}

export const confirmDialog = new ConfirmStore();
