---
title: "JSONL プロセッサ - CyberGo JSON | API リファレンス"
description: "CyberGo JSON JSONL/NDJSON プロセッサリファレンス：StreamJSONL ストリーム処理、JSONLWriter 書き込み、StreamLinesInto[T] ジェネリックストリーム、ParseJSONL 解析、ToJSONL 変換、設定オプションを含む、JSON Lines 形式の読み書きと高度な操作を完全サポート。"
---

# JSONL プロセッサ

JSONL（JSON Lines）または NDJSON（Newline Delimited JSON）は、1行に1つの JSON オブジェクトを格納する形式です。本ライブラリは `Processor` メソッドとパッケージレベル関数により、完全な JSONL 処理機能を提供します。

## 形式仕様

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- 各行は有効な JSON 値であること
- 行は `\n` で区切られる
- 最終行の末尾には改行があってもなくてもよい

---

## Processor JSONL メソッド

JSONL 処理機能は `Processor` のメソッドを通じて提供されます。

### StreamJSONL

シグネチャ：`func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL データをストリーム処理し、各行ごとに `IterableValue` を返します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `reader` | `io.Reader` | データソース |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理コールバック |

**コールバック戻り値**

| 戻り値 | 説明 |
|--------|------|
| `nil` | 次の行の処理を継続 |
| `item.Break()` | イテレーションを停止、エラーは返さない |
| その他の `error` | イテレーションを停止し、エラーを返す |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("行 %d: name=%s, age=%d\n", lineNum, name, age)
    return nil // 処理を継続
    // return item.Break() // イテレーションを停止
})
```

### StreamJSONLParallel

シグネチャ：`func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

ワーカープールパターンを使用して JSONL データを並列処理します。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `reader` | `io.Reader` | データソース |
| `workers` | `int` | ワーカーゴルーチン数（<=0 の場合、デフォルトは 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理コールバック |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // CPU 負荷の高い処理
    return processItem(item)
})
```

::: tip パフォーマンスのヒント
CPU 負荷の高い操作（データ変換や計算など）では、並列処理によりパフォーマンスが大幅に向上します。I/O 負荷の高い操作の場合は、シングルスレッド処理を推奨します。
:::

### StreamJSONLParallelWithContext

シグネチャ：`func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

コンテキスト付きの並列 JSONL データ処理。タイムアウトとキャンセル操作をサポートします。

**パラメータ**

| 名前 | 型 | 説明 |
|------|------|------|
| `ctx` | `context.Context` | キャンセルとタイムアウト用のコンテキスト |
| `reader` | `io.Reader` | データソース |
| `workers` | `int` | ワーカーゴルーチン数（0 以下の場合はデフォルト 4） |
| `fn` | `func(lineNum int, item *IterableValue) error` | 処理コールバック |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err = p.StreamJSONLParallelWithContext(ctx, file, 8, func(lineNum int, item *json.IterableValue) error {
    // キャンセル対応の並列処理
    return processItem(item)
})
```

### StreamJSONLChunked

シグネチャ：`func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

JSONL データをチャンク単位で処理し、指定した要素数ごとにバッチ処理を行います。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 1バッチあたり 1000 件
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // データベースへのバッチ書き込み
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### StreamJSONLFile

シグネチャ：`func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

JSONL ファイルを直接処理します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

## 高度な JSONL 操作

### MapJSONL

シグネチャ：`func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

JSONL データを新しい形式にマッピングします。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return map[string]any{
        "name": item.GetString("name"),
        "age":  item.GetInt("age"),
    }, nil
})
```

### ReduceJSONL

シグネチャ：`func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

JSONL データを単一の結果に集約します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 年齢の合計を計算
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

シグネチャ：`func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

JSONL データをフィルタリングし、条件を満たす要素を返します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 成年を抽出
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

シグネチャ：`func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

すべての JSONL 要素をスライスに収集します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

items, err := p.CollectJSONL(file)
for _, item := range items {
    fmt.Println(item.GetString("name"))
}
```

### FirstJSONL

シグネチャ：`func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

条件を満たす最初の要素を返します。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

user, found, err := p.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("name") == "Alice"
})
if found {
    fmt.Println("発見:", user.GetString("name"))
}
```

### ForeachJSONL

