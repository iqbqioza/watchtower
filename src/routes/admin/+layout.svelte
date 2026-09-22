<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$lib/session.svelte.js';

	let { children } = $props();

	$effect(() => {
		if (!session.isAuthenticated) {
			void goto(resolve('/'));
		}
	});

	function signOut() {
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
					<span class="hidden max-w-64 truncate font-mono text-xs text-neutral-500 sm:block">
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
		<main class="mx-auto max-w-3xl px-4 py-8">
			{@render children()}
		</main>
	</div>
{/if}
