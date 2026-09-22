<script lang="ts">
	import { onMount } from 'svelte';
	import { Nip86AuthError, createNip86Client } from '$lib/nostr/nip86';
	import { session } from '$lib/session.svelte.js';

	let methods = $state<string[]>([]);
	let error = $state<string | null>(null);
	let loading = $state(true);

	function describe(cause: unknown): string {
		if (cause instanceof Nip86AuthError) {
			return `${cause.message}. Check that this key is allowed to manage the relay.`;
		}
		return cause instanceof Error ? cause.message : String(cause);
	}

	onMount(async () => {
		if (!session.secretKey) return;
		try {
			methods = await createNip86Client({
				relayUrl: session.relayUrl,
				secretKey: session.secretKey
			}).supportedMethods();
		} catch (cause) {
			error = describe(cause);
		} finally {
			loading = false;
		}
	});
</script>

<section>
	<h2 class="text-lg font-semibold">Relay management API</h2>

	{#if loading}
		<p class="mt-3 text-sm text-neutral-400">Asking the relay which methods it supports...</p>
	{:else if error}
		<p
			class="mt-3 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200"
			role="alert"
		>
			{error}
		</p>
	{:else}
		<p class="mt-3 text-sm text-neutral-400">
			The relay accepts signed requests from this key and supports {methods.length} management methods.
		</p>
		<ul class="mt-4 flex flex-wrap gap-2">
			{#each methods as method (method)}
				<li
					class="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-300"
				>
					{method}
				</li>
			{/each}
		</ul>
	{/if}
</section>
