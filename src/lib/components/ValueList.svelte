<script lang="ts">
	import Button from './Button.svelte';
	import CopyButton from './CopyButton.svelte';

	export interface ValueListItem {
		/** Raw value used by the action, such as a hex pubkey. */
		value: string;
		/** Main line of the row, such as an npub or a kind number. */
		label: string;
		/** Secondary line, for example the hex form of a pubkey. */
		sublabel?: string;
		reason?: string;
	}

	interface Props {
		items: ValueListItem[];
		empty: string;
		actionLabel?: string;
		/** False hides the action button, for example when the relay lacks the method. */
		showAction?: boolean;
		busyValue?: string | null;
		onAction?: (item: ValueListItem) => void;
	}

	let {
		items,
		empty,
		actionLabel = '',
		showAction = true,
		busyValue = null,
		onAction
	}: Props = $props();
</script>

{#if items.length === 0}
	<p class="rounded-md border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
		{empty}
	</p>
{:else}
	<ul class="divide-y divide-line overflow-hidden rounded-md border border-line">
		{#each items as item (item.value)}
			<li class="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-control/60">
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-0.5">
						<p class="truncate font-mono text-xs text-ink">{item.label}</p>
						<CopyButton value={item.label} />
					</div>
					{#if item.sublabel}
						<p class="truncate font-mono text-[11px] text-muted">{item.sublabel}</p>
					{/if}
					{#if item.reason}
						<p class="mt-0.5 truncate text-xs text-muted">reason: {item.reason}</p>
					{/if}
				</div>
				{#if showAction && actionLabel && onAction}
					<Button
						size="sm"
						variant="danger"
						disabled={busyValue === item.value}
						onclick={() => onAction?.(item)}
					>
						{busyValue === item.value ? 'Working...' : actionLabel}
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
