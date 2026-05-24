---
title: "フックシステム - CyberGo DD | ライフサイクルフック実践ガイド"
description: "CyberGo DD フックシステム実践ガイド。6 種類のライフサイクルフックイベント（BeforeLog、AfterLog、OnFilter、OnRotate、OnClose、OnError）、HookRegistry 登録と管理、HookContext コンテキストデータ、エラー処理戦略、一般的なフック使用シナリオを詳細に紹介し、ログライブラリの動作を拡張できます。"
---

# フックシステム

フック（Hooks）を使用すると、ログライフサイクルの重要なポイントにカスタムロジックを注入でき、ログ書き込み前後、ファイルローテーション、エラー発生などのタイミングで追加の操作を実行できます。

## フックイベント

DD は 6 種類のライフサイクルフックイベントを提供します：

| イベント | トリガータイミング | 典型的な用途 |
|------|----------|----------|
| `HookBeforeLog` | ログフォーマット前（フィールドはフィルタリング済み） | 条件スキップ、サンプリング制御 |
| `HookAfterLog` | ログ書き込み完了 | メトリクス更新、通知送信 |
| `HookOnFilter` | セキュリティフィルタリング発動 | マスキングイベント記録、監査 |
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

logger, _ := dd.New(dd.Config{
    Hooks: hooks,
})
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

logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
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

logger, _ := dd.New(dd.Config{Hooks: registry})
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
        "file":     hCtx.Metadata["file"],
        "new_file": hCtx.Metadata["new_file"],
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

## 次のステップ

- [監査ログ](./audit-logging) -- セキュリティ監査統合
- [分散トレーシング](./context-tracing) -- コンテキスト統合
- [API リファレンス - Hooks](../api-reference/hooks) -- フック完全 API
