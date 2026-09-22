<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props {
		type?: 'button' | 'submit';
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		type = 'button',
		variant = 'secondary',
		size = 'md',
		disabled = false,
		onclick,
		children
	}: Props = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-ink text-bg hover:opacity-85',
		secondary: 'border border-line bg-panel text-ink hover:bg-control-hover',
		ghost: 'text-muted hover:bg-control-hover hover:text-ink',
		danger: 'border border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400'
	};

	const sizes: Record<Size, string> = {
		sm: 'gap-1.5 px-2.5 py-1.5 text-xs',
		md: 'gap-2 px-3 py-2 text-sm'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus/50 disabled:pointer-events-none disabled:opacity-50 {variants[
		variant
	]} {sizes[size]}"
>
	{@render children()}
</button>
