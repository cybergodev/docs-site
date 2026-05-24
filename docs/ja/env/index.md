---
title: "CyberGo env - 環境変数管理ライブラリ"
description: "CyberGo env は高セキュリティの Go 環境変数管理ライブラリで、.env、JSON、YAML の複数フォーマットファイルの読み込みと自動フォーマット検出をサポートし、Loader インターフェース、型安全な変換、スレッドセーフな並行アクセス、SecureValue のメモリ保護と完全な監査ログ機能を提供し、多様な設定プリセットテンプレートを内蔵し、Web サービスやコンテナデプロイなどのシナリオに適しています。"
---

# env

高セキュリティの Go 環境変数管理ライブラリ。`.env`、JSON、YAML の複数フォーマットをサポートし、スレッドセーフ、監査ログ、セキュアストレージ機能を提供します。

## コア機能

- **複数フォーマットサポート** - `.env`、JSON、YAML の自動検出
- **型安全** - 自動型変換と検証
- **スレッドセーフ** - シャードロックによるスレッドセーフな並行アクセス
- **セキュアストレージ** - 機密値のメモリロック、自動ゼロクリア
- **監査ログ** - 完全な操作追跡
- **変数展開** - `${VAR}` 構文サポート
- **構造体マッピング** - タグ駆動の設定バインディング

## 主な機能概要

| 機能 | 説明 |
|------|------|
| [型変換](/ja/env/getting-started) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [構造体マッピング](/ja/env/guides/struct-mapping) | タグ駆動の設定バインディング |
| [セキュアストレージ](/ja/env/api-reference/secure-value) | 機密値のメモリ保護 |
| [複数フォーマット読み込み](/ja/env/guides/multi-format) | .env, JSON, YAML |

## クイックナビゲーション

<div class="vp-features">

### 入門
- [クイックスタート](/ja/env/getting-started) - 5 分で始めるチュートリアル
- [チートシート](/ja/env/cheatsheet) - よく使うコードスニペット

### API リファレンス
- [パッケージ関数](/ja/env/api-reference/functions) - 完全 API ドキュメント
- [Loader](/ja/env/api-reference/loader) - ローダーメソッド
- [SecureValue](/ja/env/api-reference/secure-value) - セキュア値の処理

### セキュリティ
- [セキュリティ概要](/ja/env/security/) - セキュリティアーキテクチャとベストプラクティス

</div>
