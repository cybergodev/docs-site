---
title: "ファイル操作関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON ファイル操作関数：LoadFromReader、ParseJSONL/ToJSONL、StreamLinesInto[T]、NewJSONLWriter で大ファイルのストリーミング処理に対応します。"
---

# ファイル操作関数

json パッケージが提供するファイル操作と JSONL 処理関数。

## ファイル読み込み関数

### LoadFromFile

シグネチャ：`func LoadFromFile(filePath string, cfg ...Config) (string, error)`

ファイルから JSON データを読み込みます。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `filePath` | `string` | はい | ファイルパス |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data)
```

### SaveToFile

シグネチャ：`func SaveToFile(filePath string, data any, cfg ...Config) error`

JSON データをファイルに保存します。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `filePath` | `string` | はい | ファイルパス |
| `data` | `any` | はい | 保存するデータ |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})
if err != nil {
    panic(err)
}
```

### MarshalToFile

シグネチャ：`func MarshalToFile(filePath string, data any, cfg ...Config) error`

データをシリアライズしてファイルに書き込みます。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `filePath` | `string` | はい | ファイルパス |
| `data` | `any` | はい | シリアライズするデータ |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

シグネチャ：`func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

ファイルから読み込み、データをデシリアライズします。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `filePath` | `string` | はい | ファイルパス |
| `v` | `any` | はい | ターゲットオブジェクトのポインタ |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### LoadFromReader

シグネチャ：`func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

io.Reader から JSON データを読み込みます。ネットワーク接続、HTTP リクエストボディなどのストリーミングデータソースからの JSON 読み込みに適しています。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `reader` | `io.Reader` | はい | データソース |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
// HTTP レスポンスボディから読み込み
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// 文字列から読み込み
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

シグネチャ：`func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

JSON データを io.Writer に書き込みます。

**パラメータ**

| 名前 | 型 | 必須 | 説明 |
|------|------|------|------|
| `writer` | `io.Writer` | はい | 出力先 |
| `data` | `any` | はい | 書き込むデータ |
| `cfg` | `Config` | いいえ | オプション設定 |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

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
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

// 基本的な使用方法
results, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("行 %d: ユーザー %s\n", lineNum, user.Name)
    return nil // error を返すと処理を中断
})
if err != nil {
    panic(err)
}
fmt.Printf("合計 %d 件のレコードを処理\n", len(results))
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
jsonlStr, err := json.ToJSONLString(items)
```

## JSONL 設定

::: warning
`JSONLConfig` 独立構造体と `DefaultJSONLConfig()` 関数は削除されました。JSONL 設定は `Config` の `JSONL*` フィールドに統合されています。
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
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
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

- [エンコード・デコード関数](./encode-decode) - Marshal、Unmarshal などのシリアライズ操作
- [ストリーミング処理](../../large-files) - ストリーミングプロセッサの詳細
- [Processor JSONL メソッド](../processor/jsonl) - Processor レベルの JSONL メソッドの詳細
