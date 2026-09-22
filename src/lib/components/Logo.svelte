<script lang="ts">
	interface Props {
		size?: 'sm' | 'md';
	}

	let { size = 'md' }: Props = $props();
	const box = $derived(size === 'sm' ? 'size-6' : 'size-7');
</script>

<span
	class="{box} flex shrink-0 items-center justify-center rounded-md bg-ink text-bg"
	aria-hidden="true"
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="size-4">
		<path d="M5 5h14M12 5v14M8 19h8" stroke-linecap="round" />
	</svg>
</span>
