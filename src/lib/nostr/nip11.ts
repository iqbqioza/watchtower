import { relayHttpUrl } from './relay-url';

/** Content type a relay answers with its NIP-11 document. */
export const NIP11_ACCEPT = 'application/nostr+json';

/**
 * Relay information document (NIP-11). Only the fields this app shows are
 * typed; everything else the relay sends is kept as it came in.
 */
export interface RelayInformation {
	[key: string]: unknown;
	name?: string;
	description?: string;
	icon?: string;
	pubkey?: string;
	contact?: string;
	software?: string;
	version?: string;
	supported_nips?: number[];
}

const STRING_FIELDS = [
	'name',
	'description',
	'icon',
	'pubkey',
	'contact',
	'software',
	'version'
] as const;

/** Validates the document, dropping fields whose type does not fit. */
export function parseRelayInformation(value: unknown): RelayInformation {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('relay information must be a JSON object');
	}

	const information = { ...(value as Record<string, unknown>) } as RelayInformation;
	for (const field of STRING_FIELDS) {
		if (typeof information[field] !== 'string') {
			delete information[field];
		}
	}
	const supported = information.supported_nips;
	if (!Array.isArray(supported) || !supported.every((nip) => typeof nip === 'number')) {
		delete information.supported_nips;
	}
	return information;
}

export interface FetchRelayInformationOptions {
	/** Replaceable for tests. */
	fetch?: typeof globalThis.fetch;
	signal?: AbortSignal;
}

/** Reads the NIP-11 document of a relay over plain HTTP. */
export async function fetchRelayInformation(
	relayUrl: string,
	options: FetchRelayInformationOptions = {}
): Promise<RelayInformation> {
	const fetchFn = options.fetch ?? globalThis.fetch;
	const response = await fetchFn(relayHttpUrl(relayUrl), {
		headers: { Accept: NIP11_ACCEPT },
		signal: options.signal
	});
	if (!response.ok) {
		throw new Error(`the relay answered HTTP ${response.status} for its information document`);
	}

	const text = await response.text();
	let document: unknown;
	try {
		document = JSON.parse(text);
	} catch (cause) {
		throw new Error('the relay returned an information document that is not JSON', { cause });
	}
	return parseRelayInformation(document);
}
