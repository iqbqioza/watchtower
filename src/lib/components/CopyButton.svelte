<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		value: string;
		label?: string;
	}

	let { value, label = 'Copy' }: Props = $props();
	let copied = $state(false);

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			// The clipboard API needs a secure context, and a fallback that
			// copies nothing is worse than no feedback at all.
			try {
				const field = document.createElement('textarea');
				field.value = value;
				field.setAttribute('readonly', '');
				field.style.position = 'fixed';
				field.style.opacity = '0';
				document.body.append(field);
				field.select();
				document.execCommand('copy');
				field.remove();
			} catch {
				return;
			}
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<button
	type="button"
	onclick={copy}
	title={copied ? 'Copied' : label}
	aria-label={label}
	class="shrink-0 rounded p-1 text-muted transition-colors outline-none hover:bg-control-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/50"
>
	<Icon name={copied ? 'check' : 'copy'} />
</button>
