---
sidebar_label: "修改操作"
title: "Processor 数据修改 - CyberGo JSON | Set/SetMultiple 方法用法"
description: "CyberGo JSON 的 Processor 提供 Set/SetMultiple 数据修改与 SetCreate 自动创建路径，所有方法不可变地返回新 JSON 字符串并支持链式调用，配合 SetFromParsed 预解析与 MergeJSON 合并，适合连续多步修改同一份数据的写入场景。"
sidebar_position: 30
---

# 数据修改方法

Processor 提供数据修改方法，所有方法**返回修改后的新 JSON 字符串**（不可变语义，原字符串不变），支持链式调用。删除相关方法见[删除操作](./delete)。方法行为与[包级修改函数](../functions/modify)一致，本页聚焦 Processor 侧的配置语义（`CreatePaths` 优先级、`ContinueOnError`）与链式模式。

## 不可变语义

所有修改方法均返回**新的 JSON 字符串**，原始输入字符串永远不会被修改（Go 字符串本就不可变）。操作失败时返回原始字符串与错误，便于安全降级：

```go
original := `{"user":{"name":"Alice"}}`

// Set 返回新字符串，original 不变
modified, err := p.Set(original, "user.name", "Bob")
// original 仍是 {"user":{"name":"Alice"}}
// modified 是 {"user":{"name":"Bob"}}

// 失败时返回原始字符串 + 错误
result, err := p.Set(original, "nonexistent.deep.path", "x")
// result == original（当 CreatePaths=false 且路径不存在时）
```

**完整示例**

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

	original := `{"user":{"name":"Alice"}}`
	modified, err := p.Set(original, "user.name", "Bob")
	if err != nil {
		panic(err)
	}
	fmt.Println(original) // 输出：{"user":{"name":"Alice"}}
	fmt.Println(modified) // 输出：{"user":{"name":"Bob"}}
}
```

## Set

签名：`func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

设置指定路径的值，返回修改后的 JSON 字符串。是否自动创建不存在的中间路径取决于 `Config.CreatePaths`（见[CreatePaths 与 SetCreate](#createpaths-与-setcreate)）。

```go
result, err := p.Set(data, "user.name", "NewName")
```

支持设置多种类型的值：

```go
// 字符串
result, _ := p.Set(data, "user.name", "CyberGo")

// 数字
result, _ = p.Set(data, "user.age", 25)

// 布尔值
result, _ = p.Set(data, "user.active", true)

// 对象
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio":      "Developer",
    "location": "China",
})

// 数组
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

**完整示例：修改嵌套路径**

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

	data := `{"user":{"name":"Alice","address":{"city":"Beijing"}}}`
	result, err := p.Set(data, "user.address.city", "Shanghai")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"address":{"city":"Shanghai"},"name":"Alice"}}
}
```

## SetMultiple

签名：`func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个路径的值，返回修改后的 JSON 字符串。相比多次调用 `Set`，`SetMultiple` 只解析一次 JSON、在一次遍历中应用所有更新，效率更高。是否创建路径取决于 `Config.CreatePaths`。

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name":   "CyberGo",
    "user.age":    25,
    "user.active": true,
})
```

**完整示例：批量更新已有字段**

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

	data := `{"user":{"name":"Alice","age":25,"email":"a@x.com"}}`
	result, err := p.SetMultiple(data, map[string]any{
		"user.name":  "Bob",
		"user.age":   26,
		"user.email": "b@x.com",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"age":26,"email":"b@x.com","name":"Bob"}}
}
```

::: tip ContinueOnError 与确定性顺序
- 默认（`ContinueOnError=false`）遇到第一个失败路径即返回原字符串与错误；开启后跳过失败路径继续写入其余路径，仅当全部失败时才返回错误。该字段只作用于 `SetMultiple`，与 [`ProcessBatch`](./batch) 内置的逐操作隔离无关。
- 更新按**路径字典序**依次应用，重叠路径（如 `a` 与 `a.b`）结果确定：`a` 先落地，`a.b` 总写入新创建的容器，不受 map 迭代随机序影响。
:::

## SetCreate

签名：`func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

