<script lang="ts">
	import Icon from './Icon.svelte';
	import { initialIndex, moveIndex, type SelectOption } from './select';

	interface Props {
		label: string;
		value: string;
		options: SelectOption[];
		/** Text of the empty entry, shown while nothing is chosen. */
		placeholder?: string;
		hint?: string;
		error?: string | null;
		disabled?: boolean;
	}

	let {
		label,
		value = $bindable(),
		options,
		placeholder = 'Choose...',
		hint,
		error = null,
		disabled = false
	}: Props = $props();

	const id = $props.id();
	const listId = `${id}-listbox`;
	let open = $state(false);
	let active = $state(-1);
	let wrapper = $state<HTMLDivElement | null>(null);
	let field = $state<HTMLButtonElement | null>(null);

	const selected = $derived(options.find((option) => option.value === value) ?? null);

	function openList(): void {
		if (disabled || options.length === 0) return;
		active = initialIndex(options, value);
		open = true;
	}

	function close(refocus = false): void {
		open = false;
		if (refocus) field?.focus();
	}

	function choose(index: number): void {
		const option = options[index];
		if (!option) return;
		value = option.value;
		close(true);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;

		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
				event.preventDefault();
				openList();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				active = moveIndex(active, 1, options.length);
				break;
			case 'ArrowUp':
				event.preventDefault();
				active = moveIndex(active, -1, options.length);
				break;
			case 'Home':
				event.preventDefault();
				active = 0;
				break;
			case 'End':
				event.preventDefault();
				active = options.length - 1;
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				choose(active);
				break;
			case 'Escape':
				event.preventDefault();
				close(true);
				break;
			case 'Tab':
				close();
				break;
		}
	}

	// Close when the pointer goes down somewhere else.
	$effect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (wrapper && !wrapper.contains(event.target as Node)) close();
		};
		window.addEventListener('pointerdown', onPointerDown);
		return () => window.removeEventListener('pointerdown', onPointerDown);
	});
</script>

<div class="space-y-1.5" bind:this={wrapper}>
	<label class="block text-xs font-medium text-muted" for={id}>{label}</label>
	<div class="relative">
		<button
			{id}
			type="button"
			bind:this={field}
			{disabled}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={listId}
			onclick={() => (open ? close() : openList())}
			onkeydown={onKeydown}
			class="flex w-full items-center justify-between gap-2 rounded-md border bg-panel px-3 py-2 text-left text-sm transition-colors outline-none focus:ring-2 focus:ring-focus/25 disabled:opacity-50 {error
				? 'border-red-500/60'
				: 'border-line focus:border-focus'}"
		>
			<span class="min-w-0 truncate {selected ? 'text-ink' : 'text-muted/70'}">
				{selected ? selected.label : placeholder}
			</span>
			<span class="text-muted">
				<Icon name="chevronDown" />
			</span>
		</button>

		{#if open}
			<div
				id={listId}
				role="listbox"
				aria-labelledby={id}
				class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-panel py-1 panel-shadow"
			>
				{#each options as option, index (option.value)}
					<button
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={option.value === value}
						class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm {index ===
						active
							? 'bg-control text-ink'
							: 'text-muted hover:bg-control/60 hover:text-ink'}"
						onpointerenter={() => (active = index)}
						onclick={() => choose(index)}
					>
						<span class="min-w-0 truncate">{option.label}</span>
						{#if option.value === value}
							<span class="text-ink"><Icon name="check" /></span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	{#if error}
		<p class="text-xs text-red-700 dark:text-red-400">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted">{hint}</p>
	{/if}
</div>
