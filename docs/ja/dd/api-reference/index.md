---
sidebar_label: "概要"
title: "API リファレンス - CyberGo DD | 概要"
description: "CyberGo DD 構造化ログライブラリ完全 API リファレンス概要。Logger コアロガー、Config 設定オプション、Writers 出力先、Security セキュリティフィルタリング、Audit 監査ログ、Hooks フックシステム、Integrity 整合性署名などコア機能モジュールを網羅。"
sidebar_position: 1
---

# API リファレンス

DD ログライブラリは豊富な API インターフェースを提供し、機能モジュールごとに整理されています：

## コアコンポーネント

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **パッケージ関数** | グローバルログ関数、コンビニエンスコンストラクタ | [パッケージ関数](./core/functions) |
| **Logger** | コアロガーとそのメソッド | [Logger](./core/logger) |
| **LoggerEntry** | プリセットフィールド付きログ Entry | [LoggerEntry](./core/entry) |
| **Config** | 設定構造体とプリセット設定 | [設定](./core/config) |
| **インターフェース** | CoreLogger、LogProvider などのインターフェース | [インターフェース定義](./core/interfaces) |

## 出力と書き込み

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Writers** | FileWriter、BufferedWriter、MultiWriter | [出力先](./output-integration/writers) |
| **コンテキスト** | Context 統合と ContextExtractor | [コンテキスト統合](./output-integration/context) |

## 拡張機能

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Fields** | 構造化フィールドコンストラクタ（20+ 型） | [構造化フィールド](./output-integration/fields) |
| **Hooks** | ライフサイクルフックシステム | [フックシステム](./security-audit/hooks) |
| **Security** | 機密データフィルタリングとセキュリティ設定 | [セキュリティフィルタ](./security-audit/security) |
| **Audit** | 監査ログと監査イベント | [監査ログ](./security-audit/audit) |
| **Integrity** | ログ整合性署名と検証 | [整合性署名](./security-audit/integrity) |

## 補助ツール

| モジュール | 説明 | ドキュメント |
|------|------|------|
| **Debug Visual** | Print/JSON/Text/Exit デバッグ関数 | [デバッグ出力](./dev-tools/debug-visual) |
| **Recorder** | テスト補助ログレコーダー | [テスト補助](./dev-tools/recorder) |
| **Constants** | ログレベル、フォーマット、エラーコード | [定数とエラー](./dev-tools/constants) |

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

- [パッケージ関数](./core/functions) -- グローバル関数とコンストラクタ
- [Logger](./core/logger) -- コアロガー詳解
- [設定](./core/config) -- 設定オプション
