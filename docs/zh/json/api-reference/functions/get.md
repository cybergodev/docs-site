---
title: "查询与获取函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 查询与获取函数：Get/GetString/GetInt/GetFloat/GetBool 类型安全获取、GetTyped[T] 泛型与 Parse/ParseAny 解析，全面支持 JSONPath。"
---

# 查询与获取函数

json 包提供的查询和获取函数，支持路径表达式、类型安全获取和批量操作。

## 路径查询函数

### Get

签名：`func Get(jsonStr, path string, cfg ...Config) (any, error)`

按路径获取任意类型的值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `cfg` | `Config` | 否 | 可选配置 |

**示例**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    val, err := json.Get(`{"items":[{"name":"test"}]}`, "items[0].name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 输出: test
}
```

### GetWithContext

签名：`func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

带上下文的路径获取。支持超时和取消操作。`Get` 的上下文感知版本。

::: info 注意
Context 在操作前后检查，不在解析/导航过程中检查。对于大型 JSON 文档，操作期间可能不会响应取消。
:::

```go
package main

import (
    "context"
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // 输出: Alice
}
```

## 类型安全获取函数

类型安全获取函数通过 `defaultValue` 可变参数提供零值回退。当路径不存在、值为 null 或类型转换失败时返回 `defaultValue`（未提供则返回对应类型的零值）。

### GetString

签名：`func GetString(jsonStr, path string, defaultValue ...string) string`

按路径获取字符串值。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo"}}`

    name := json.GetString(jsonStr, "user.name")
    fmt.Println(name) // 输出: CyberGo

    // 不存在的路径返回零值（空字符串）或自定义默认值
    nickname := json.GetString(jsonStr, "user.nickname", "未知")
    fmt.Println(nickname) // 输出: 未知
}
```

### GetInt

签名：`func GetInt(jsonStr, path string, defaultValue ...int) int`

按路径获取整数值。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

    count := json.GetInt(jsonStr, "pagination.count")
    fmt.Println(count) // 输出: 42

    timeout := json.GetInt(jsonStr, "timeout")
    fmt.Println(timeout) // 输出: 30

    // 不存在的路径返回自定义默认值
    page := json.GetInt(jsonStr, "pagination.page", 1)
    fmt.Println(page) // 输出: 1
}
```

### GetFloat

签名：`func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

按路径获取浮点数值。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

    price := json.GetFloat(jsonStr, "item.price")
    fmt.Println(price) // 输出: 19.99

    rate := json.GetFloat(jsonStr, "rate")
    fmt.Println(rate) // 输出: 0.85

    // 不存在的路径返回自定义默认值
    discount := json.GetFloat(jsonStr, "item.discount", 0.0)
    fmt.Println(discount) // 输出: 0
}
```

### GetBool

签名：`func GetBool(jsonStr, path string, defaultValue ...bool) bool`

按路径获取布尔值。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"feature": {"enabled": true}, "debug": false}`

    enabled := json.GetBool(jsonStr, "feature.enabled")
    fmt.Println(enabled) // 输出: true

    debug := json.GetBool(jsonStr, "debug")
    fmt.Println(debug) // 输出: false

    // 不存在的路径返回自定义默认值
    verbose := json.GetBool(jsonStr, "feature.verbose", false)
    fmt.Println(verbose) // 输出: false
}
```

### GetArray

签名：`func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

按路径获取数组。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"items": ["apple", "banana", "cherry"]}`

    items := json.GetArray(jsonStr, "items")
    for i, item := range items {
        fmt.Printf("[%d] %v\n", i, item)
    }

    // 不存在的路径返回自定义默认值
    empty := json.GetArray(jsonStr, "tags", []any{"default"})
    fmt.Println(empty) // 输出: [default]
}
```

### GetObject

签名：`func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

按路径获取对象。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"profile": {"name": "CyberGo", "level": 5}}}`

    profile := json.GetObject(jsonStr, "user.profile")
    fmt.Println(profile) // map[level:5 name:CyberGo]

    // 不存在的路径返回自定义默认值
    settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
    fmt.Println(settings) // 输出: map[theme:dark]
}
```

## 泛型获取函数

### GetTyped[T]

签名：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

泛型获取函数，支持自定义类型。当路径不存在或类型转换失败时返回 `defaultValue`（未提供则返回 `T` 的零值）。

**命名约定说明**：`GetTyped[T]` 等同于 `GetAs[T]` 语义，表示将 JSON 值获取并转换为指定类型 `T`。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    // 获取类型化结构体
    user := json.GetTyped[User](jsonStr, "user")
    fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

    // 内置类型示例
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // 输出: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // 输出: 30

    // 不存在的路径返回自定义默认值
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // 输出: unknown@example.com
}
```

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

签名：`func Valid(data []byte) bool`

验证 JSON 字节切片是否有效。100% 兼容 `encoding/json.Valid`。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    if json.Valid(data) {
        fmt.Println("有效 JSON")
    }
}
```

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
完整的 Schema 类型定义和验证器用法请参考 [验证器](../validator)。
:::

## 安全获取函数

### SafeGet（包级函数）

签名：`func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

执行类型安全的获取操作，返回 `AccessResult`，提供类型转换方法（`AsString`, `AsInt`, `AsFloat64`, `AsBool`）。

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    result := json.SafeGet(jsonStr, "user.age")
    if result.Exists {
        age, _ := result.AsInt()
        fmt.Println(age) // 输出: 30
    }

    nameResult := json.SafeGet(jsonStr, "user.name")
    name, _ := nameResult.AsString()
    fmt.Println(name) // 输出: CyberGo
}
```

### SafeGet（Processor 方法）

签名：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

通过 Processor 实例执行类型安全的获取操作。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

result := p.SafeGet(jsonStr, "user.age")
if result.Exists {
    age, _ := result.AsInt()
    fmt.Println(age) // 输出: 30
}
```

## Processor 扩展方法

以下方法同时作为包级函数和 Processor 方法提供。

### GetMultiple（包级函数）

签名：`func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

批量获取多个路径的值（包级函数，无需创建 Processor）。

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 输出: CyberGo
```

### Processor.GetMultiple

签名：`func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

批量获取多个路径的值。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := p.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 输出: CyberGo
```

### Processor.ProcessBatch

签名：`func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

批量处理多个 JSON 操作。

**BatchOperation 字段**：`Type string`、`JSONStr string`、`Path string`、`Value any`、`ID string`

**BatchResult 字段**：`ID string`、`Result any`、`Error error`

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := p.ProcessBatch(operations)
if err != nil {
    panic(err)
}
for _, r := range results {
    if r.Error != nil {
        fmt.Printf("操作 %s 失败: %v\n", r.ID, r.Error)
    } else {
        fmt.Printf("操作 %s 结果: %v\n", r.ID, r.Result)
    }
}
```

## 相关类型

### AccessResult

`SafeGet` 使用的 `AccessResult` 结构体字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Value` | `any` | 获取到的值 |
| `Exists` | `bool` | 路径是否存在 |
| `Type` | `string` | 检测到的值类型 |

**方法**：`Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

详见 [AccessResult 类型](../types#accessresult-属性访问结果)。

### Result[T]

`Result[T]` 泛型结构体字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `Value` | `T` | 获取到的值 |
| `Exists` | `bool` | 值是否被找到 |
| `Error` | `error` | 错误信息 |

## 相关

- [修改函数](./modify) - Set, Delete 等修改操作
- [编码解码](./encode-decode) - Marshal, Unmarshal 等序列化操作
- [辅助函数](../helpers) - CompareJSON, MergeJSON 等工具函数
- [配置选项](../config) - Config 配置详解
