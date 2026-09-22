<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
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
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let banId = $state('');
	let banReason = $state('');
	let allowId = $state('');
	let allowReason = $state('');

	const canListBanned = $derived(admin.supports('listbannedevents'));
	const canBan = $derived(admin.supports('banevent'));
	const canAllow = $derived(admin.supports('allowevent'));

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
		if (!canListBanned) return;
		banned = await admin.call<ReasonedEvent[]>('listbannedevents');
	}

	function toItems(items: ReasonedEvent[]): ValueListItem[] {
		return items.map((item) => ({ value: item.id, label: item.id, reason: item.reason }));
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
		if (action === 'ban' && !confirm(`Ban event ${id}?`)) return;

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

	<Panel title="Banned events" description="listbannedevents">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the event ban list" />
				Loading...
			</p>
		{:else if !canListBanned}
			<Notice>This relay does not support listbannedevents, so current bans cannot be shown.</Notice
			>
		{:else}
			<ValueList items={toItems(banned)} empty="No events are banned." showAction={false} />
		{/if}
		<p class="text-xs text-muted">
			NIP-86 has no method to lift a single event ban; allow the event instead so the relay accepts
			it.
		</p>
	</Panel>

	<Panel title="Ban an event" description="banevent">
		{#if !canBan}
			<Notice>This relay does not support banevent.</Notice>
		{:else}
			<form
				class="grid gap-3 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void submit('ban');
				}}
			>
				<TextField label="Event id (hex)" bind:value={banId} mono placeholder="64 hex characters" />
				<TextField label="Reason (optional)" bind:value={banReason} placeholder="illegal content" />
				<div class="sm:col-span-2">
					<Button type="submit" variant="danger" disabled={!banId.trim() || busy !== null}>
						Ban event
					</Button>
				</div>
			</form>
		{/if}
	</Panel>

	<Panel title="Allow an event" description="allowevent">
		{#if !canAllow}
			<Notice>This relay does not support allowevent.</Notice>
		{:else}
			<form
				class="grid gap-3 sm:grid-cols-2"
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
				<div class="sm:col-span-2">
					<Button type="submit" disabled={!allowId.trim() || busy !== null}>Allow event</Button>
				</div>
			</form>
		{/if}
	</Panel>
</div>
