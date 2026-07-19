---
sidebar_label: "JSONL"
title: "JSONL 処理関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON JSONL 処理関数：ParseJSONL/ToJSONL/ToJSONLString 変換、StreamJSONL/ForeachJSONL/MapJSONL/ReduceJSONL/FilterJSONL ストリーミング処理、StreamLinesInto[T] ジェネリックストリームと NewJSONLWriter ライタ。"
sidebar_position: 8
---

# JSONL 処理関数

json パッケージが提供する JSONL（JSON Lines）処理関数。改行区切りの JSON データのパース、ストリーミング読み込み、変換、書き込みをサポートします。

## JSONL 処理関数

JSONL（JSON Lines）は改行区切りの JSON フォーマットで、1行に1つの独立した JSON オブジェクトが含まれます。

### ParseJSONL

シグネチャ：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

JSONL（改行区切り JSON）データをパースします。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `data` | `[]byte` | はい | JSONL バイトデータ |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
    results, err := json.ParseJSONL([]byte(jsonl))
    if err != nil {
        panic(err)
    }
    for i, r := range results {
        fmt.Printf("[%d] %v\n", i, r)
    }
}
```

### StreamLinesInto

シグネチャ：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

io.Reader から JSONL データをストリーミング読み込みし、コールバック関数で各行を処理します。推奨されるジェネリック JSONL 処理方法です。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `reader` | `io.Reader` | はい | データソース |
| `fn` | `func(lineNum int, data T) error` | はい | 処理コールバック（行番号とデータを受け取る） |
| `cfg` | `Config` | いいえ | オプション設定 |

**戻り値**

| 型 | 説明 |
|------|------|
| `[]T` | 処理後のすべての結果スライス |
| `error` | エラー情報 |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
}

func main() {
    src := `{"name":"Alice"}
{"name":"Bob"}`

    // 基本的な使用方法
    results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
        fmt.Printf("行 %d: ユーザー %s\n", lineNum, user.Name)
        return nil // error を返すと処理を中断
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("合計 %d 件のレコードを処理\n", len(results))
}
```

### ToJSONL

シグネチャ：`func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

データスライスを JSONL フォーマットに変換します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `data` | `[]any` | はい | データスライス |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonl, err := json.ToJSONL(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(jsonl))
    // {"name":"Alice"}
    // {"name":"Bob"}
}
```

### ToJSONLString

シグネチャ：`func ToJSONLString(data []any, cfg ...Config) (string, error)`

データスライスを JSONL 文字列に変換します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `data` | `[]any` | はい | データスライス |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonlStr, err := json.ToJSONLString(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(jsonlStr)
}
```

## JSONL ストリーミング処理関数（パッケージレベル）

json パッケージが提供する JSONL ストリーミング処理パッケージレベル便捷関数。シグネチャは対応する Processor メソッドと一致し、末尾にオプションの `cfg ...Config` 引数を追加で受け取ります。内部では `cfg` ごとにキャッシュされたグローバル Processor を使用するため、インスタンスを手動作成する必要がなく、一回限りの処理シナリオに適しています。複数回の処理や同一設定の共有が必要な場合は、[`json.New(cfg)`](../processor/#new) で独立した Processor を作成することを推奨します。

完全な使用方法とサンプルは [JSONL ストリーミング処理ガイド](../../streaming/jsonl#パッケージレベル関数) および [Processor JSONL メソッド](../processor/jsonl) を参照してください。

### StreamJSONL

シグネチャ：`func StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

JSONL をストリーミングで行ごとに処理し、各行を `IterableValue` にパースしてからコールバックを呼び出します。

### StreamJSONLParallel

シグネチャ：`func StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

`workers` 個の並列 goroutine で JSONL を処理します（CPU 集約型シナリオ向け）。

### StreamJSONLParallelWithContext

シグネチャ：`func StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

コンテキストのキャンセル/タイムアウトをサポートする並列 JSONL 処理。

### StreamJSONLChunked

シグネチャ：`func StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

`chunkSize` ごとにバッチ処理し、各バッチは `[]*IterableValue` としてコールバックに渡されます。

### ForeachJSONL

シグネチャ：`func ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

JSONL を反復します（`StreamJSONL` と同じ動作のエイリアス）。

### MapJSONL

シグネチャ：`func MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error), cfg ...Config) ([]any, error)`

各行を新しい値にマッピングし、結果のスライスを返します。

### ReduceJSONL

シグネチャ：`func ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any, cfg ...Config) (any, error)`

JSONL を単一の値に畳み込みます。`initial` はアキュムレータの初期値です。

### FilterJSONL

シグネチャ：`func FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) ([]*IterableValue, error)`

述語でフィルタリングし、一致する要素のスライスを返します。

### StreamJSONLFile

シグネチャ：`func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error, cfg ...Config) error`

JSONL ファイル全体を直接ストリーミング処理します。

### CollectJSONL

シグネチャ：`func CollectJSONL(reader io.Reader, cfg ...Config) ([]*IterableValue, error)`

JSONL の全行を読み込んでスライスに収集します（注意：全量をメモリにロードします。大ファイルには `StreamJSONL` を推奨）。

### FirstJSONL

シグネチャ：`func FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool, cfg ...Config) (*IterableValue, bool, error)`

述語を満たす最初の要素を返します。第2戻り値は見つかったかどうかを示します。

## JSONL 設定

::: warning
JSONLConfig 独立構造体と `DefaultJSONLConfig()` 関数は削除されました。JSONL 設定は `Config` の `JSONL*` フィールドに統合されています。
:::

### Config による JSONL 設定

```go
cfg := json.DefaultConfig()

// JSONL 設定
cfg.JSONLBufferSize    = 64 * 1024    // 読み込みバッファサイズ (デフォルト: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // 1行の最大サイズ (デフォルト: 1MB)
cfg.JSONLSkipEmpty     = true         // 空行をスキップ (デフォルト: true)
cfg.JSONLSkipComments  = false        // コメント行をスキップ (デフォルト: false)
cfg.JSONLContinueOnErr = false        // エラー時も継続 (デフォルト: false)
cfg.JSONLWorkers       = 4            // 並列ワーカーゴルーチン数 (デフォルト: 4)
cfg.JSONLChunkSize     = 1000         // バッチあたりの処理行数 (デフォルト: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // 最大メモリ (デフォルト: 100MB)

processor, err := json.New(cfg)
```

詳しくは [Config 設定](../config#config-構造体) を参照してください。

## JSONL ライター

### NewJSONLWriter

シグネチャ：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

JSONL ライターを作成します。

```go
package main

import (
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()
    jw := json.NewJSONLWriter(file)
    jw.Write(map[string]any{"id": 1, "name": "Alice"})
    jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
```

**JSONLWriter メソッド**

| メソッド | シグネチャ | 説明 |
|------|------|------|
| `Write` | `(data any) error` | 1行書き込み |
| `WriteAll` | `(data []any) error` | 複数行書き込み |
| `WriteRaw` | `(line []byte) error` | 生バイト行の書き込み |
| `Err` | `() error` | 蓄積されたエラーを返す |
| `Stats` | `() JSONLStats` | 書き込み統計を返す |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## 関連

- [ファイル操作関数](./file-io) - LoadFromFile、SaveToFile などのファイル操作
- [Processor JSONL メソッド](../processor/jsonl) - Processor レベルの JSONL メソッドの詳細
- [ストリーミング処理](../../streaming/large-files) - ストリーミングプロセッサの詳細
