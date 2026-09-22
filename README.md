# Tower

Nostr NIP-86（Relay Management API）専用のリレー管理者パネル。

## 技術スタック

- SvelteKit + TypeScript + TailwindCSS + Vite
- CSR のみ（`ssr = false`、adapter-static の SPA フォールバック）
- Nostr は `@noble/curves` / `@noble/hashes` / `@scure/base` で実装
- ログインは nsec とリレーの `wss://` を sessionStorage に保持

## 開発

```sh
npm install
npm run dev
```

開発サーバは `0.0.0.0:53000` で待ち受ける。

## チェック

```sh
npm run lint
npm run check
npm test
npm run build
```
