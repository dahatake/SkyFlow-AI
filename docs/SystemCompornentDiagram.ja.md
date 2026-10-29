# システムコンポーネント図

## 現在の構成: ローカル専用・水平デモ

```mermaid
flowchart LR
    user["運用担当者"] --> ui["ローカル React UI<br/>2D / 3D / ダッシュボード"]
    ui --> advisor["コード化したルール<br/>検知 / 分類 / 解決 / 通知プレビュー"]
    advisor --> engine["決定論的エンジン<br/>シナリオ / KPI / 最適化 / 計画"]
    engine --> human["人による承認<br/>派生ビュー / 5W2H タスク"]
    human --> storage["ブラウザ内保存<br/>IndexedDB / 設定 / 監査"]
    seed["同梱の顧客設定・シード<br/>模擬フィード / GPS"] --> engine
```

全機能は一台のローカル端末内で動作します。Vite が localhost でアセットを配信し、ブラウザが処理を実行します。LLM、MCP/API サーバー、Azure、Entra 認証、Fabric、Teams、外部テレメトリは使用しません。推薦はエンジンが算出した有効な選択肢と数値のみを使用します。

提案は権限のある三つのマネージャーロールによる明示的な承認後にのみ適用します。ロール選択はデモ用で本番認証ではありません。決定・監査は IndexedDB、設定は localStorage に保存し、ベースラインは変更しません。依存関係の導入後は localhost の配信のみで動作します。PWA / Service Worker のインストールではありません。

実装: [アドバイザー](../app/src/agent/client.ts)、[承認 UI](../app/src/components/AgentView.tsx)、[エンジン](../app/src/domain)、[保存](../app/src/storage)。

## 過去のクラウド構成 (現在のデモでは使用しない)

<details>
<summary>過去の Azure / LLM コンポーネント</summary>

以下は旧クラウド実装の参考図です。
(出典: [azure.yaml](../azure.yaml)、[infra/resources.bicep](../infra/resources.bicep)、`app/`、`services/`)

## 1. アプリケーション層

```mermaid
flowchart LR
    user([運用担当ユーザー])

    subgraph web["web (React SPA / app)"]
        direction TB
        ui["UI コンポーネント<br/>Board, Decisions, Optimizer,<br/>AgentView, Map2D/Scene3D, KPI"]
        domain["domain<br/>決定論的エンジン<br/>scenario, judgement, kpi,<br/>optimizer, planning"]
        data["データプロバイダー<br/>シード / Fabric プロバイダー"]
        storage["ストレージ<br/>IndexedDB, GPS トラッカー"]
        i18n["i18n + customers<br/>customer.json"]
        client["agent/client.ts"]
        ui --> domain
        ui --> data
        ui --> storage
        ui --> i18n
        ui --> client
    end

    subgraph api["agent-api (Python / FastAPI)"]
        direction TB
        routes["app.py<br/>/api/agent/propose, proposals,<br/>approve, reject, apply, audit, ask"]
        auth["auth.py<br/>Entra ID トークン検証"]
        pipeline["pipeline.py<br/>Detect → Triage → Resolver → Comms"]
        rules["rules.py<br/>決定論的フォールバック"]
        safety["safety.py<br/>インジェクション検査、グラウンディング、<br/>マスキング、サーキットブレーカー、シールド"]
        model["model.py<br/>LLM クライアント"]
        engclient["engine_client.py<br/>MCP クライアント"]
        store["store.py<br/>提案 + 監査"]
        teams["teams.py<br/>承認カード"]
        tel["telemetry.py<br/>OpenTelemetry"]
        routes --> auth
        routes --> pipeline
        routes --> store
        pipeline --> rules
        pipeline --> safety
        pipeline --> model
        pipeline --> engclient
        pipeline --> teams
        pipeline --> tel
    end

    subgraph engine["engine-mcp (TypeScript MCP サーバー)"]
        tools["MCP ツール<br/>get_live_state, get_exceptions, rank_by_sla,<br/>list_decision_tasks, run_scenario,<br/>compare_options, run_optimizer, get_kpi_value"]
        eng["engine.ts<br/>共有の決定論的エンジン"]
        tools --> eng
    end

    subgraph sched["scheduler (Python ジョブ)"]
        job["scheduler.py<br/>定期的な提案の実行"]
    end

    user --> ui
    client -- "HTTPS /api/*" --> routes
    engclient -- "MCP over HTTP" --> tools
    job --> pipeline
    domain -. "同一のエンジンロジック" .- eng
    model -- "LLM 呼び出し" --> llm[(Foundry モデル)]
    safety -- "プロンプト/コンテンツのシールド" --> cs[(Content Safety)]
    store --> db[(Cosmos DB)]
    teams -- "Webhook" --> teamsx[(Microsoft Teams)]
```

