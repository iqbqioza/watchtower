<script lang="ts">
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { pubkeyHexFromInput } from '$lib/nostr/keys';

	let roleId = $state('');
	let label = $state('');
	let description = $state('');
	let color = $state('');
	let order = $state('0');

	let targetPubkey = $state('');
	let targetRoleId = $state('');

	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let busy = $state<string | null>(null);

	const canCreate = $derived(admin.supports('createrole'));
	const canEdit = $derived(admin.supports('editrole'));
	const canDelete = $derived(admin.supports('deleterole'));
	const canAssign = $derived(admin.supports('assignrole'));
	const canUnassign = $derived(admin.supports('unassignrole'));
	const canManage = $derived(canCreate || canEdit || canDelete || canAssign || canUnassign);

	async function run(key: string, action: () => Promise<unknown>, message: string): Promise<void> {
		error = null;
		success = null;
		busy = key;
		try {
			await action();
			success = message;
		} catch (cause) {
			error = describeError(cause);
		} finally {
			busy = null;
		}
	}

	function roleParams(): unknown[] | null {
		const id = roleId.trim();
		const parsedOrder = Number(order.trim());
		if (!id) {
			error = 'Enter a role id.';
			return null;
		}
		if (!Number.isInteger(parsedOrder)) {
			error = 'Order must be a whole number.';
			return null;
		}
		return [id, label.trim(), description.trim(), color.trim(), parsedOrder];
	}

	async function create(): Promise<void> {
		const params = roleParams();
		if (!params) return;
		await run('create', () => admin.call('createrole', params), 'Role created.');
	}

	async function edit(): Promise<void> {
		const params = roleParams();
		if (!params) return;
		await run('edit', () => admin.call('editrole', params), 'Role updated.');
	}

	async function remove(): Promise<void> {
		const id = roleId.trim();
		if (!id) {
			error = 'Enter a role id.';
			return;
		}
		if (!confirm(`Delete role ${id}?`)) return;
		await run('delete', () => admin.call('deleterole', [id]), 'Role deleted.');
	}

	async function assign(action: 'assign' | 'unassign'): Promise<void> {
		let pubkey: string;
		try {
			pubkey = pubkeyHexFromInput(targetPubkey);
		} catch (cause) {
			error = describeError(cause);
			return;
		}
		const role = targetRoleId.trim();
		if (!role) {
			error = 'Enter a role id.';
			return;
		}
		await run(
			action,
			() => admin.call(action === 'assign' ? 'assignrole' : 'unassignrole', [pubkey, role]),
			action === 'assign' ? 'Role assigned.' : 'Role unassigned.'
		);
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Roles"
		description="NIP-86 has no method to list roles, so this screen only writes what you enter."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	{#if !canManage}
		<Notice>
			This relay does not support any of the role methods (createrole, editrole, deleterole,
			assignrole, unassignrole).
		</Notice>
	{/if}

	<Panel title="Role details" description="createrole / editrole / deleterole">
		<div class="grid gap-3 sm:grid-cols-2">
			<TextField label="Role id" bind:value={roleId} mono placeholder="moderator" />
			<TextField label="Label" bind:value={label} placeholder="Moderator" />
			<TextField label="Description" bind:value={description} placeholder="Can hide events" />
			<TextField label="Color" bind:value={color} mono placeholder="#ff8800" />
			<div class="sm:col-span-2 sm:max-w-32">
				<TextField label="Order" bind:value={order} type="number" />
			</div>
		</div>
		<div class="flex flex-wrap gap-2 border-t border-line pt-4">
			{#if canCreate}
				<Button variant="primary" disabled={busy !== null} onclick={() => void create()}>
					Create role
				</Button>
			{/if}
			{#if canEdit}
				<Button disabled={busy !== null} onclick={() => void edit()}>Update role</Button>
			{/if}
			{#if canDelete}
				<Button variant="danger" disabled={busy !== null} onclick={() => void remove()}>
					Delete role
				</Button>
			{/if}
		</div>
	</Panel>

	<Panel title="Assign a role" description="assignrole / unassignrole">
		{#if !canAssign && !canUnassign}
			<Notice>This relay does not support assignrole or unassignrole.</Notice>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				<TextField
					label="Pubkey (hex or npub)"
					bind:value={targetPubkey}
					mono
					placeholder="npub1..."
				/>
				<TextField label="Role id" bind:value={targetRoleId} mono placeholder="moderator" />
			</div>
			<div class="flex flex-wrap gap-2 border-t border-line pt-4">
				{#if canAssign}
					<Button disabled={busy !== null} onclick={() => void assign('assign')}>Assign role</Button
					>
				{/if}
				{#if canUnassign}
					<Button disabled={busy !== null} onclick={() => void assign('unassign')}>
						Unassign role
					</Button>
				{/if}
			</div>
		{/if}
	</Panel>
</div>
