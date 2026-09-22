<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		mono?: boolean;
		children: Snippet;
	}

	let { mono = false, children }: Props = $props();
</script>

<span
	class="inline-flex items-center rounded-md border border-line bg-control px-2 py-0.5 text-xs text-muted {mono
		? 'font-mono'
		: ''}"
>
	{@render children()}
</span>
