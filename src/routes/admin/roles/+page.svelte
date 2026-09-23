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
	import Panel from '$lib/components/Panel.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { npubFromPubkey, pubkeyHexFromInput } from '$lib/nostr/keys';
	import { fetchRelayInformation } from '$lib/nostr/nip11';
	import {
		MEMBERSHIP_LIST_KIND,
		parseMembershipList,
		parseRoleDefinition,
		ROLE_DEFINITION_KIND,
		safeColor,
		type RelayRole,
		type RoleMember
	} from '$lib/nostr/nip43';
	import { queryEvents } from '$lib/nostr/query';
	import type { RelayClient } from '$lib/nostr/relay';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { session } from '$lib/session.svelte.js';

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

	let roles = $state<RelayRole[]>([]);
	let members = $state<RoleMember[]>([]);
	/** False when the relay does not say which key signs its roles. */
	let listed = $state(false);
	let listLoading = $state(true);
	let listError = $state<string | null>(null);
	let detailsAnchor = $state<HTMLDivElement | null>(null);
	let assignAnchor = $state<HTMLDivElement | null>(null);

	const canCreate = $derived(admin.supports('createrole'));
	const canEdit = $derived(admin.supports('editrole'));
	const canDelete = $derived(admin.supports('deleterole'));
	const canAssign = $derived(admin.supports('assignrole'));
	const canUnassign = $derived(admin.supports('unassignrole'));

	onMount(() => {
		void loadRoles();
	});

	/** The shared connection is opened by the layout; wait for it to be up. */
	async function waitForConnection(timeoutMs = 10_000): Promise<RelayClient | null> {
		const started = Date.now();
		while (Date.now() - started < timeoutMs) {
			const connection = relayConnection.client;
			if (connection) return connection;
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
		return null;
	}

	/**
	 * Reads the roles the relay publishes about itself (NIP-43): one
	 * addressable definition per role plus the membership list. NIP-86 has no
	 * method to list roles, so this is the only way to show them.
	 */
	async function loadRoles(): Promise<void> {
		listLoading = true;
		listError = null;
		try {
			const information = await fetchRelayInformation(session.relayUrl);
			const relayKey =
				typeof information.self === 'string'
					? information.self
					: typeof information.pubkey === 'string'
						? information.pubkey
						: null;
			if (!relayKey) {
				listed = false;
				roles = [];
				members = [];
				return;
			}

			const connection = await waitForConnection();
			if (!connection) throw new Error('the relay connection is not ready yet');

			const events = await queryEvents(
				connection,
				[{ kinds: [ROLE_DEFINITION_KIND, MEMBERSHIP_LIST_KIND], authors: [relayKey] }],
				{ timeoutMs: 6000 }
			);
			const own = events.filter((event) => event.pubkey === relayKey);
			// One entry per role id and per pubkey: the relay can be asked twice
			// while the NIP-42 handshake finishes.
			const rolesById: Record<string, RelayRole> = {};
			const membersByPubkey: Record<string, RoleMember> = {};
			for (const event of own) {
				const role = parseRoleDefinition(event);
				if (role) rolesById[role.id] = role;
				for (const member of parseMembershipList(event)) {
					membersByPubkey[member.pubkey] = member;
				}
			}
			roles = Object.values(rolesById).sort(
				(left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id)
			);
			members = Object.values(membersByPubkey);
			listed = true;
		} catch (cause) {
			listError = describeError(cause);
		} finally {
			listLoading = false;
		}
	}

	function membersOf(id: string): RoleMember[] {
		return members.filter((member) => member.roles.includes(id));
	}

	function friendly(pubkey: string): string {
		try {
			return npubFromPubkey(pubkey);
		} catch {
			return pubkey;
		}
	}

	async function run(
		key: string,
		action: () => Promise<unknown>,
		message: string,
		reload = true
	): Promise<void> {
		error = null;
		success = null;
		busy = key;
		try {
			await action();
			if (reload) await loadRoles();
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
		const id = roleId.trim() || targetRoleId.trim();
		if (!id) {
			error = 'Enter or pick a role id.';
			return;
		}
		if (
			!(await confirmDialog.ask({
				title: 'Delete role',
				message: `Role ${id} will be removed and unassigned from everyone who holds it.`,
				confirmLabel: 'Delete role'
			}))
		) {
			return;
		}
		await run('delete', () => admin.call('deleterole', [id]), 'Role deleted.');
	}

	async function removeFromList(id: string): Promise<void> {
		if (
			!(await confirmDialog.ask({
				title: 'Delete role',
				message: `Role ${id} will be removed and unassigned from everyone who holds it.`,
				confirmLabel: 'Delete role'
			}))
		) {
			return;
		}
		await run(`delete:${id}`, () => admin.call('deleterole', [id]), 'Role deleted.');
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
		if (action === 'unassign' && !(await confirmUnassign(pubkey, role))) return;
		await run(
			action,
			() => admin.call(action === 'assign' ? 'assignrole' : 'unassignrole', [pubkey, role]),
			action === 'assign' ? 'Role assigned.' : 'Role unassigned.'
		);
	}

	async function unassign(pubkey: string, role: string): Promise<void> {
		if (!(await confirmUnassign(pubkey, role))) return;
		await run(
			`unassign:${pubkey}:${role}`,
			() => admin.call('unassignrole', [pubkey, role]),
			'Role unassigned.'
		);
	}

	/** Both unassign paths ask the same question. */
	function confirmUnassign(pubkey: string, role: string): Promise<boolean> {
		return confirmDialog.ask({
			title: 'Unassign role',
			message: `${friendly(pubkey)} will lose the role ${role}.`,
			confirmLabel: 'Unassign'
		});
	}

	/** Loads a role into the form so it can be changed or deleted. */
	function pick(role: RelayRole): void {
		roleId = role.id;
		label = role.label ?? '';
		description = role.description ?? '';
		color = role.color ?? '';
		order = role.order !== undefined ? String(role.order) : '0';
		detailsAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/** Loads a role id into the assign form. */
	function pickAssign(role: RelayRole): void {
		targetRoleId = role.id;
		assignAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Roles"
		description="Roles are written through NIP-86; the relay publishes them as NIP-43 events, which is how Tower lists them."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}

	<div bind:this={detailsAnchor}>
		<Panel title="Role details" description="createrole / editrole / deleterole">
			{#if admin.ready && !canCreate && !canEdit && !canDelete}
				<Notice>This relay does not support createrole, editrole or deleterole.</Notice>
			{:else if admin.ready}
				<div class="grid gap-3 sm:grid-cols-2">
					<TextField label="Role id" bind:value={roleId} mono placeholder="moderator" />
					<TextField label="Label" bind:value={label} placeholder="Moderator" />
					<TextField label="Description" bind:value={description} placeholder="Can hide events" />
					<TextField label="Color" bind:value={color} mono placeholder="#ff8800" />
					<div class="sm:col-span-2 sm:max-w-32">
						<TextField label="Order" bind:value={order} type="number" />
					</div>
				</div>
				<div class="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
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
			{/if}
		</Panel>
	</div>

	<div bind:this={assignAnchor}>
		<Panel title="Assign a role" description="assignrole / unassignrole">
			{#if admin.ready && !canAssign && !canUnassign}
				<Notice>This relay does not support assignrole or unassignrole.</Notice>
			{:else if admin.ready}
				<div class="grid gap-3 sm:grid-cols-2">
					<TextField
						label="Pubkey (hex or npub)"
						bind:value={targetPubkey}
						mono
						placeholder="npub1..."
					/>
					{#if roles.length > 0}
						<SelectField
							label="Role"
							bind:value={targetRoleId}
							options={roles.map((role) => ({
								value: role.id,
								label: role.label ? `${role.label} (${role.id})` : role.id
							}))}
							placeholder="Choose a role..."
						/>
					{:else}
						<TextField
							label="Role id"
							bind:value={targetRoleId}
							mono
							placeholder="moderator"
							hint="This relay does not publish its roles, so type the id."
						/>
					{/if}
				</div>
				<div class="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
					{#if canAssign}
						<Button disabled={busy !== null} onclick={() => void assign('assign')}
							>Assign role</Button
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
	<Panel
		title="Roles on this relay"
		description="NIP-43 events (kind 33534 and 13534) signed by the relay."
	>
		{#snippet action()}
			<Button size="sm" onclick={() => void loadRoles()} disabled={listLoading}>
				{#if listLoading}
					<Spinner label="Reading the roles" />
				{:else}
					<Icon name="refresh" />
				{/if}
				Reload
			</Button>
		{/snippet}

		{#if listError}
			<Notice tone="error">{listError}</Notice>
		{:else if !admin.ready}
			<!-- Waiting for the method list; nothing to show yet. -->
		{:else if listLoading && roles.length === 0 && members.length === 0}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Reading the roles" />
				Reading...
			</p>
		{:else if !listed}
			<Notice>
				This relay does not say which key signs its roles (NIP-11 <code>self</code>), so they cannot
				be listed here. Create or change a role by typing its id below.
			</Notice>
		{:else if roles.length === 0}
			<p class="text-sm text-muted">No roles are published yet. Create one below.</p>
		{:else}
			<ul class="divide-y divide-line overflow-hidden rounded-md border border-line">
				{#each roles as role (role.id)}
					{@const fill = safeColor(role.color)}
					{@const assigned = membersOf(role.id)}
					<li class="px-3 py-3">
						<div class="flex flex-wrap items-start gap-x-3 gap-y-2">
							<div class="min-w-0 flex-1 basis-56">
								<div class="flex flex-wrap items-center gap-2">
									{#if fill}
										<span
											class="size-3 shrink-0 rounded-full border border-line"
											style="background-color: {fill}"
										></span>
									{/if}
									<p class="truncate text-sm font-medium text-ink">{role.label || role.id}</p>
									{#if role.order !== undefined}
										<Badge mono>order {role.order}</Badge>
									{/if}
								</div>
								<div class="mt-0.5 flex items-center gap-0.5">
									<span class="truncate font-mono text-xs text-muted">{role.id}</span>
									<CopyButton value={role.id} label="Copy the role id" />
								</div>
								{#if role.description}
									<p class="mt-1 text-xs break-words text-muted">{role.description}</p>
								{/if}
							</div>
							<div class="ml-auto flex flex-wrap gap-2">
								{#if canEdit}
									<Button size="sm" onclick={() => pick(role)}>Edit</Button>
								{/if}
								{#if canAssign}
									<Button size="sm" onclick={() => pickAssign(role)}>Assign</Button>
								{/if}
								{#if canDelete}
									<Button
										size="sm"
										variant="danger"
										disabled={busy !== null}
										onclick={() => void removeFromList(role.id)}
									>
										Delete
									</Button>
								{/if}
							</div>
						</div>

						{#if assigned.length > 0}
							<details class="mt-2.5 border-t border-line pt-2">
								<summary class="cursor-pointer text-xs text-muted">
									{assigned.length} assigned
								</summary>
								<ul class="mt-1.5 space-y-1">
									{#each assigned as member (member.pubkey)}
										<li class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
											<span class="font-mono text-xs break-all text-ink">
												{friendly(member.pubkey)}
											</span>
											<CopyButton value={member.pubkey} label="Copy the pubkey" />
											{#if canUnassign}
												<Button
													size="sm"
													variant="ghost"
													disabled={busy !== null}
													title="Unassign this role from the pubkey"
													onclick={() => void unassign(member.pubkey, role.id)}
												>
													Unassign
												</Button>
											{/if}
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>
