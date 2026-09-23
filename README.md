# WatchTower

<img src="static/icon-180.png" alt="WatchTower icon" width="120" height="120" />

An admin panel for relays that speak **NIP-86**, the relay management API. Sign in with a
[NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) browser extension, point it at a relay
and manage it from one place: bans and allow lists, event moderation, blocked IPs, allowed kinds, roles
and relay metadata.

## Features

- **NIP-07 sign-in** — the private key never leaves the browser extension. WatchTower only keeps the
  public key and the relay URL for the tab, in `sessionStorage`.
- **NIP-86 management** — ban/unban and allow/unallow pubkeys, ban/allow events, block and unblock IPs,
  allow and disallow kinds, change the relay name, description and icon, create, edit, delete and assign
  roles.
- **NIP-98 authentication** — every management call is an HTTP request signed with a fresh `kind: 27235`
  event, including a `payload` hash and a nonce, so relays that reject replays work too.
- **Moderation queue** — events the relay is holding back are listed, and the event itself is read over
  the websocket so the decision is made with the content in front of you.
- **One websocket connection** — kept open while the panel is in use, authenticated with NIP-42 and
  reconnected automatically when it drops.
- **NIP-11 and NIP-43 aware** — the relay screen shows the relay's own information document, and the
  roles screen lists the roles the relay publishes as NIP-43 events.
- **Confirmation before destructive actions** — banning, blocking, deleting a role and unassigning a
  role all go through a modal dialog.
- **Light and dark theme**, monochrome layout, keyboard-friendly controls.

## Requirements

- Node.js 24 or newer (the bundled devcontainer is ready to use)
- A NIP-07 browser extension, such as nos2x or Alby
- A relay with the NIP-86 management API enabled, and the extension's key allowed to manage it

## Getting started

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0:53000`. Open <http://localhost:53000>, enter the relay URL
(`wss://relay.example.com`), then approve the sign-in in the extension.

Production build:

```sh
npm run build   # static SPA written to build/
npm run preview # serve the build on 0.0.0.0:53000
```

## Screens

| Route               | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `/`                 | Sign in with a relay URL and the browser extension          |
| `/admin`            | Connection status and the methods the relay reports         |
| `/admin/moderation` | Events waiting for a decision, with their content           |
| `/admin/pubkeys`    | Banned and allowed pubkeys                                  |
| `/admin/events`     | Banned events, and allowing a single event                  |
| `/admin/ips`        | Blocked IP addresses                                        |
| `/admin/kinds`      | Allowed event kinds                                         |
| `/admin/roles`      | Roles read from NIP-43 events, plus assignments             |
| `/admin/relay`      | NIP-11 information and the relay name, description and icon |

## How it talks to relays

| NIP                                                                | Used for                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Event ids, signatures and websocket messages          |
| [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) | Signing through the browser extension                 |
| [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) | Relay information document                            |
| [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) | Authenticating the websocket (relays that gate reads) |
| [NIP-43](https://github.com/nostr-protocol/nips/blob/master/43.md) | Reading the relay's roles and memberships             |
| [NIP-86](https://github.com/nostr-protocol/nips/blob/master/86.md) | Management API over HTTP                              |
| [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) | HTTP authentication for management calls              |

## Tech stack

- SvelteKit + TypeScript + Tailwind CSS v4 + Vite
- Client-side rendering only (`ssr = false`), static adapter with an SPA fallback
- Nostr primitives come from `@noble/curves`, `@noble/hashes` and `@scure/base`; nothing else is needed
  at runtime
- Icons from [Heroicons](https://heroicons.com) (MIT, see `LICENSES/heroicons.txt`)

## Development

```sh
npm run lint    # Prettier and ESLint
npm run check   # svelte-check
npm test        # Vitest
npm run build   # production build
npm run format  # rewrite files with Prettier
```

## Limitations

- The relay has to implement NIP-86. If it does not, WatchTower says so instead of showing empty screens.
- NIP-86 has no method to list roles, so they are read from the relay's NIP-43 events (`kind: 33534`
  definitions and `kind: 13534` memberships). Relays that do not publish them keep the write-only role
  form, where the role id is typed by hand.
- NIP-86 cannot lift an event ban; allow the event instead.
- NIP-46 (remote signers) is not supported.
- A relay that gates reads needs the signed-in key to be allowed to read before the moderation and role
  screens can show anything.

## Deploying

The build output in `build/` is a static single-page app. It is deployed to Cloudflare Workers with
static assets (`wrangler.jsonc`): `assets.directory` points at `build/` and
`not_found_handling: single-page-application` makes deep links such as `/admin/pubkeys` work, so no
`_redirects` rule is needed.

```sh
npm run deploy   # wrangler types --check && vite build, then wrangler deploy
```

The build runs `wrangler types --check`, so `worker-configuration.d.ts` is kept in the repository; rerun
`npx wrangler types` after changing `wrangler.jsonc`.

## Sponsoring

If WatchTower is useful to you, you can support its development through
[GitHub Sponsors](https://github.com/sponsors/iqbqioza).

## License

MIT © 2026 [iqbqioza](https://github.com/iqbqioza)
