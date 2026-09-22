# Tower

Nostr NIP-86（Relay Management API）専用のリレー管理者パネル。

## 技術スタック

- SvelteKit + TypeScript + TailwindCSS + Vite
- CSR のみ（`ssr = false`、adapter-static の SPA フォールバック）
- Nostr は `@noble/curves` / `@noble/hashes` / `@scure/base` で実装
- ログインは nsec とリレーの `wss://` を sessionStorage に保持
- HTTP 認証は NIP-98、WebSocket 認証は NIP-42

## 開発

```sh
npm install
npm run dev
```

開発サーバは `0.0.0.0:53000` で待ち受ける。

## 画面

- `/` ログイン（nsec とリレーの `wss://` を入力）
- `/admin` 対応している管理メソッドの確認
- `/admin/pubkeys` pubkey の禁止・許可
- `/admin/events` イベントの禁止・許可
- `/admin/moderation` モデレーション待ち（WebSocket で中身を取得して確認）
- `/admin/ips` IP アドレスのブロック
- `/admin/kinds` 許可する kind
- `/admin/relay` リレー情報（名前・説明・アイコン）
- `/admin/roles` ロール操作（作成・更新・削除・割当・解除）

## 制限

- リレーが対応していないメソッドの画面は「未対応」と表示する
- ロールの一覧取得メソッドが NIP-86 に無いため、ロール画面は書き込みのみ

## チェック

```sh
npm run lint
npm run check
npm test
npm run build
```
