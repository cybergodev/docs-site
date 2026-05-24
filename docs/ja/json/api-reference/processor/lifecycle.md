---
title: "Processor ライフサイクル - CyberGo JSON | API リファレンス"
description: "CyberGo JSON Processor ライフサイクル管理完全リファレンス：New によるインスタンス作成、Close によるリソース解放、IsClosed 状態確認、Stats 統計情報、HealthCheck ヘルスモニタリング、並列安全なクローズとリソース保護のベストプラクティスガイド。"
---

# ライフサイクルと統計

Processor はライフサイクル管理、キャッシュ制御、ヘルスモニタリング機能を完全に提供します。

## ライフサイクル

### Close

シグネチャ：`func (p *Processor) Close() error`

プロセッサを閉じてリソースを解放します。Processor の使用後はこのメソッドを呼び出す必要があります。

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

### IsClosed

シグネチャ：`func (p *Processor) IsClosed() bool`

プロセッサが閉じられているかどうかを確認します。

```go
if processor.IsClosed() {
    // プロセッサは閉じられており、使用不可
}
```

## キャッシュ管理

### ClearCache

シグネチャ：`func (p *Processor) ClearCache()`

プロセッサの内部キャッシュをクリアします。

```go
processor.ClearCache()
```

用途：
- データソースが変更された場合
- メモリ使用量が高すぎる場合
- 強制リフレッシュが必要な場合

### WarmupCache

シグネチャ：`func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

キャッシュをウォームアップし、以降の操作のパフォーマンスを向上させます。

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("%d 個のパスのウォームアップに成功\n", result.Successful)
```

**WarmupResult 構造体**：

```go
type WarmupResult struct {
    TotalPaths   int      // 総パス数
    Successful   int      // ウォームアップ成功したパス数
    Failed       int      // 失敗したパス数
    SuccessRate  float64  // 成功率（パーセント）
    FailedPaths  []string // 失敗したパスのリスト
}
```

| フィールド | 型 | 説明 |
|------------|------|------|
| `TotalPaths` | `int` | 総パス数 |
| `Successful` | `int` | ウォームアップ成功したパス数 |
| `Failed` | `int` | 失敗したパス数 |
| `SuccessRate` | `float64` | 成功率（0-100） |
| `FailedPaths` | `[]string` | 失敗したパスのリスト |

## 統計情報

### GetStats

シグネチャ：`func (p *Processor) GetStats() Stats`

プロセッサの統計情報を取得します。

```go
stats := processor.GetStats()
fmt.Printf("キャッシュヒット率: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("キャッシュサイズ: %d\n", stats.CacheSize)
```

**Stats 構造体**：

```go
type Stats struct {
    CacheSize        int64         // キャッシュエントリ数
    CacheMemory      int64         // キャッシュメモリ使用量（バイト）
    MaxCacheSize     int           // 最大キャッシュサイズ
    HitCount         int64         // キャッシュヒット回数
    MissCount        int64         // キャッシュミス回数
    HitRatio         float64       // キャッシュヒット率
    CacheTTL         time.Duration // キャッシュ TTL
    CacheEnabled     bool          // キャッシュが有効かどうか
    IsClosed         bool          // プロセッサが閉じられているかどうか
    MemoryEfficiency float64       // メモリ効率
    OperationCount   int64         // 総操作回数
    ErrorCount       int64         // 総エラー回数
}
```

| フィールド | 型 | 説明 |
|------------|------|------|
| `CacheSize` | `int64` | 現在のキャッシュエントリ数 |
| `CacheMemory` | `int64` | キャッシュメモリ使用量（バイト） |
| `MaxCacheSize` | `int` | 最大キャッシュサイズ制限 |
| `HitCount` | `int64` | キャッシュヒット回数 |
| `MissCount` | `int64` | キャッシュミス回数 |
| `HitRatio` | `float64` | キャッシュヒット率（0-1） |
| `CacheTTL` | `time.Duration` | キャッシュ有効期限 |
| `CacheEnabled` | `bool` | キャッシュが有効かどうか |
| `IsClosed` | `bool` | プロセッサが閉じられているかどうか |
| `MemoryEfficiency` | `float64` | メモリ効率 |
| `OperationCount` | `int64` | 総操作回数 |
| `ErrorCount` | `int64` | 総エラー回数 |

## ヘルスチェック

### GetHealthStatus

シグネチャ：`func (p *Processor) GetHealthStatus() HealthStatus`

プロセッサのヘルス状態を取得します。

```go
status := processor.GetHealthStatus()
if status.Healthy {
    fmt.Println("プロセッサは正常です")
} else {
    for name, check := range status.Checks {
        if !check.Healthy {
            fmt.Printf("チェック %s 失敗: %s\n", name, check.Message)
        }
    }
}
```

**HealthStatus 構造体**：

```go
type HealthStatus struct {
    Timestamp time.Time              // チェック時刻
    Healthy   bool                   // 全体的なヘルス状態
    Checks    map[string]CheckResult // 各チェックの結果
}

type CheckResult struct {
    Healthy  bool   // 正常かどうか
    Message  string // ステータスメッセージ
}
```

| フィールド | 型 | 説明 |
|------------|------|------|
| `Timestamp` | `time.Time` | チェック時刻 |
| `Healthy` | `bool` | 全体的に正常かどうか |
| `Checks` | `map[string]CheckResult` | 各チェックの詳細 |

## 拡張フック

### AddHook

シグネチャ：`func (p *Processor) AddHook(hook Hook)`

操作フックをプロセッサに追加します。

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

フックは各操作の前後に呼び出され、以下の用途に使用できます：
- ログ記録
- パフォーマンス監視
- メトリクス収集
- 監査トレース

### SetLogger

シグネチャ：`func (p *Processor) SetLogger(logger *slog.Logger)`

プロセッサのロガーを設定します。デバッグやランタイム診断に使用します。

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

シグネチャ：`func (p *Processor) GetConfig() Config`

プロセッサの現在の設定コピーを取得します。返された設定は安全に変更でき、プロセッサには影響しません。

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("キャッシュ有効: %v\n", cfg.EnableCache)
fmt.Printf("最大 JSON サイズ: %d\n", cfg.MaxJSONSize)
```

## 使用のヒント

### リソース管理

```go
processor, _ := json.New()
defer processor.Close()  // リソースの解放を確実に

// processor を使用...
```

### パフォーマンス最適化

```go
// よく使用するパスをウォームアップ
processor.WarmupCache(data, []string{
    "user.name",
    "user.email",
    "items[*].id",
})

// 定期的に統計を確認
stats := processor.GetStats()
if stats.HitRatio < 0.5 {
    // ヒット率が低い場合、キャッシュ設定の調整を検討
}
```

### 監視の統合

```go
// 定期的なヘルスチェック
go func() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        status := processor.GetHealthStatus()
        if !status.Healthy {
            log.Printf("Processor unhealthy: %+v", status.Checks)
        }
    }
}()
```

## 関連

- [Config](../config) - 設定オプション（キャッシュサイズ、TTL など）
- [Hook フックシステム](../hooks) - フックの詳細な使用ガイド
- [インターフェース定義](../interfaces) - Hook インターフェース
