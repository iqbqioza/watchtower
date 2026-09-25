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

	let allowed = $state<number[]>([]);
	let disallowed = $state<number[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let kindInput = $state('1');

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
		if (admin.supports('listallowedkinds')) {
			allowed = await admin.call<number[]>('listallowedkinds');
		}
		if (admin.supports('listdisallowedkinds')) {
			disallowed = await admin.call<number[]>('listdisallowedkinds');
		}
	}

	function toItems(values: number[]): ValueListItem[] {
		return [...values]
			.sort((left, right) => left - right)
			.map((kind) => ({ value: String(kind), label: String(kind) }));
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

	/** Reads a kind number, or null when the input is not a usable number. */
	function parseKind(input: string): number | null {
		const raw = input.trim();
		if (!/^\d+$/.test(raw)) return null;
		const kind = Number(raw);
		return kind > 65535 ? null : kind;
	}

	async function allow(): Promise<void> {
		const kind = parseKind(kindInput);
		if (kind === null) {
			error = 'Enter a kind number between 0 and 65535.';
			return;
		}
		await change(() => admin.call('allowkind', [kind]), `Kind ${kind} allowed.`, String(kind));
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Kinds"
		description="Event kinds the relay accepts, and kinds it always refuses."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<Panel title="Allowed kinds" description="allowkind / disallowkind / listallowedkinds">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the kind list" />
				Loading...
			</p>
		{:else if admin.lacks('listallowedkinds')}
			<Notice
				>This relay does not support listallowedkinds, so current entries cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(allowed)}
				empty="No kind allowlist is set, so every kind is accepted."
				actionLabel="Disallow"
				showAction={admin.supports('disallowkind')}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('disallowkind', [Number(item.value)]),
						'Kind disallowed.',
						item.value
					)}
			/>
		{/if}

		{#if admin.lacks('allowkind')}
			<Notice>This relay does not support allowkind.</Notice>
		{:else if admin.ready}
			<form
				class="flex flex-wrap items-end justify-end gap-3 border-t border-line pt-4"
				onsubmit={(event) => {
					event.preventDefault();
					void allow();
				}}
			>
				<div class="w-32">
					<TextField label="Kind" bind:value={kindInput} type="number" />
				</div>
				<Button type="submit" disabled={busy !== null}>Allow kind</Button>
			</form>
		{/if}
	</Panel>

	<Panel title="Disallowed kinds" description="listdisallowedkinds">
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the blocked kinds" />
				Loading...
			</p>
		{:else if admin.lacks('listdisallowedkinds')}
			<Notice
				>This relay does not support listdisallowedkinds, so blocked kinds cannot be shown.</Notice
			>
		{:else if admin.ready}
			<ValueList
				items={toItems(disallowed)}
				empty="No kind is disallowed."
				actionLabel="Allow"
				showAction={admin.supports('allowkind')}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('allowkind', [Number(item.value)]),
						`Kind ${item.value} allowed and unblocked.`,
						item.value
					)}
			/>
			{#if admin.supports('allowkind')}
				<p class="text-xs text-muted">Allowing a kind also removes it from this blocklist.</p>
			{/if}
		{/if}
	</Panel>
</div>
