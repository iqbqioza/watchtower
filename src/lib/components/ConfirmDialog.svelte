<script lang="ts">
	import Button from './Button.svelte';
	import { confirmDialog } from './confirm.svelte.js';

	let dialog = $state<HTMLDialogElement | null>(null);

	// The store drives the native dialog, which brings its own focus trap and
	// Escape handling.
	$effect(() => {
		const element = dialog;
		if (!element) return;
		if (confirmDialog.open && !element.open) {
			element.showModal();
		} else if (!confirmDialog.open && element.open) {
			element.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	oncancel={(event) => {
		event.preventDefault();
		confirmDialog.settle(false);
	}}
	onclose={() => confirmDialog.settle(false)}
	class="m-auto max-w-[92vw] border-0 bg-transparent p-0 text-ink backdrop:bg-black/40"
>
	<div class="w-[min(28rem,92vw)] rounded-lg border border-line bg-panel p-5 panel-shadow">
		<h2 class="text-sm font-semibold">{confirmDialog.title}</h2>
		<p class="mt-2 text-sm break-words text-muted">{confirmDialog.message}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<Button onclick={() => confirmDialog.settle(false)}>Cancel</Button>
			<Button
				variant={confirmDialog.danger ? 'danger' : 'primary'}
				onclick={() => confirmDialog.settle(true)}
			>
				{confirmDialog.confirmLabel}
			</Button>
		</div>
	</div>
</dialog>
