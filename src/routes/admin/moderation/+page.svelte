<script lang="ts">
	import { onMount } from 'svelte';
	import { admin, describeError } from '$lib/admin.svelte.js';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { RelayClient } from '$lib/nostr/relay';
	import type { NostrEvent } from '$lib/nostr/types';
	import { relayConnection } from '$lib/relay-connection.svelte.js';
	import { signerActivity } from '$lib/signer-activity.svelte.js';

	interface QueueItem {
		id: string;
		reason?: string;
	}

	const REQUEST_TIMEOUT = 10_000;

	let queue = $state<QueueItem[]>([]);
	let events = $state<Record<string, NostrEvent>>({});
	let loading = $state(true);
	let loadingEvent = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	const canList = $derived(admin.supports('listeventsneedingmoderation'));
	const canAllow = $derived(admin.supports('allowevent'));
	const canBan = $derived(admin.supports('banevent'));

	onMount(async () => {
		try {
			if (!(await admin.ensure())) return;
			if (canList) {
				queue = await admin.call<QueueItem[]>('listeventsneedingmoderation');
			}
		} catch (cause) {
			error = describeError(cause);
		} finally {
			loading = false;
		}
	});

	/** Reads one event over the websocket, so the content can be reviewed. */
	function fetchEvent(connection: RelayClient, id: string): Promise<NostrEvent> {
		return new Promise<NostrEvent>((resolve, reject) => {
			let timer = setTimeout(checkTimeout, REQUEST_TIMEOUT);
			const subscription = connection.subscribe([{ ids: [id], limit: 1 }], {
				onEvent: (event) => finish(() => resolve(event)),
				onEose: () => {
					// Before NIP-42 is accepted the relay answers EOSE without
					// events, and the REQ is sent again after authentication.
					if (!connection.authenticated && connection.authRequested) return;
					finish(() => reject(new Error('the relay does not have this event')));
				},
				onClosed: (message) =>
					finish(() => reject(new Error(message || 'the subscription was closed')))
			});

			/** While the extension shows a prompt, keep waiting for it. */
			function checkTimeout(): void {
				if (signerActivity.pending) {
					timer = setTimeout(checkTimeout, REQUEST_TIMEOUT);
					return;
				}
				finish(() => reject(new Error('the relay did not answer in time')));
			}

			function finish(settle: () => void): void {
				clearTimeout(timer);
				subscription.close();
				settle();
			}
		});
	}

	async function loadEvent(id: string): Promise<void> {
		error = null;
		const connection = relayConnection.client;
		if (!connection) {
			// The layout keeps the connection up; ask it to try again.
			relayConnection.start();
			error = 'The relay connection is not ready yet. Try again in a moment.';
			return;
		}

		loadingEvent = id;
		try {
			events[id] = await fetchEvent(connection, id);
		} catch (cause) {
			error = describeError(cause);
		} finally {
			loadingEvent = null;
		}
	}

	async function decide(id: string, action: 'allow' | 'ban'): Promise<void> {
		error = null;
		success = null;
		if (action === 'ban' && !confirm(`Ban event ${id}?`)) return;

		busy = id;
		try {
			await admin.call(action === 'allow' ? 'allowevent' : 'banevent', [id]);
			queue = queue.filter((item) => item.id !== id);
			success = action === 'allow' ? 'Event allowed.' : 'Event banned.';
		} catch (cause) {
			error = describeError(cause);
		} finally {
			busy = null;
		}
	}
</script>

<div class="space-y-5">
	<PageHeader
		title="Moderation"
		description="Events the relay is holding back until someone decides what to do with them."
	/>

	{#if admin.error}
		<Notice tone="error">{admin.error}</Notice>
	{:else if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if success}
		<Notice tone="success">{success}</Notice>
	{/if}
	{#if relayConnection.notice}
		<Notice>Relay notice: {relayConnection.notice}</Notice>
	{/if}
	{#if relayConnection.status === 'failed'}
		<Notice tone="error">
			The relay rejected our NIP-42 authentication, so it will not send events.
		</Notice>
	{:else if relayConnection.status !== 'authenticated' && relayConnection.status !== 'connected'}
		<Notice>
			The websocket connection is {relayConnection.status === 'connecting'
				? 'still being made'
				: 'offline'}; events can be read once it is up.
		</Notice>
	{/if}

	<Panel
		title="Events waiting for a decision"
		description="listeventsneedingmoderation · the event itself is read over the websocket"
	>
		{#if loading}
			<p class="flex items-center gap-2 text-sm text-muted">
				<Spinner label="Loading the moderation queue" />
				Loading...
			</p>
		{:else if !canList}
			<Notice>This relay does not support listeventsneedingmoderation.</Notice>
		{:else if queue.length === 0}
			<p
				class="rounded-md border border-dashed border-line px-3 py-8 text-center text-sm text-muted"
			>
				Nothing is waiting for a decision.
			</p>
		{:else}
			<ul class="space-y-3">
				{#each queue as item (item.id)}
					<li class="rounded-lg border border-line p-3">
						<div class="flex items-center gap-0.5">
							<span class="truncate font-mono text-xs text-ink">{item.id}</span>
							<CopyButton value={item.id} label="Copy the event id" />
							{#if item.reason}
								<Badge>{item.reason}</Badge>
							{/if}
						</div>

						{#if events[item.id]}
							{@const event = events[item.id]}
							<div class="mt-3 space-y-1.5 rounded-md bg-control p-3">
								<p class="flex flex-wrap items-center gap-1.5 text-xs text-muted">
									<Badge mono>kind {event.kind}</Badge>
									<span>{new Date(event.created_at * 1000).toLocaleString()}</span>
								</p>
								<div class="flex items-center gap-0.5">
									<span class="truncate font-mono text-xs text-muted">{event.pubkey}</span>
									<CopyButton value={event.pubkey} label="Copy the author pubkey" />
								</div>
								<p class="mt-2 text-sm break-words whitespace-pre-wrap text-ink">
									{event.content}
								</p>
							</div>
							<details class="mt-2">
								<summary class="cursor-pointer text-xs text-muted">Raw event</summary>
								<pre
									class="mt-1.5 overflow-x-auto rounded-md border border-line p-3 text-xs text-muted">{JSON.stringify(
										event,
										null,
										2
									)}</pre>
							</details>
						{/if}

						<div class="mt-3 flex flex-wrap gap-2">
							<Button
								size="sm"
								onclick={() => void loadEvent(item.id)}
								disabled={loadingEvent === item.id}
							>
								{#if loadingEvent === item.id}
									<Spinner label="Reading the event" />
									Loading...
								{:else}
									{events[item.id] ? 'Reload event' : 'Load event'}
								{/if}
							</Button>
							{#if canAllow}
								<Button
									size="sm"
									variant="primary"
									disabled={busy === item.id}
									onclick={() => void decide(item.id, 'allow')}
								>
									Allow
								</Button>
							{/if}
							{#if canBan}
								<Button
									size="sm"
									variant="danger"
									disabled={busy === item.id}
									onclick={() => void decide(item.id, 'ban')}
								>
									Ban
								</Button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
</div>
