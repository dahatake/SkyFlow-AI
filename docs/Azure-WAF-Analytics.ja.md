# Azure Well-Architected Framework (WAF) 分析レポート: SkyFlow AI

- **フレームワーク:** [Microsoft Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/) (5 つの柱)
- **スコープ:** 現状のままのリポジトリ。`azure.yaml`、`infra/` (Bicep)、`services/`、`app/`、`.github/workflows/` の静的レビューです。稼働中のサブスクリプションは評価していないため、ランタイム構成、クォータ、実際のコストは対象外です。
- **評価スケール:** 🟢 強固 · 🟡 適切だがギャップあり · 🔴 本番運用前に対処すべきギャップ。

## 1. ワークロードの概要

SkyFlow AI は、空港グランドハンドリング向けの AI Operations Control Tower です。決定論的なシナリオエンジンが信頼できる唯一の情報源 (source of truth) であり、AI エージェントはエンジンが提示する選択肢の中から選ぶだけです。すべての変更には人間による承認ゲートが適用されます。

| コンポーネント | Azure サービス | 備考 |
|---|---|---|
| `web` (React SPA、`app/`) | Static Web Apps (Standard) | オプションの Entra ID 認証。リンクされたバックエンドが `/api/*` を agent-api にプロキシ |
| `agent-api` (Python/FastAPI) | Container Apps (外部 Ingress) | Entra JWT 検証、レートリミッター、サーキットブレーカー、Content Safety シールド、1 vCPU / 2 GiB |
| `engine-mcp` (Node/TS MCP サーバー) | Container Apps (**内部** Ingress) | 0.5 vCPU / 1 GiB |
| `scheduler` | Container Apps ジョブ | Cron `* * * * *`、タイムアウト 55 秒、再試行なし |
| 永続化 | Cosmos DB NoSQL (既定はサーバーレス) | `proposals` および `audit` コンテナー。ローカル認証は無効 |
| AI | gpt-4.1 と gpt-4.1-mini (GlobalStandard) を備えた Foundry (AIServices)、Azure AI Content Safety | ローカル認証は無効。マネージド ID を使用 |
| シークレット、イメージ | Key Vault (RBAC、論理的な削除 90 日、消去保護)、ACR Basic | Teams Webhook は Key Vault に保存 |
| 可観測性 | Log Analytics、Application Insights、可用性テスト (APAC の 3 ロケーション)、メトリックアラート、ワークブック、診断設定 | 保持期間 30 日、上限 5 GB/日 |
| オプションのネットワーク | Cosmos、Key Vault、AI アカウント向けの VNet とプライベートエンドポイント | `enablePrivateNetworking`、既定は `false` |
| デリバリー | GitHub Actions: CI (テスト、Bicep lint、gitleaks)、CodeQL、azd と OIDC フェデレーションによる CD、スモークテスト | Dependabot 有効 |

## 2. エグゼクティブ スコアカード

| 柱 | 評価 | 一言での評価 |
|---|---|---|
| 信頼性 | 🟡 | ヘルスプローブ、アラート、決定論的フォールバックは良好。シングルリージョンでゾーン冗長なし、prod 以外ではゼロスケール。 |
| セキュリティ | 🟢/🟡 | ID 優先の強固な設計。ただし既定ではパブリックエンドポイントで、認証を無効化できる。 |
| コスト最適化 | 🟢 | サーバーレスとゼロスケールを既定とし、予算とログ上限あり。SKU と実行間隔に調整の余地あり。 |
| 運用上の優秀性 | 🟢 | IaC、OIDC による CI/CD、テスト、アラート、ワークブックを整備。Runbook とポリシーに若干のギャップあり。 |
| パフォーマンス効率 | 🟡 | HTTP オートスケールは構成済み。負荷テストと SLO 目標がなく、モデルのクォータも控えめ。 |

## 3. 柱ごとの分析

### 3.1 信頼性

**強み**
- アーキテクチャは段階的に機能を縮退 (グレースフルデグラデーション) できます。「すべての AI パスは、モデルをオフにしても動作しなければならない (`mode: rules`)」(`AGENTS.md`)。`safety.py` の `CircuitBreaker` と `RateLimiter` が、モデルと API のパスを保護します。
- `/health` と `/api/health` エンドポイントがあります。Application Insights の可用性テストが 3 ロケーションから実行され、可用性、API の 5xx、コンテナーの再起動に対するメトリックアラートが設定されています (`infra/modules/monitoring-alerts.bicep`)。
- `CosmosStore` では楽観的同時実行制御を使用しています (`CosmosAccessConditionFailedError` の処理)。`MemoryStore` フォールバックにより、デモは引き続き動作します。
- `activeRevisionsMode: Single` と `fetch-latest-image` により、再プロビジョニングでイメージがロールバックされることを防ぎます。
- 不変のベースラインと派生オーバーレイにより、状態が再現可能でテスト可能になります。

