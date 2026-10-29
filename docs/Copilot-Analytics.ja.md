# GitHub Copilot 分析詳細レポート — SkyFlow AI

スナップショット: 2026-10-29 · リポジトリ: `dahatake/SkyFlow-AI` · データ源: git 履歴と `.github/` の内容（静的分析）

> 範囲: Copilot の利用テレメトリ（提案の採用率、チャット数、シート数）はリポジトリには保存されません。本レポートはリポジトリから確認できる範囲（Copilot カスタマイズ資産、コミット活動、対象コード）を扱います。実利用指標は組織/エンタープライズの *Copilot usage metrics* ダッシュボードまたは API を使用してください。

## 1. エグゼクティブサマリー

| 指標 | 値 |
|---|---|
| 追跡ファイル数 | 214 |
| コミット数（全ブランチ） | 22（2026-10-28 〜 10-29） |
| コントリビューター | 人間 1 名、Dependabot 5 コミット |
| Copilot カスタマイズファイル | 15（`.github/` 内、workflows/dependabot を除く） |
| カスタムエージェント | 4 |
| スキル | 5 |
| パス指定インストラクション | 4 + リポジトリ共通 1 |
| 再利用プロンプト | 1 |
| `Co-authored-by: Copilot` 付きコミット | 0 |

要点: エージェント・スキル・パス指定インストラクションが 4 つのコード領域すべてをカバーし **Copilot 対応は充実**していますが、Copilot 支援作業のコミット単位の帰属記録はありません。

## 2. Copilot 資産一覧

### カスタムエージェント（`.github/agents/`）
| エージェント | 目的 | ツール |
|---|---|---|
| `azure-deployer` | 検証後に azd でデプロイ（最小権限） | codebase, runCommands, search |
| `customer-onboarding` | 新規顧客/空港向けにインスタンス化 | codebase, editFiles, runCommands, search |
| `deck-builder` | 経営層・CIO/CTO 向け資料作成とストーリー確認 | codebase, editFiles, runCommands |
| `scenario-author` | 障害シナリオとテストの追加 | codebase, editFiles, runCommands, search |

### スキル（`.github/skills/`）
`add-language`、`add-scenario`、`deploy-azure`、`generate-deck`、`swap-customer-dataset`

### パス指定インストラクション（`.github/instructions/`）
| ファイル | `applyTo` |
|---|---|
| `domain.instructions.md` | `app/src/domain/**`, `app/src/data/**`, `app/tests/**` |
| `ui.instructions.md` | `app/src/components/**`, `app/src/App.tsx`, `app/src/i18n/**` |
| `agents.instructions.md` | `services/**` |
| `infra.instructions.md` | `infra/**`, `azure.yaml`, `.github/workflows/**`, `scripts/**` |

加えて `copilot-instructions.md`（共通）とプロンプト `instantiate-engagement.prompt.md`。

## 3. カバレッジ分析

| コード領域 | ファイル数 | インストラクション | エージェント | スキル |
|---|---|---|---|---|
| `app/`（React/TS UI + ドメインエンジン） | 103 | domain, ui | scenario-author, deck-builder | add-scenario, add-language, generate-deck |
| `services/`（agent-api Python, engine-mcp） | 35 | agents | — | — |
| `infra/`・ワークフロー・スクリプト | 約 7 + 4 | infra | azure-deployer | deploy-azure |
| `docs/`（日英バイリンガル） | 35 | —（共通のみ） | customer-onboarding | swap-customer-dataset |

ギャップ:
- `docs/` 向けのスコープ指定なし（例: 英日の整合性ルール）。
- `services/` 専用のエージェント/スキルなし。
- ツールはローカル操作に限定（最小権限として良好）。

## 4. 活動プロファイル

- 2 日間で 22 コミット（10-28: 4、10-29: 18）。AI 支援による急速な構築に典型的なバースト傾向。
- コミット件名: 22 件中 13 件が `feat…` 形式。汎用的な「Refactor code structure…」が 2 件、「Implement new feature…」が 1 件で、自動生成メッセージに特徴的な文言。
- ファイル構成: `.ts` 59、`.md` 43、`.tsx` 26、`.py` 20、`.json` 15、`.bicep` 6。TypeScript 中心で Copilot と相性が良い。
- 活用可能な自動化: `ci.yml`、`cd.yml`、`codeql.yml`、`deploy-env.yml`、Dependabot。

## 5. 推奨事項

1. **帰属の記録**: Copilot が作成したコミットに `Co-authored-by: Copilot` を付与し、将来の計測を可能にする。
2. **ギャップ解消**: `docs.instructions.md`（`applyTo: docs/**`、英日整合）と `services` 向けエージェント/スキルを追加。
3. **汎用コミットメッセージの改善**: コミットメッセージ規約のインストラクションを追加。
4. **実利用データの取得**: 組織の Copilot usage metrics API/ダッシュボードを有効化し、定期ワークフローで出力。
5. **カスタマイズの品質確認**: 各 `.agent.md`/`SKILL.md`（多くは 5〜10 行）に入力・出力・ガードレールを追記し評価を実施。
6. CodeQL と併せて PR で **Copilot コードレビュー**を利用。

## 6. 方法

`git log`、`git ls-files`、`.github/` 配下のフロントマターから集計。セッション履歴にはこのリポジトリの Copilot セッション記録はありませんでした。数値はスナップショット日時点です。
