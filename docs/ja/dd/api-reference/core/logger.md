---
sidebar_label: "Logger"
title: "Logger - CyberGo DD | コアロガー"
description: "CyberGo DD Logger コアロガー完全 API ドキュメント。ログ出力メソッド（Info/Warn/Error/Fatal）、レベル動的管理、Writer 増減と置き換え、ライフサイクル制御（Close/Flush）、グローバルログ関数とチェーンフィールド設定をカバーするログライブラリのコアエントリタイプ。"
sidebar_position: 2
---

# Logger

`Logger` は DD のコアタイプで、スレッドセーフなログ記録機能を提供します。

## 作成

```go
// New で作成
logger, _ := dd.New(dd.DefaultConfig())
```

```go
// カスタム設定で作成
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## ログメソッド

### 基本ログ

| メソッド | 説明 |
|------|------|
| `Debug(args ...any)` | Debug レベルログ |
| `Info(args ...any)` | Info レベルログ |
| `Warn(args ...any)` | Warn レベルログ |
| `Error(args ...any)` | Error レベルログ |
| `Fatal(args ...any)` | Fatal レベルログ（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `Log(level LogLevel, args ...any)` | レベル指定ログ |

### フォーマットログ

| メソッド | 説明 |
|------|------|
| `Debugf(format string, args ...any)` | フォーマット Debug |
| `Infof(format string, args ...any)` | フォーマット Info |
| `Warnf(format string, args ...any)` | フォーマット Warn |
| `Errorf(format string, args ...any)` | フォーマット Error |
| `Fatalf(format string, args ...any)` | フォーマット Fatal（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `Logf(level LogLevel, format string, args ...any)` | フォーマット レベル指定 |

### 構造化ログ

| メソッド | 説明 |
|------|------|
| `DebugWith(msg string, fields ...Field)` | 構造化 Debug |
| `InfoWith(msg string, fields ...Field)` | 構造化 Info |
| `WarnWith(msg string, fields ...Field)` | 構造化 Warn |
| `ErrorWith(msg string, fields ...Field)` | 構造化 Error |
| `FatalWith(msg string, fields ...Field)` | 構造化 Fatal（デフォルトで os.Exit(1) を呼び出し、**defer は実行されません**；FatalHandler でカスタマイズ可能） |
| `LogWith(level LogLevel, msg string, fields ...Field)` | 構造化 レベル指定 |

```go
logger.InfoWith("リクエスト完了",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## レベル管理

```go
level := logger.GetLevel()                    // 現在のレベルを取得
_ = logger.SetLevel(dd.LevelDebug)            // レベルを設定
enabled := logger.IsLevelEnabled(dd.LevelInfo)// レベルを確認

// ショートカット確認
logger.IsDebugEnabled()
logger.IsInfoEnabled()
logger.IsWarnEnabled()
logger.IsErrorEnabled()
logger.IsFatalEnabled()

// 動的レベルリゾルバー
logger.SetLevelResolver(func(ctx context.Context) dd.LogLevel {
    if isDebug {
        return dd.LevelDebug
    }
    return dd.LevelInfo
})
resolver := logger.GetLevelResolver()
```

## フィールドチェーン

```go
// プリセットフィールド、LoggerEntry を返す
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// 単一フィールド
entry := logger.WithField("env", "prod")
```

## 出力先管理

```go
// Writer を追加
_ = logger.AddWriter(os.Stderr)

// Writer を削除
_ = logger.RemoveWriter(os.Stderr)

// Writer 数を取得
count := logger.WriterCount()

// 書き込みエラーハンドラーを設定
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "書き込み失敗: %v\n", err)
})
```

## コンテキスト統合

```go
// コンテキストエクストラクタを追加
_ = logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// 全エクストラクタを置き換え
_ = logger.SetContextExtractors(extractor1, extractor2)

// 現在のエクストラクタを取得
extractors := logger.GetContextExtractors()
```

## フック管理

```go
// フックを登録
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // ログ前処理
    return nil
})

// フックレジストリを置き換え
_ = logger.SetHooks(registry)

// フックレジストリを取得
hooks := logger.GetHooks()
```

## サンプリング制御

```go
// サンプリング設定を設定
logger.SetSampling(&dd.SamplingConfig{
    // サンプリングパラメータ
})

// サンプリング設定を取得
cfg := logger.GetSampling()
```

## セキュリティ設定

```go
// セキュリティ設定を設定
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// セキュリティ設定を取得
sec := logger.GetSecurityConfig()
```

## フィールド検証

```go
// フィールド検証を設定
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// 検証設定を取得
validation := logger.GetFieldValidation()
```

## ライフサイクル

```go
// バッファをフラッシュ
_ = logger.Flush()

// ロガーを閉じる
_ = logger.Close()

// グレースフルシャットダウン（タイムアウト付き）
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// 閉じているか確認
closed := logger.IsClosed()

// フィルター goroutine の完了を待機
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## デバッグ出力

| メソッド | 説明 |
|------|------|
| `Print(args ...any)` | 設定された Writer に出力（LevelInfo、セキュリティフィルタリング対象） |
| `Println(args ...any)` | Print と同じ動作（内部 Log() で自動改行） |
| `Printf(format string, args ...any)` | フォーマット出力（LevelInfo、セキュリティフィルタリング対象） |
| `JSON(data ...any)` | コンパクト JSON フォーマットで stdout に出力（呼び出し元情報付き、セキュリティフィルタリングなし） |
| `JSONF(format string, args ...any)` | フォーマット文字列をコンパクト JSON として stdout に出力（呼び出し元情報付き、セキュリティフィルタリングなし） |
| `Text(data ...any)` | pretty-print フォーマットで stdout に出力（呼び出し元情報なし、セキュリティフィルタリングなし） |
| `Textf(format string, args ...any)` | フォーマットテキストを stdout に出力（呼び出し元情報なし、セキュリティフィルタリングなし） |

## 次のステップ

- [LoggerEntry](./entry) -- プリセットフィールド チェーン呼び出し
- [設定](./config) -- Config 詳解
- [出力先](../output-integration/writers) -- FileWriter 詳解
