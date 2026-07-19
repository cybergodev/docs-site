---
sidebar_label: "フックシステム"
title: "フックシステム - CyberGo DD | ライフサイクルフック実践ガイド"
description: "CyberGo DD フックシステムガイド。6 種のライフサイクルイベント（BeforeLog、AfterLog、OnFilter、OnRotate、OnClose、OnError）、HookRegistry 登録管理、HookContext コンテキストと一般的な拡張シナリオを解説します。"
sidebar_position: 6
---

# フックシステム

フック（Hooks）を使用すると、ログライフサイクルの重要なポイントにカスタムロジックを注入でき、ログ書き込み前後、ファイルローテーション、エラー発生などのタイミングで追加の操作を実行できます。

## フックイベント

DD は 6 種類のライフサイクルフックイベントを提供します：

| イベント | トリガータイミング | 典型的な用途 |
|------|----------|----------|
| `HookBeforeLog` | ログフォーマット前（フィールドはフィルタリング済み） | 条件スキップ、サンプリング制御 |
| `HookAfterLog` | ログ書き込み完了 | メトリクス更新、通知送信 |
| `HookOnFilter` | フィールド値がマスキングされた時に発火（メッセージテキストのマスキングでは発火しない；フックはフィールド key のみ受信し、元の値は受け取らない） | マスキングイベント記録、監査 |
| `HookOnRotate` | ファイルローテーション完了 | 運用通知、古いファイルのアップロード |
| `HookOnClose` | Logger クローズ | リソースクリーンアップ、最終レポート送信 |
| `HookOnError` | 書き込みエラー発生 | アラート、グレードダウン処理 |

## クイックスタート

### HooksConfig を使用

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("書き込み直前: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, err := dd.New(dd.Config{
    Hooks: hooks,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### HookRegistry を使用

```go
registry := dd.NewHookRegistry()

// BeforeLog フックを登録
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // デバッグレベルログの特定の処理をスキップ
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// OnRotate フックを登録
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("ファイルローテーション: %s\n", hCtx.Metadata)
    return nil
})

logger, err := dd.New(dd.Config{
    Hooks: registry,
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

## HookContext コンテキスト

各フックは `HookContext` を受け取り、現在のログの完全な情報を含みます：

```go
type HookContext struct {
    Event          HookEvent    // トリガーされたイベントタイプ
    Level          LogLevel     // ログレベル
    Message        string       // ログメッセージ
    Fields         []Field      // 処理後のフィールド
    OriginalFields []Field      // 元のフィールド（フィルタリング前）
    Error          error        // 関連エラー（OnError 時）
    Timestamp      time.Time    // タイムスタンプ
    Writer         io.Writer    // 対象 Writer
    Metadata       map[string]any // 追加メタデータ
}
```

## 一般的なシナリオ

### メトリクス収集

```go
var (
    logCounter   atomic.Int64
    errorCounter atomic.Int64
)

registry := dd.NewHookRegistry()

registry.Add(dd.HookAfterLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    logCounter.Add(1)
    if hCtx.Level >= dd.LevelError {
        errorCounter.Add(1)
    }
    return nil
})

logger, err := dd.New(dd.Config{Hooks: registry})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### ログサンプリング

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // 100 件に 1 件のみ記録
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // エラーを返すとログの書き込みを阻止
        }
    }
    return nil
})
```

### ファイルローテーション通知

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // モニタリングシステムに通知
    monitoring.Alert("log_rotated", map[string]any{
        "path": hCtx.Metadata["path"],
    })
    return nil
})
```

### エラーアラート

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // アラートを送信
    alerting.Send(fmt.Sprintf("ログ書き込み失敗: %v", hCtx.Error))
    return nil
})
```

## エラー処理

### グローバルエラーハンドラー

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // エラーを返す可能性がある
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("フック %s の実行に失敗: %v", event, err)
    },
})
```

### BeforeLog でログを中止

`BeforeLog` フックがエラーを返した場合、そのログは書き込まれません：

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // 条件をチェックし、満たさない場合はスキップ
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // 書き込みを阻止
    }
    return nil // 書き込みを許可
})
```

:::warning フック内の Panic
フック関数内で panic が発生した場合、DD は自動的にリカバリし、メインフローに影響を与えません。panic 情報は ErrorHandler に渡されます。
:::

## 動的登録

```go
// 実行時に新しいフックを登録
registry.Add(dd.HookAfterLog, newHookFunc)

// 実行時に削除（HookRegistry メソッド経由）
```

:::warning registry のクローン
Logger 作成時に入力された `registry` はクローンされます（`dd.New(dd.Config{Hooks: registry})` 後に内部に保持されるのはコピーです）。その後、元の `registry` を変更しても作成済みの Logger には影響しません。**作成済み Logger** のフックをランタイムに変更する場合は `logger.AddHook(event, hook)` を使用してください（内部で Clone-Modify-Store を行います）。
:::

## 次のステップ

- [監査ログ](./audit-logging) -- セキュリティ監査統合
- [分散トレーシング](./context-tracing) -- コンテキスト統合
- [API リファレンス - Hooks](../api-reference/security-audit/hooks) -- フック完全 API
