---
sidebar_label: "HookRegistry"
title: "フックシステム - CyberGo DD | HookRegistry"
description: "CyberGo DD ライフサイクルフックシステム完全 API ドキュメント。ログ書き込み前後（BeforeLog/AfterLog）、ファイルローテーション（OnRotate）、エラー発生（OnError）などの重要イベントでカスタムコールバックを登録可能。HookRegistry レジストリによるログ処理拡張。"
sidebar_position: 1
---

# フックシステム

DD はイベントベースのフックシステムを提供し、ログライフサイクルの重要なノードにカスタムロジックを挿入できます。

## フックイベント

| 定数 | String() | トリガータイミング |
|------|----------|----------|
| `HookBeforeLog` | `"BeforeLog"` | ログ書き込み前 |
| `HookAfterLog` | `"AfterLog"` | ログ書き込み後 |
| `HookOnFilter` | `"OnFilter"` | 機密データフィルタリング時 |
| `HookOnRotate` | `"OnRotate"` | ファイルローテーション時 |
| `HookOnClose` | `"OnClose"` | ロガークローズ時 |
| `HookOnError` | `"OnError"` | エラー発生時 |

## フック関数型

### Hook

```go
type Hook func(ctx context.Context, hookCtx *HookContext) error
```

フック関数シグネチャ。ログライフサイクルイベントのトリガー時に呼び出されます。

- `BeforeLog` フックがエラーを返した場合、**ログエントリは書き込まれません**。
- その他のイベントで返されたエラーは、デフォルトで後続フックの実行を終了させます；エラーハンドラーを設定した場合（`HookErrorHandler` を参照）、代わりにエラーをハンドラーに渡し、全フックが実行されます。
- フック内で発生した panic は `HookRegistry` で捕捉されてエラーに変換され、アプリケーション全体をクラッシュさせることはありません。

### HookErrorHandler

```go
type HookErrorHandler func(event HookEvent, hookCtx *HookContext, err error)
```

フックエラーハンドラーのシグネチャ。

パラメータ：

- `event`：エラーをトリガーしたフックイベントタイプ
- `hookCtx`：フックに渡されるコンテキスト
- `err`：フックが返した（または panic から変換された）エラー

エラーハンドラーを設定すると（`HookRegistry.SetErrorHandler` または `HooksConfig.ErrorHandler` 経由）、`Trigger` はすべてのフックを実行し、エラー遇到時の即時停止を行わなくなります；各エラーはハンドラーに渡されます。**例外**：`BeforeLog` イベントでは、ハンドラーを設定していても、返されたエラーはログ書き込みを阻止します。ハンドラー内部で panic してはなりません；panic した場合はリカバリされて stderr に出力されます。

## HookRegistry

フックレジストリ。全フックの登録とトリガーを管理します。スレッドセーフ。

### 作成

```go
// 空のレジストリ
reg := dd.NewHookRegistry()

// 設定から作成
reg := dd.NewHooksFromConfig(hooksConfig)
```

### メソッド

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Add` | `(event HookEvent, hook Hook)` | フックを登録 |
| `Remove` | `(event HookEvent)` | イベントの全フックを削除 |
| `Trigger` | `(ctx, event, hookCtx) error` | イベントの全フックをトリガー |
| `Clear` | `()` | 全フックをクリア |
| `ClearFor` | `(event HookEvent)` | 指定イベントのフックをクリア |
| `SetErrorHandler` | `(handler HookErrorHandler)` | エラーハンドラーを設定 |

### フックの登録

```go
reg := dd.NewHookRegistry()

// BeforeLog フック
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("ログ書き込み直前:", hc.Message)
    return nil
})

// AfterLog フック
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// OnRotate フック
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("ファイルローテーション完了",
        dd.String("path", hc.Metadata["path"].(string)),
    )
    return nil
})
```

### Logger で管理

```go
// 単一フックを追加
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// レジストリ全体を置き換え
_ = logger.SetHooks(reg)

// 現在のレジストリを取得
hooks := logger.GetHooks()
```

## HookContext

フックコンテキスト。イベント発生時の詳細情報を提供します。

```go
type HookContext struct {
    Event          HookEvent      // イベントタイプ
    Level          LogLevel       // ログレベル
    Message        string         // ログメッセージ
    Fields         []Field        // 構造化フィールド（フィルタリング後）
    OriginalFields []Field        // 元のフィールド（フィルタリング前）
    Error          error          // エラー情報（OnError イベント）
    Timestamp      time.Time      // イベント時刻
    Writer         io.Writer      // 対象 Writer（書き込み関連イベント）
    Metadata       map[string]any // 追加メタデータ
}
```

## HooksConfig

構造化フック設定。バッチでのフック登録に推奨されます。

```go
type HooksConfig struct {
    BeforeLog    []Hook              // ログ書き込み前フック
    AfterLog     []Hook              // ログ書き込み後フック
    OnFilter     []Hook              // 機密データフィルタリング時フック
    OnRotate     []Hook              // ファイルローテーション時フック
    OnClose      []Hook              // ロガークローズ時フック
    OnError      []Hook              // 書き込みエラー時フック
    ErrorHandler HookErrorHandler    // エラーハンドラー
}
```

```go
cfg := dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // ログ前処理
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        log.Printf("フックエラー: %v\n", err)
    },
}
registry := dd.NewHooksFromConfig(cfg)
```

## 完全な例

### メトリクス収集

```go
reg := dd.NewHookRegistry()
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    logCount.Inc()
    logLevelCounter.WithLabelValues(hc.Level.String()).Inc()
    return nil
})
reg.Add(dd.HookOnError, func(ctx context.Context, hc *dd.HookContext) error {
    errorCount.Inc()
    return nil
})
_ = logger.SetHooks(reg)
```

## 次のステップ

- [Logger](../core/logger) -- AddHook / SetHooks メソッド
- [設定](../core/config) -- HooksConfig 設定
- [インターフェース定義](../core/interfaces) -- Hook 型定義