设置值并**自动创建不存在的中间路径**。是 `Set` + `CreatePaths=true` 的便捷封装，无论处理器自身配置如何都会创建路径。详见[CreatePaths 与 SetCreate](#createpaths-与-setcreate)。

**创建中间对象**

```go
// user.profile 不存在时自动创建为对象
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

**完整示例：自动创建中间对象与数组**

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

	data := `{"user":{"name":"Alice"}}`

	// 创建嵌套对象：user.profile.bio
	result, err := p.SetCreate(data, "user.profile.bio", "Developer")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"name":"Alice","profile":{"bio":"Developer"}}}

	// 创建数组：user.tags[0] 不存在时创建数组并填入索引 0
	result, err = p.SetCreate(data, "user.tags[0]", "admin")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"name":"Alice","tags":["admin"]}}
}
```

## SetMultipleCreate

签名：`func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

批量设置多个值并自动创建中间路径。是 `SetMultiple` + `CreatePaths=true` 的便捷封装。

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

**完整示例：从空对象批量创建嵌套结构**

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

	data := `{}`
	result, err := p.SetMultipleCreate(data, map[string]any{
		"user.name":        "Alice",
		"user.profile.bio": "Developer",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"user":{"name":"Alice","profile":{"bio":"Developer"}}}
}
```

## 追加数组元素

路径中使用 `[+]` 语法可在数组末尾追加元素，无需预先知道数组长度。`[+]` 必须跟在已有数组路径之后（如 `items[+]`）。

```go
data := `{"items":["a","b"]}`

// 追加单个元素
result, err := p.Set(data, "items[+]", "c")
// {"items":["a","b","c"]}

// 追加多个元素（传入切片会展开）
result, err = p.Set(data, "items[+]", []any{"c", "d"})
// {"items":["a","b","c","d"]}
```

**完整示例**

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

	data := `{"items":["a","b"]}`
	result, err := p.Set(data, "items[+]", "c")
	if err != nil {
		panic(err)
	}
	fmt.Println(result)
	// 输出：{"items":["a","b","c"]}
}
```

## CreatePaths 与 SetCreate

路径自动创建行为有两个控制入口，理解区别有助于在「按处理器配置」与「按调用强制」之间做选择：

| 方式 | 行为 | 适用场景 |
|------|------|----------|
| `Config.CreatePaths`（默认 `true`） | 处理器级开关，影响 `Set` / `SetMultiple` | 构建**专用**处理器，统一开启或关闭路径创建 |
| `SetCreate` / `SetMultipleCreate` | 强制 `CreatePaths=true`，**覆盖**处理器配置 | 偶尔需要创建路径，不想改处理器配置 |

**配置优先级**（从高到低）：

1. **`SetCreate` / `SetMultipleCreate`** —— 始终强制 `CreatePaths=true`。
2. **per-call `cfg`** —— 显式传入的 `cfg` 完全覆盖处理器设置（包括将其关闭）。
3. **处理器 `Config.CreatePaths`** —— 省略 `cfg` 时生效。

```go
// 构建一个关闭路径创建的处理器
cfg := json.DefaultConfig()
cfg.CreatePaths = false
p, _ := json.New(cfg)

// Set 遵循处理器配置：路径不存在时报错
_, err := p.Set(`{"user":{}}`, "user.profile.bio", "x") // err 非 nil

// SetCreate 强制创建：无论处理器配置如何
result, _ := p.SetCreate(`{"user":{}}`, "user.profile.bio", "x")
// {"user":{"profile":{"bio":"x"}}}

// per-call cfg 覆盖处理器设置（此处重新开启）
result, _ = p.Set(`{"user":{}}`, "user.profile.bio", "x", json.DefaultConfig())
// {"user":{"profile":{"bio":"x"}}}
```

## 链式修改

修改方法返回新字符串，可将上一步结果作为下一步输入实现链式操作：

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Processor 合并方法

Processor 提供与包级 [MergeJSON](../functions/modify#mergejson)、[MergeMany](../functions/modify#mergemany)、[CompareJSON](../helpers#comparejson) 对应的实例方法。

### Processor.MergeJSON

签名：`func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

从 cfg 解析选项，按 `Config.MergeMode` 深度合并两个对象，再用本处理器重新编码结果。**省略 cfg 时使用处理器自身配置**——`New(cfg)` 时固化的 `MergeMode` 与编码选项直接生效，无需再次传入；传入 cfg 时则按 cfg 的 `MergeMode` 执行。

与包级函数一样，`Processor.MergeJSON` 不执行安全验证——它是仅做解码、深合并、再编码的结构性工具。需要安全验证时请使用 `CompareJSON`（始终执行安全验证；传入 cfg 时按 cfg，否则按处理器自身配置）。

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 联合合并（默认）
result, err := p.MergeJSON(base, override)

// 交集合并
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

签名：`func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

通过 `MergeJSON` 从左到右折叠切片，合并策略由 `Config.MergeMode` 决定（默认 `MergeUnion`）。少于 2 个 JSON 字符串时返回错误；任一合并步骤失败时返回携带失败索引的错误。

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

签名：`func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

比较两个 JSON 字符串是否相等（数字归一化、键顺序无关）。

::: warning 与包级 CompareJSON 的差异
包级 `CompareJSON` 在无 cfg 时不执行安全验证、两侧用 `encoding/json` 编组；Processor 方法**始终**执行安全验证（传入 cfg 时按 cfg，否则按处理器自身配置），并用库编码器对两侧对称编组，使配置的编码（如 `EscapeHTML`）对称应用。
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## 相关

- [路径查询](./query) - Get 系列方法
- [删除操作](./delete) - Delete/DeleteClean 方法
- [批量操作](./batch) - ProcessBatch 批量处理
- [修改函数](../functions/modify) - 包级 Set/SetMultiple/MergeJSON 函数
