# Tower

Nostr NIP-86（Relay Management API）専用のリレー管理者パネル。

## 技術スタック

- SvelteKit + TypeScript + TailwindCSS + Vite
- CSR のみ（`ssr = false`、adapter-static の SPA フォールバック）
- Nostr は `@noble/curves` / `@noble/hashes` / `@scure/base` で実装
- ログインは NIP-07（ブラウザ拡張）。公開鍵とリレー URL だけを sessionStorage に保持し、**秘密鍵は拡張内から出ない**
- HTTP 認証は NIP-98、WebSocket 認証は NIP-42（どちらも拡張に署名を依頼する）
- リレー情報は NIP-11（`Accept: application/nostr+json`）から読み込む
- 管理画面では WebSocket を常時接続し、切断時は自動で再接続する
- ライト / ダーク / システム追従のテーマ切替（選択は localStorage に保存）
- 画面の色は `src/routes/layout.css` のセマンティックトークン（`bg` / `panel` / `line` / `ink` / `muted`）で統一

## 開発

```sh
npm install
npm run dev
```

開発サーバは `0.0.0.0:53000` で待ち受ける。

## 画面

- `/` ログイン（リレーの `wss://` を入力してから、ブラウザ拡張で署名）
- `/admin` 対応している管理メソッドの確認
- `/admin/pubkeys` pubkey の禁止・許可
- `/admin/events` イベントの禁止・許可
- `/admin/moderation` モデレーション待ち（WebSocket で中身を取得して確認）
- `/admin/ips` IP アドレスのブロック
- `/admin/kinds` 許可する kind
- `/admin/relay` リレー情報（NIP-11 での読み込みと、名前・説明・アイコンの変更）
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
