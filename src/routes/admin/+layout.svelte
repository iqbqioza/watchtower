<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { admin } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { session } from '$lib/session.svelte.js';
	import { signerActivity } from '$lib/signer-activity.svelte.js';

	let { children } = $props();

	const links = [
		{ href: resolve('/admin'), label: 'Overview' },
		{ href: resolve('/admin/pubkeys'), label: 'Pubkeys' },
		{ href: resolve('/admin/events'), label: 'Events' },
		{ href: resolve('/admin/moderation'), label: 'Moderation' },
		{ href: resolve('/admin/ips'), label: 'IPs' },
		{ href: resolve('/admin/kinds'), label: 'Kinds' },
		{ href: resolve('/admin/relay'), label: 'Relay' },
		{ href: resolve('/admin/roles'), label: 'Roles' }
	];

	const statusLabels = {
		offline: 'relay offline',
		connecting: 'connecting...',
		connected: 'relay connected',
		authenticated: 'relay authenticated',
		failed: 'authentication failed'
	} as const;

	const statusDots = {
		offline: 'bg-muted',
		connecting: 'bg-amber-400',
		connected: 'bg-emerald-500',
		authenticated: 'bg-emerald-500',
		failed: 'bg-red-500'
	} as const;

	// The header reports the connection only; extension prompts are shown by the
	// banner below, so the text does not change while pages load.
	const statusLabel = $derived(statusLabels[relayConnection.status]);
	const statusDot = $derived(statusDots[relayConnection.status]);
	const canReconnect = $derived(
		relayConnection.status === 'offline' || relayConnection.status === 'failed'
	);

	// The panel keeps one connection to the relay: the method list over HTTP
	// and the websocket that the moderation screen reads events from.
	onMount(() => {
		void admin.load();
		relayConnection.start();
	});

	onDestroy(() => relayConnection.stop());

	$effect(() => {
		if (session.isAuthenticated && !session.signer) {
			// The extension is gone (uninstalled or another browser profile).
			session.signOut();
			return;
		}
		if (!session.isAuthenticated) {
			void goto(resolve('/'));
		}
	});

	function signOut() {
		relayConnection.stop();
		session.signOut();
		void goto(resolve('/'));
	}
</script>

{#if session.isAuthenticated}
	<div class="min-h-screen bg-bg text-ink">
		<header class="border-b border-line">
			<div class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
				<a class="flex items-center gap-2" href={resolve('/admin')}>
					<Logo size="sm" />
					<span class="text-sm font-semibold">Tower</span>
				</a>

				<div class="flex min-w-0 items-center gap-0.5">
					<span class="truncate font-mono text-xs text-muted">{session.relayUrl}</span>
					<CopyButton value={session.relayUrl} label="Copy the relay URL" />
				</div>

				<div class="ml-auto flex items-center gap-2">
					<span class="hidden items-center gap-1.5 text-xs text-muted sm:flex">
						<span class="size-1.5 rounded-full {statusDot}"></span>
						{statusLabel}
					</span>
					{#if canReconnect}
						<Button size="sm" onclick={() => relayConnection.start()}>
							<Icon name="refresh" />
							Reconnect
						</Button>
					{/if}
					<ThemeToggle />
					<Button size="sm" onclick={signOut}>
						<Icon name="signout" />
						<span class="hidden sm:inline">Sign out</span>
					</Button>
				</div>
			</div>
		</header>

		<nav class="border-b border-line">
			<div class="mx-auto flex max-w-3xl flex-wrap gap-1 px-4 py-2">
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={page.url.pathname === link.href ? 'page' : undefined}
						class="rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors {page.url
							.pathname === link.href
							? 'bg-control font-medium text-ink'
							: 'text-muted hover:bg-control/60 hover:text-ink'}"
					>
						{link.label}
					</a>
				{/each}
			</div>
		</nav>

		<main class="mx-auto max-w-3xl px-4 py-6">
			{@render children()}
		</main>

		{#if signerActivity.pending}
			<div
				class="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4"
				role="status"
			>
				<span
					class="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-ink panel-shadow"
				>
					<Spinner label="Waiting for the browser extension" />
					Waiting for the browser extension to approve...
				</span>
			</div>
		{/if}
	</div>
{/if}
