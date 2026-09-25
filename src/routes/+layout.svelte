<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { releaseFallbackWidget } from '$lib/nostr/signer';
	import { session } from '$lib/session.svelte.js';
	import { theme } from '$lib/theme.svelte.js';

	// CSR only: restore before the first page renders, so route guards already
	// see the session that is kept in sessionStorage.
	session.restore();
	onMount(() => {
		theme.start();
		// An extension installed while the tab is open replaces the fallback
		// signer, and the fallback widget has to go with it.
		const dropFallbackWidget = () => releaseFallbackWidget();
		dropFallbackWidget();
		window.addEventListener('focus', dropFallbackWidget);
		return () => window.removeEventListener('focus', dropFallbackWidget);
	});

	let { children } = $props();
</script>

{@render children()}
