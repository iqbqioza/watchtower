<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		action?: Snippet;
	}

	let { title, description, action }: Props = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-lg font-semibold text-ink">{title}</h1>
		{#if description}
			<p class="mt-0.5 text-sm text-muted">{description}</p>
		{/if}
	</div>
	{#if action}
		{@render action()}
	{/if}
</header>
