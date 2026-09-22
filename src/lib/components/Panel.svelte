<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		action?: Snippet;
		children: Snippet;
	}

	let { title, description, action, children }: Props = $props();
</script>

<section class="rounded-lg border border-line bg-panel panel-shadow">
	<header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
		<div class="min-w-0">
			<h2 class="text-sm font-semibold text-ink">{title}</h2>
			{#if description}
				<p class="mt-0.5 text-xs text-muted">{description}</p>
			{/if}
		</div>
		{#if action}
			{@render action()}
		{/if}
	</header>
	<div class="space-y-4 px-4 py-4">
		{@render children()}
	</div>
</section>
