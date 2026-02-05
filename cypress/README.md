# Cypress E2E テスト

## 前提条件

- **アプリの起動**: E2E実行前に、Laravel と Vite を起動しておく必要があります。
  - 例: `php artisan serve --port=8430`（別ターミナル）
  - 開発時: `npm run dev` で Vite を起動し、ブラウザでは `http://localhost:8430` でアクセス（vite.config の proxy 先に合わせる）
- **ベースURL**: デフォルトは `http://localhost:8430`。別の場合は環境変数で指定します。
  ```bash
  export CYPRESS_BASE_URL=http://localhost:8000
  ```
- **テスト用アカウント**: 管理者・出品者・参加者のユーザーが DB に存在し、ログインできる状態にしてください。
  - シーダーで作成するか、`.env.cypress` または環境変数でメール・パスワードを指定します。

## 環境変数（任意）

| 変数名 | 説明 | デフォルト例 |
|--------|------|--------------|
| `CYPRESS_BASE_URL` | アプリのベースURL | `http://localhost:8430` |
| `E2E_ADMIN_EMAIL` | 管理者メール | `admin@example.com` |
| `E2E_ADMIN_PASSWORD` | 管理者パスワード | `password` |
| `E2E_SELLER_EMAIL` | 出品者メール | `seller@example.com` |
| `E2E_SELLER_PASSWORD` | 出品者パスワード | `password` |
| `E2E_PARTICIPANT_EMAIL` | 参加者メール（**participant ロールのみ**のユーザー） | Docker スクリプトのデフォルトは `participant1@example.com`（DemoDataSeeder 用）。DatabaseSeeder のみの場合は `participant@example.com` を指定 |
| `E2E_PARTICIPANT_PASSWORD` | 参加者パスワード | `password` |

`.env.cypress` に書いても読み込まれません。`cypress.config.ts` の `env` は `process.env` を参照しているため、実行前に export するか、`cypress run` の前に設定してください。

## UI で操作する（cy:open）

**Cypress の画面からテストを選んで実行・デバッグしたい場合**は、**ホストマシン**（Mac/Windows、Docker の外）で次を実行してください。

1. アプリを起動しておく  
   - Docker の場合: `docker-compose up -d` で `http://localhost:8430` が開ける状態  
   - ローカルの場合: `php artisan serve --port=8430` と `npm run dev`
2. プロジェクトの **src** ディレクトリに移動してから:
   ```bash
   cd src
   npm run cy:open
   ```
3. Cypress のウィンドウが開いたら、実行したいスペック（例: `auth.cy.ts`）をクリックしてブラウザでテストを実行できます。失敗時はスクリーンショットやタイムトラベルで確認できます。

※ **Docker コンテナ内**では画面（ディスプレイ）がないため `cy:open` は使えません。コンテナ内で流す場合は `./src/scripts/cypress-docker-run.sh`（ヘッドレス）を使ってください。

## コマンド

```bash
# 対話型（Cypress UI を開く）※ ホストで実行
npm run cy:open

# ヘッドレスで全スペック実行
npm run cy:run

# ブラウザを表示して実行
npm run cy:run:headed

# エイリアス
npm run test:e2e
```

## ディレクトリ構成

```
cypress/
├── e2e/           # スペック（*.cy.ts）
├── fixtures/      # テストデータ（JSON 等）
├── support/
│   ├── e2e.ts     # サポート読み込み
│   └── commands.ts # カスタムコマンド（loginAsAdmin 等）
└── README.md      # 本ファイル
```

## カスタムコマンド

- `cy.loginAsAdmin()` … 管理者でログイン（/admin に遷移するまで待機）
- `cy.loginAsSeller()` … 出品者でログイン
- `cy.loginAsParticipant()` … 参加者でログイン
- `cy.logout()` … ログアウト

## 項目書との対応

テストケースのコメントや describe/it の名前で、`docs/E2Eテスト項目書.md` のシナリオID（AUTH-01, ADM-01 等）を併記しています。項目書に沿ってスペックを追加・拡張してください。

## Docker 内で実行する場合

コンテナ内で Cypress を初めて使うときは、**Cypress のバイナリ**を別途ダウンロードする必要があります。`cypress` コマンドはパスにないため、必ず **`npx`** または **`npm run`** で実行してください。

```bash
# 1. バイナリをインストール（初回のみ。ネットワークでダウンロードします）
npx cypress install
# または
npm run cy:install

# 2. その後で UI を開く / テスト実行
npm run cy:open
npm run cy:run
```

