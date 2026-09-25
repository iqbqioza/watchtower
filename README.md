# WatchTower

<img src="static/icon-180.png" alt="WatchTower icon" width="120" height="120" />

An admin panel for relays that speak **NIP-86**, the relay management API. Sign in with a
[NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) browser extension, point it at a relay
and manage it from one place: bans and allow lists, event moderation, blocked IPs, event kinds, roles,
delegated admins, invite claims and relay metadata.

## Features

- **NIP-07 sign-in** — with an extension installed the private key never leaves it. Without one,
  [window.nostr.js](https://github.com/fiatjaf/window.nostr.js) is loaded as an in-page signer, and it
  is left out entirely when an extension is there. WatchTower itself keeps only the public key and the
  relay URL for the tab, in `sessionStorage`.
- **NIP-86 management** — ban/unban and allow/unallow pubkeys, ban, allow and unban events, block and
  unblock IPs, allow and disallow kinds, change the relay name, description and icon, create, edit,
  delete and assign roles.
- **Delegated administration** — grant another pubkey the management methods it needs, so moderators get
  just those verbs, and hand out invite claims, so new members can be let in one code at a time.
- **NIP-98 authentication** — every management call is an HTTP request signed with a fresh `kind: 27235`
  event, including a `payload` hash and a nonce, so relays that reject replays work too.
- **Moderation queue** — events the relay is holding back are listed, and the event itself is read over
  the websocket so the decision is made with the content in front of you.
- **One websocket connection** — kept open while the panel is in use, authenticated with NIP-42 and
  reconnected automatically when it drops.
- **NIP-11 and NIP-43 aware** — the relay screen shows the relay's own information document, and the
  roles screen lists the roles the relay publishes as NIP-43 events.
- **Confirmation before destructive actions** — banning, blocking, deleting a role, revoking a method and
  deleting an invite claim all go through a modal dialog.
- **Light and dark theme**, monochrome layout, keyboard-friendly controls.

## Requirements

- Node.js 24 or newer (the bundled devcontainer is ready to use)
- A browser with a NIP-07 extension (such as nos2x or Alby) or the in-page fallback signer, which is
  loaded automatically when no extension is present
- A relay with the NIP-86 management API enabled, and that key allowed to manage it

## Getting started

```sh
npm install
npm run dev
```

The development server listens on `0.0.0.0:53000`. Open <http://localhost:53000>, enter the relay URL
(`wss://relay.example.com`), then approve the sign-in in the extension. Without an extension, the
built-in signer's widget takes its place.

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
| `/admin/events`     | Banned and allowed events, with their event ids             |
| `/admin/ips`        | Blocked IP addresses                                        |
| `/admin/kinds`      | Allowed and disallowed event kinds                          |
| `/admin/roles`      | Roles read from NIP-43 events, plus assignments             |
| `/admin/admins`     | Methods granted to other pubkeys                            |
| `/admin/invites`    | Invite claims waiting to be redeemed                        |
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
- Some screens use methods that are proposed extensions to NIP-86 rather than part of it: delegated
  administration (`assignmethod`, `unassignmethod`, `listmethodassignees`), invite claims (`createclaim`,
  `deleteclaim`, `listclaims`) and lifting an event ban (`unbanevent`). WatchTower asks the relay which
  methods it supports and hides the actions it does not.
- NIP-46 (remote signers) is not supported beyond the bunker logins the fallback signer offers.
- Without a NIP-07 extension, the fallback signer and its widget are loaded from jsDelivr and sign in
  the page, so a key it creates is kept in this browser instead of in an extension.
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
