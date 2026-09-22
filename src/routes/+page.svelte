<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { secretKeyFromNsec } from '$lib/nostr/keys';
	import { session } from '$lib/session.svelte.js';

	let nsec = $state('');
	let relayUrl = $state('wss://');
	let revealKey = $state(false);
	let error = $state<string | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (session.isAuthenticated) {
			void goto(resolve('/admin'));
		}
	});

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		busy = true;
		try {
			const secretKey = secretKeyFromNsec(nsec);
			session.signIn(secretKey, relayUrl);
			// Do not keep the nsec in component state any longer than needed.
			nsec = '';
			await goto(resolve('/admin'));
		} catch (cause) {
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
				label="Private key (nsec)"
				bind:value={nsec}
				type={revealKey ? 'text' : 'password'}
				mono
				placeholder="nsec1..."
			>
				{#snippet trailing()}
					<Button variant="ghost" size="sm" onclick={() => (revealKey = !revealKey)}>
						<Icon name={revealKey ? 'eyeOff' : 'eye'} />
						<span class="sr-only">{revealKey ? 'Hide the key' : 'Show the key'}</span>
					</Button>
				{/snippet}
			</TextField>

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

			<Button type="submit" variant="primary" disabled={busy}>
				{#if busy}
					<Spinner label="Signing in" />
					Signing in...
				{:else}
					Sign in
				{/if}
			</Button>
		</form>

		<p class="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
			The key is kept in this tab's sessionStorage and is gone when the tab closes. Use a key that
			the relay accepts for NIP-86.
		</p>
	</main>
</div>
