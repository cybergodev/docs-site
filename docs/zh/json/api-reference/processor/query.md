---
sidebar_label: "查询获取"
title: "Processor 路径查询 - CyberGo JSON | Get/GetString 方法用法"
description: "CyberGo JSON 的 Processor 提供 Get/GetString/GetInt 等类型安全的路径查询方法，支持 GetMultiple 批量读取、SafeGet 安全访问与 GetTyped[T] 泛型获取，兼容 JSONPath 通配符、数组切片与默认值回退，可用 CompilePath 预编译加速重复查询，适合从深层嵌套 JSON 中精确取值的读取场景。"
sidebar_position: 20
---

# 路径查询方法

Processor 提供多种类型安全的路径查询方法。

::: tip 与包级函数的镜像关系
本页方法与[包级查询函数](../functions/query)是同一套行为的两种入口：路径语法、返回类型与错误语义完全一致。本页聚焦 Processor 侧的配置语义与复用模式，完整函数级示例见包级页。
:::

## 基础查询

### Get

签名：`func (p *Processor) Get(jsonStr, path string, cfg ...Config) (result any, err error)`

从指定路径获取任意类型的值。

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

签名：`func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

从指定路径获取字符串值。路径不存在、值为 null 或类型转换失败时返回空字符串或 `defaultValue`。

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
// 不提供默认值
name := p.GetString(data, "user.name")

// 提供默认值
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

签名：`func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

从指定路径获取整数值。路径不存在、值为 null 或类型转换失败时返回 0 或 `defaultValue`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...int` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `int` | 路径处的整数值（宽松转换）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `0`） |

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

签名：`func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

从指定路径获取浮点数值。路径不存在、值为 null 或类型转换失败时返回 0 或 `defaultValue`。

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
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

签名：`func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

从指定路径获取布尔值。路径不存在、值为 null 或类型转换失败时返回 false 或 `defaultValue`。

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
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

::: tip 类型化获取不接受 cfg
`GetString`/`GetInt` 等 typed getters 的可变参数是**默认值**而非 `Config`（Go 仅允许一个可变参数，这是官方设计的三个例外之一）。需要按 `Config` 控制的类型化读取时，用 `New(cfg)` 构建处理器后调用其 `GetString`/`GetInt` 等类型化方法，或改用 `SafeGet` + `AsInt()` 等转换方法。
:::

### GetWithContext

签名：`func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

带上下文的路径获取。支持超时和取消操作，是 `Get` 的上下文感知版本。

::: info 注意
Context 在操作前后检查，不在解析/导航过程中检查。对于大型 JSON 文档，操作期间可能不会响应取消。
:::

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := p.GetWithContext(ctx, data, "items[0].name")
if err != nil {
    panic(err)
}
fmt.Println(val)
```

## 安全查询

### SafeGet

签名：`func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

安全获取值，返回 AccessResult 结构。适用于需要类型转换的场景。

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // 类型转换失败
    }
    fmt.Println(age)
}

// 也可以获取其他类型
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**AccessResult 方法**：

| 方法 | 说明 |
|------|------|
| `Ok() bool` | 检查值是否存在 |
| `Unwrap() any` | 获取原始值 |
| `UnwrapOr(defaultValue any) any` | 获取值或默认值 |
| `AsString() (string, error)` | 安全转换为字符串 |
| `AsStringConverted() (string, error)` | 格式化转换为字符串 |
| `AsInt() (int, error)` | 安全转换为整数 |
| `AsFloat64() (float64, error)` | 安全转换为浮点数 |
| `AsBool() (bool, error)` | 安全转换为布尔值 |

## 集合获取

### GetArray

签名：`func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

从指定路径获取数组。路径不存在、值为 null 或类型转换失败时返回 nil 或 `defaultValue`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...[]any` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `[]any` | 路径处的数组（元素保持解析后的原生类型）；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `nil`） |

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

