---
title: "出力関数 - CyberGo JSON | API リファレンス"
description: "CyberGo JSON 出力とフォーマットリファレンス：Encode、EncodePretty、Prettify 関数と標準 fmt パッケージを使用して JSON フォーマット出力を実現。非公開化された Print/PrintPretty 系関数の代替。カスタムインデントとプレフィックスをサポート。"
---

# 出力関数

::: warning API 変更のお知らせ
`Print`、`PrintPretty`、`PrintE`、`PrintPrettyE` は内部関数（小文字命名）に移行し、公開 API としてエクスポートされなくなりました。以下の代替案を使用してください。
:::

## 代替案

### コンパクト JSON の出力

`fmt.Println` + `Encode` を使用：

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 出力: {"age":30,"name":"Alice"}
```

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

// エンコードして出力
s, err := p.Encode(data)
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

    // コンパクト出力
    compact, err := json.Encode(data)
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

- [エンコード・デコード関数](./functions/encode-decode) - Encode、EncodePretty、Prettify
- [パッケージ関数](./functions) - パッケージレベル関数の概要
