---
sidebar_label: "概要"
title: "構造化ログ - CyberGo DD | 高性能 Go ロガー"
description: "CyberGo DD は CyberGo 組織が提供する高性能 Go 構造化ログライブラリで、スレッドセーフなログ記録、柔軟な出力先設定、ファイル自動ローテーション、機密データ自動フィルタリング、非同期監査ログ、HMAC 整合性署名、低アロケーション最適化を提供し、安全で信頼性の高いログシステムを迅速に構築できます。"
---

# DD

DD（ソースコメントでは "data-driven" または "distributed debugger" と読みます）は CyberGo 組織が提供する高性能構造化ログライブラリで、スレッドセーフなログ記録、柔軟な出力先設定、包括的なセキュリティ保護を提供します。

## 特徴

- **構造化ログ** -- 型安全なフィールド記録、オプションで JSON フォーマット出力
- **マルチ出力先** -- コンソール、ファイル、カスタム `io.Writer` への同時出力
- **ファイルローテーション** -- サイズによる自動ローテーション、バックアップ数制限と時間保持ポリシーをサポート
- **機密データフィルタリング** -- 組み込みの正規表現パターンにより、パスワード、キー、Token などの機密情報を自動マスキング
- **監査ログ** -- 非同期監査イベント記録、HMAC 整合性署名とシーケンス番号をサポート
- **フックシステム** -- BeforeLog、AfterLog、OnRotate などのライフサイクルフック
- **コンテキスト統合** -- TraceID/SpanID/RequestID の context ツールと ContextExtractor 拡張ポイントを提供（ログメソッドは ctx を受け取らず、WithFields でフィールド渡しが必要）
- **ログサンプリング** -- 高スループットシナリオで選択可能なログサンプリング戦略
- **低アロケーション最適化** -- ホットパスのメモリアロケーションを最小化、卓越したパフォーマンス

## インストール

```bash
go get github.com/cybergodev/dd
```

## クイックスタート

```go
package main

import (
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // デフォルトロガーを使用
    dd.Info("サービス起動")

    // 構造化ログ
    dd.InfoWith("リクエスト処理完了",
        dd.String("method", "GET"),
        dd.Int("status", 200),
        dd.Duration("elapsed", 150*time.Millisecond),
    )

    // カスタムロガーを作成
    logger, _ := dd.New(dd.DefaultConfig())
    defer logger.Close()

    logger.Info("カスタムロガーが作成されました")
}
```

## モジュールナビゲーション

| モジュール | 説明 |
|------|------|
| [コア概念](./guides/core-concepts) | Logger 体系、処理パイプライン、インターフェース階層 |
| [構造化ログ](./guides/structured-logging) | フィールドコンストラクタ、チェーン呼び出し |
| [ファイル出力とローテーション](./guides/file-output) | FileWriter、BufferedWriter |
| [機密データフィルタリング](./guides/sensitive-filtering) | 自動マスキング、セキュリティレベル |
| [監査ログ](./guides/audit-logging) | 非同期監査イベント、整合性署名 |
| [フックシステム](./guides/hooks) | ライフサイクルフック拡張 |

## 次のステップ

- [クイックスタート](./getting-started/) -- 5 分入門ガイド
- [コア概念](./guides/core-concepts) -- DD アーキテクチャを理解する
- [マイグレーションガイド](./guides/migration) -- log/slog/zap/logrus からの移行
- [チートシート](./getting-started/cheatsheet) -- よく使う API クイックリファレンス
- [API リファレンス](./api-reference/) -- 完全 API ドキュメント
- [基本サンプル](./examples/basic-usage) -- 実用的なコード例
