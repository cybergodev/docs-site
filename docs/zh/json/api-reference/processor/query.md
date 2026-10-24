---
sidebar_label: "查询获取"
title: "Processor 路径查询 - CyberGo JSON | Get/GetString 方法用法"
description: "Processor 路径查询：Get/GetString/GetInt 类型化读取、SafeGet、GetMultiple 批量取值与 CompilePath 预编译。"
sidebar_position: 20
---

# 路径查询方法

查询方法的路径语法、返回类型与错误语义与[包级查询函数](../functions/query)一致；差异在配置来源：省略 `cfg` 时按处理器固化的配置执行，传入 `cfg` 时按该次调用执行。

::: tip 与包级函数的镜像关系
`Get`、`GetString`、`SafeGet`、`GetMultiple` 等方法与包级查询函数逐条同源，函数级示例见包级页。
:::

## 基础查询

### Get

签名：`func (p *Processor) Get(jsonStr, path string, cfg ...Config) (result any, err error)`

从指定路径获取任意类型的值。对象键不存在与数组下标越界都返回包裹 `ErrPathNotFound` 的错误，用 `errors.Is(err, json.ErrPathNotFound)` 判定；需要「缺失即默认值」时用类型化获取函数或 `SafeGet`，不要用 `Get` 的 err 分支兜底。

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
`GetString`/`GetInt` 等类型化方法的可变参数是**默认值**，不是 `Config`（Go 每个函数只允许一个可变参数）。需要按特定 `Config` 做类型化读取时，用 `New(cfg)` 构建处理器后调用其类型化方法，或改用 `SafeGet` 加 `AsInt()` 等转换方法。
:::

### GetWithContext

签名：`func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

带上下文的路径获取，是 `Get` 的上下文感知版本。

::: info 取消只在操作前后生效
`GetWithContext` 在调用 `Get` 之前检查一次 `ctx.Done()`，`Get` 返回后再检查一次。解析与路径导航过程中都不检查上下文。

- 进入时已取消或已超时：立即返回 `ctx.Err()`，不执行查询。
- 操作期间才超时：`Get` 仍会跑完，其结果被丢弃，函数返回 `ctx.Err()`。
- `Get` 自身返回错误时直接返回该错误，不再检查上下文。

因此 context 超时**不能**截断单次解析或单次查询的耗时。
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

安全获取值，返回 `AccessResult` 结构。用于先判存在、再做类型转换的场景；路径缺失与数组下标越界都返回 `Exists=false`。

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

::: tip 只有 AsString 会包装 ErrTypeMismatch
`AccessResult.AsString()` 转换失败时返回的错误满足 `errors.Is(err, ErrTypeMismatch)`；`AsInt()`、`AsFloat64()`、`AsBool()` 失败时返回普通 error，`errors.Is` 不命中该哨兵。需要统一判定时先看 `Ok()`，再按具体方法处理错误。
:::

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

一次性获取多个路径的值，返回路径到值的映射。某个路径失败时该条目为 `nil`，同时返回首个错误；其余路径仍会求值。

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

预编译路径表达式，供后续 `GetCompiled` 重复使用。重复路径会命中全局编译缓存；用完调用 `cp.Release()` 归还对象池，调用后不可再使用该 `cp`。

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

使用预编译路径获取值，适合对多条 JSON 数据重复查询同一路径。

::: warning 与 Get 的两点差异
- **不接受 per-call `cfg`**：输入校验（大小、深度、危险模式）始终按处理器自身配置执行。
- **不查结果缓存**：省掉的是路径解析开销，传入的 JSON 每次仍会解析；想连解析也复用，改用 [`PreParse`](#preparse) + `GetFromParsed`。
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

预解析 JSON 文档，返回可复用的 `*ParsedJSON`。对同一 JSON 多次查询时只解析一次，后续查询直接导航。`Data()` 返回的就是解析缓存中的树，不可修改；需要修改时用 `SetFromParsed`。

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

容器类结果（`map[string]any` / `[]any`）默认做防御性深拷贝后返回，基本类型直接返回；处理器开启 `Config.CacheSharedResults`（调用方承诺不修改返回值）时跳过拷贝。`GetFromParsed` 本身**不写结果缓存**：预解析复用的是解析树，而非查询结果。

**ParsedJSON 方法**

| 方法 | 说明 |
|------|------|
| `Data() any` | 取底层解析结果（`map[string]any` / `[]any`） |
| `Release()` | 置空内部数据引用，使解析树可被 GC（调用后 `Data()` 返回 `nil`，应配合 `defer` 使用） |

::: tip 与 CompilePath 的分工
`PreParse` 省掉「同一 JSON 的重复解析」，`CompilePath` 省掉「同一路径的重复解析」。`SetFromParsed`（见[解析验证](./parse#setfromparsed)）可在预解析结果上继续修改。选择标准见 [Processor 入门](../../getting-started/processor-guide)。
:::

## 相关

- [数据修改](./modify) - Set/Delete 方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [泛型操作](../generics) - GetTyped[T] 泛型获取