**ギャップとリスク**
| # | 所見 | 根拠 | リスク | 推奨事項 |
|---|---|---|---|---|
| R1 | Container Apps 環境がゾーン冗長ではない。 | `zoneRedundant: false` (`resources.bicep`) | ゾーン障害で API とエンジンが停止する。 | パラメーター化する。`prod` で有効化する (VNet 統合環境が必要)。 |
| R2 | Cosmos DB がシングルリージョンで、ゾーン冗長ではない。 | `isZoneRedundant: false` | データプレーンの障害が発生し、監査証跡にリージョン間 DR がない。 | prod では、リージョンが対応していればゾーン冗長を有効化し、セカンダリリージョンを追加し、継続的バックアップ (PITR) を使用し、`enableAutomaticFailover` を設定する。 |
| R3 | `dev` と `staging` の既定は `minReplicas: 0` (`isProd` ガード)。 | `var minReplicas = isProd ? 1 : 0` | コールドスタートが発生する。アイドル後の最初のリクエストが遅い。 | 非 prod では許容できる。prod では 2 レプリカ以上にして、単一レプリカの喪失でダウンタイムが発生しないようにする。 |
| R4 | scheduler が `replicaRetryLimit: 0` で毎分実行される。 | `cronExpression: '* * * * *'` | 実行が漏れても通知されずスキップされる。 | ジョブが冪等であることを確認し、ジョブ失敗のアラートを追加する。重複実行のガードも検討する。 |
| R5 | RTO/RPO、SLO、DR Runbook が文書化されていない。 | `docs/` | 復旧に関する期待値が不明確。 | SLO (例: API 可用性、p95 レイテンシ、提案から承認までの時間) を定義する。`docs/PLAYBOOK.md` に DR セクションを追加する。 |
| R6 | Foundry が単一リージョン (`eastus2`) に GlobalStandard でデプロイされている。 | `foundryLocation` | リージョンのモデル障害で AI 機能が低下する。 | rules モードのフォールバックに依存する。必要に応じてセカンダリのデプロイまたは Foundry アカウントを追加する。 |
| R7 | SPA は `eastasia` にある API とリージョンをまたいでいる。Cosmos は `southeastasia`、Foundry は `eastus2` にある。 | `main.bicep` | リージョン間のレイテンシと、複数のリージョン依存が生じる。 | トレードオフを文書化する。これらの選択は、キャパシティとモデルの提供状況によるもの。 |

### 3.2 セキュリティ

**強み**
- **ID 優先:** ユーザー割り当てマネージド ID に最小権限のロール (AcrPull、Key Vault Secrets User、Cognitive Services User、Cosmos データ共同作成者) を付与しています。Cosmos、Foundry、Content Safety はいずれも `disableLocalAuth: true` です。Key Vault は RBAC 認可を使用しています。リポジトリにキーは含まれておらず、このルールは `AGENTS.md` に明記されています。
- **API 認証:** `Authenticator` が Entra ID のベアラートークンを検証します (テナントの JWKS による RS256 署名、audience、issuer の許可リスト)。ロールは `roles` クレームから取得し、承認者ロールはサーバー側で強制されます。
- **内部エンジン:** `engine-mcp` は `external: false` で、両アプリとも `allowInsecure: false` が設定されています。
- **AI の安全性:** プロンプトインジェクションのヒューリスティック (`looks_like_injection`、`sanitize_untrusted`、`wrap_data`)、出力のマスキング、数値のグラウンディング検査 (モデルは数値を生成しない)、Content Safety シールド、人間による承認ゲート。
- **Key Vault:** 論理的な削除 (90 日) と消去保護が既定で有効です。オプションでプライベートエンドポイントを利用できます。
- **サプライチェーン:** gitleaks、CodeQL (週次および PR 時)、Dependabot、CD 向けの OIDC フェデレーション (Azure の資格情報を保存しない)。

