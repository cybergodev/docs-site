---
sidebar_label: "テスト補助"
title: "テスト補助 - CyberGo DD | LoggerRecorder"
description: "CyberGo DD テスト補助ツール LoggerRecorder 完全 API ドキュメント。単体テスト専用でログ出力のキャプチャとアサーションをサポート。レベル別フィルタリング、構造化フィールド値検証、エントリカウント統計、順序付きアサーションを含み、ログ関連単体テストの効率と可読性を向上。"
sidebar_position: 2
---

# テスト補助

DD はテストシナリオ用に `LoggerRecorder` を提供し、ログエントリをキャプチャしてアサーションに使用できます。

## LoggerRecorder

スレッドセーフなログレコーダー。テストでログ出力をキャプチャして検査します。

:::warning テキストフォーマット解析の制限
テキストモードのパーサーはデフォルトの時間フォーマット（ISO 8601）とデフォルトレベル文字列（DEBUG/INFO/WARN/ERROR/FATAL）を前提としています。`TimeFormat` をカスタマイズした場合、テキストモードでレベルとタイムスタンプが正しく抽出されない場合があります。カスタムフォーマットの場合は JSON フォーマット（`FormatJSON`）の使用を推奨します。`SetFormat` で設定可能です。
:::

### 作成

```go
recorder := dd.NewLoggerRecorder()
```

### コアメソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Writer` | `() io.Writer` | io.Writer を取得 |
| `SetFormat` | `(format LogFormat)` | ログフォーマットを設定（解析用） |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | このレコーダーに書き込む Logger を作成 |
| `Entries` | `() []LogEntry` | 全ログエントリを取得 |
| `Count` | `() int` | エントリ数 |
| `Clear` | `()` | 全エントリをクリア |
| `HasEntries` | `() bool` | エントリが存在するか |
| `LastEntry` | `() *LogEntry` | 最新のエントリ（nil セーフ） |

### アサーションメソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | レベルでエントリをフィルタリング |
| `ContainsMessage` | `(msg string) bool` | 指定メッセージを含むか（完全一致または部分一致） |
| `ContainsField` | `(key string) bool` | 指定フィールドを含むか |
| `GetFieldValue` | `(key string) any` | 最初に一致したフィールドの値を取得 |

### 使用例

#### 基本的なテスト

```go
func TestLogger(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("hello")
    logger.Warn("warning")

    if rec.Count() != 2 {
        t.Errorf("expected 2 entries, got %d", rec.Count())
    }

    if !rec.ContainsMessage("hello") {
        t.Error("should contain 'hello'")
    }
}
```

#### レベルアサーション

```go
func TestLogLevel(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    // 注意：Recorder は ISO 8601 タイムスタンプでレベルを解析するが、DevelopmentConfig の
    // 時間フォーマット（"15:04:05.000"）は非互換のため、DefaultConfig で手動 DEBUG 設定。
    cfg := dd.DefaultConfig()
    cfg.Level = dd.LevelDebug
    logger, _ := rec.NewLogger(cfg)

    logger.Debug("debug")
    logger.Info("info")
    logger.Error("error")

    errors := rec.EntriesAtLevel(dd.LevelError)
    if len(errors) != 1 {
        t.Errorf("expected 1 error, got %d", len(errors))
    }

    debugs := rec.EntriesAtLevel(dd.LevelDebug)
    if len(debugs) != 1 {
        t.Errorf("expected 1 debug, got %d", len(debugs))
    }
}
```

#### 構造化フィールドアサーション

```go
func TestStructuredLog(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.InfoWith("user login",
        dd.String("user", "admin"),
        dd.String("ip", "192.168.1.1"),
    )

    if !rec.ContainsField("user") {
        t.Error("should contain 'user' field")
    }

    user := rec.GetFieldValue("user")
    if user != "admin" {
        t.Errorf("expected user=admin, got %v", user)
    }
}
```

#### 最後のログエントリ

```go
func TestLastEntry(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("first")
    logger.Error("second")

    last := rec.LastEntry()
    if last.Level != dd.LevelError {
        t.Errorf("expected Error level, got %v", last.Level)
    }
    if last.Message != "second" {
        t.Errorf("expected 'second', got %s", last.Message)
    }
}
```

## LogEntry

キャプチャされたログエントリ構造。

```go
type LogEntry struct {
    Level     LogLevel
    Message   string
    Fields    []Field
    Timestamp time.Time
    Format    LogFormat
    RawOutput string
}
```

## 次のステップ

- [Logger](../core/logger) -- Logger 完全メソッド
- [構造化フィールド](../output-integration/fields) -- Field コンストラクタ
- [定数とエラー](./constants) -- LogLevel 定数
