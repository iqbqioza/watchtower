<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { browserNostrProvider } from '$lib/nostr/signer';
	import { session } from '$lib/session.svelte.js';

	let relayUrl = $state('wss://');
	let error = $state<string | null>(null);
	let busy = $state(false);
	// Only the presence is kept in state; the provider object itself must not
	// be wrapped in a proxy.
	let hasExtension = $state(browserNostrProvider() !== null);

	$effect(() => {
		if (session.isAuthenticated) {
			void goto(resolve('/admin'));
		}
	});

	// Extensions can be injected after the first paint, so look again when the
	// window gets focus (for example after installing one).
	onMount(() => {
		const check = () => (hasExtension = browserNostrProvider() !== null);
		check();
		window.addEventListener('focus', check);
		return () => window.removeEventListener('focus', check);
	});

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		busy = true;
		try {
			await session.signIn(relayUrl);
			await goto(resolve('/admin'));
		} catch (cause) {
			hasExtension = browserNostrProvider() !== null;
			error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<div class="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
	<div class="absolute top-4 right-4">
		<ThemeToggle />
	</div>

	<main class="w-full max-w-md rounded-xl border border-line bg-panel p-6 panel-shadow">
		<div class="flex items-center gap-2.5">
			<Logo />
			<div>
				<h1 class="text-base font-semibold">Tower</h1>
				<p class="text-xs text-muted">NIP-86 relay admin panel</p>
			</div>
		</div>

		<form class="mt-6 space-y-4" onsubmit={signIn}>
			<TextField
				label="Relay URL"
				bind:value={relayUrl}
				mono
				placeholder="wss://relay.example.com"
				hint="The management API is reached over https on the same host."
			/>

			{#if error}
				<Notice tone="error">{error}</Notice>
			{/if}

			<Button type="submit" variant="primary" disabled={busy || !hasExtension}>
				{#if busy}
					<Spinner label="Waiting for the extension" />
					Waiting for the extension...
				{:else}
					<Icon name="signin" />
					Sign in with browser extension
				{/if}
			</Button>
		</form>

		{#if !hasExtension}
			<Notice tone="warning">
				No NIP-07 extension was found. Install one (for example nos2x or Alby), then focus this
				window again.
			</Notice>
		{/if}

		<p class="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
			Your key stays in the extension and is never sent to this page. The relay must accept the
			extension's key for NIP-86.
		</p>
	</main>
</div>
