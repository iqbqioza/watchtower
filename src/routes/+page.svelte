<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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

<div
	class="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10 text-neutral-100"
>
	<main class="w-full max-w-md">
		<h1 class="text-2xl font-semibold tracking-tight">Tower</h1>
		<p class="mt-1 text-sm text-neutral-400">NIP-86 relay admin panel</p>

		<form class="mt-8 space-y-5" onsubmit={signIn}>
			<div>
				<label class="block text-sm font-medium" for="nsec">Private key (nsec)</label>
				<div class="mt-1 flex gap-2">
					<input
						id="nsec"
						type={revealKey ? 'text' : 'password'}
						bind:value={nsec}
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						placeholder="nsec1..."
						class="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
					/>
					<button
						type="button"
						onclick={() => (revealKey = !revealKey)}
						class="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
					>
						{revealKey ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<div>
				<label class="block text-sm font-medium" for="relay">Relay URL</label>
				<input
					id="relay"
					type="text"
					bind:value={relayUrl}
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					placeholder="wss://relay.example.com"
					class="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
				/>
			</div>

			{#if error}
				<p
					class="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200"
					role="alert"
				>
					{error}
				</p>
			{/if}

			<button
				type="submit"
				disabled={busy}
				class="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
			>
				{busy ? 'Connecting...' : 'Sign in'}
			</button>
		</form>

		<p class="mt-6 text-xs leading-relaxed text-neutral-500">
			The key is kept in this tab's sessionStorage and is gone when the tab closes. Use an admin key
			that the relay accepts for NIP-86.
		</p>
	</main>
</div>
