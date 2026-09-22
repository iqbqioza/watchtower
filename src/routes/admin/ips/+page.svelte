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

	interface ReasonedIp {
		ip: string;
		reason?: string;
	}

	let blocked = $state<ReasonedIp[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	let ipInput = $state('');
	let ipReason = $state('');

	const canList = $derived(admin.supports('listblockedips'));
	const canBlock = $derived(admin.supports('blockip'));
	const canUnblock = $derived(admin.supports('unblockip'));

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
		if (!canList) return;
		blocked = await admin.call<ReasonedIp[]>('listblockedips');
	}

	function isLikelyIp(value: string): boolean {
		const trimmed = value.trim();
		if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
			return trimmed.split('.').every((part) => Number(part) <= 255);
		}
		return trimmed.includes(':') && /^[0-9a-f:]+$/i.test(trimmed);
	}

	function toItems(items: ReasonedIp[]): ValueListItem[] {
		return items.map((item) => ({ value: item.ip, label: item.ip, reason: item.reason }));
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

	async function block(): Promise<void> {
		const ip = ipInput.trim();
		if (!isLikelyIp(ip)) {
			error = 'Enter an IPv4 or IPv6 address.';
			return;
		}
		if (!confirm(`Block ${ip} from connecting?`)) return;
		const reason = ipReason.trim();
		await change(() => admin.call('blockip', reason ? [ip, reason] : [ip]), 'IP blocked.', ip);
		ipInput = '';
		ipReason = '';
	}
</script>

<div class="space-y-5">
	<PageHeader title="IPs" description="Addresses that are not allowed to connect to the relay." />

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Blocked IPs" description="blockip / unblockip / listblockedips">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the block list" />
				Loading...
			</p>
		{:else if !canList}
			<Notice>This relay does not support listblockedips, so current blocks cannot be shown.</Notice
			>
		{:else}
			<ValueList
				items={toItems(blocked)}
				empty="No IP addresses are blocked."
				actionLabel="Unblock"
				showAction={canUnblock}
				busyValue={busy}
				onAction={(item) =>
					void change(() => admin.call('unblockip', [item.value]), 'IP unblocked.', item.value)}
			/>
		{/if}

		{#if !canBlock}
			<Notice>This relay does not support blockip.</Notice>
		{:else}
			<form
				class="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
				onsubmit={(event) => {
					event.preventDefault();
					void block();
				}}
			>
				<TextField label="IP address" bind:value={ipInput} mono placeholder="203.0.113.7" />
				<TextField label="Reason (optional)" bind:value={ipReason} placeholder="abuse" />
				<div class="sm:col-span-2">
					<Button type="submit" variant="danger" disabled={!ipInput.trim() || busy !== null}>
						Block IP
					</Button>
				</div>
			</form>
		{/if}
	</Panel>
</div>
