import { describe, expect, it } from 'vitest';
import { finalizeEvent } from './event';
import {
	MEMBERSHIP_LIST_KIND,
	parseMembershipList,
	parseRoleDefinition,
	ROLE_DEFINITION_KIND,
	safeColor
} from './nip43';
import type { EventTemplate } from './types';
import { hexToBytes } from '@noble/hashes/utils.js';

const SECRET_KEY = hexToBytes('00'.repeat(31) + '03');
const RELAY_PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';

function signed(template: EventTemplate) {
	return finalizeEvent(SECRET_KEY, { created_at: 1_700_000_000, ...template });
}

function roleEvent(tags: string[][]) {
	return signed({ kind: ROLE_DEFINITION_KIND, tags });
}

describe('parseRoleDefinition', () => {
	it('reads the role fields from the tags', () => {
		const role = parseRoleDefinition(
			roleEvent([
				['d', 'moderator'],
				['label', 'Moderator'],
				['description', 'Can hide events'],
				['color', '#ff8800'],
				['order', '2']
			])
		);

		expect(role).toEqual({
			id: 'moderator',
			label: 'Moderator',
			description: 'Can hide events',
			color: '#ff8800',
			order: 2
		});
	});

	it('keeps only the id when the optional tags are missing', () => {
		expect(parseRoleDefinition(roleEvent([['d', 'admin']]))).toEqual({ id: 'admin' });
	});

	it('ignores tombstones, other kinds and unusable ids', () => {
		expect(parseRoleDefinition(roleEvent([['d', 'moderator'], ['deleted']]))).toBeNull();
		expect(parseRoleDefinition(roleEvent([['label', 'no id']]))).toBeNull();
		expect(parseRoleDefinition(signed({ kind: MEMBERSHIP_LIST_KIND, tags: [] }))).toBeNull();
	});
});

describe('parseMembershipList', () => {
	it('reads one entry per member with its roles', () => {
		const event = signed({
			kind: MEMBERSHIP_LIST_KIND,
			tags: [
				['-'],
				['member', RELAY_PUBKEY.toUpperCase(), 'moderator', 'curator'],
				['member', 'ab'.repeat(32)]
			]
		});

		expect(parseMembershipList(event)).toEqual([
			{ pubkey: RELAY_PUBKEY, roles: ['moderator', 'curator'] },
			{ pubkey: 'ab'.repeat(32), roles: [] }
		]);
	});

	it('ignores events of other kinds and malformed member tags', () => {
		expect(parseMembershipList(roleEvent([['d', 'x']]))).toEqual([]);
		expect(
			parseMembershipList(
				signed({ kind: MEMBERSHIP_LIST_KIND, tags: [['member'], ['member', 7 as never]] })
			)
		).toEqual([]);
	});
});

describe('safeColor', () => {
	it('accepts hex, names and rgb() but nothing else', () => {
		expect(safeColor('#ff8800')).toBe('#ff8800');
		expect(safeColor('tomato')).toBe('tomato');
		expect(safeColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
		expect(safeColor(undefined)).toBeNull();
		expect(safeColor('red; background-image: url(x)')).toBeNull();
		expect(safeColor('url(x)')).toBeNull();
	});
});
