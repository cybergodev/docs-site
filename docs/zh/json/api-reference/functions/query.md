---
sidebar_label: "查询获取"
title: "查询与获取函数 - CyberGo JSON | Get/GetInt 用法与示例"
description: "CyberGo JSON 是 JSONPath 路径查询的 Go 库，提供 Get/GetInt 类型安全获取、GetTyped[T] 泛型、SafeGet 安全访问与 GetMultiple 批量读取，路径缺失时自动回退默认值，GetWithContext 支持超时取消，帮助开发者稳健提取深层嵌套字段。"
sidebar_position: 20
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
	fmt.Println(val) // 输出：test
}
```

### GetWithContext

签名：`func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

带上下文的路径获取。支持超时和取消操作。`Get` 的上下文感知版本。

::: info 取消语义：边界级检查
Context 仅在**操作开始前**与**结束后**各检查一次，不在解析/导航过程中检查：

- 开始前已取消/超时：直接返回 `ctx.Err()`（`context.Canceled` / `context.DeadlineExceeded`），不执行任何解析
- 操作完成后才检测到超时：同样返回 `ctx.Err()`，即使值已成功取出也会被丢弃
- 因此本函数适合作为**调用边界的守卫**——避免在已超时的请求上继续做无用功；但解析本身无法被中途掐断，对超大 JSON 文档，超时并不能限制单次解析的耗时上界
:::

```go
package main

import (
	"context"
	"fmt"
	"github.com/cybergodev/json"
	"time"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
	if err != nil {
		panic(err)
	}
	fmt.Println(val) // 输出：Alice
}
```

## 类型安全获取函数

类型安全获取函数通过 `defaultValue` 可变参数提供零值回退。当路径不存在、值为 null 或类型转换失败时返回 `defaultValue`（未提供则返回对应类型的零值）。

### GetString

签名：`func GetString(jsonStr, path string, defaultValue ...string) string`

按路径获取字符串值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...string` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `string` | 路径处的字符串值；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `""`） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"user": {"name": "CyberGo"}}`

	name := json.GetString(jsonStr, "user.name")
	fmt.Println(name) // 输出：CyberGo

	// 不存在的路径返回零值（空字符串）或自定义默认值
	nickname := json.GetString(jsonStr, "user.nickname", "未知")
	fmt.Println(nickname) // 输出：未知
}
```

### GetInt

签名：`func GetInt(jsonStr, path string, defaultValue ...int) int`

按路径获取整数值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...int` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `int` | 路径处的整数值（宽松转换，如字符串 `"42"` 可转 `42`）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `0`） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

	count := json.GetInt(jsonStr, "pagination.count")
	fmt.Println(count) // 输出：42

	timeout := json.GetInt(jsonStr, "timeout")
	fmt.Println(timeout) // 输出：30

	// 不存在的路径返回自定义默认值
	page := json.GetInt(jsonStr, "pagination.page", 1)
	fmt.Println(page) // 输出：1
}
```

### GetFloat

签名：`func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

按路径获取浮点数值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...float64` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `float64` | 路径处的浮点数值（整数会被提升为 `float64`）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `0`） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

	price := json.GetFloat(jsonStr, "item.price")
	fmt.Println(price) // 输出：19.99

	rate := json.GetFloat(jsonStr, "rate")
	fmt.Println(rate) // 输出：0.85

	// 不存在的路径返回自定义默认值
	discount := json.GetFloat(jsonStr, "item.discount", 0.0)
	fmt.Println(discount) // 输出：0
}
```

### GetBool

签名：`func GetBool(jsonStr, path string, defaultValue ...bool) bool`

按路径获取布尔值。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...bool` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `bool` | 路径处的布尔值；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `false`） |

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	jsonStr := `{"feature": {"enabled": true}, "debug": false}`

	enabled := json.GetBool(jsonStr, "feature.enabled")
	fmt.Println(enabled) // 输出：true

	debug := json.GetBool(jsonStr, "debug")
	fmt.Println(debug) // 输出：false

	// 不存在的路径返回自定义默认值
	verbose := json.GetBool(jsonStr, "feature.verbose", false)
	fmt.Println(verbose) // 输出：false
}
```

### GetArray

签名：`func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

按路径获取数组。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...[]any` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `[]any` | 路径处的数组（元素保持解析后的原生类型，数字默认为 `float64`）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `nil`） |

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
	fmt.Println(empty) // 输出：[default]
}
```

### GetObject

签名：`func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

按路径获取对象。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...map[string]any` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `map[string]any` | 路径处的对象（数字默认为 `float64`）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `nil`） |

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
	fmt.Println(settings) // 输出：map[theme:dark]
}
```

## 泛型获取函数

### GetTyped[T]

