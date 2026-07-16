---
layout: home
title: "CyberGo"
titleTemplate: "高性能 Go オープンソースライブラリコレクション"
description: "CyberGo は Go 言語向けの高性能オープンソースライブラリコレクションです。JSON 処理、JWT 認証、セキュア HTTP クライアント、HTML コンテンツ抽出、構造化ログ、環境変数管理の 6 つのコアライブラリを提供します。軽量設計、すぐに使える、最小限の依存関係で、高並行性の本番環境に信頼性の高い基盤コンポーネントを提供します。"

hero:
  name: CyberGo
  text: 本番対応と極限のパフォーマンス
  tagline: 軽量設計 / すぐに使える / 最小限の依存関係 / 高性能 / 高並行性シナリオ向け
---

<!-- プロジェクト一覧 (shared.ts の PROJECT_META でデータ駆動 — 一箇所でプロジェクト追加) -->
<ProjectGrid lang="ja" />

<style>
/* Hero タグライン レスポンシブ */
@media (min-width: 640px) {
  [class*="tagline"] {
    max-width: 900px !important;
  }
}

@media (min-width: 960px) {
  [class*="container"] {
    padding: 0;
    max-width: 1280px;
  }
}
</style>
