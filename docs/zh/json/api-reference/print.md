---
sidebar_label: "打印函数"
title: "打印函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 打印与格式化：使用 Encode、EncodePretty、Prettify 与标准 fmt 包输出 JSON，支持自定义缩进与前缀，替代已移除的 Print 系列。"
sidebar_position: 11
---

# 打印函数

::: warning API 变更说明
Print、PrintPretty、PrintE、PrintPrettyE 已从库中移除，不再提供。请使用以下替代方案。
:::

## 替代方案

### 打印紧凑 JSON

使用 `fmt.Println` + `EncodeWithConfig`（推荐）或 `Marshal`：

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 输出: {"age":30,"name":"Alice"}

// 或者使用 Marshal（[]byte 输出）
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning Encode 已废弃
`json.Encode` 已标记为废弃（与 `EncodeWithConfig` 功能等价），将在未来主版本移除。新代码请使用 `EncodeWithConfig` 或 `Marshal`。
:::

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

// 编码并打印（推荐 EncodeWithConfig；Encode 已废弃）
s, err := p.EncodeWithConfig(data)
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

    // 紧凑输出（Encode 已废弃，推荐 EncodeWithConfig）
    compact, err := json.EncodeWithConfig(data)
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

- [编码输出函数](./functions/output) - Encode、EncodePretty、Prettify
- [包函数](./functions/) - 包级函数总览
