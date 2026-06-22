---
title: "パフォーマンス最適化 - CyberGo JSON | 高パフォーマンスガイド"
description: "CyberGo JSON パフォーマンスガイド：EnableCache/CacheTTL、ParallelThreshold 並列、PreParse、WarmupCache、オブジェクトプール再利用で高頻度 JSON 処理を高速化します。"
---

# パフォーマンス最適化

JSON 処理のパフォーマンスを最適化するための戦略とテクニック。

## プロセッサの再利用

### Processor インスタンスの再利用

```go
// ✅ パッケージレベル関数はグローバル Processor を自動的に再利用
for _, item := range dataList {
    val := json.GetString(item, "name")
}

// ✅ または明示的にインスタンスを再利用（カスタム設定に適しています）
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
for _, item := range dataList {
    val := processor.GetString(item, "name")
}
```

## メモリ最適化

### アロケーションの削減

```go
// ✅ Marshal を使用してバイトスライスを返す
bytes, _ := json.Marshal(data)

// ✅ Encode を使用して文字列を返す
s, _ := json.Encode(data)
```

### バッファの事前割り当て

```go
// 大量のデータを処理する際に事前割り当て
buf := make([]byte, 0, 1024*1024)
```

## ファイル処理

### 大ファイルには構造化イテレーションを使用

```go
// ❌ 一括ロード
data, _ := os.ReadFile("large.json")
parsed, _ := json.ParseAny(string(data))

// ✅ 構造化イテレーション（注意：ファイル全体をメモリにロードします）
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()
processor.ForeachFile("large.json", func(key any, item *json.IterableValue) error {
    processItem(item)
    return nil
})
```

### NDJSON 処理

```go
// StreamLinesInto を使用したストリーム処理
file, _ := os.Open("data.jsonl")
defer file.Close()
entries, err := json.StreamLinesInto[LogEntry](file, func(lineNum int, entry LogEntry) error {
    // 各行の JSON を処理
    return nil
})
```

## 並行処理

### 配列の並列処理

```go
items := json.GetArray(data, "items")

var wg sync.WaitGroup
sem := make(chan struct{}, runtime.NumCPU())

for _, item := range items {
    wg.Add(1)
    go func(item any) {
        defer wg.Done()
        sem <- struct{}{}
        defer func() { <-sem }()

        processItem(item)
    }(item)
}
wg.Wait()
```

### Worker プールの使用

```go
items := json.GetArray(data, "items")
jobs := make(chan any, len(items))

// 固定数の worker を起動し、goroutine を再利用して頻繁な生成/破棄を回避
var wg sync.WaitGroup
workers := runtime.NumCPU()
for w := 0; w < workers; w++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for item := range jobs {
            processItem(item)
        }
    }()
}

// タスクを分散後にチャネルを閉じ、worker に終了を通知
for _, item := range items {
    jobs <- item
}
close(jobs)
wg.Wait()
```

## 設定の最適化

### シナリオに応じた設定の調整

```go
// 小さいデータ量：緩やかな設定
smallCfg := json.DefaultConfig()
smallCfg.MaxNestingDepthSecurity = 200 // 最大許可値（検証範囲 10-200）

// 信頼できない入力：セキュリティ設定
safeCfg := json.SecurityConfig()
safeCfg.MaxJSONSize = 1024 * 1024
```

### 不要な機能の無効化

```go
// フックが不要な場合は設定しない
cfg := json.DefaultConfig() // 最小設定
```

## キャッシュ戦略

### パース結果のキャッシュ

```go
var cache sync.Map

func getOrParse(key string, data []byte) (any, error) {
    if val, ok := cache.Load(key); ok {
        return val, nil
    }

    result, err := json.ParseAny(string(data))
    if err != nil {
        return nil, err
    }

    cache.Store(key, result)
    return result, nil
}
```

### パスクエリのキャッシュ

```go
// よく使うパスを事前コンパイル（Processor を使用）
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
path1, _ := p.CompilePath("user.name")
path2, _ := p.CompilePath("user.email")
path3, _ := p.CompilePath("items[*].id")
```

## ベンチマーク

### パフォーマンステストの例

```go
func BenchmarkParse(b *testing.B) {
    data := []byte(`{"name": "test", "items": [1, 2, 3]}`)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, _ = json.ParseAny(string(data))
    }
}

func BenchmarkGetString(b *testing.B) {
    data := `{"user": {"name": "CyberGo", "email": "test@example.com"}}`

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        json.GetString(data, "user.name")
    }
}
```

### メモリ分析

```go
func TestMemoryUsage(t *testing.T) {
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    before := m.Alloc

    // 操作の実行
    data := generateLargeJSON()
    _, _ = json.ParseAny(data)

    runtime.ReadMemStats(&m)
    after := m.Alloc

    fmt.Printf("メモリ使用量: %d bytes\n", after-before)
}
```

## パフォーマンス比較

| 操作 | 小データ (<1KB) | 中データ (1MB) | 大データ (>10MB) |
|------|---------------|----------------|----------------|
| `Parse` | 推奨 | 推奨 | 非推奨 |
| `ForeachFile` | 不要 | オプション | 推奨 |

## 関連

- [大ファイル処理 API](../api-reference/large-file)
- [エラー処理](./error-handling)
- [大ファイル処理](../large-files)
