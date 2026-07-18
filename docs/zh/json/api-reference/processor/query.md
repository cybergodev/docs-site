---
sidebar_label: "查询获取"
title: "Processor 路径查询 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 路径查询：Get/GetString/GetInt 类型获取、GetMultiple 批量、SafeGet 返回 AccessResult 与 GetTyped[T] 泛型，支持 JSONPath。"
sidebar_position: 2
---

# 路径查询方法

Processor 提供多种类型安全的路径查询方法。

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

```go
// 不提供默认值
name := p.GetString(data, "user.name")

// 提供默认值
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

签名：`func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

从指定路径获取整数值。路径不存在、值为 null 或类型转换失败时返回 0 或 `defaultValue`。

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

签名：`func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

从指定路径获取浮点数值。路径不存在、值为 null 或类型转换失败时返回 0 或 `defaultValue`。

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

签名：`func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

从指定路径获取布尔值。路径不存在、值为 null 或类型转换失败时返回 false 或 `defaultValue`。

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

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

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

签名：`func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

从指定路径获取对象。路径不存在、值为 null 或类型转换失败时返回 nil 或 `defaultValue`。

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

```go
cp, _ := p.CompilePath("items[0].id")
defer cp.Release()

for _, jsonStr := range jsonStrings {
    id, err := p.GetCompiled(jsonStr, cp)
    if err != nil {
        continue
    }
    fmt.Println(id)
}
```

## 相关

- [数据修改](./modify) - Set/Delete 方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [泛型操作](../generics) - GetTyped[T] 泛型获取
