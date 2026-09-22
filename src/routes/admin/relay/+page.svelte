<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { npubFromPubkey } from '$lib/nostr/keys';
	import { fetchRelayInformation, type RelayInformation } from '$lib/nostr/nip11';
	import { session } from '$lib/session.svelte.js';

	let name = $state('');
	let description = $state('');
	let icon = $state('');
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let information = $state<RelayInformation | null>(null);
	let informationError = $state<string | null>(null);
	let informationLoading = $state(true);

	const canName = $derived(admin.supports('changerelayname'));
	const canDescription = $derived(admin.supports('changerelaydescription'));
	const canIcon = $derived(admin.supports('changerelayicon'));

	const operator = $derived(
		typeof information?.pubkey === 'string' ? friendlyPubkey(information.pubkey) : null
	);

	onMount(async () => {
		await admin.ensure();
		await loadInformation();
	});

	function friendlyPubkey(pubkey: string): string {
		try {
			return npubFromPubkey(pubkey);
		} catch {
			return pubkey;
		}
	}

	/** Reads the NIP-11 document and fills in the forms that are still empty. */
	async function loadInformation(): Promise<void> {
		informationLoading = true;
		informationError = null;
		try {
			const document = await fetchRelayInformation(session.relayUrl);
			information = document;
			if (canName && !name) name = document.name ?? '';
			if (canDescription && !description) description = document.description ?? '';
			if (canIcon && !icon) icon = document.icon ?? '';
		} catch (cause) {
			information = null;
			informationError = describeError(cause);
		} finally {
			informationLoading = false;
		}
	}

	async function submit(
		method: 'changerelayname' | 'changerelaydescription' | 'changerelayicon',
		value: string,
		label: string,
		clear: () => void
	): Promise<void> {
		error = null;
		success = null;
		const trimmed = value.trim();
		if (!trimmed) {
			error = `Enter a value for the relay ${label} first.`;
			return;
		}

		busy = method;
		try {
			await admin.call(method, [trimmed]);
			success = `Relay ${label} updated.`;
			clear();
			await loadInformation();
		} catch (cause) {
			error = describeError(cause);
		} finally {
			busy = null;
		}
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Relay"
		description="What the relay publishes about itself, and the parts of it this key can change."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel
		title="Current information"
		description="Read directly from the relay with NIP-11 (Accept: application/nostr+json)."
	>
		{#snippet action()}
			<Button size="sm" onclick={() => void loadInformation()} disabled={informationLoading}>
				{#if informationLoading}
					<Spinner label="Reading the relay information" />
				{:else}
					<Icon name="refresh" />
				{/if}
				Read again
			</Button>
		{/snippet}

		{#if informationLoading && !information}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Reading the relay information" />
				Reading...
			</p>
		{:else if informationError}
			<Notice tone="warning">
				{informationError}. The relay may not publish a NIP-11 document, or the browser may have
				blocked the request.
			</Notice>
		{:else if information}
			<dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
				<div class="min-w-0">
					<dt class="text-xs text-muted">Name</dt>
					<dd class="mt-1 text-sm">{information.name ?? 'not set'}</dd>
				</div>

				<div class="min-w-0">
					<dt class="text-xs text-muted">Software</dt>
					<dd class="mt-1 text-sm">
						{information.software ?? 'unknown'}{information.version
							? ` ${information.version}`
							: ''}
					</dd>
				</div>

				{#if information.pubkey}
					<div class="min-w-0 sm:col-span-2">
						<dt class="text-xs text-muted">Operator</dt>
						<dd class="mt-1 flex min-w-0 items-center gap-0.5">
							<span class="truncate font-mono text-xs">{operator}</span>
							<CopyButton value={operator ?? ''} label="Copy the operator pubkey" />
						</dd>
					</div>
				{/if}

				<div class="min-w-0 sm:col-span-2">
					<dt class="text-xs text-muted">Description</dt>
					<dd class="mt-1 text-sm break-words whitespace-pre-wrap">
						{information.description ?? 'not set'}
					</dd>
				</div>

				{#if information.icon}
					<div class="min-w-0 sm:col-span-2">
						<dt class="text-xs text-muted">Icon</dt>
						<dd class="mt-1 flex items-center gap-2">
							<img
								src={information.icon}
								alt=""
								class="size-8 shrink-0 rounded-md border border-line object-cover"
							/>
							<span class="truncate font-mono text-xs text-muted">{information.icon}</span>
						</dd>
					</div>
				{/if}

				{#if information.contact}
					<div class="min-w-0 sm:col-span-2">
						<dt class="text-xs text-muted">Contact</dt>
						<dd class="mt-1 truncate text-sm">{information.contact}</dd>
					</div>
				{/if}

				{#if information.supported_nips && information.supported_nips.length > 0}
					<div class="sm:col-span-2">
						<dt class="text-xs text-muted">Supported NIPs</dt>
						<dd class="mt-1.5 flex flex-wrap gap-1.5">
							{#each information.supported_nips as nip (nip)}
								<Badge mono>{nip}</Badge>
							{/each}
						</dd>
					</div>
				{/if}
			</dl>

			<details>
				<summary class="cursor-pointer text-xs text-muted">Raw document</summary>
				<pre
					class="mt-1.5 overflow-x-auto rounded-md border border-line p-3 text-xs text-muted">{JSON.stringify(
						information,
						null,
						2
					)}</pre>
			</details>
		{/if}
	</Panel>

	<Panel
		title="Change relay information"
		description="changerelayname / changerelaydescription / changerelayicon"
	>
		{#if !canName}
			<Notice>This relay does not support changerelayname.</Notice>
		{:else}
			<form
				class="flex flex-wrap items-end gap-3"
				onsubmit={(event) => {
					event.preventDefault();
					void submit('changerelayname', name, 'name', () => (name = ''));
				}}
			>
				<div class="min-w-56 flex-1">
					<TextField label="Name" bind:value={name} placeholder="My relay" />
				</div>
				<Button type="submit" disabled={busy !== null}>Change name</Button>
			</form>
		{/if}

		{#if !canDescription}
			<Notice>This relay does not support changerelaydescription.</Notice>
		{:else}
			<form
				class="flex flex-wrap items-end gap-3 border-t border-line pt-4"
				onsubmit={(event) => {
					event.preventDefault();
					void submit(
						'changerelaydescription',
						description,
						'description',
						() => (description = '')
					);
				}}
			>
				<div class="min-w-56 flex-1">
					<TextField
						label="Description"
						bind:value={description}
						placeholder="A relay for friends"
					/>
				</div>
				<Button type="submit" disabled={busy !== null}>Change description</Button>
			</form>
		{/if}

		{#if !canIcon}
			<Notice>This relay does not support changerelayicon.</Notice>
		{:else}
			<form
				class="flex flex-wrap items-end gap-3 border-t border-line pt-4"
				onsubmit={(event) => {
					event.preventDefault();
					void submit('changerelayicon', icon, 'icon', () => (icon = ''));
				}}
			>
				<div class="min-w-56 flex-1">
					<TextField
						label="Icon URL"
						bind:value={icon}
						mono
						placeholder="https://example.com/icon.png"
					/>
				</div>
				<Button type="submit" disabled={busy !== null}>Change icon</Button>
			</form>
		{/if}
	</Panel>
</div>
