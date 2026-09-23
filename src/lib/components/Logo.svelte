<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg' | 'xl';
	}

	let { size = 'md' }: Props = $props();
	const box = $derived(
		size === 'sm' ? 'size-6' : size === 'lg' ? 'size-10' : size === 'xl' ? 'size-16' : 'size-7'
	);
</script>

<img src="/icon-64.png" alt="" class="{box} shrink-0 object-contain" />