**ギャップとリスク**
| # | 所見 | 根拠 | リスク | 推奨事項 |
|---|---|---|---|---|
| S1 | プライベートネットワークが既定でオフのため、Cosmos、Key Vault、Foundry、Content Safety にパブリックエンドポイント経由で到達できる。 | `enablePrivateNetworking = 'false'` | 攻撃対象領域が広がり、データ流出の経路となる。 | `staging` と `prod` では既定を `true` にする。agent-api の送信 (egress) にも VNet が必要。 |
| S2 | `apiAudience` が空の場合、`authDisabled` が `true` に解決される (「デモ専用」)。 | `main.bicep` | 承認エンドポイントを持つ API が認証なしになる。 | `environmentType == 'prod'` で認証が無効な場合はデプロイを失敗させる。Bicep の `assert` または `preflight` に検証ステップを追加する。 |
| S3 | CORS がすべてのヘッダーを `allowCredentials: true` で許可している。メソッドは広いが、オリジンは SWA ホストと明示的な追加分に限定されている。 | `corsPolicy` | リスクは低い。`additionalCorsOrigins` の設定ミスで範囲が広がる。 | `allowedHeaders` を必要なもの (`Authorization`、`Content-Type`) に制限する。追加分にワイルドカードがないことを検証する。 |
| S4 | WAF やエッジ保護がない。agent-api は外部 Ingress を持ち、SWA のリンク経由が唯一の経路ではない。 | `ingress.external: true` | API が直接公開され、L7 フィルタリングや DDoS 向けに調整されたポリシーがない。 | prod では、Azure Front Door と WAF または APIM を API の前段に配置する。agent-api の Ingress を Front Door または SWA 発のものに制限する (IP 制限またはプライベートリンク)。 |
| S5 | プライベートネットワークがない場合、Key Vault の `networkAcls.defaultAction` が `Allow` になる。 | `resources.bicep` | シークレットがパブリックネットワークから到達可能になる。 | S1 で対応する。あわせて Defender for Cloud のプラン (Key Vault、Cosmos DB、Containers、App Service) を有効化する。 |
| S6 | ACR が Basic である。 | `sku: Basic` | プライベートリンク、geo レプリケーション、コンテンツ信頼、検疫がない。 | プライベートリンクや脆弱性ポリシーが必要な場合は、prod で Premium を使用する。管理者ユーザーは無効のままにする。 |
| S7 | トークンはテナントに対する JWKS クライアントで検証される。 | `auth.py` | 低。 | 401/403 が繰り返されるパターンのテストとアラートを追加する。 |
| S8 | ログの内容にユーザーデータが含まれる可能性がある。 | `telemetry.py`、`redact` | マスキングが不完全な場合、データ保護上のリスクがある。 | `redact` のカバレッジをテストで維持する。保持期間をお客様のデータポリシーに照らして見直す。 |

### 3.3 コスト最適化

**強み**
- Cosmos は既定でサーバーレスで、無効にした場合のオートスケール上限は 1000 RU/s です。
- Container Apps は従量課金プロファイルを使用し、prod 以外ではゼロスケールで、`maxReplicas` に上限があります (dev は 2、prod はエンジン 5、API 10)。
- Log Analytics は上限 5 GB/日、保持期間 30 日です。`monthlyBudgetUsd` と連絡先メールアドレスがパラメーター化されており、アラート付きの予算を設定できます。
- リソースタグ (`azd-env-name`、`application`、`customer`、`environmentType`) により、コストの配賦が可能です。
- 小型モデル (`gpt-4.1-mini`、100K TPM) とプライマリモデル (`gpt-4.1`、50K TPM) は別々のデプロイのため、軽い呼び出しは小型モデルに振り分けられます。
- 数値処理は決定論的エンジンが行うため、トークン使用量に上限があります。

**改善の機会**
| # | 所見 | 推奨事項 |
|---|---|---|
| C1 | scheduler がアイドル時でも毎分実行される (月に約 43,200 回)。 | 実行間隔をパラメーター化する。非 prod ではバックオフするか、イベントで起動する。 |
| C2 | リンクされたバックエンドには Static Web Apps の **Standard** が必要だが、Free よりコストが高い。 | staging と prod では Standard を維持する。dev ではリンクされたバックエンドが不要な場合のみ Free を使用する (`linkSwaBackend=false`)。 |
| C3 | 可用性テストが全環境で 3 ロケーションから実行されている。 | dev では 1 ロケーションに減らす。 |
| C4 | 5 GB/日の上限により、テレメトリが通知なく破棄される可能性がある。 | 上限の 80% でアラートを出す。詳細なテーブルには Basic ログやアーカイブ層を検討する。 |
| C5 | モデルのキャパシティが GlobalStandard (トークン従量課金) でプロビジョニングされている。 | トークン使用量を監視する。agent-api にユーザー単位・日単位のトークン予算を追加する。 |
| C6 | 予算はあるが、しきい値が 1 組のみ。 | 50/80/100% の予測アラートと、環境ごとの予算を追加する。 |
| C7 | リザベーションや Savings Plan の分析がない。 | 使用量が安定した時点で prod について再検討する。 |

