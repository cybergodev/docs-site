---
sidebar_label: "JSONL"
title: "JSONL 処理関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON JSONL 処理関数：ParseJSONL/ToJSONL/ToJSONLString 変換、StreamLinesInto[T] ジェネリックストリームと NewJSONLWriter ライタで、JSON Lines 形式をサポートします。"
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
