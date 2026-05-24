---
title: "クイックスタート - CyberGo DD | 5分入門ガイド"
description: "CyberGo DD 高性能構造化ログライブラリの完全な入門チュートリアル。依存関係のインストールから初回ログ出力まで、ロガーの作成、出力先とファイルローテーションポリシーの設定、構造化フィールドによるリクエストコンテキスト情報の記録、フックシステム拡張機能の使用方法を段階的に学び、5 分でコア機能を習得して実際のプロジェクトに応用できます。"
---

# クイックスタート

## 1. ロガーの作成

DD は様々なシナリオに対応する複数のコンビニエンスコンストラクタを提供します：

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    // 方法 1：デフォルトグローバルロガー（ゼロ設定）
    dd.Info("グローバルロガーを使用")

    // 方法 2：開発モード（DEBUG レベル、caller 付き）
    dev, _ := dd.New(dd.DevelopmentConfig())
    defer dev.Close()
    dev.Info("開発モード出力")

    // 方法 3：ファイル出力
    file, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    defer file.Close()
    file.Info("ファイル出力")

    // 方法 4：コンソールとファイルの同時出力
    all, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    defer all.Close()
    all.Info("デュアル出力先")

    // 方法 5：JSON フォーマット デュアル出力先
    jsonLogger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    defer jsonLogger.Close()
    jsonLogger.Info("JSON フォーマット出力")
}
```

## 2. ログレベル

DD は 5 つのログレベルをサポートします。低い方から高い方へ：

```go
dd.Debug("デバッグ情報")   // LevelDebug
dd.Info("一般情報")    // LevelInfo（デフォルト）
dd.Warn("警告情報")    // LevelWarn
dd.Error("エラー情報")   // LevelError
dd.Fatal("致命的エラー")   // LevelFatal（os.Exit を呼び出し）
```

フォーマット版：

```go
dd.Debugf("ユーザー %s がログイン、所要時間 %dms", name, elapsed)
dd.Infof("リクエスト処理完了: status=%d", status)
dd.Warnf("接続プール使用率 %d%%", usage)
dd.Errorf("データベースクエリ失敗: %v", err)
```

## 3. 構造化ログ

型安全なフィールドコンストラクタを使用：

```go
dd.InfoWith("リクエスト処理完了",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

出力例（デフォルトテキストフォーマット）：

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 リクエスト処理完了 method=GET path=/api/users status=200 elapsed=150ms
```

:::tip JSON フォーマット出力
デフォルトのグローバルロガーはテキストフォーマットを使用します。JSON フォーマット出力が必要な場合は、`dd.New(dd.JSONConfig())` で JSON フォーマットのロガーを作成してください。
:::

## 4. フィールドのチェーン渡し

```go
// プリセットフィールド付き Entry を作成
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// 各ログ出力にプリセットフィールドが自動付与される
requestLogger.Info("サービス起動")
requestLogger.InfoWith("ルート登録完了",
    dd.Int("routes", 42),
)
```

## 5. ファイルローテーション

`FileWriter` でローテーションポリシーを設定：

```go
// デフォルト 100MB、30日、10バックアップ
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})

logger.Info("hello world")
```

## 6. 機密データフィルタリング

DD はデフォルトで基本機密データフィルタリングが有効（パスワード、API Key、クレジットカード番号などが自動マスキング）：

```go
// デフォルト設定には基本セキュリティフィルタリングが含まれる
logger, _ := dd.New(dd.DefaultConfig())

// パスワードフィールドは自動マスキング
logger.InfoWith("ユーザーログイン",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 出力: [REDACTED]
)
```

## 次のステップ

- [コア概念](./guides/core-concepts) -- Logger 体系と処理パイプラインを理解する
- [構造化ログ](./guides/structured-logging) -- フィールドの使い方詳細
- [ファイル出力とローテーション](./guides/file-output) -- FileWriter 詳解
- [機密データフィルタリング](./guides/sensitive-filtering) -- セキュリティフィルタリング実践
- [チートシート](./cheatsheet) -- よく使う API クイックリファレンス
