---
title: "Processor JSONL メソッド - CyberGo JSON | API リファレンス"
description: "CyberGo JSON プロセッサの JSONL メソッド：StreamJSONL/StreamJSONLParallel/StreamJSONLChunked ストリーミング処理、ForeachJSONL 反復、MapJSONL マッピング、ReduceJSONL 畳み込み、FilterJSONL フィルタリング、CollectJSONL 収集、FirstJSONL 検索。"
---

# Processor JSONL メソッド

Processor は JSONL（JSON Lines）のストリーミング処理機能を完全に提供し、行単位処理、並列処理、バッチ処理、関数型操作をサポートします。

## ストリーミング読み込みメソッド

### StreamJSONL

シグネチャ：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL データをストリーミング処理し、行ごとに読み込んでコールバック関数を呼び出します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL データソース |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理関数。エラーを返すと処理を停止 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    level := item.GetString("level")
    msg := item.GetString("message")
    fmt.Printf("[%d] %s: %s\n", lineNum, level, msg)
    return nil
})
```

---

### StreamJSONLParallel

シグネチャ：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

JSONL データを並列処理し、複数のワーカーゴルーチンを使用して処理を高速化します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL データソース |
| `workers` | `int` | ワーカーゴルーチン数（0 以下の場合はデフォルト 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理関数 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("large.jsonl")
defer file.Close()

var count int64
err := processor.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    atomic.AddInt64(&count, 1)
    // CPU 集約的な処理...
    return nil
})
fmt.Printf("%d 行を処理しました\n", count)
```

::: tip パフォーマンスのヒント
- CPU 集約的な操作（データ変換、計算）に適しています
- I/O 集約的な操作にはシングルスレッドの `StreamJSONL` を推奨
- workers の数は CPU コア数に設定することを推奨
:::

### StreamJSONLParallelWithContext

シグネチャ：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

コンテキスト付きの並列 JSONL データ処理。キャンセルとタイムアウト制御をサポートします。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `ctx` | `context.Context` | コンテキスト。キャンセルやタイムアウトに使用 |
| `reader` | `io.Reader` | JSONL データソース |
| `workers` | `int` | ワーカーゴルーチン数（0 以下の場合はデフォルト 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理関数 |

```go
processor, _ := json.New()
defer processor.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := processor.StreamJSONLParallelWithContext(ctx, reader, 8, func(lineNum int, item *json.IterableValue) error {
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

---

### StreamJSONLChunked

シグネチャ：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

JSONL データをチャンク単位で処理し、毎回一批の要素を処理します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `reader` | `io.Reader` | JSONL データソース |
| `chunkSize` | `int` | 1 バッチあたりの要素数 |
| `fn` | `func(chunk []*IterableValue) error` | バッチ処理関数 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // データベースへバッチ書き込み
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:    item.GetInt("id"),
            Name:  item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

---

### StreamJSONLFile

シグネチャ：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

ファイルから直接 JSONL データをストリーミング処理します。

```go
processor, _ := json.New()
defer processor.Close()

err := processor.StreamJSONLFile("logs.jsonl", func(lineNum int, item *json.IterableValue) error {
    if item.GetString("level") == "error" {
        logErrors(item)
    }
    return nil
})
```

---

## 関数型操作メソッド

### ForeachJSONL

シグネチャ：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL データを反復するエイリアスメソッド。`StreamJSONL` と同じ動作です。

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

シグネチャ：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

JSONL データを新しい形式にマッピングし、変換後のスライスを返します。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// すべてのユーザー名を抽出
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

シグネチャ：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

JSONL データを単一の値に畳み込みます。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// 売上合計を計算
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("売上合計: %.2f\n", total.(float64))
```

---

### FilterJSONL

シグネチャ：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

JSONL データをフィルタリングし、条件を満たす要素を返します。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// エラーログを抽出
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("%d 件のエラーログを発見\n", len(errors))
```

---

### CollectJSONL

シグネチャ：`func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

すべての JSONL データをスライスに収集します。

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

items, err := processor.CollectJSONL(file)
if err != nil {
    panic(err)
}
fmt.Printf("%d 件のレコードを収集\n", len(items))
```

::: warning メモリに関する注意
このメソッドはすべてのデータをメモリに読み込むため、非常に大きなファイルには適していません。大きなファイルには `StreamJSONL` で行単位処理を使用してください。
:::

---

### FirstJSONL

シグネチャ：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

条件を満たす最初の要素を検索します。

**戻り値**

| 型 | 説明 |
|------|------|
| `*IterableValue` | 見つかった要素（存在する場合） |
| `bool` | 見つかったかどうか |
| `error` | エラー情報 |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// 最初の管理者を検索
admin, found, err := processor.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetBool("is_admin")
})
if err != nil {
    panic(err)
}
if found {
    fmt.Printf("管理者: %s\n", admin.GetString("name"))
}
```

---

## 設定オプション

JSONL 処理の動作は `Config` の以下のフィールドで設定できます：

| フィールド | 型 | デフォルト値 | 説明 |
|------------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536 (64KB) | 読み込みバッファサイズ |
| `JSONLMaxLineSize` | `int` | 1048576 (1MB) | 1 行の最大バイト数 |
| `JSONLSkipEmpty` | `bool` | `true` | 空行をスキップ |
| `JSONLSkipComments` | `bool` | `false` | `#` または `//` コメントをスキップ |
| `JSONLContinueOnErr` | `bool` | `false` | 解析エラー時に処理を続行 |
| `JSONLWorkers` | `int` | 4 | 並列処理のワーカーゴルーチン数 |
| `JSONLChunkSize` | `int` | 1000 | チャンク処理の1バッチあたりのサイズ |
| `JSONLMaxMemory` | `int64` | 104857600 (100MB) | 最大メモリ使用量 |

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // コメント行をスキップ
cfg.JSONLContinueOnErr = true    // 解析エラー時に続行
cfg.JSONLWorkers = 8             // 8 つの並列ワーカー

processor, _ := json.New(cfg)
defer processor.Close()
```

---

## 完全な例

### ログ分析

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    processor, _ := json.New()
    defer processor.Close()

    file, _ := os.Open("app.log.jsonl")
    defer file.Close()

    var errorCount, warningCount int

    err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        level := item.GetString("level")
        switch level {
        case "error":
            errorCount++
            fmt.Printf("[ERROR] %s\n", item.GetString("message"))
        case "warning":
            warningCount++
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("統計: %d 件のエラー, %d 件の警告\n", errorCount, warningCount)
}
```

### 並列データ処理

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    cfg.JSONLWorkers = 16 // 16 の並列ワーカー

    processor, _ := json.New(cfg)
    defer processor.Close()

    file, _ := os.Open("large_data.jsonl")
    defer file.Close()

    var processed int64

    err := processor.StreamJSONLParallel(file, 16, func(lineNum int, item *json.IterableValue) error {
        // CPU 集約的な処理
        processItem(item)
        atomic.AddInt64(&processed, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("%d 件のレコードを並列処理しました\n", processed)
}
```

---

## 関連

- [JSONL プロセッサ](../jsonl) - パッケージレベル JSONL 関数
- [大規模ファイル処理](../../large-files) - 大規模ファイル処理ガイド
- [イテレータ](../iterator) - IterableValue 型の詳細
