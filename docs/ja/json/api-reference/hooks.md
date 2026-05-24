---
title: "Hook フックシステム - CyberGo JSON | API リファレンス"
description: "CyberGo JSON フックシステム完全リファレンス：Hook インターフェース定義、LoggingHook ログ記録、TimingHook パフォーマンスタイミング、ValidationHook データバリデーション、ErrorHook エラー処理、カスタムフック実装の詳細解説。JSON 操作の前後にカスタムロジックを挿入可能。"
---

# Hook フックシステム

Hook を使用すると、JSON 操作の前後にカスタムロジックを挿入し、ログ記録、パフォーマンス監視、バリデーションなどの機能を実現できます。

## Hook インターフェース

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### メソッドの説明

| メソッド | 説明 |
|------|------|
| `Before(ctx HookContext) error` | 操作前に呼び出される。エラーを返すと操作を中止 |
| `After(ctx HookContext, result any, err error) (any, error)` | 操作後に呼び出される。結果の変更やエラーの返却が可能 |

---

## HookContext 構造体

HookContext は操作のコンテキスト情報を提供します。

```go
type HookContext struct {
    Operation string      // 操作タイプ："get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // 入力 JSON 文字列（marshal の場合は空の可能性あり）
    Path      string      // 対象パス（marshal/unmarshal の場合は空の可能性あり）
    Value     any         // set 操作の値
    Config    *Config     // アクティブな設定
    StartTime time.Time   // 操作開始時刻
}
```

### フィールドの説明

| フィールド | 型 | 説明 |
|------|------|------|
| `Operation` | `string` | 操作タイプ。値は `get`、`set`、`delete`、`marshal`、`unmarshal` |
| `JSONStr` | `string` | 入力 JSON 文字列 |
| `Path` | `string` | 対象パス式 |
| `Value` | `any` | set 操作の値 |
| `Config` | `*Config` | 現在使用中の設定 |
| `StartTime` | `time.Time` | 操作開始時刻 |

---

## HookFunc アダプタ

HookFunc は構造体アダプタで、関数を Hook として使用できるようにします。Before または After のいずれかのみが必要な場面に適しています。

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### 例

```go
// After のみ必要な場合
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Before のみ必要な場合
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

---

## 便利な Hook ファクトリ関数

### LoggingHook

ログ記録 Hook を作成します。

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### TimingHook

タイミング Hook を作成し、操作の所要時間を記録します。

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

### ValidationHook

バリデーション Hook を作成し、操作前に入力をバリデーションします。

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

### ErrorHook

エラー処理 Hook を作成し、エラーをインターセプトして処理します。

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // 元のエラーまたは変換後のエラーを返す
}))
```

---

## カスタム Hook 実装

### 完全な例

```go
package main

import (
    "fmt"
    "log/slog"
    "time"
    "github.com/cybergodev/json"
)

// ログ Hook
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "op", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err)
    return result, err
}

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // カスタム Hook を追加
    p.AddHook(&LoggingHook{logger: slog.Default()})

    // processor を使用...
    val, err := p.Get(`{"name": "test"}`, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val)
}
```

### HookFunc で簡素化

```go
// 完了時間の記録のみが必要な場合
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## 設定による Hook

### Config 経由で追加

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### Processor 経由で追加

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

---

## 実行順序

### Before フック

- **追加順**に実行
- いずれかの Hook がエラーを返すと操作を中止

### After フック

- **追加の逆順**に実行
- すべての Hook が実行される（前にエラーが返されても）

```go
// 追加順序: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// 実行順序:
// Before: A.Before → B.Before → C.Before
// After:  C.After → B.After → A.After
```

---

## ベストプラクティス

### 1. ログ記録

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. パフォーマンス監視

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. 入力バリデーション

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. エラートラッキング

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. 監査ログ

```go
type AuditHook struct {
    auditLogger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if ctx.Operation == "set" || ctx.Operation == "delete" {
        h.auditLogger.Info("data modification",
            "operation", ctx.Operation,
            "path", ctx.Path,
            "success", err == nil)
    }
    return result, err
}
```

---

## 関連

- [インターフェース定義](./interfaces) - 拡張インターフェース
- [Validator](./validator) - バリデータ
- [Config](./config) - 設定オプション
