---
sidebar_label: "解析验证"
title: "解析与验证函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 解析与验证函数：Parse/ParseAny 解析、Valid/ValidWithConfig 校验与 ValidateSchema 的 JSON Schema 验证，覆盖完整处理链路。"
sidebar_position: 6
---

# 解析与验证函数

json 包提供的解析和验证函数，支持将 JSON 解析到目标对象、通过 Processor 实例解析，以及 JSON 有效性验证和 JSON Schema 验证。

## 解析函数

### Parse

签名：`func Parse(jsonStr string, target any, cfg ...Config) error`

将 JSON 字符串解析到 `target` 指针所指向的对象中。`target` 必须是一个指针。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `target` | `any` | 是 | 目标对象指针 |
| `cfg` | `Config` | 否 | 可选配置 |

**基本解析**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data)
    if err != nil {
        panic(err)
    }
    fmt.Println(data) // map[name:test]
}
```

**解析到结构体**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    var person Person
    err := json.Parse(`{"name": "CyberGo", "age": 30}`, &person)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Name: %s, Age: %d\n", person.Name, person.Age)
}
```

**使用自定义配置**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data, cfg)
    if err != nil {
        panic(err)
    }
    fmt.Println(data)
}
```

### ParseAny

签名：`func ParseAny(jsonStr string, cfg ...Config) (any, error)`

将 JSON 字符串解析并返回根值为 `any` 类型，无需预先声明目标变量。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    result, err := json.ParseAny(`{"name": "test"}`)
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // map[name:test]
}
```

::: tip Parse vs ParseAny
- `Parse(jsonStr, &target)` — 解析到目标指针，需要预先声明变量
- `ParseAny(jsonStr)` — 直接返回 `any` 类型，无需预先声明
:::

### Processor.Parse

**签名**：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

通过 Processor 实例解析 JSON 到目标指针。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

var data map[string]any
err = p.Parse(`{"name": "test"}`, &data)
if err != nil {
    panic(err)
}
```

### Processor.ParseAny

**签名**：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

通过 Processor 实例解析 JSON 并返回 `any` 类型，行为与包级 `ParseAny` 相同。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

详见 [Processor 解析方法](../processor/parse#解析方法)。

## 验证函数

### Valid

签名：`func Valid(data []byte, cfg ...Config) bool`

验证 JSON 字节切片是否有效。100% 兼容 `encoding/json.Valid`：无 cfg 调用 `json.Valid(data)` 与标准库完全一致，返回普通 `bool`。

通过可选的尾随 `Config` 可应用安全限制（大小、嵌套深度、完整安全扫描等）。传入 cfg 时，`Valid` 委托给 `Processor.Valid` 并将任何错误折叠为 `false`。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    // 兼容 encoding/json（无 cfg）
    if json.Valid(data) {
        fmt.Println("有效 JSON")
    }

    // 带配置（非破坏性可选参数）
    if json.Valid(data, json.SecurityConfig()) {
        fmt.Println("通过安全验证")
    }
}
```

::: tip Valid vs ValidWithConfig
- `Valid(data, cfg)` 返回单个 `bool`（兼容 `encoding/json`），任何错误折叠为 `false`
- `ValidWithConfig(jsonStr, cfg)` 返回 `(bool, error)`，便于检查验证失败原因

两者都接受 `cfg`；命名差异是历史遗留。
:::

### ValidWithConfig

签名：`func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

使用配置验证 JSON 字符串是否有效，并返回可能的错误信息。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    valid, err := json.ValidWithConfig(`{"name": "test"}`, cfg)
    if err != nil {
        panic(err)
    }
    if valid {
        fmt.Println("有效 JSON")
    }
}
```

### ValidateSchema

签名：`func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

使用 JSON Schema 验证 JSON 数据。返回所有验证错误的列表。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name":  {Type: "string", MinLength: 1},
            "email": {Type: "string", Format: "email"},
            "age":   {Type: "integer", Minimum: 0},
        },
    }

    errors, err := json.ValidateSchema(`{"name":"Alice","email":"alice@example.com","age":25}`, schema)
    if err != nil {
        panic(err)
    }
    for _, e := range errors {
        fmt.Printf("路径 %s: %s\n", e.Path, e.Message)
    }
}
```

::: tip 详见
完整的 Schema 类型定义和验证器用法请参考 [验证器](../../extensions/validator)。
:::

## 相关

- [查询获取函数](./query) - Get, GetString 等查询操作
- [Processor 解析方法](../processor/parse) - Processor 级解析与验证方法详解
