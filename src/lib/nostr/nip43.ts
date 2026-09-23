import type { NostrEvent } from './types';

/** NIP-43 kinds: roles the relay publishes about itself. */
export const ROLE_DEFINITION_KIND = 33534;
export const MEMBERSHIP_LIST_KIND = 13534;
/** Tag that marks a role definition as deleted. */
const DELETED_TAG = 'deleted';

/** A role the relay publishes. */
export interface RelayRole {
	/** Role id, from the `d` tag. */
	id: string;
	label?: string;
	description?: string;
	color?: string;
	order?: number;
}

/** One pubkey with the roles it holds. */
export interface RoleMember {
	pubkey: string;
	roles: string[];
}

function tagValue(event: NostrEvent, name: string): string | undefined {
	const tag = event.tags.find(([tagName]) => tagName === name);
	return typeof tag?.[1] === 'string' ? tag[1] : undefined;
}

/** Reads a `kind:33534` role definition; null for tombstones and other events. */
export function parseRoleDefinition(event: NostrEvent): RelayRole | null {
	if (event.kind !== ROLE_DEFINITION_KIND) return null;
	if (event.tags.some(([name]) => name === DELETED_TAG)) return null;

	const id = tagValue(event, 'd');
	if (!id) return null;

	const role: RelayRole = { id };
	const label = tagValue(event, 'label');
	if (label) role.label = label;
	const description = tagValue(event, 'description');
	if (description) role.description = description;
	const color = tagValue(event, 'color');
	if (color) role.color = color;
	const order = tagValue(event, 'order');
	if (order !== undefined && order !== '') {
		const parsed = Number(order);
		if (Number.isFinite(parsed)) role.order = parsed;
	}
	return role;
}

/**
 * Reads a `kind:13534` membership list: one `member` tag per pubkey, the
 * pubkey first and the role ids after it.
 */
export function parseMembershipList(event: NostrEvent): RoleMember[] {
	if (event.kind !== MEMBERSHIP_LIST_KIND) return [];

	const members: RoleMember[] = [];
	for (const tag of event.tags) {
		if (tag[0] !== 'member' || typeof tag[1] !== 'string') continue;
		members.push({ pubkey: tag[1].toLowerCase(), roles: tag.slice(2) });
	}
	return members;
}

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([0-9,.%\s]+\))$/i;

/** Only colours that cannot smuggle anything else into a style attribute. */
export function safeColor(color: string | undefined): string | null {
	return color && SAFE_COLOR.test(color.trim()) ? color.trim() : null;
}
