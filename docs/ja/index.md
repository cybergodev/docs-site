---
layout: home
title: CyberGo
titleTemplate: 高性能 Go オープンソースライブラリコレクション
description: CyberGo は Go 言語向けの高性能オープンソースライブラリコレクションです。JSON 処理、JWT 認証、セキュア HTTP クライアント、HTML コンテンツ抽出、構造化ログ、環境変数管理の 6 つのコアライブラリを提供します。軽量設計、すぐに使える、最小限の依存関係で、高並行性の本番環境に信頼性の高い基盤コンポーネントを提供します。

hero:
  name: CyberGo
  text: 本番対応と極限のパフォーマンス
  tagline: 軽量設計 / すぐに使える / 最小限の依存関係 / 高性能 / 高並行性シナリオ向け
---

<!-- プロジェクト一覧 -->
<div class="home-projects" id="projects">
  <div class="project-grid">
    <div class="project-card" data-href="/ja/json/">
      <a href="/ja/json/" class="card-main">
        <div class="title">
          <span class="icon">📦</span>
          <span>json</span>
        </div>
        <div class="description">
          高性能でスレッドセーフな JSON 処理ライブラリ。パース、クエリ、変更、検証、フォーマットなど、豊富な JSON 操作機能を提供します。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/json" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ja/jwt/">
      <a href="/ja/jwt/" class="card-main">
        <div class="title">
          <span class="icon">🔑</span>
          <span>jwt</span>
        </div>
        <div class="description">
          本番レベルの JWT ライブラリ。わずか 3 つの関数で全ての JWT 操作を完了できます。セキュリティ保護とブラックリスト管理機能を内蔵。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/jwt" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ja/httpc/">
      <a href="/ja/httpc/" class="card-main">
        <div class="title">
          <span class="icon">🌐</span>
          <span>httpc</span>
        </div>
        <div class="description">
          モダンで高性能な HTTP クライアント。TLS 1.2+、SSRF 防御、サーキットブレーカー、インテリジェントリトライ、ゼロアロケーションプールをサポートし、GC を 90% 削減。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/httpc" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ja/html/">
      <a href="/ja/html/" class="card-main">
        <div class="title">
          <span class="icon">📄</span>
          <span>html</span>
        </div>
        <div class="description">
          本番レベルの HTML コンテンツ抽出ツール。スマート記事認識をサポートし、メタデータ付きの画像、動画、音声、リンクを抽出できます。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/html" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ja/dd/">
      <a href="/ja/dd/" class="card-main">
        <div class="title">
          <span class="icon">📝</span>
          <span>dd</span>
        </div>
        <div class="description">
          高性能ログライブラリ。毎秒 300 万回以上の操作を処理。構造化ログ、自動ファイルローテーション、機密データフィルタリングをサポート。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/dd" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
    <div class="project-card" data-href="/ja/env/">
      <a href="/ja/env/" class="card-main">
        <div class="title">
          <span class="icon">⚙️</span>
          <span>env</span>
        </div>
        <div class="description">
          本番対応の環境変数管理ライブラリ。インメモリロック、監査ログ記録、高並行性をサポートし、ゼロ依存設計。
        </div>
      </a>
      <div class="actions">
        <a class="github-link" href="https://github.com/cybergodev/env" target="_blank" rel="noopener">
          <GitHubIcon :size="16" />
          GitHub
        </a>
      </div>
    </div>
  </div>
</div>

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
