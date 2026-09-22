/**
 * Validates a relay URL typed by the user and returns it in ws(s) form.
 * http(s) input is accepted because relays are often copied from web pages.
 */
export function normalizeRelayUrl(input: string): string {
	const value = input.trim();
	if (!value) {
		throw new Error('relay URL must not be empty');
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch (cause) {
		throw new Error('relay URL is not a valid URL', { cause });
	}

	switch (url.protocol) {
		case 'ws:':
		case 'wss:':
			break;
		case 'http:':
			url.protocol = 'ws:';
			break;
		case 'https:':
			url.protocol = 'wss:';
			break;
		default:
			throw new Error('relay URL must use ws://, wss://, http:// or https://');
	}

	if (!url.hostname) {
		throw new Error('relay URL must include a host');
	}

	// Fragments are never part of a relay endpoint.
	url.hash = '';
	return url.toString();
}

/** The plain HTTP URL of the relay, used by NIP-11 and NIP-86. */
export function relayHttpUrl(relayUrl: string): string {
	const url = new URL(normalizeRelayUrl(relayUrl));
	url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
	return url.toString();
}
