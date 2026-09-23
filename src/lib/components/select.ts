/** One entry of a dropdown. */
export interface SelectOption {
	value: string;
	label: string;
}

/** Index of the chosen option; the first one when nothing matches. */
export function initialIndex(options: SelectOption[], value: string): number {
	if (options.length === 0) return -1;
	const index = options.findIndex((option) => option.value === value);
	return index === -1 ? 0 : index;
}

/** Moves the highlighted option, staying inside the list. */
export function moveIndex(current: number, delta: number, length: number): number {
	if (length === 0) return -1;
	const next = current + delta;
	if (next < 0) return 0;
	if (next > length - 1) return length - 1;
	return next;
}
