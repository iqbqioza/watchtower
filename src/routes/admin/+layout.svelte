<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { admin } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { session } from '$lib/session.svelte.js';
	import { signerActivity } from '$lib/signer-activity.svelte.js';

	let { children } = $props();

	// Status, then the work queue, then the block/allow lists (people, content,
	// network), then policy, and the relay's own settings last.
	const links = [
		{ href: resolve('/admin'), label: 'Overview' },
		{ href: resolve('/admin/moderation'), label: 'Moderation' },
		{ href: resolve('/admin/pubkeys'), label: 'Pubkeys' },
		{ href: resolve('/admin/events'), label: 'Events' },
		{ href: resolve('/admin/ips'), label: 'IPs' },
		{ href: resolve('/admin/kinds'), label: 'Kinds' },
		{ href: resolve('/admin/roles'), label: 'Roles' },
		{ href: resolve('/admin/relay'), label: 'Relay' }
	];

	const statusLabels = {
		offline: 'offline',
		connecting: 'connecting',
		connected: 'connected',
		authenticated: 'authenticated',
		failed: 'auth failed'
	} as const;

	/** Longer explanation for the short label, shown on hover. */
	const statusTitles = {
		offline: 'Not connected to the relay',
		connecting: 'Connecting to the relay',
		connected: 'Connected; the relay has not asked for authentication',
		authenticated: 'Connected and authenticated with NIP-42',
		failed: 'The relay rejected our NIP-42 authentication'
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
	/** Tab title follows the navigation entry of the current screen. */
	const pageTitle = $derived(
		links.find((link) => link.href === page.url.pathname)?.label ?? 'Admin'
	);
	const canReconnect = $derived(
		relayConnection.status === 'offline' || relayConnection.status === 'failed'
	);

	// Shown instead of the screens when the relay cannot be managed at all.
	const failureTitles = {
		unsupported: 'This relay does not offer the NIP-86 management API',
		auth: 'This key cannot manage the relay',
		error: 'The relay cannot be managed right now'
	} as const;
	const failureTexts = {
		unsupported:
			'WatchTower manages relays over the NIP-86 HTTP API on the same address as the websocket. This address answered something else: the relay may only speak websocket, or its management API is turned off.',
		auth: 'The relay accepts management requests but rejected this key. Add the key to the relay admins (or use a key that is already allowed) and try again.',
		error: 'The management API did not answer. Check that the relay is reachable and try again.'
	} as const;
	const failureTitle = $derived(admin.failure ? failureTitles[admin.failure] : '');
	const failureText = $derived(admin.failure ? failureTexts[admin.failure] : '');

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
			admin.reset();
			session.signOut();
			return;
		}
		if (!session.isAuthenticated) {
			admin.reset();
			// A failed redirect leaves the page as it is; nothing to do here.
			void goto(resolve('/')).catch(() => {});
		}
	});

	function signOut() {
		relayConnection.stop();
		admin.reset();
		session.signOut();
		void goto(resolve('/')).catch(() => {});
	}
</script>

<svelte:head><title>{pageTitle} | WatchTower</title></svelte:head>

{#if session.isAuthenticated}
	<div class="flex min-h-screen flex-col bg-bg text-ink">
		<div class="md:sticky md:top-0 md:z-20 md:bg-bg/90 md:backdrop-blur-sm">
			<header class="border-b border-line">
				<div class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
					<a class="flex items-center gap-2" href={resolve('/admin')}>
						<Logo size="sm" />
						<span class="text-sm font-semibold">WatchTower</span>
					</a>

					<div class="flex min-w-0 items-center gap-0.5">
						<span class="truncate font-mono text-xs text-muted">{session.relayUrl}</span>
						<CopyButton value={session.relayUrl} label="Copy the relay URL" />
					</div>

					<div class="ml-auto flex items-center gap-2">
						<span
							class="flex items-center gap-1.5 text-xs text-muted"
							title={statusTitles[relayConnection.status]}
						>
							<span class="size-1.5 rounded-full {statusDot}"></span>
							<span class="hidden sm:inline">{statusLabel}</span>
						</span>
						{#if canReconnect}
							<Button size="sm" onclick={() => relayConnection.start()}>
								<Icon name="refresh" />
								Reconnect
							</Button>
						{/if}
						<ThemeToggle />
						<Button size="sm" title="Sign out" onclick={signOut}>
							<Icon name="signout" />
							<span class="hidden sm:inline">Sign out</span>
						</Button>
					</div>
				</div>
			</header>

			{#if !admin.failure}
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
			{/if}
		</div>

		<main class="mx-auto w-full max-w-3xl px-4 py-6">
			{#if admin.failure}
				<div class="rounded-lg border border-line bg-panel p-5 panel-shadow">
					<div class="flex items-start gap-3">
						<span class="mt-0.5 text-amber-500"><Icon name="warning" size={18} /></span>
						<div class="min-w-0 flex-1 space-y-3">
							<div>
								<h2 class="text-sm font-semibold">{failureTitle}</h2>
								<p class="mt-1 text-sm text-muted">{failureText}</p>
							</div>
							{#if admin.error}
								<p
									class="rounded-md border border-line bg-control px-3 py-2 font-mono text-xs break-words text-muted"
								>
									{admin.error}
								</p>
							{/if}
							<div class="flex flex-wrap gap-2">
								<Button
									variant="primary"
									disabled={admin.loading}
									onclick={() => void admin.load(true)}
								>
									{#if admin.loading}
										<Spinner label="Trying again" />
									{:else}
										<Icon name="refresh" />
									{/if}
									Try again
								</Button>
								<Button onclick={signOut}>Sign out</Button>
							</div>
						</div>
					</div>
				</div>
			{:else}
				{@render children()}
			{/if}
		</main>

		<div class="mt-auto">
			<Footer />
		</div>

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

		<ConfirmDialog />
	</div>
{/if}
