# バリューモデル

ソース: `app/src/domain/value.ts`。顧客入力: `app/src/customers/<id>/customer.json`（`assumptions`）。

デモ用の各障害について、エンジンは次の2つの状態を算出します。

- **意思決定なし**: 緩和策を講じない障害の状態。
- **意思決定あり**: すべての判断タスクに対してエンジンが推奨するオプションを適用した状態。

| 指標 | ソース |
|---|---|
| SLA違反、リスクのあるターンアラウンド、ブロックされたタスク | エンジンの影響に対する `judgement.scoreImpact` |
| フライト遅延分数 | エンジンの影響における `flightDelay` の合計 |
| 検知から担当者のアクションまで（分） | `assumptions.manualResponseMinutes` と `agentResponseMinutes` の比較 |

イベントあたりの削減額 = 回避した違反件数 x `slaBreachPenalty` + 回避したブロックタスク数 x `blockedTaskCost` + 回避した遅延分数 x `costPerDelayMinute`。月額 = イベントあたり x `disruptionsPerMonth`。

すべての出力は**シミュレーション**です。UI、デッキ、READMEにもその旨を記載しています。既定の数値は `assumptions.source` で示したプレースホルダーです。財務部門およびSIOCで検証済みの数値に置き換え、その出典を同箇所に記録してください。

応答時間の行は実測値ではなく仮定です。引用する前に、パイロットで（アラートから担当者の最初のアクションまでの時間を）測定してください。
