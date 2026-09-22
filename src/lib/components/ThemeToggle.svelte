<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';
	import { theme, type ThemeMode } from '$lib/theme.svelte.js';

	const options: Array<{ mode: ThemeMode; icon: IconName; label: string }> = [
		{ mode: 'light', icon: 'sun', label: 'Light theme' },
		{ mode: 'dark', icon: 'moon', label: 'Dark theme' },
		{ mode: 'system', icon: 'monitor', label: 'Follow the system theme' }
	];
</script>

<div
	class="flex items-center gap-0.5 rounded-md border border-line bg-control p-0.5"
	role="group"
	aria-label="Theme"
>
	{#each options as option (option.mode)}
		<button
			type="button"
			onclick={() => theme.set(option.mode)}
			aria-pressed={theme.mode === option.mode}
			title={option.label}
			class="rounded p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus/50 {theme.mode ===
			option.mode
				? 'bg-panel text-ink panel-shadow'
				: 'text-muted hover:text-ink'}"
		>
			<Icon name={option.icon} />
			<span class="sr-only">{option.label}</span>
		</button>
	{/each}
</div>
