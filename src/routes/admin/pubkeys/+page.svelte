<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import { confirmDialog } from '$lib/components/confirm.svelte.js';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import ValueList, { type ValueListItem } from '$lib/components/ValueList.svelte';
	import { npubFromPubkey, pubkeyHexFromInput } from '$lib/nostr/keys';

	interface ReasonedPubkey {
		pubkey: string;
		reason?: string;
	}

	let banned = $state<ReasonedPubkey[]>([]);
	let allowed = $state<ReasonedPubkey[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let banKey = $state('');
	let banReason = $state('');
	let allowKey = $state('');
	let allowReason = $state('');

	const canUnban = $derived(admin.supports('unbanpubkey'));
	const canUnallow = $derived(admin.supports('unallowpubkey'));
	const canListBanned = $derived(admin.supports('listbannedpubkeys'));
	const canListAllowed = $derived(admin.supports('listallowedpubkeys'));

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
		if (canListBanned) {
			banned = await admin.call<ReasonedPubkey[]>('listbannedpubkeys');
		}
		if (canListAllowed) {
			allowed = await admin.call<ReasonedPubkey[]>('listallowedpubkeys');
		}
	}

	function toItems(items: ReasonedPubkey[]): ValueListItem[] {
		return items.map((item) => {
			let label = item.pubkey;
			try {
				label = npubFromPubkey(item.pubkey);
			} catch {
				// Non-standard values are shown as they are.
			}
			return { value: item.pubkey, label, sublabel: item.pubkey, reason: item.reason };
		});
	}

	async function change(
		action: () => Promise<unknown>,
		message: string,
		key: string
	): Promise<void> {
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

	function params(pubkey: string, reason: string): string[] {
		const trimmed = reason.trim();
		return trimmed ? [pubkey, trimmed] : [pubkey];
	}

	async function ban(): Promise<void> {
		let pubkey: string;
		try {
			pubkey = pubkeyHexFromInput(banKey);
		} catch (cause) {
			error = describeError(cause);
			return;
		}
		if (
			!(await confirmDialog.ask({
				title: 'Ban pubkey',
				message: `${pubkey} will no longer be able to publish to this relay.`,
				confirmLabel: 'Ban pubkey'
			}))
		) {
			return;
		}
		await change(
			() => admin.call('banpubkey', params(pubkey, banReason)),
			'Pubkey banned.',
			pubkey
		);
		banKey = '';
		banReason = '';
	}

	async function allow(): Promise<void> {
		let pubkey: string;
		try {
			pubkey = pubkeyHexFromInput(allowKey);
		} catch (cause) {
			error = describeError(cause);
			return;
		}
		await change(
			() => admin.call('allowpubkey', params(pubkey, allowReason)),
			'Pubkey allowed.',
			pubkey
		);
		allowKey = '';
		allowReason = '';
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Pubkeys"
		description="Who the relay refuses to accept events from, and who it always accepts."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Banned pubkeys" description="banpubkey / unbanpubkey / listbannedpubkeys">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the ban list" />
				Loading...
			</p>
		{:else if admin.lacks('listbannedpubkeys')}
			<Notice
				>This relay does not support listbannedpubkeys, so current bans cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(banned)}
				empty="No pubkeys are banned."
				actionLabel="Unban"
				showAction={canUnban}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('unbanpubkey', [item.value]),
						'Pubkey unbanned.',
						item.value
					)}
			/>
		{/if}

		{#if admin.lacks('banpubkey')}
			<Notice>This relay does not support banpubkey.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void ban();
				}}
			>
				<TextField label="Pubkey (hex or npub)" bind:value={banKey} mono placeholder="npub1..." />
				<TextField label="Reason (optional)" bind:value={banReason} placeholder="spam" />
				<div class="flex justify-end sm:col-span-2">
					<Button type="submit" variant="danger" disabled={!banKey.trim() || busy !== null}>
						Ban pubkey
					</Button>
				</div>
			</form>
		{/if}
	</Panel>

	<Panel title="Allowed pubkeys" description="allowpubkey / unallowpubkey / listallowedpubkeys">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the allow list" />
				Loading...
			</p>
		{:else if admin.lacks('listallowedpubkeys')}
			<Notice
				>This relay does not support listallowedpubkeys, so current entries cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(allowed)}
				empty="No pubkeys are allowed."
				actionLabel="Unallow"
				showAction={canUnallow}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('unallowpubkey', [item.value]),
						'Pubkey unallowed.',
						item.value
					)}
			/>
		{/if}

		{#if admin.lacks('allowpubkey')}
			<Notice>This relay does not support allowpubkey.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void allow();
				}}
			>
				<TextField label="Pubkey (hex or npub)" bind:value={allowKey} mono placeholder="npub1..." />
				<TextField label="Reason (optional)" bind:value={allowReason} placeholder="trusted" />
				<div class="flex justify-end sm:col-span-2">
					<Button type="submit" disabled={!allowKey.trim() || busy !== null}>Allow pubkey</Button>
				</div>
			</form>
		{/if}
	</Panel>
</div>
