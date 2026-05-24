---
title: "API リファレンス - CyberGo DD | 概要"
description: "CyberGo DD 構造化ログライブラリ完全 API リファレンスドキュメント概要。Logger コアロガー、Config 設定オプション、Writers 出力先、Security セキュリティフィルタリング、Audit 監査ログ、Hooks フックシステム、Integrity 整合性署名などコア機能モジュールを包括的にカバー。"
---

# API リファレンス

DD ログライブラリは豊富な API インターフェースを提供し、機能モジュールごとに整理されています：

## コアコンポーネント

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **パッケージ関数** | グローバルログ関数、コンビニエンスコンストラクタ | [パッケージ関数](./functions) |
| **Logger** | コアロガーとそのメソッド | [Logger](./logger) |
| **LoggerEntry** | プリセットフィールド付きログ Entry | [LoggerEntry](./entry) |
| **Config** | 設定構造体とプリセット設定 | [設定](./config) |
| **インターフェース** | CoreLogger、LogProvider などのインターフェース | [インターフェース定義](./interfaces) |

## 出力と書き込み

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Writers** | FileWriter、BufferedWriter、MultiWriter | [出力先](./writers) |
| **コンテキスト** | Context 統合と ContextExtractor | [コンテキスト統合](./context) |

## 拡張機能

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Fields** | 構造化フィールドコンストラクタ（20+ 型） | [構造化フィールド](./fields) |
| **Hooks** | ライフサイクルフックシステム | [フックシステム](./hooks) |
| **Security** | 機密データフィルタリングとセキュリティ設定 | [セキュリティフィルタ](./security) |
| **Audit** | 監査ログと監査イベント | [監査ログ](./audit) |
| **Integrity** | ログ整合性署名と検証 | [整合性署名](./integrity) |

## 補助ツール

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Debug Visual** | Print/JSON/Text/Exit デバッグ関数 | [デバッグ出力](./debug-visual) |
| **Recorder** | テスト補助ログレコーダー | [テスト補助](./recorder) |
| **Constants** | ログレベル、フォーマット、エラーコード | [定数とエラー](./constants) |

## クイック検索

```go
// 基本的な使い方
dd.Info("message")                        // → パッケージ関数
dd.InfoWith("msg", dd.String("k", "v"))   // → パッケージ関数 + Fields

// カスタムロガーを作成
logger, _ := dd.New(dd.DefaultConfig())    // → パッケージ関数 + Config
logger.WithFields(fields).Info("msg")      // → Logger + Entry

// ファイル出力
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // → Writers

// セキュリティ
sec := dd.DefaultSecurityConfig()          // → Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // → Audit
```

## 次のステップ

- [パッケージ関数](./functions) -- グローバル関数とコンストラクタ
- [Logger](./logger) -- コアロガー詳解
- [設定](./config) -- 設定オプション
