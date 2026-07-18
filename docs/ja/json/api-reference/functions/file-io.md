---
sidebar_label: "ファイル I/O"
title: "ファイル操作 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON ファイル操作関数：LoadFromFile/SaveToFile 読み書き、LoadFromReader/SaveToWriter ストリーム I/O、MarshalToFile/UnmarshalFromFile シリアライズに対応します。"
sidebar_position: 9
---

# ファイル操作関数

json パッケージが提供するファイル操作関数。ファイル読み書きとストリーミング I/O をサポートします。

## ファイル読み込み関数

### LoadFromFile

シグネチャ：`func LoadFromFile(filePath string, cfg ...Config) (string, error)`

ファイルから JSON データをロードします。

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

ファイルからデータを読み込んでデシリアライズします。

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

io.Reader から JSON データをロードします。ネットワーク接続、HTTP リクエストボディなどのストリーミングデータソースから JSON を読み込むのに適しています。

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

## 関連

- [JSONL 処理関数](./jsonl) - ParseJSONL、StreamLinesInto などの改行区切り JSON 処理
- [エンコード出力関数](./output) - Marshal、Unmarshal などのシリアライズ操作
- [ストリーミング処理](../../streaming/large-files) - ストリーミングプロセッサの詳細