签名：`func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

泛型获取函数，支持自定义类型。当路径不存在、值为 null 或类型转换失败时返回 `defaultValue`（未提供则返回 `T` 的零值）。

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
	fmt.Println(name) // 输出：CyberGo

	age := json.GetTyped[int](jsonStr, "user.age")
	fmt.Println(age) // 输出：30

	// 不存在的路径返回自定义默认值
	email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
	fmt.Println(email) // 输出：unknown@example.com
}
```

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
		fmt.Println(age) // 输出：30
	}

	nameResult := json.SafeGet(jsonStr, "user.name")
	name, _ := nameResult.AsString()
	fmt.Println(name) // 输出：CyberGo
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
    fmt.Println(age) // 输出：30
}
```

::: tip 选型：GetTyped 系列还是 SafeGet
- **Config 支持**：`GetString`/`GetInt`/`GetTyped[T]` 等类型化函数**无法接收 Config**——可变参数已被 `defaultValue` 占用（Go 每个函数仅允许一个可变参数），它们固定使用默认处理器。需要按调用定制安全限制、校验或缓存时，改用 `SafeGet(jsonStr, path, cfg)`，或 `json.New(cfg)` 创建专用 Processor 后调用其 `GetString` 等方法。
- **转换宽松度**：类型化函数走宽松转换（字符串 `"42"` 可转 `int`、布尔 `true` 转 `1`）；`SafeGet` 的 `AsInt`/`AsFloat64` 拒绝布尔输入，`AsString` 要求原值就是 string（需要显式字符串化时用 `AsStringConverted`）。
- **错误语义**：类型化函数**静默回退**到默认值/零值；`SafeGet` 保留「是否存在」（`Exists`/`Ok()`）与「转换失败」（`AsInt`/`AsString` 等转换方法返回 error）两类信息，便于区分处理。
:::

## Processor 扩展方法

以下方法同时作为包级函数和 Processor 方法提供。

### GetMultiple（包级函数）

签名：`func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

批量获取多个路径的值（包级函数，无需创建 Processor）。

**返回值语义**

- 整份 JSON 只解析**一次**，再对每个路径求值（比多次调用 `Get` 高效）
- 返回的 map 以**路径字符串本身**为键（如 `"user.name"`），与输入 `paths` 一一对应
- **部分失败**：某条路径取值失败时，该键在 map 中为 `nil`，同时函数返回**第一个**遇到的错误（`map` 与 `err` 同时非 nil）——已成功路径的结果仍可使用
- 任一路径**语法非法**则整体失败（返回 `nil, err`）；`paths` 为空切片时返回空 map 与 `nil`

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // 输出：CyberGo
```

**部分失败示例**（失败路径为 nil，但成功路径仍可用）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "CyberGo", "age": 30}}`

	values, err := json.GetMultiple(data, []string{"user.name", "user.missing"})
	fmt.Println(values["user.name"])    // 输出：CyberGo（成功路径不受影响）
	fmt.Println(values["user.missing"]) // 输出：<nil>（失败路径为 nil）
	fmt.Println(err != nil)             // 输出：true（部分失败时 err 非 nil）
}
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
fmt.Println(values["user.name"]) // 输出：CyberGo
```

## 错误处理

`Get`/`GetWithContext` 的失败用哨兵错误区分，`errors.Is` 判别；类型化函数（`GetString` 等）不返回错误，静默落到零值/默认值：

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := `{"user": {"name": "Alice"}}`

	if _, err := json.Get(data, "user.age"); errors.Is(err, json.ErrPathNotFound) {
		fmt.Println("路径不存在，走默认值逻辑")
	}
	if _, err := json.Get(`{"name": "x"}`, "name[0]"); errors.Is(err, json.ErrTypeMismatch) {
		fmt.Println("类型不匹配：字符串不支持下标")
	}
	if _, err := json.Get(`{"name": }`, "name"); errors.Is(err, json.ErrInvalidJSON) {
		fmt.Println("输入不是合法 JSON")
	}
}
```

::: tip 性能入口
同一路径反复查询时用 [`CompilePath`/`GetCompiled`](../processor/query#compilepath)；同一 JSON 多路径查询用 [`PreParse`/`GetFromParsed`](../processor/query#preparse)，均见 Processor 查询参考。
:::

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

- [解析与验证函数](./parse) - Parse, Valid, ValidateSchema 等解析与验证操作
- [批量操作函数](./batch) - ProcessBatch 批量处理
- [修改函数](./modify) - Set, Delete 等修改操作
- [编码输出](./output) - Marshal, Unmarshal 等序列化操作
- [辅助函数](../helpers) - CompareJSON, MergeJSON 等工具函数
- [配置选项](../config) - Config 配置详解