签名：`func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

从指定路径获取对象。路径不存在、值为 null 或类型转换失败时返回 nil 或 `defaultValue`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `jsonStr` | `string` | 是 | JSON 字符串 |
| `path` | `string` | 是 | 路径表达式 |
| `defaultValue` | `...map[string]any` | 否 | 可选默认值，路径不存在、值为 null 或类型转换失败时返回 |

**返回值**

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 唯一返回值 | `map[string]any` | 路径处的对象；路径不存在、值为 null 或转换失败时返回 `defaultValue`（未提供则返回零值 `nil`） |

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## 泛型获取

::: tip 包级函数
`GetTyped[T]` 是包级函数，不是 Processor 方法。详见 [泛型操作](../generics#gettyped)。
:::

```go
// 使用包级 GetTyped
user := json.GetTyped[User](data, "user")

// 带默认值
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## 批量查询

### GetMultiple

签名：`func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

一次性获取多个路径的值，返回路径到值的映射。

```go
results, err := p.GetMultiple(data, []string{"user.name", "user.age", "user.email"})
if err != nil {
    panic(err)
}
fmt.Println(results["user.name"]) // Alice
fmt.Println(results["user.age"])  // 30
```

## 编译路径

### CompilePath

签名：`func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

预编译路径表达式，用于后续快速重复操作。

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// 使用编译后的路径进行多次查询
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

签名：`func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

使用预编译路径获取值。适合对多条 JSON 数据重复查询相同路径。

::: warning 与 Get 的两点差异
- **不接受 per-call `cfg`**：输入校验（大小、深度、危险模式）始终按处理器自身配置执行。
- **不查结果缓存**：省掉的是路径解析开销，JSON 本身每次仍会解析；若想连解析也复用，配合 [`PreParse`](#preparse) 使用。
:::

**完整示例：对一批文档重复查询同一路径**

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cp, err := p.CompilePath("user.name")
	if err != nil {
		panic(err)
	}
	defer cp.Release()

	docs := []string{
		`{"user":{"name":"Alice"}}`,
		`{"user":{"name":"Bob"}}`,
	}
	for _, doc := range docs {
		name, err := p.GetCompiled(doc, cp)
		if err != nil {
			panic(err)
		}
		fmt.Println(name)
	}
}

// 输出：
// Alice
// Bob
```

## 预解析查询

### PreParse

签名：`func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

预解析 JSON 文档，返回可复用的 `*ParsedJSON`。对同一 JSON 多次查询时只解析一次，后续查询直接导航。

```go
parsed, err := p.PreParse(largeJSON)
if err != nil {
    panic(err)
}
defer parsed.Release() // 用完释放解析树引用

// 多次查询复用解析结果
name, _ := p.GetFromParsed(parsed, "user.name")
email, _ := p.GetFromParsed(parsed, "user.email")
tags, _ := p.GetFromParsed(parsed, "tags")
```

### GetFromParsed

签名：`func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

在预解析结果上按路径取值，跳过 JSON 解析步骤。

容器类结果（`map[string]any` / `[]any`）默认做防御性深拷贝后返回，基本类型直接返回；处理器开启 `Config.CacheSharedResults`（调用方承诺不修改返回值）时跳过拷贝。`GetFromParsed` 本身**不写结果缓存**——预解析复用的是解析树本身，而非查询结果。

**ParsedJSON 方法**

| 方法 | 说明 |
|------|------|
| `Data() any` | 取底层解析结果（`map[string]any` / `[]any`） |
| `Release()` | 置空内部数据引用，使解析树可被 GC（调用后 `Data()` 返回 `nil`，应配合 `defer` 使用） |

::: tip 与 CompilePath 的分工
`PreParse` 省「同一 JSON 重复解析」，`CompilePath` 省「同一路径重复解析」；`SetFromParsed`（见[解析验证](./parse#setfromparsed)）支持在预解析结果上链式修改。两者选择标准见 [Processor 入门](../../getting-started/processor-guide)。
:::

## 相关

- [数据修改](./modify) - Set/Delete 方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [泛型操作](../generics) - GetTyped[T] 泛型获取