## 2. Azure コンポーネント

```mermaid
flowchart TB
    user([ユーザーのブラウザー])
    entra[Microsoft Entra ID]
    teams[Microsoft Teams]
    gh[azd / CI デプロイ]

    subgraph rg["リソースグループ (infra/main.bicep + resources.bicep)"]
        swa["Static Web App<br/>web (React SPA)<br/>+ リンクされたバックエンド (Standard SKU)"]

        subgraph cae["Container Apps 環境"]
            api["Container App<br/>agent-api"]
            mcp["Container App<br/>engine-mcp"]
            job["Container Apps ジョブ<br/>scheduler"]
        end

        acr["Azure Container Registry"]
        uami["ユーザー割り当て<br/>マネージド ID"]
        kv["Key Vault<br/>(Teams Webhook シークレット)"]
        cosmos["Cosmos DB (NoSQL)<br/>コンテナー: proposals, audit"]

        subgraph ai["Microsoft Foundry"]
            foundry["AI Services アカウント + プロジェクト"]
            dep1["デプロイ: プライマリモデル"]
            dep2["デプロイ: 高速モデル"]
            foundry --- dep1
            foundry --- dep2
        end
        cs["Azure AI Content Safety<br/>(オプション)"]

        subgraph mon["監視"]
            law["Log Analytics ワークスペース"]
            ai_ins["Application Insights"]
            alerts["アラートルール<br/>(オプション)"]
        end

        subgraph net["プライベートネットワーク (オプション)"]
            vnet["VNet + サブネット"]
            pe["プライベートエンドポイント<br/>Cosmos, Key Vault,<br/>Foundry, Content Safety"]
        end
    end

    user -- HTTPS --> swa
    swa -- "Entra サインイン" --> entra
    swa -- "/api/* プロキシ" --> api
    api -- "MCP (内部 Ingress)" --> mcp
    job -- "パイプライン実行" --> api
    api -- "マネージド ID<br/>データプレーン RBAC" --> cosmos
    api --> foundry
    api --> cs
    api -- "シークレット参照" --> kv
    api -- "Webhook" --> teams
    api -. "トークン検証" .-> entra

    uami -. "AcrPull" .-> acr
    uami -. "Key Vault Secrets User" .-> kv
    uami -. "Cosmos データロール" .-> cosmos
    uami -. "Cognitive Services ロール" .-> foundry
    api & mcp & job -. "ID を使用" .-> uami
    gh -- "イメージのビルドとプッシュ" --> acr
    acr -- "プル" --> cae

    cae --> law
    api & mcp & job -- "OpenTelemetry" --> ai_ins
    ai_ins --> law
    cosmos & kv & foundry & cs -- "診断" --> law
    law --> alerts
    cae --- vnet
    vnet --- pe
    pe -.-> cosmos & kv & foundry & cs
```

## 補足

- `agent-api` と `scheduler` は同じイメージ/プロジェクト (`services/agent-api`) からビルドされます。scheduler は Container Apps ジョブとして実行されます。
- 数値の唯一の情報源は決定論的エンジンです。LLM は選択と説明のみを行い、`safety.py` のグラウンディング検査で保護されます。
- プライベートエンドポイント、Content Safety、アラート、SWA のリンクされたバックエンドは、Bicep パラメーター (`enablePrivateNetworking`、`enableContentSafety`、`enableAlerts`、`linkSwaBackend`) によって有効化される条件付きの構成です。

</details>