- **Alpine Linux (linux-arm64)** の場合、Cypress がその組み合わせを公式にサポートしていないことがあり、`cypress install` でバイナリが取れない、または **Cypress failed to start / spawn Cypress ENOENT** となります。Alpine は musl ベースのため、公式バイナリが動作しないことがあります。その場合は**コンテナ内で Cypress を動かさず**、次のいずれかで実行してください。
  - **推奨: 公式 Cypress Docker イメージで実行**（下記「Docker 内で Cypress が起動しない場合」参照）
  - **ホストマシン（Mac/Windows）で Cypress を実行する**（アプリだけ Docker で動かし、テストは手元で `npm run cy:run`）

### Docker 内で Cypress が起動しない場合（ENOENT / failed to start）

**Alpine コンテナ内**では Cypress バイナリが動かないことがあります。その場合は **ホストマシン** から、公式の Cypress Docker イメージを使ってテストを実行してください。

1. アプリを起動した状態にしておく（例: `docker-compose up -d` でプロキシが `localhost:8430` で動いている）
2. **ホストマシン**（コンテナの外）で、リポジトリルート（`docker-compose.yml` があるディレクトリ）に移動してから以下を実行:

```bash
chmod +x src/scripts/cypress-docker-run.sh
./src/scripts/cypress-docker-run.sh
```

- **注意**: このスクリプトは `docker run` を使うため、**コンテナの中ではなくホストで実行**してください。コンテナ内（`/var/www/html`）では Docker が使えません。
- アプリのURLを変えたい場合は、実行前に `export CYPRESS_BASE_URL=http://host.docker.internal:8080` のように指定してください。
- Linux のホストでは、スクリプト内で `host.docker.internal` が使えるようにしています。

### Docker 内で「Xvfb がない」と言われる場合

コンテナに画面（ディスプレイ）がないため、Cypress は仮想フレームバッファ **Xvfb** を要求します。Alpine の場合はコンテナ内で以下を実行してください。

```bash
# Alpine の場合（コンテナ内で）
apk add --no-cache xvfb
```

インストール後、もう一度 `npm run cy:open` または `npm run cy:run` を実行してください。

- **cy:open（UI）を使わない**場合は、ヘッドレスで実行する **`npm run cy:run`** だけ使う方法もあります。その場合でも多くの Linux 環境では Xvfb が必要になります。
- Dockerfile でイメージをビルドする際に Xvfb を入れておく場合は、上記の `apk add` を Dockerfile に追加してください。

## トラブルシューティング

- **Cypress executable not found**  
  → 上記「Docker 内で実行する場合」のとおり `npx cypress install`（または `npm run cy:install`）を実行してください。

- **Your system is missing the dependency: Xvfb**（Docker / Alpine など）  
  → 上記「Xvfb がない」のとおり、コンテナ内で `apk add --no-cache xvfb` を実行してください。

- **Cypress failed to start / spawn Cypress ENOENT**（Alpine など）  
  → Alpine + linux-arm64 では公式バイナリが動作しないことがあります。**コンテナ内では Cypress を動かさず**、ホストから `src/scripts/cypress-docker-run.sh` で公式 Cypress Docker イメージを実行してください（上記「Docker 内で Cypress が起動しない場合」）。

- **esbuild のプラットフォームエラー**（`darwin-arm64` vs `darwin-x64`）: Node を Rosetta 経由で使っている場合に発生することがあります。Node をネイティブ ARM64 で入れ直すか、`npm rebuild` を試してください。

- **baseUrl に接続できない**: 先に `php artisan serve --port=8430` と `npm run dev` でアプリを起動し、ブラウザで `http://localhost:8430` が開けることを確認してください。

- **allowCypressEnv の警告**: Cypress 15 で `Cypress.env()` に関する警告が出ることがあります。テストはそのまま動作します。将来のバージョンでは `cy.env()` や `Cypress.expose()` への移行が推奨されています。

- **参加者テストが /seller にリダイレクトされる**: ログイン後のリダイレクトは「admin → seller → participant」の順で判定します。参加者用アカウントに **seller ロールも付いている**と /seller に飛びます。**participant ロールのみ**のユーザーを使ってください。DemoDataSeeder を使っている場合は `E2E_PARTICIPANT_EMAIL=participant1@example.com`（デフォルト）、DatabaseSeeder のみの場合は `participant@example.com` を指定してください。