### 3.4 運用上の優秀性

**強み**
- すべてが IaC (AVM スタイルのモジュールを用いた Bicep) で、`azd` 駆動です。デプロイは再現可能で、`azure.yaml` で 4 つのサービスを定義しています。
- CI は、ユニットテスト、プロパティテスト、ゴールデンテスト (domain に 80% のカバレッジゲート)、lint、型チェック、Playwright の e2e、Python テスト、Bicep のビルドと lint、シークレットスキャンをカバーしています。
- CD は OIDC フェデレーションを使用し、環境別のデプロイ (`deploy-env.yml`) を行い、デプロイ後に API とブラウザーのスモークテストを実行します。
- 可観測性: Application Insights、Azure Monitor ワークブック、アクショングループ付きのアラート、Foundry、Content Safety、Cosmos、Key Vault の診断設定。
- 明確なコントリビューター向けガイダンス (`AGENTS.md`、`.github/instructions`、スキル、カスタムエージェント) と運用ドキュメント (`PLAYBOOK.md`、`DEMO-SCRIPT.md`)。
- 監査コンテナーが提案と承認を記録します。`trace_id` でレコードを関連付けます。
- 固定時刻クロック (`?clock=<ISO>`) により、テストが決定論的になります。

**ギャップ**
| # | 所見 | 推奨事項 |
|---|---|---|
| O1 | リポジトリに Azure Policy やガバナンスの割り当てがない。 | 必須タグ、プライベートエンドポイント、ローカル認証の無効化に関するポリシーを追加する。CI で `azqr` により評価する。 |
| O2 | 文書化されたインシデント Runbook や、アラートとオンコールの対応付けがない。 | アラートの説明からリンクされる Runbook を追加する。 |
| O3 | プログレッシブデリバリーの戦略がない。リビジョンは Single モードで動作している。 | prod では、複数のリビジョンとトラフィック分割 (ブルー/グリーン) を使用する。 |
| O4 | Bicep のチェックがビルドと lint のみ。 | PR に `what-if` を追加し、CI に Checkov または PSRule for Azure を追加する。 |
| O5 | SPA → agent-api → engine-mcp → Foundry にわたる分散トレーシングが、エンドツーエンドの確認項目として文書化されていない。 | W3C のトレース伝播を確実にし、サンプルの KQL を公開する。 |
| O6 | モデルの評価がルールベースのテストに限られている。 | エージェントパイプライン向けのオフライン評価セット (根拠性、選択肢選択の精度) を追加し、それをゲートにする。 |
| O7 | リポジトリのルートにバイナリのアーカイブ (`*-app.zip`) がある。 | ソース管理から削除する。ノイズとなり、古い内容を含んでいる可能性がある。 |

### 3.5 パフォーマンス効率

**強み**
- クライアントと MCP サービスで動作する純粋で決定論的な TypeScript エンジンにより、高速でキャッシュ可能な結果が得られます。クライアントでは IndexedDB ストレージを使用しています。
- HTTP 同時実行によるオートスケールルール (エンジン 50、API 30 の同時リクエスト) と、軽い処理向けの高速モデル。
- SWA は静的アセットをエッジから配信します。SWA のリンクされたバックエンドにより API が同一オリジンになり、CORS のプリフライトが不要になります。
- レートリミッターと Content Safety 呼び出しの 5 秒タイムアウトにより、遅い依存先が滞留することを防ぎます。

