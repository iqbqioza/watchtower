<script lang="ts">
	interface Props {
		label?: string;
	}

	let { label = 'Loading' }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width="16"
	height="16"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	class="animate-spin motion-reduce:animate-none"
	role="status"
	aria-label={label}
>
	<path d="M12 4a8 8 0 018 8" />
</svg>
