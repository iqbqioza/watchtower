<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { admin } from '$lib/admin.svelte.js';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { session } from '$lib/session.svelte.js';

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
		offline: 'bg-neutral-500',
		connecting: 'bg-amber-400',
		connected: 'bg-emerald-400',
		authenticated: 'bg-emerald-400',
		failed: 'bg-red-400'
	} as const;

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
	<div class="min-h-screen bg-neutral-950 text-neutral-100">
		<header class="border-b border-neutral-800">
			<div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
				<div class="min-w-0">
					<p class="text-sm font-semibold">Tower</p>
					<p class="truncate font-mono text-xs text-neutral-400">{session.relayUrl}</p>
				</div>
				<div class="flex items-center gap-3">
					<span class="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex">
						<span class="size-1.5 rounded-full {statusDot}"></span>
						{statusLabel}
					</span>
					{#if canReconnect}
						<button
							type="button"
							onclick={() => relayConnection.start()}
							class="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
						>
							Reconnect
						</button>
					{/if}
					<span class="hidden max-w-56 truncate font-mono text-xs text-neutral-500 md:block">
						{session.npub}
					</span>
					<button
						type="button"
						onclick={signOut}
						class="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
					>
						Sign out
					</button>
				</div>
			</div>
		</header>

		<nav class="border-b border-neutral-800">
			<div class="mx-auto flex max-w-3xl flex-wrap gap-1 px-4 py-2">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded-md px-3 py-1.5 text-sm whitespace-nowrap {page.url.pathname === link.href
							? 'bg-neutral-800 text-neutral-100'
							: 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}"
					>
						{link.label}
					</a>
				{/each}
			</div>
		</nav>

		<main class="mx-auto max-w-3xl px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}
