<script lang="ts">
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import TextField from '$lib/components/TextField.svelte';

	let name = $state('');
	let description = $state('');
	let icon = $state('');
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	const canName = $derived(admin.supports('changerelayname'));
	const canDescription = $derived(admin.supports('changerelaydescription'));
	const canIcon = $derived(admin.supports('changerelayicon'));

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
		description="Public information about the relay, as shown in its NIP-11 document."
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
		title="Relay information"
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
