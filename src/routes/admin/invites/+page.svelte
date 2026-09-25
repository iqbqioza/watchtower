<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import { confirmDialog } from '$lib/components/confirm.svelte.js';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { validateClaim } from '$lib/nostr/nip86';

	let claims = $state<string[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let claimInput = $state('');

	onMount(async () => {
		try {
			if (!(await admin.ensure())) return;
			await refresh();
		} catch (cause) {
			error = describeError(cause);
		} finally {
			loading = false;
		}
	});

	async function refresh(): Promise<void> {
		if (!admin.supports('listclaims')) return;
		claims = await admin.call<string[]>('listclaims');
	}

	async function run(key: string, action: () => Promise<unknown>, message: string): Promise<void> {
		error = null;
		success = null;
		busy = key;
		try {
			await action();
			await refresh();
			success = message;
		} catch (cause) {
			error = describeError(cause);
		} finally {
			busy = null;
		}
	}

	async function create(): Promise<void> {
		let claim: string;
		try {
			claim = validateClaim(claimInput);
		} catch (cause) {
			error = describeError(cause);
			return;
		}
		await run('create', () => admin.call('createclaim', [claim]), 'Claim created.');
		claimInput = '';
	}

	async function remove(claim: string): Promise<void> {
		if (
			!(await confirmDialog.ask({
				title: 'Delete claim',
				message: `${claim} will no longer work as an invite.`,
				confirmLabel: 'Delete claim'
			}))
		) {
			return;
		}
		await run(`delete:${claim}`, () => admin.call('deleteclaim', [claim]), 'Claim deleted.');
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Invites"
		description="Codes a pubkey can present to claim membership on this relay (NIP-43 invite claims)."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Invite claims" description="listclaims / deleteclaim">
		{#snippet action()}
			<Button size="sm" onclick={() => void refresh()} disabled={loading}>
				{#if loading}
					<Spinner label="Reading the invite claims" />
				{:else}
					<Icon name="refresh" />
				{/if}
				Reload
			</Button>
		{/snippet}

		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Reading the invite claims" />
				Loading...
			</p>
		{:else if admin.lacks('listclaims')}
			<Notice>This relay does not support listclaims.</Notice>
		{:else if admin.ready}
			{#if claims.length === 0}
				<p class="text-sm text-muted">No invite claim is waiting to be used.</p>
			{:else}
				<ul class="divide-y divide-line overflow-hidden rounded-md border border-line">
					{#each claims as claim (claim)}
						<li class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5">
							<span class="min-w-0 flex-1 font-mono text-xs break-all text-ink">{claim}</span>
							<span class="flex shrink-0 items-center gap-1">
								<CopyButton value={claim} label="Copy the claim" />
								{#if admin.supports('deleteclaim')}
									<Button
										size="sm"
										variant="ghost"
										disabled={busy !== null}
										title="Delete this claim"
										onclick={() => void remove(claim)}
									>
										Delete
									</Button>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</Panel>

	<Panel title="Create a claim" description="createclaim">
		{#if admin.lacks('createclaim')}
			<Notice>This relay does not support createclaim.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3"
				onsubmit={(event) => {
					event.preventDefault();
					void create();
				}}
			>
				<TextField
					label="Claim"
					bind:value={claimInput}
					mono
					placeholder="a code you hand out"
					hint="Up to 128 characters, no surrounding spaces. The relay matches it exactly."
				/>
				<div class="flex justify-end">
					<Button type="submit" disabled={!claimInput.trim() || busy !== null}>Create claim</Button>
				</div>
			</form>
		{/if}
	</Panel>
</div>
