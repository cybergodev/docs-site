---
title: "DD - 構造化ログライブラリ"
description: "CyberGo DD は CyberGo 組織が提供する高性能 Go 構造化ログライブラリで、スレッドセーフなログ記録、柔軟な出力先設定、ファイル自動ローテーション、機密データ自動フィルタリング、非同期監査ログ、HMAC 整合性署名、ゼロアロケーション最適化を提供し、開発者が安全で信頼性の高いログ記録システムを迅速に構築できるようにします。"
---

# DD

DD（Data-Driven Debugger）は CyberGo 組織が提供する高性能構造化ログライブラリで、スレッドセーフなログ記録、柔軟な出力先設定、包括的なセキュリティ保護を提供します。

## 特徴

- **構造化ログ** -- 型安全なフィールド記録、自動 JSON シリアライズ
- **マルチ出力先** -- コンソール、ファイル、カスタム `io.Writer` への同時出力
- **ファイルローテーション** -- サイズによる自動ローテーション、バックアップ数制限と保持期間ポリシーをサポート
- **機密データフィルタリング** -- 組み込み正規表現パターン、パスワード、キー、Token などの機密情報を自動マスキング
- **監査ログ** -- 非同期監査イベント記録、整合性署名とチェーン検証をサポート
- **フックシステム** -- BeforeLog、AfterLog、OnRotate などのライフサイクルフック
- **コンテキスト統合** -- TraceID、SpanID、RequestID の自動伝播をサポート
- **ログサンプリング** -- 高スループット環境でのオプションのログサンプリング戦略
- **ゼロアロケーション最適化** -- ホットパスでのメモリ割り当てを最小化、卓越したパフォーマンス

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

- [クイックスタート](./getting-started) -- 5 分入門ガイド
- [コア概念](./guides/core-concepts) -- DD アーキテクチャを理解する
- [マイグレーションガイド](./guides/migration) -- log/slog/zap/logrus からの移行
- [チートシート](./cheatsheet) -- よく使う API クイックリファレンス
- [API リファレンス](./api-reference/) -- 完全 API ドキュメント
- [基本サンプル](./examples/basic-usage) -- 実用的なコード例
