<script lang="ts">
	import Icon from './Icon.svelte';
	import {
		initialIndex,
		moveIndex,
		summarizeSelection,
		toggleValue,
		type SelectOption
	} from './select';

	interface Props {
		label: string;
		/** Selected values, in the order they were picked. */
		values: string[];
		options: SelectOption[];
		/** Text of the button while nothing is picked. */
		placeholder?: string;
		hint?: string;
		error?: string | null;
		disabled?: boolean;
	}

	let {
		label,
		values = $bindable(),
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

	const summary = $derived(summarizeSelection(options, values, placeholder));
	const nothingPicked = $derived(values.length === 0);

	function openList(): void {
		if (disabled || options.length === 0) return;
		active = initialIndex(options, values[0] ?? '');
		open = true;
	}

	function close(refocus = false): void {
		open = false;
		if (refocus) field?.focus();
	}

	function toggle(index: number): void {
		const option = options[index];
		if (!option) return;
		values = toggleValue(values, option.value);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;

		// Let the header buttons keep Enter and Space for themselves.
		const target = event.target as HTMLElement | null;
		if (target?.dataset.listAction !== undefined && event.key !== 'Escape') return;

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
				toggle(active);
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
			<span class="min-w-0 truncate {nothingPicked ? 'text-muted/70' : 'text-ink'}">{summary}</span>
			<span class="text-muted">
				<Icon name="chevronDown" />
			</span>
		</button>

		{#if open}
			<div
				id={listId}
				role="listbox"
				tabindex="-1"
				aria-multiselectable="true"
				aria-labelledby={id}
				onkeydown={onKeydown}
				class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-panel py-1 panel-shadow"
			>
				<div class="flex items-center justify-between gap-2 border-b border-line px-3 pb-1.5">
					<button
						type="button"
						data-list-action="all"
						class="text-xs text-muted transition-colors hover:text-ink"
						onclick={() => (values = options.map((option) => option.value))}
					>
						Select all
					</button>
					<button
						type="button"
						data-list-action="clear"
						class="text-xs text-muted transition-colors hover:text-ink"
						onclick={() => (values = [])}
					>
						Clear
					</button>
				</div>
				{#each options as option, index (option.value)}
					<button
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={values.includes(option.value)}
						class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm {index ===
						active
							? 'bg-control text-ink'
							: 'text-muted hover:bg-control/60 hover:text-ink'}"
						onpointerenter={() => (active = index)}
						onclick={() => toggle(index)}
					>
						<span class="min-w-0 truncate">{option.label}</span>
						{#if values.includes(option.value)}
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