シグネチャ：`func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

JSONL データをイテレーションします（StreamJSONL のエイリアス）。

---

## JSONL 設定

JSONL 設定は `Config` 構体体に統合されています：

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // バッファサイズ（デフォルト 64KB）
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // 最大行サイズ（デフォルト 1MB）
cfg.JSONLSkipEmpty = true           // 空行をスキップ（デフォルト true）
cfg.JSONLSkipComments = true        // コメント行をスキップ（デフォルト false）
cfg.JSONLContinueOnErr = true       // 解析エラー時に継続（デフォルト false）
cfg.JSONLWorkers = 8                // 並列ワーカー数（デフォルト 4）
cfg.JSONLChunkSize = 500            // チャンクサイズ（デフォルト 1000）
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // 最大メモリ（デフォルト 100MB）

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

---

## JSONLWriter

JSONL ライターは、データを JSON Lines 形式で書き込むために使用します。

### NewJSONLWriter

シグネチャ：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

JSONL ライターを作成します。オプションの設定パラメータをサポートします。

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// デフォルト設定を使用
writer := json.NewJSONLWriter(file)

// カスタム設定を使用
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

シグネチャ：`func (w *JSONLWriter) Write(data any) error`

単一の JSON 値を1行として書き込みます。

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

### WriteAll

シグネチャ：`func (w *JSONLWriter) WriteAll(data []any) error`

複数の JSON 値を、それぞれ1行として書き込みます。

```go
items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
    map[string]any{"id": 3, "name": "Charlie"},
}

err := writer.WriteAll(items)
```

### WriteRaw

シグネチャ：`func (w *JSONLWriter) WriteRaw(line []byte) error`

生の JSON 行を書き込みます（JSON エンコードは行われません）。

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
```

### Err

シグネチャ：`func (w *JSONLWriter) Err() error`

書き込み中に発生したエラーを返します。

```go
if err := writer.Err(); err != nil {
    fmt.Printf("書き込みエラー: %v\n", err)
}
```

### Stats

シグネチャ：`func (w *JSONLWriter) Stats() JSONLStats`

書き込みの統計情報を取得します。

```go
stats := writer.Stats()
fmt.Printf("書き込み %d 行, %d バイト\n", stats.LinesProcessed, stats.BytesWritten)
```

**JSONLStats 構体体**：

```go
type JSONLStats struct {
    LinesProcessed int64 // 処理済み行数
    BytesWritten   int64 // 書き込み済みバイト数
}
```

---

## NDJSONProcessor

`map[string]any` 型に特化した NDJSON ファイルプロセッサです。

### NewNDJSONProcessor

シグネチャ：`func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

NDJSON プロセッサを作成します。オプションの設定パラメータをサポートします。

```go
// デフォルト設定を使用
np := json.NewNDJSONProcessor()

// カスタム設定を使用
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024
np = json.NewNDJSONProcessor(cfg)
```

### ProcessFile

シグネチャ：`func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

NDJSON ファイルを処理します。

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

シグネチャ：`func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

Reader から NDJSON を処理します。

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## パッケージレベル関数

### StreamJSONLFile

シグネチャ：`func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

パッケージレベル関数。Processor を作成せずに、ファイルから直接 JSONL データをストリーム処理します。

```go
err := json.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("行 %d: %v\n", lineNum, item.GetData())
    return nil
})
```

### StreamLinesInto[T]

シグネチャ：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

JSONL をストリーム読み込みし、行ごとに処理します。

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// デフォルト設定を使用
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("処理中: %s\n", user.Name)
    return nil
})

// カスタム設定を使用
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

### ParseJSONL

シグネチャ：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

JSONL バイトスライスを解析します。

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

シグネチャ：`func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

JSONL バイトスライスに変換します。

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

シグネチャ：`func ToJSONLString(data []any, cfg ...Config) (string, error)`

JSONL 文字列に変換します。

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## 完全な例

### 大規模 JSONL ファイルの読み込み

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

func main() {
    file, _ := os.Open("logs.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    count := 0
    err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        count++
        if item.GetString("level") == "error" {
            fmt.Printf("エラー: %s\n", item.GetString("message"))
        }
        return nil
    })

    if err != nil {
        fmt.Printf("エラー: %v\n", err)
    }

    fmt.Printf("合計 %d 行を処理しました\n", count)
}
```

### JSONL ファイルの書き込み

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Create("output.jsonl")
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    for i := 0; i < 10; i++ {
        writer.Write(map[string]any{
            "id":    i,
            "value": fmt.Sprintf("item-%d", i),
        })
    }

    stats := writer.Stats()
    fmt.Printf("%d バイトを書き込みました\n", stats.BytesWritten)
}
```

### 大規模ファイルの並列処理

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Open("large.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    var count int64
    err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
        atomic.AddInt64(&count, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("並列処理 %d 行\n", count)
}
```

---

## 関連

- [大規模ファイル処理 API](./large-file) - ForeachFile シリーズメソッド
- [大規模ファイル処理ガイド](../large-files) - 大規模ファイル処理ガイド
- [イテレータ](./iterator) - イテレーション API
