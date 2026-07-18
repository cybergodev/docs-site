---
sidebar_label: "インターフェース定義"
title: "インターフェース定義 - CyberGo DD | Logger インターフェース階層"
description: "CyberGo DD インターフェース階層定義ドキュメント。CoreLogger、LevelLogger、ConfigurableLogger、LogProvider の 4 インターフェースで多層ログ抽象をサポートしカスタム実装と DI に便利。"
sidebar_position: 5
---

# インターフェース定義

DD は階層化されたログインターフェースを定義し、異なるレベルの抽象ニーズをサポートします。

## インターフェース階層

```text
CoreLogger                  基本ログメソッド
├── LevelLogger             + レベル管理
└── ConfigurableLogger      + 設定/ライフサイクル/Writer/Hook
    └── LogProvider         + 全機能
```

## CoreLogger

最も基本的なログインターフェース。ログ出力メソッドのみを含みます。

```go
type CoreLogger interface {
    // 基本ログ
    Debug(args ...any)
    Info(args ...any)
    Warn(args ...any)
    Error(args ...any)
    Fatal(args ...any)

    // フォーマットログ
    Debugf(format string, args ...any)
    Infof(format string, args ...any)
    Warnf(format string, args ...any)
    Errorf(format string, args ...any)
    Fatalf(format string, args ...any)

    // 構造化ログ
    DebugWith(msg string, fields ...Field)
    InfoWith(msg string, fields ...Field)
    WarnWith(msg string, fields ...Field)
    ErrorWith(msg string, fields ...Field)
    FatalWith(msg string, fields ...Field)

    // フィールドチェーン
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry
}
```

## LevelLogger

`CoreLogger` を拡張し、レベル管理機能を追加します。

```go
type LevelLogger interface {
    CoreLogger

    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool
}
```

## ConfigurableLogger

`CoreLogger` を拡張し、設定、ライフサイクル、Writer、コンテキストエクストラクタ、フック、サンプリング管理を追加します。

```go
type ConfigurableLogger interface {
    CoreLogger

    // レベル管理
    GetLevel() LogLevel
    SetLevel(level LogLevel) error

    // 出力先
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // ライフサイクル
    Flush() error
    Close() error
    IsClosed() bool

    // 設定
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // コンテキストエクストラクタ
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // フック
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // サンプリング
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig
}
```

## LogProvider

完全なログインターフェース。全ての機能を組み合わせます。`Logger` 型がこのインターフェースを実装します。

```go
type LogProvider interface {
    // レベル管理
    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool

    // 汎用ログ
    Log(level LogLevel, args ...any)
    Logf(level LogLevel, format string, args ...any)
    LogWith(level LogLevel, msg string, fields ...Field)

    // 便宜ログ - Debug
    Debug(args ...any)
    Debugf(format string, args ...any)
    DebugWith(msg string, fields ...Field)

    // 便宜ログ - Info
    Info(args ...any)
    Infof(format string, args ...any)
    InfoWith(msg string, fields ...Field)

    // 便宜ログ - Warn
    Warn(args ...any)
    Warnf(format string, args ...any)
    WarnWith(msg string, fields ...Field)

    // 便宜ログ - Error
    Error(args ...any)
    Errorf(format string, args ...any)
    ErrorWith(msg string, fields ...Field)

    // 便宜ログ - Fatal
    Fatal(args ...any)
    Fatalf(format string, args ...any)
    FatalWith(msg string, fields ...Field)

    // フィールドチェーン
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry

    // 出力先
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // ライフサイクル
    Flush() error
    Close() error
    IsClosed() bool

    // 設定
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // コンテキストエクストラクタ
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // フック
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // サンプリング
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig

    // デバッグ出力
    Print(args ...any)
    Println(args ...any)
    Printf(format string, args ...any)
    Text(data ...any)
    Textf(format string, args ...any)
    JSON(data ...any)
    JSONF(format string, args ...any)

    // goroutine 管理
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip Logger の追加メソッド
具象型 `Logger` は `LogProvider` インターフェースを実装し、さらに以下のインターフェースに含まれないメソッドを提供します：

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Shutdown` | `(ctx context.Context) error` | タイムアウト付きグレースフルシャットダウン |
| `SetLevelResolver` | `(resolver LevelResolver)` | 動的レベルリゾルバー |
| `GetLevelResolver` | `() LevelResolver` | レベルリゾルバーを取得 |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | フィールド検証設定 |
| `GetFieldValidation` | `() *FieldValidationConfig` | フィールド検証設定を取得 |

これらのメソッドは [Logger](./logger) ページで詳しく説明されています。
:::

## Flusher

Writer のフラッシュインターフェース。このインターフェースを実装した Writer は `Logger.Flush()` の際に呼び出されます。

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter` がこのインターフェースを実装しています。

## 関数タイプ

| タイプ | シグネチャ | 説明 |
|------|------|------|
| `FatalHandler` | `func()` | Fatal レベルのカスタム処理関数 |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | 書き込みエラーコールバック |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | 動的レベル解決 |
| `ContextExtractor` | `func(ctx context.Context) []Field` | コンテキストフィールド抽出 |
| `Hook` | `func(ctx context.Context, hookCtx *HookContext) error` | フック関数 |
| `HookErrorHandler` | `func(event HookEvent, hookCtx *HookContext, err error)` | フックエラー処理 |

## 使用シナリオ

### 依存性注入

```go
type Service struct {
    logger dd.CoreLogger  // 基本インターフェースのみに依存
}

func NewService(logger dd.CoreLogger) *Service {
    return &Service{logger: logger}
}

// *Logger または *LoggerEntry を渡せる
svc := NewService(logger)
svc.logger.Info("サービス起動")
```

### インターフェース適応

```go
// CoreLogger を実装する任意の型を受け付ける
func process(logger dd.CoreLogger) {
    logger.InfoWith("処理開始", dd.String("item", "data"))
}
```

## 次のステップ

- [Logger](./logger) -- LogProvider を実装する具象型
- [LoggerEntry](./entry) -- CoreLogger を実装する Entry 型
- [パッケージ関数](./functions) -- グローバル関数
