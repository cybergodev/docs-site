---
title: "マイグレーションガイド - CyberGo DD | 他のログライブラリからの移行"
description: "CyberGo DD 標準ライブラリ log/slog および主要サードパーティログライブラリ（zap、logrus、zerolog）からの完全な比較移行ガイド。詳細な API マッピングテーブル、設定パラメータの比較、一般的な移行パターン、段階的移行戦略を提供し、既存のログシステムを DD ログライブラリに低リスクでスムーズに切り替えられます。"
---

# マイグレーションガイド

他のログライブラリを使用している場合、このガイドがプロジェクトの DD への移行を支援します。

## 標準ライブラリ log からの移行

### API 比較

| log | DD | 説明 |
|-----|-----|------|
| `log.Print(msg)` | `dd.Info(msg)` | Info レベル |
| `log.Printf(format, args)` | `dd.Infof(format, args)` | フォーマット |
| `log.Println(msg)` | `dd.Info(msg)` | Info レベル |
| `log.Fatal(msg)` | `dd.Fatal(msg)` | Fatal（os.Exit を呼び出し） |
| `log.Fatalf(format, args)` | `dd.Fatalf(format, args)` | フォーマット Fatal |
| `log.Panic(msg)` | `dd.Error(msg)` + `panic()` | DD には組み込みの Panic なし |
| — | `dd.InfoWith(msg, fields...)` | 構造化ログ（新規） |

### 基本的な移行

```go
// 移行前: log
log.Printf("ユーザー %s のログイン失敗: %v", username, err)

// 移行後: DD
dd.Infof("ユーザー %s のログイン失敗: %v", username, err)

// または構造化ログを使用
dd.ErrorWith("ユーザーログイン失敗",
    dd.String("username", username),
    dd.Err(err),
)
```

### グローバル Logger の置き換え

```go
// 移行前: log
log.SetOutput(file)
log.SetFlags(log.LstdFlags | log.Lshortfile)

// 移行後: DD
logger, _ := dd.New(dd.Config{
    Format: dd.FormatText,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
dd.SetDefault(logger)
```

## slog からの移行

### API 比較

| slog | DD | 説明 |
|------|-----|------|
| `slog.Info(msg)` | `dd.Info(msg)` | Info レベル |
| `slog.Info(msg, "key", value)` | `dd.InfoWith(msg, dd.String("key", value))` | 構造化 |
| `slog.Debug(msg)` | `dd.Debug(msg)` | Debug レベル |
| `slog.Error(msg, "err", err)` | `dd.ErrorWith(msg, dd.Err(err))` | エラーログ |
| `slog.Warn(msg)` | `dd.Warn(msg)` | Warn レベル |
| `slog.With("key", value)` | `dd.WithFields(dd.String("key", value))` | プリセットフィールド |
| `slog.New(handler)` | `dd.New(cfg)` | インスタンス作成 |
| `slog.SetDefault(logger)` | `dd.SetDefault(logger)` | グローバル設定 |

### 構造化ログの移行

```go
// 移行前: slog
slog.Info("request completed",
    "method", "GET",
    "status", 200,
    "duration", 150*time.Millisecond,
)

// 移行後: DD
dd.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("duration", 150*time.Millisecond),
)
```

:::tip 型安全性
slog は `any` キーと値のペアを使用し、DD は型が明確なフィールドコンストラクタを使用します。型エラーはコンパイル時に検出できます。
:::

## zap からの移行

### API 比較

| zap | DD | 説明 |
|-----|-----|------|
| `zap.L().Info(msg, zap.Field...)` | `dd.InfoWith(msg, dd.Field...)` | 構造化 |
| `zap.String(key, val)` | `dd.String(key, val)` | 文字列フィールド |
| `zap.Int(key, val)` | `dd.Int(key, val)` | 整数フィールド |
| `zap.Error(err)` | `dd.Err(err)` | エラーフィールド |
| `zap.Any(key, val)` | `dd.Any(key, val)` | 任意の型 |
| `zap.Sugar().Infof(...)` | `dd.Infof(...)` | フォーマット |
| `logger.With(zap.Field...)` | `logger.WithFields(dd.Field...)` | プリセットフィールド |
| `zapcore.NewCore(...)` | `dd.New(dd.Config{...})` | インスタンス作成 |

### 設定の比較

```go
// 移行前: zap
cfg := zap.Config{
    Level:       zap.NewAtomicLevelAt(zap.InfoLevel),
    Encoding:    "json",
    OutputPaths: []string{"stdout", "logs/app.log"},
}
logger, _ := cfg.Build()

// 移行後: DD
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
```

### フィールドの比較

```go
// 移行前: zap
logger.Info("request",
    zap.String("method", "GET"),
    zap.Int("status", 200),
    zap.Duration("elapsed", 150*time.Millisecond),
    zap.Error(err),
)

// 移行後: DD
dd.InfoWith("request",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
    dd.Err(err),
)
```

## logrus からの移行

### API 比較

| logrus | DD | 説明 |
|--------|-----|------|
| `logrus.Info(msg)` | `dd.Info(msg)` | Info レベル |
| `logrus.WithField("k", v)` | `dd.WithField("k", v)` | 単一フィールド |
| `logrus.WithFields(logrus.Fields{...})` | `dd.WithFields(dd.String(...), ...)` | 複数フィールド |
| `logrus.SetLevel(logrus.InfoLevel)` | `dd.SetLevel(dd.LevelInfo)` | レベル設定 |
| `logrus.SetFormatter(&logrus.JSONFormatter{})` | `dd.New(dd.Config{Format: dd.FormatJSON})` | JSON フォーマット |
| `logrus.SetOutput(file)` | `dd.Config{Targets: ...}` | 出力先 |
| `logrus.Fatal(msg)` | `dd.Fatal(msg)` | Fatal |

### フィールドの移行

```go
// 移行前: logrus
logrus.WithFields(logrus.Fields{
    "method":  "GET",
    "status":  200,
    "elapsed": 150 * time.Millisecond,
}).Info("Request completed")

// 移行後: DD
dd.WithFields(
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
).Info("Request completed")
```

## DD 固有の機能

移行後、DD の独自機能を活用できます：

| 機能 | 説明 | ドキュメント |
|------|------|------|
| 機密データフィルタリング | パスワード、API Key などの自動マスキング | [機密データフィルタリング](./sensitive-filtering) |
| 監査ログ | 非同期セキュリティイベント記録 | [監査ログ](./audit-logging) |
| HMAC 署名 | ログの改ざん防止 | [HMAC 署名実践](../advanced/integrity) |
| 業界コンプライアンス | HIPAA/PCI-DSS プリセット | [業界コンプライアンス設定](../security/compliance) |
| ライフサイクルフック | 6 種類の Hook イベント | [フックシステム](./hooks) |
| LoggerRecorder | テスト補助 | [テストパターン](../examples/testing-patterns) |

## 次のステップ

- [コア概念](./core-concepts) -- DD アーキテクチャ概要
- [構造化ログ](./structured-logging) -- フィールド使用詳解
- [チートシート](../cheatsheet) -- API クイックリファレンス
