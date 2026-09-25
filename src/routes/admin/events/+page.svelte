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
	import { normalizeHex32 } from '$lib/nostr/hex';

	interface ReasonedEvent {
		id: string;
		reason?: string;
	}

	let banned = $state<ReasonedEvent[]>([]);
	let allowed = $state<ReasonedEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let banId = $state('');
	let banReason = $state('');
	let allowId = $state('');
	let allowReason = $state('');

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
		if (admin.supports('listbannedevents')) {
			banned = await admin.call<ReasonedEvent[]>('listbannedevents');
		}
		if (admin.supports('listallowedevents')) {
			allowed = await admin.call<ReasonedEvent[]>('listallowedevents');
		}
	}

	function toItems(items: ReasonedEvent[]): ValueListItem[] {
		return items.map((item) => ({ value: item.id, label: item.id, reason: item.reason }));
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

	async function submit(action: 'ban' | 'allow'): Promise<void> {
		error = null;
		success = null;

		const input = action === 'ban' ? banId : allowId;
		const reason = action === 'ban' ? banReason : allowReason;
		let id: string;
		try {
			id = normalizeHex32(input);
		} catch {
			error = 'Enter the 32-byte hex id of an event.';
			return;
		}
		if (
			action === 'ban' &&
			!(await confirmDialog.ask({
				title: 'Ban event',
				message: `${id} will be hidden from this relay.`,
				confirmLabel: 'Ban event'
			}))
		) {
			return;
		}

		busy = id;
		try {
			const method = action === 'ban' ? 'banevent' : 'allowevent';
			const trimmed = reason.trim();
			await admin.call(method, trimmed ? [id, trimmed] : [id]);
			await refresh();
			success = action === 'ban' ? 'Event banned.' : 'Event allowed.';
			if (action === 'ban') {
				banId = '';
				banReason = '';
			} else {
				allowId = '';
				allowReason = '';
			}
		} catch (cause) {
			error = describeError(cause);
		} finally {
			busy = null;
		}
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Events"
		description="Events the relay refuses to serve, and single events it was told to accept."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Banned events" description="banevent / unbanevent / listbannedevents">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the event ban list" />
				Loading...
			</p>
		{:else if admin.lacks('listbannedevents')}
			<Notice>This relay does not support listbannedevents, so current bans cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(banned)}
				empty="No events are banned."
				actionLabel="Unban"
				showAction={admin.supports('unbanevent')}
				busyValue={busy}
				onAction={(item) =>
					void change(() => admin.call('unbanevent', [item.value]), 'Event unbanned.', item.value)}
			/>
			{#if !admin.supports('unbanevent')}
				<p class="text-xs text-muted">
					This relay cannot lift an event ban; allow the event instead so it is served.
				</p>
			{/if}
		{/if}

		{#if admin.lacks('banevent')}
			<Notice>This relay does not support banevent.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void submit('ban');
				}}
			>
				<TextField label="Event id (hex)" bind:value={banId} mono placeholder="64 hex characters" />
				<TextField label="Reason (optional)" bind:value={banReason} placeholder="illegal content" />
				<div class="flex justify-end sm:col-span-2">
					<Button type="submit" variant="danger" disabled={!banId.trim() || busy !== null}>
						Ban event
					</Button>
				</div>
			</form>
		{/if}
	</Panel>

	<Panel title="Allowed events" description="allowevent / unallowevent / listallowedevents">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the event allow list" />
				Loading...
			</p>
		{:else if admin.lacks('listallowedevents')}
			<Notice
				>This relay does not support listallowedevents, so current entries cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(allowed)}
				empty="No single events are allowed."
				actionLabel="Unallow"
				showAction={admin.supports('unallowevent')}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('unallowevent', [item.value]),
						'Event unallowed.',
						item.value
					)}
			/>
		{/if}

		{#if admin.lacks('allowevent')}
			<Notice>This relay does not support allowevent.</Notice>
		{:else if admin.ready}
			<form
				class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void submit('allow');
				}}
			>
				<TextField
					label="Event id (hex)"
					bind:value={allowId}
					mono
					placeholder="64 hex characters"
				/>
				<TextField label="Reason (optional)" bind:value={allowReason} placeholder="reviewed" />
				<div class="flex justify-end sm:col-span-2">
					<Button type="submit" disabled={!allowId.trim() || busy !== null}>Allow event</Button>
				</div>
			</form>
		{/if}
	</Panel>
</div>
