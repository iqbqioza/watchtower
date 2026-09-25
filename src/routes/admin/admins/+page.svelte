<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import { confirmDialog } from '$lib/components/confirm.svelte.js';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import MultiSelectField from '$lib/components/MultiSelectField.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { npubFromPubkey, pubkeyHexFromInput } from '$lib/nostr/keys';
	import { GRANTABLE_METHODS } from '$lib/nostr/nip86';

	interface MethodGrant {
		pubkey: string;
		methods: string[];
	}

	let grants = $state<MethodGrant[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let pubkeyInput = $state('');
	let methodSelection = $state<string[]>([]);

	const methodOptions = GRANTABLE_METHODS.map((method) => ({ value: method, label: method }));

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
		if (!admin.supports('listmethodassignees')) return;
		grants = await admin.call<MethodGrant[]>('listmethodassignees');
	}

	function friendly(pubkey: string): string {
		try {
			return npubFromPubkey(pubkey);
		} catch {
			return pubkey;
		}
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

	/** Lets another pubkey call NIP-86 methods; the relay takes one per call. */
	async function grant(): Promise<void> {
		let pubkey: string;
		try {
			pubkey = pubkeyHexFromInput(pubkeyInput);
		} catch (cause) {
			error = describeError(cause);
			return;
		}
		const methods = [...methodSelection];
		if (methods.length === 0) {
			error = 'Choose at least one method to grant.';
			return;
		}
		if (
			!(await confirmDialog.ask({
				title: methods.length === 1 ? 'Grant a method' : 'Grant methods',
				message: `${friendly(pubkey)} will be allowed to call ${methods.join(', ')} on this relay.`,
				confirmLabel: methods.length === 1 ? 'Grant method' : `Grant ${methods.length} methods`,
				danger: false
			}))
		) {
			return;
		}

		error = null;
		success = null;
		busy = `grant:${pubkey}`;
		const failures: string[] = [];
		try {
			for (const method of methods) {
				try {
					await admin.call('assignmethod', [pubkey, method]);
				} catch (cause) {
					failures.push(`${method}: ${describeError(cause)}`);
				}
			}
			await refresh();
			if (failures.length > 0) {
				error = `Some methods were not granted — ${failures.join('; ')}`;
			} else {
				success =
					methods.length === 1 ? `${methods[0]} granted.` : `${methods.length} methods granted.`;
				pubkeyInput = '';
				methodSelection = [];
			}
		} finally {
			busy = null;
		}
	}

	async function revoke(pubkey: string, method: string): Promise<void> {
		if (
			!(await confirmDialog.ask({
				title: 'Revoke a method',
				message: `${friendly(pubkey)} will no longer be allowed to call ${method}.`,
				confirmLabel: 'Revoke method'
			}))
		) {
			return;
		}
		await run(
			`revoke:${pubkey}:${method}`,
			() => admin.call('unassignmethod', [pubkey, method]),
			`${method} revoked.`
		);
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Administrators"
		description="Pubkeys that may call individual NIP-86 methods without being full admins."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Granted methods" description="listmethodassignees / unassignmethod">
		{#snippet action()}
			<Button size="sm" onclick={() => void refresh()} disabled={loading}>
				{#if loading}
					<Spinner label="Reading the assignees" />
				{:else}
					<Icon name="refresh" />
				{/if}
				Reload
			</Button>
		{/snippet}

		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Reading the assignees" />
				Loading...
			</p>
		{:else if admin.lacks('listmethodassignees')}
			<Notice>This relay does not support listmethodassignees.</Notice>
		{:else if admin.ready}
			{#if grants.length === 0}
				<p class="text-sm text-muted">No method has been granted to another pubkey yet.</p>
			{:else}
				<ul class="divide-y divide-line overflow-hidden rounded-md border border-line">
					{#each grants as grant (grant.pubkey)}
						<li class="px-3 py-3">
							<div class="flex items-center gap-0.5">
								<span class="min-w-0 truncate font-mono text-xs text-ink">
									{friendly(grant.pubkey)}
								</span>
								<CopyButton value={grant.pubkey} label="Copy the pubkey" />
							</div>
							{#if grant.methods.length === 0}
								<p class="mt-1 text-xs text-muted">No methods granted.</p>
							{:else}
								<ul class="mt-2 space-y-1">
									{#each grant.methods as method (method)}
										<li class="flex flex-wrap items-center gap-x-2 gap-y-1">
											<Badge mono>{method}</Badge>
											{#if admin.supports('unassignmethod')}
												<Button
													size="sm"
													variant="ghost"
													disabled={busy !== null}
													title="Revoke this method from the pubkey"
													onclick={() => void revoke(grant.pubkey, method)}
												>
													Revoke
												</Button>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</Panel>

	<Panel title="Grant methods" description="assignmethod">
		{#if admin.lacks('assignmethod')}
			<Notice>This relay does not support assignmethod.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void grant();
				}}
			>
				<TextField
					label="Pubkey (hex or npub)"
					bind:value={pubkeyInput}
					mono
					placeholder="npub1..."
				/>
				<MultiSelectField
					label="Methods"
					bind:values={methodSelection}
					options={methodOptions}
					placeholder="Choose methods..."
					hint="Several methods can be picked at once."
				/>
				<div class="flex justify-end sm:col-span-2">
					<Button type="submit" disabled={!pubkeyInput.trim() || busy !== null}>
						{methodSelection.length > 1
							? `Grant ${methodSelection.length} methods`
							: 'Grant method'}
					</Button>
				</div>
			</form>
			<p class="text-xs text-muted">
				Only moderation verbs and read-only lists can be granted. Roles, invite claims, relay
				settings and permission management itself stay with the relay admins.
			</p>
		{/if}
	</Panel>
</div>
