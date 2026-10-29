# プレイブック: ローカル専用・ルールベースのデモ

現在のデモは localhost のブラウザ内で動作します。Python、Azure、LLM、外部サービスは不要です。

```powershell
cd app
npm ci --legacy-peer-deps
npm run dev -- --host 127.0.0.1
```

`http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1` を開きます。ビルド済みデモは `npm run build` の後に `npx vite preview --host 127.0.0.1 --port 4173` で配信します。配信サーバーは停止しないでください。PWA ではありません。

パイプラインを実行し、ルールによる提案を確認してからマネージャーが明示的に承認します。決定と監査は IndexedDB に保存されます。ブラウザデータを削除する前に Diagnostics からエクスポートしてください。外部通知は送信せず、旧 `VITE_AGENT_API_URL` 設定も使用しません。

構成: [水平コンポーネント図](SystemCompornentDiagram.ja.md)。検証は `app/` で `npm test`、`npx tsc --noEmit`、`npm run lint`、`npm run build`、`npm run test:e2e` を実行します。

## 過去のクラウド手順

以下は参考資料です。デプロイワークフローは無効であり、ローカルデモに Azure の作成手順は不要です。

<details>
<summary>過去のサービス・デプロイ・CI/CD 手順</summary>

対象読者: GitHub Copilot(または任意の AI ハーネス)とこのリポジトリのみを使用する Hub SE。

## 0. 前提条件

| ツール | バージョン | 確認方法 |
|---|---|---|
| Node.js | 22 以上 (`app/.nvmrc`) | `node -v` |
| Python | 3.12(エージェントサービスのみ) | `python --version` |
| Azure CLI + Bicep | 最新 | `az version` |
| Azure Developer CLI | 最新 | `azd version` |
| GitHub CLI(CI/CD のみ) | 最新 | `gh --version` |

または、開発コンテナー(`.devcontainer`)でリポジトリを開きます。

## 1. ローカルで実行する(10 分、Azure 不要)

```
./scripts/setup.ps1        # or setup.sh: npm ci, validate customers, run tests
cd app && npm run dev
```

`http://localhost:5173/?clock=2027-01-11T08:00:00%2B08:00&demo=1` を開きます。

## 2. 自社向けにカスタマイズする(30 分)

最速の方法: VS Code の Copilot チャットで `/instantiate-engagement` を実行します。手動で行う手順は次のとおりです。

1. `app/src/customers/generic-hub` を `app/src/customers/<id>` にコピーします。
2. `customer.json` を編集します: 名称、空港、通貨、前提条件(`assumptions.source` を含む)、日付。
3. `app/src/customers/index.ts` にそのファイルを登録します。
4. `cd app && npm run validate:customer -- <id>`。
5. `?customer=<id>` を付けて実行します(または `app/.env.local` に `VITE_CUSTOMER=<id>` を設定します)。
6. 空港のレイアウトとフライトは `app/src/domain/seed.ts`、`airportMap.ts`、`app/scripts/fetch-changi-routes.py` から取得されます。別の空港向けには、これらを置き換え、スキーマ(`SCHEMA_VERSION`)は維持してください。ライブデータを使用する場合は、`scripts/fabric-setup.kql` と `scripts/publish-baseline.ts` とともに `app/src/data/fabricProvider.ts` を使用します。
7. `npm test && npm run test:e2e`。

## 3. デッキ(10 分)

```
cd app && npx playwright install chromium
npm run build:deck -- <id>       # app/out/decks/<id>/*.pdf
```

ナラティブ: `docs/presentation-narrative.md`。デモの流れ: `docs/DEMO-SCRIPT.md`。価値の数値: `docs/VALUE-MODEL.md`。外部に提示する前に、すべてのプレースホルダー前提条件を置き換えてください。

## 4. Azure にデプロイする(45 分)

```
./scripts/preflight.ps1 -SubscriptionId <id> -Location <region>
azd env new <name>
azd env set AZURE_SUBSCRIPTION_ID <id>
azd env set AZURE_LOCATION <region>
azd env set BUDGET_CONTACT_EMAIL you@contoso.com
azd provision --preview        # review the what-if
azd up
```

作成されるもの(`infra/` を参照): Static Web App、Container Apps(`engine-mcp`、`agent-api`、`agent-scheduler` ジョブ)、Container Registry、2 つのモデルデプロイを含む Microsoft Foundry アカウントとプロジェクト、Content Safety、Cosmos DB、Key Vault、Log Analytics と Application Insights、アラートとワークブック、および月次予算(既定は 10,000 USD、50/80/100% でのアラートと 110% の予測アラート)。

一般的なコスト: 開発環境でおよそ月額 40~180 USD、本番環境でおよそ 400~3,500 USD(主にモデルの使用量によって変動します)。

必要になる可能性のある設定:

| 設定 | 場所 | 備考 |
|---|---|---|
| モデル名とキャパシティ | `azd env set FOUNDRY_MODEL_PRIMARY ...` | preflight を実行してください。クォータはリージョンごとに異なります |
| Teams Webhook | `azd env set TEAMS_WEBHOOK_URL ...` | Key Vault に保存されます。省略可能 |
| Entra サインイン | `aadClientId` パラメーター | `app/public/staticwebapp.config.json` は既定でログインを必須としています |
| プライベートネットワーク | `enablePrivateNetworking=true` | 省略可能。月額でおよそ 30 USD が追加されます |
| Web から Agent API への接続 | ビルド時の `VITE_AGENT_API_URL` | azd がデプロイ済みの API から設定します |

スモークテスト: `curl https://<agent-api>/health` と `E2E_BASE_URL=https://<swa> npm run test:e2e`(`app/` 内で実行)。

## 5. CI/CD(15 分)

```
./scripts/setup-oidc.ps1 -SubscriptionId <id> -Repo <owner/name>
```

このスクリプトは、`.github/workflows/cd.yml` 用のリポジトリ変数 `AZURE_CLIENT_ID`、`AZURE_TENANT_ID`、`AZURE_SUBSCRIPTION_ID`、`AZURE_ENV_NAME`、`AZURE_LOCATION`、`BUDGET_CONTACT_EMAIL` を出力します。`staging` と `production` の GitHub 環境を作成してください(それぞれ独自の変数を持たせ、production には必須レビュー担当者を設定します)。CD はステージングにデプロイしてスモークテストを行い、その後本番にデプロイします。ロールバックするには、CD ワークフローを手動で実行し、`ref` に以前の正常な SHA を指定します。CI は、すべての PR でテスト、lint、カバレッジ、Bicep ビルド、e2e を実行します。

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `npm ci` でピア依存関係エラーが出る | リポジトリの `.npmrc`(`legacy-peer-deps`)を使用してください。削除しないでください |
| 値がデモスクリプトと異なる | `?clock=` が指定されていません。シードは時刻に依存します |
| モデルのデプロイに失敗する | クォータまたはリージョンの問題です。preflight を実行し、`FOUNDRY_MODEL_*` またはリージョンを変更してください |
| エージェントが "Rule-based fallback" と表示する | サービスに到達できない、モデルが利用できない、または出力が検証に失敗したことを示します。仕様どおりの動作です |
| プロビジョニング直後にスケジューラージョブが失敗する | `azd deploy` が完了するまではプレースホルダーイメージのためです |
| サイトで 401 が返る | Entra サインインが必須です。サインインするか、`staticwebapp.config.json` のルートを緩和してください |
| 再デプロイ時に Key Vault の名前が競合する | 消去保護が有効です。新しい環境名を使用してください |

## 削除

`azd down --purge`

</details>
