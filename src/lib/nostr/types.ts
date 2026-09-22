/** NIP-01 event fields that the id commits to. */
export interface SerializableEvent {
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
}

/** NIP-01 event with its id and BIP-340 signature. */
export interface NostrEvent extends SerializableEvent {
	id: string;
	sig: string;
}

/** Event values that are filled in by {@link finalizeEvent}. */
export interface EventTemplate {
	kind: number;
	created_at?: number;
	tags?: string[][];
	content?: string;
}
