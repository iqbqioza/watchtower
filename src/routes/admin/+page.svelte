<script lang="ts">
	import { onMount } from 'svelte';
	import { admin } from '$lib/admin.svelte.js';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { session } from '$lib/session.svelte.js';

	const wsStates = {
		offline: 'offline',
		connecting: 'connecting...',
		connected: 'connected, not authenticated',
		authenticated: 'connected and authenticated',
		failed: 'authentication failed'
	} as const;

	onMount(() => {
		void admin.load();
	});
</script>

<div class="space-y-5">
	<PageHeader
		title="Overview"
		description="How this tab talks to the relay. Both connections stay open while you work."
	/>

	<Panel title="Connection" description={session.relayUrl}>
		{#snippet action()}
			<Button size="sm" onclick={() => void admin.load(true)} disabled={admin.loading}>
				{#if admin.loading}
					<Spinner label="Checking the relay" />
				{:else}
					<Icon name="refresh" />
				{/if}
				Check again
			</Button>
		{/snippet}

		<dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
			<div class="min-w-0">
				<dt class="text-xs text-muted">Management API (NIP-86 over HTTPS)</dt>
				<dd class="mt-1 text-sm">
					{#if admin.loading && admin.methods.length === 0}
						<span class="flex items-center gap-2 text-muted">
							<Spinner label="Checking" />
							Checking...
						</span>
					{:else if admin.error}
						<span class="text-red-700 dark:text-red-400">Not available</span>
					{:else}
						{admin.methods.length} methods supported
					{/if}
				</dd>
			</div>

			<div class="min-w-0">
				<dt class="text-xs text-muted">Websocket (NIP-01, NIP-42)</dt>
				<dd class="mt-1 text-sm">{wsStates[relayConnection.status]}</dd>
			</div>

			<div class="min-w-0 sm:col-span-2">
				<dt class="text-xs text-muted">Your public key</dt>
				<dd class="mt-1 flex min-w-0 items-center gap-0.5">
					<span class="truncate font-mono text-xs">{session.npub}</span>
					<CopyButton value={session.npub ?? ''} label="Copy your npub" />
				</dd>
			</div>
		</dl>

		{#if admin.error}
			<Notice tone="error">{admin.error}</Notice>
		{/if}
		{#if relayConnection.notice}
			<Notice>Relay notice: {relayConnection.notice}</Notice>
		{/if}
	</Panel>

	<Panel title="Supported methods" description="As reported by the relay through supportedmethods.">
		{#if admin.loading && admin.methods.length === 0}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the method list" />
				Loading...
			</p>
		{:else if admin.methods.length === 0}
			<Notice>No methods were reported. Check the key and the relay URL above.</Notice>
		{:else}
			<ul class="flex flex-wrap gap-1.5">
				{#each [...admin.methods].sort() as method (method)}
					<li><Badge mono>{method}</Badge></li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>
