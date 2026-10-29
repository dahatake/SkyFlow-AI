<!-- Slide number: 1 -->

SATS PROJECT SPEAR  ·  ユースケース 2

AI Operations
Control Tower
To-Be アーキテクチャ図と
次のステップ
プロトタイプと本番ターゲットを、機能要件および非機能要件に対応付け

次のステップ: スライド 2 と 10

検証用ドラフト  ·  2026 年 10 月 28 日

### Notes:
表紙です。AI Operations Control Tower (ユースケース 2) のアーキテクチャ図と、MVP 構築に至るまでの次のステップを示します。要件定義書とソリューション・エンビジョニング成果物に基づいて作成しています。表紙の写真は生成画像であり、イメージ用です。

<!-- Slide number: 2 -->
アプローチ

1 つの UI、2 つのデータホライズン

![2 つのホライズン: 現在のブラウザーのみのプロトタイプと、Fabric Real-Time Intelligence による本番環境。データプロバイダー・インターフェースで接続し、4 フェーズのロードマップを示します。](Picture93.jpg)
出典: 要件定義書 セクション 1 および 13、ソリューション・エンビジョニング成果物 スライド 14、16、17

### Notes:
要件定義書ではブラウザーストレージを用いたプロトタイプをスコープとしており、エンビジョニング成果物では Fabric による本番ターゲットを定義しています。要件のセクション 13 にあるデータプロバイダー・インターフェースにより、画面を書き換えることなく、Fabric アダプターでシードプロバイダーを置き換えられます。ロードマップは提案段階であり、確認が必要です。

<!-- Slide number: 3 -->
To-Be · ホライズン 1

プロトタイプはすべてブラウザー内で動作

![プロトタイプのアーキテクチャ: プレゼンテーション層、共有ビューコンテキスト、コアサービス、IndexedDB と localStorage、データプロバイダー・インターフェース。Azure Static Web Apps でホスティング。](Picture139.jpg)
出典: 要件定義書 セクション 8、10、13、Microsoft Learn: What is Azure Static Web Apps?

### Notes:
コンポーネントの分割は要件定義書のセクション 13 に従っています。IndexedDB にはエンティティとシナリオを保存し、localStorage には小規模な設定のみを保存します (DATA-002)。Azure Static Web Apps によるホスティングは設計上の提案であり、出典文書には記載されていません。

<!-- Slide number: 4 -->
To-Be · シミュレーター

What-if をベースラインと並べて実行

![シミュレーターのフロー: ベースライン スナップショットとシナリオ パラメーター、検証、シナリオエンジン、派生オーバーレイ、ベースライン・シナリオ・差分の各ビュー。シナリオストアは IndexedDB に配置。](Picture140.jpg)
出典: 要件定義書 セクション 6、8、12 (SIM-001 〜 SIM-004、DATA-003、AT-03、AT-04、AT-07)

### Notes:
シナリオエンジンはベースラインを読み取るだけです。無効なパラメーターの場合はメッセージを表示し、ビューは変更されません (AT-04)。適用、更新、削除を行っても、ベースラインはバイト単位で同一のままです。

<!-- Slide number: 5 -->
To-Be · 2D / 3D

1 つの選択がすべてのビューを動かす

![連動するビュー: 共有ビューコンテキストが KPI ストリップ、ボードとキュー、2D マップ、3D シーンを連携させ、レンダリングルールを適用します。](Picture141.jpg)
出典: 要件定義書 セクション 5 (VIZ-001 〜 VIZ-006)、FR-006、NFR-002、本番オプション: Microsoft Learn、What is Fabric Maps?

### Notes:
2D と 3D を切り替えても、フィルター、選択、時間位置、シミュレーションのコンテキストは維持されます (VIZ-001、AT-02)。本番環境では、Fabric Maps が Eventhouse へのライブクエリや Lakehouse の参照データをレイヤーとして描画できます。

<!-- Slide number: 6 -->
To-Be · ホライズン 2

Fabric が既存システムを取り囲む

![本番アーキテクチャ: ソース、取り込み、Microsoft Fabric (Eventhouse、Lakehouse、運用モデル、Activator)、エクスペリエンスとユーザー。Entra ID、行レベルセキュリティ、Purview によるガバナンス。](Picture220.jpg)
出典: ソリューション・エンビジョニング成果物 スライド 14-16、Microsoft Learn: Real-Time Intelligence overview、Fabric Activator、Fabric data agent in Copilot Studio

### Notes:
エンビジョニングのターゲットアーキテクチャ (置き換えではなく、取り囲む方式) に沿っています。追加した点は、データプロバイダー・アダプターを介して Fabric を読み取る同じ Control Tower Web アプリと、Fabric オントロジーとして表現した運用モデルです (オントロジーと digital twin builder はプレビュー)。参照パターン: Azure Architecture Center、Real-time analytics with Azure Service Bus and Microsoft Fabric。

<!-- Slide number: 7 -->
To-Be · ランタイムフロー

例外が数分でオーナーに届く

![6 ステップのフロー: Eventstreams が検知、Activator が判定、Power Automate がルーティング、Teams の Adaptive Card が通知、オーナーが対応、OneLake が監査。2 分、5 分、5 ルールの目標を併記。](Picture221.jpg)
出典: ソリューション・エンビジョニング成果物 スライド 3、11、14、17、Microsoft Learn: What is Fabric Activator?

### Notes:
目標値はエンビジョニング成果物に基づくもので、SATS との確認が必要です。GroundStar および G-Ops への書き戻しはフェーズ 2 であり、プロトタイプには書き戻しがありません (NFR-005)。

<!-- Slide number: 8 -->
非機能要件

すべての品質目標に回答がある

![7 つの非機能設計の回答: パフォーマンス、アクセシビリティ、レスポンシブ、説明可能性、安全境界、可観測性、ID とアクセス。さらに、フェーズ 2 の前に実施するデータレジデンシーの確認。](Picture222.jpg)
出典: 要件定義書 セクション 10、各カードに記載の Microsoft Learn ガイダンス

### Notes:
Copilot Studio で利用される Fabric データエージェントの応答は、Fabric のコンプライアンス境界またはリージョンの外部に送信される可能性があります (Microsoft Learn)。フェーズ 2 の前に、シンガポールのデータレジデンシーに関する決定と照らして検証してください。

<!-- Slide number: 9 -->
次のステップ  ·  オーナーと意思決定

次のステップ: オーナーと意思決定

![3 回のアーキテクチャ設計セッションと、それぞれで確定すべき意思決定、および各オーナーが提供すべきもの。2027 年 1 月 11 日の構築開始で締めくくります。](Picture223.jpg)
出典: ソリューション・エンビジョニング成果物 スライド 15 および 18、要件定義書 セクション 15

### Notes:
最優先事項: SATS の Control Tower リードが 11 月 13 日までに MVP のスコープを確認します。オーナーごとの依頼事項は、エンビジョニングの次のステップと、両文書に記載された未決事項から導き出しています。
