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

	let kinds = $state<number[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let kindInput = $state('1');

	const canList = $derived(admin.supports('listallowedkinds'));
	const canAllow = $derived(admin.supports('allowkind'));
	const canDisallow = $derived(admin.supports('disallowkind'));

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
		kinds = await admin.call<number[]>('listallowedkinds');
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

	async function allow(): Promise<void> {
		const kind = Number(kindInput.trim());
		if (!Number.isInteger(kind) || kind < 0 || kind > 65535) {
			error = 'Enter a kind number between 0 and 65535.';
			return;
		}
		await change(() => admin.call('allowkind', [kind]), `Kind ${kind} allowed.`, String(kind));
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Kinds"
		description="When this list is not empty, the relay only accepts these event kinds."
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
		{:else if !canList}
			<Notice
				>This relay does not support listallowedkinds, so current entries cannot be shown.</Notice
			>
		{:else}
			<ValueList
				items={toItems(kinds)}
				empty="No kind restriction is set."
				actionLabel="Disallow"
				showAction={canDisallow}
				busyValue={busy}
				onAction={(item) =>
					void change(
						() => admin.call('disallowkind', [Number(item.value)]),
						'Kind disallowed.',
						item.value
					)}
			/>
		{/if}

		{#if !canAllow}
			<Notice>This relay does not support allowkind.</Notice>
		{:else}
			<form
				class="flex flex-wrap items-end gap-3 border-t border-line pt-4"
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
</div>
