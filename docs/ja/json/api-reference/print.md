---
sidebar_label: "出力関数"
title: "出力関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 出力とフォーマット：Encode、EncodePretty、Prettify と標準 fmt パッケージで JSON を出力し、カスタムインデントとプレフィックスに対応、廃止された Print シリーズを置き換えます。"
sidebar_position: 11
---

# 出力関数

::: warning API 変更のお知らせ
Print、PrintPretty、PrintE、PrintPrettyE はライブラリから削除され、提供されなくなりました。以下の代替案を使用してください。
:::

## 代替案

### コンパクト JSON の出力

`fmt.Println` + `EncodeWithConfig`（推奨）または `Marshal` を使用：

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 出力: {"age":30,"name":"Alice"}

// または Marshal を使用（[]byte 出力）
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning Encode は非推奨
`json.Encode` は非推奨としてマークされています（`EncodeWithConfig` と機能的に等価）。将来のメジャーバージョンで削除されます。新規コードでは `EncodeWithConfig` または `Marshal` を使用してください。
:::

### フォーマット済み JSON の出力

`fmt.Println` + `EncodePretty` を使用：

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 出力:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### JSON 文字列の出力（既存の JSON を整形）

`Prettify` を使用：

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

### Processor を使用した出力

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// エンコードして出力（EncodeWithConfig を推奨、Encode は非推奨）
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// フォーマットして出力
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## 完全な例

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "users": []any{
            map[string]any{"id": 1, "name": "Alice"},
            map[string]any{"id": 2, "name": "Bob"},
        },
        "total": 2,
    }

    // コンパクト出力（Encode は非推奨、EncodeWithConfig を推奨）
    compact, err := json.EncodeWithConfig(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(compact)

    // フォーマット出力
    pretty, err := json.EncodePretty(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(pretty)
}
```

## 関連

- [エンコード出力関数](./functions/output) - Encode、EncodePretty、Prettify
- [パッケージ関数](./functions/) - パッケージレベル関数の概要
