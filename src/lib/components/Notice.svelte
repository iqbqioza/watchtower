<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	type Tone = 'info' | 'success' | 'warning' | 'error';

	interface Props {
		tone?: Tone;
		children: Snippet;
	}

	let { tone = 'info', children }: Props = $props();

	const styles: Record<Tone, string> = {
		info: 'border-line bg-control text-ink',
		success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
		warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
		error: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200'
	};

	const icons: Record<Tone, IconName> = {
		info: 'info',
		success: 'success',
		warning: 'warning',
		error: 'error'
	};
</script>

<div
	class="flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm {styles[tone]}"
	role={tone === 'error' ? 'alert' : undefined}
>
	<span class="mt-0.5 shrink-0"><Icon name={icons[tone]} /></span>
	<div class="min-w-0">{@render children()}</div>
</div>
