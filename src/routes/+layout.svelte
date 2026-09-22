<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { session } from '$lib/session.svelte.js';

	// CSR only: restore before the first page renders, so route guards already
	// see the session that is kept in sessionStorage.
	session.restore();

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
