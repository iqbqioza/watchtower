<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		value: string;
		placeholder?: string;
		type?: 'text' | 'number' | 'password';
		mono?: boolean;
		hint?: string;
		error?: string | null;
		disabled?: boolean;
		/** Rendered inside the field, on the right, such as a reveal button. */
		trailing?: Snippet;
	}

	let {
		label,
		value = $bindable(),
		placeholder = '',
		type = 'text',
		mono = false,
		hint,
		error = null,
		disabled = false,
		trailing
	}: Props = $props();

	const id = $props.id();
</script>

<div class="space-y-1.5">
	<label class="block text-xs font-medium text-muted" for={id}>{label}</label>
	<div class="relative">
		<input
			{id}
			{type}
			{placeholder}
			{disabled}
			bind:value
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			aria-invalid={error ? 'true' : undefined}
			class="w-full rounded-md border bg-panel px-3 py-2 text-sm text-ink transition-colors outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-focus/25 disabled:opacity-50 {error
				? 'border-red-500/60'
				: 'border-line focus:border-focus'} {mono ? 'font-mono' : ''} {trailing ? 'pr-11' : ''}"
		/>
		{#if trailing}
			<div class="absolute inset-y-0 right-1 flex items-center">{@render trailing()}</div>
		{/if}
	</div>
	{#if error}
		<p class="text-xs text-red-700 dark:text-red-400">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted">{hint}</p>
	{/if}
</div>
