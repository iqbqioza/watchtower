<script lang="ts">
	import { iconPaths, type IconName } from './icons';

	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 16 }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class="shrink-0"
>
	<path d={iconPaths[name]} />
</svg>