**ギャップ**
| # | 所見 | 推奨事項 |
|---|---|---|
| P1 | 負荷テストやパフォーマンステストがなく、レイテンシの SLO もない。 | agent-api に Azure Load Testing を追加し、`/api/*` と提案生成に p95 の目標を設定する。 |
| P2 | `minReplicas` が 0 の場合にコールドスタートが発生する。 | デモやライブ運用に使用する環境では、API に `minReplicas ≥ 1` を使用する。 |
| P3 | モデルのクォータが控えめ (50K と 100K TPM)。障害発生時のバーストで 429 が発生する可能性がある。 | ジッター付きバックオフでの再試行を追加し、クォータを事前に申請する。429 では rules フォールバックを使用する (サーキットブレーカーでほぼカバー済み)。 |
| P4 | レートリミッターがレプリカごとのインメモリである。 | 複数レプリカではリミットがグローバルにならない。厳密な制限が必要なら共有ストア (Redis または Cosmos) を使用する。 |
| P5 | Cosmos のパーティションキーが `/demoId`。 | デモとシングルテナントのモデルには適している。複数空港へのスケールでは、カーディナリティとホットパーティションのリスクを確認する。 |
| P6 | クライアントのバンドルが大きい (3D シーン、マップ)。 | 重いビュー (`Scene3D`、`GpsMap`) をコード分割し、Application Insights で Web Vitals を追跡する。 |

## 4. 横断的観点: AI ワークロード向けの Well-Architected

| 懸念事項 | 状況 |
|---|---|
| グラウンディングと決定論性 | 🟢 エンジンが信頼できる唯一の情報源であり、モデルは数値を生成しない。 |
| ヒューマン・イン・ザ・ループ | 🟢 サーバー側の承認者ロール。 |
| コンテンツの安全性とプロンプトインジェクション | 🟢 Content Safety に加え、ヒューリスティックとマスキング。 |
| 責任ある AI の証跡 | 🟡 監査ログはあるが、評価セット、透明性に関する注記、レッドチームの記録がない。 |
| モデルのライフサイクル | 🟡 モデル名とバージョンはパラメーターだが、廃止の追跡がない。`gpt-4.1` の廃止日を確認するチェックを追加する。 |
| データレジデンシー | 🟡 モデルは `eastus2` にあるが、データは東南アジアにある。お客様の要件に照らして確認する。 |

## 5. 優先順位付きアクションプラン

| 優先度 | アクション | 柱 | 工数 |
|---|---|---|---|
| P0 | `prod` で `authDisabled` を禁止する (S2)。 | セキュリティ | S |
| P0 | staging と prod でプライベートネットワークを有効化する (S1、S5)。 | セキュリティ | M |
| P1 | API の前段に Front Door と WAF を配置し、直接の Ingress を制限する (S4)。 | セキュリティ / 信頼性 | M |
| P1 | Cosmos と Container Apps のゾーン冗長と、マルチリージョンまたはバックアップの計画 (R1、R2)。 | 信頼性 | M |
| P1 | SLO、RTO/RPO、Runbook を定義する (R5、O2)。 | 信頼性 / 運用 | S |
| P1 | 負荷テストを追加し、prod で `minReplicas ≥ 2` にする (P1、P2、R3)。 | パフォーマンス | M |
| P2 | Policy-as-code、`what-if`、CI での IaC スキャン (O1、O4)。 | 運用 | M |
| P2 | scheduler の実行間隔、可用性テストのロケーション、予算アラート (C1、C3、C6)。 | コスト | S |
| P2 | AI 評価ゲートとモデルのライフサイクル追跡 (O6、セクション 4)。 | 運用 / AI | M |
| P3 | 共有レート制限、バンドル分割、リポジトリから zip を削除 (P4、P6、O7)。 | パフォーマンス / 運用 | S |

工数: S = 1 日未満、M = 1〜5 日。

## 6. 方法と制限事項

- 所見はソースを読んで得たものです。デプロイや計測は行っておらず、月 43,200 回の実行といった数値は構成から算出しています。
- 「prod」と記載した項目は `environmentType = prod` を前提としています。`dev` の既定では、いくつかのギャップはコストを優先した意図的なトレードオフです。
- インフラの変更後は、このレビューを再実施してください。デプロイ済み環境に対する [Azure Well-Architected Review assessment](https://learn.microsoft.com/en-us/assessments/azure-architecture-review/) と `azqr` により、ランタイムの状態を検証できます。

## 7. 参考資料

- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/)
- [Well-Architected pillars](https://learn.microsoft.com/en-us/azure/well-architected/pillars)
- [Well-Architected for AI workloads](https://learn.microsoft.com/en-us/azure/well-architected/ai/)
- [Azure Container Apps reliability](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-container-apps)
- [Azure Cosmos DB WAF service guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/cosmos-db)
