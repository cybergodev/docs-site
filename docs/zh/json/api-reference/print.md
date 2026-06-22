---
title: "打印函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 打印与格式化：使用 Encode、EncodePretty、Prettify 与标准 fmt 包输出 JSON，支持自定义缩进与前缀，替代已移除的 Print 系列。"
---

# 打印函数

::: warning API 变更说明
`Print`、`PrintPretty`、`PrintE`、`PrintPrettyE` 已从库中移除，不再提供。请使用以下替代方案。
:::

## 替代方案

### 打印紧凑 JSON

使用 `fmt.Println` + `Encode`：

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 输出: {"age":30,"name":"Alice"}
```

### 打印格式化 JSON

使用 `fmt.Println` + `EncodePretty`：

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 输出:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### 打印 JSON 字符串（美化已有 JSON）

使用 `Prettify`：

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

### 使用 Processor 打印

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 编码并打印
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// 格式化打印
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## 完整示例

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

    // 紧凑输出
    compact, err := json.Encode(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(compact)

    // 格式化输出
    pretty, err := json.EncodePretty(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(pretty)
}
```

## 相关

- [编码解码函数](./functions/encode-decode) - Encode、EncodePretty、Prettify
- [包函数](./functions) - 包级函数总览
