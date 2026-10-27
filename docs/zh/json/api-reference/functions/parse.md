---
sidebar_label: "解析验证"
title: "解析与验证函数 - CyberGo JSON | Valid 与 Parse 用法"
description: "解析与验证：Parse/ParseAny 解析到结构体或 any，Valid 检查有效性，ValidateSchema 按 Schema 返回全部校验错误。"
sidebar_position: 60
---

# 解析与验证函数

json 包的解析与验证函数：把 JSON 解析到目标对象、用 Processor 实例解析，以及 JSON 有效性与 JSON Schema 验证。

## 解析函数

### Parse

签名：`func Parse(jsonStr string, target any, cfg ...Config) error`

将 JSON 字符串解析到 `target` 指针指向的对象。`target` 必须是**非 nil 指针**；传 `nil` 或非指针返回参数错误。与 `Get` 一致，`Parse` 在解析前对输入执行安全校验（大小、嵌套深度、危险模式），范围受 `cfg` 与处理器配置约束。

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

将 JSON 字符串解析为根值 `any`，无需预先声明目标变量。

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

签名：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

用 Processor 实例把 JSON 解析到目标指针。

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

签名：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

用 Processor 实例解析 JSON 并返回 `any`，行为与包级 `ParseAny` 相同。

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

校验 JSON 字节切片是否有效，返回普通 `bool`。签名与 `encoding/json.Valid` 一致，现有代码换 import 即可编译；但无 cfg 调用**不只做语法检查**：它经由默认处理器的安全校验，因此语法合法但超过 `MaxJSONSize`（默认 100MB）、含非法 UTF-8 或字符串值含危险模式（如 `__proto__`、`<script`）的输入也会返回 `false`。

可选的结尾 `Config` 参数应用安全限制（大小、嵌套深度、完整安全扫描等）。传入 cfg 时，`Valid` 委托给 `Processor.Valid` 并把任何错误折叠为 `false`。需要标准库那种纯语法判断时，改用 `encoding/json.Valid`；或传 `SkipValidation: true` 的 cfg 给 `ValidWithConfig`（此时只保留大小与嵌套深度等基础检查）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	data := []byte(`{"name": "test"}`)
	// 与 encoding/json 签名一致（无 cfg）
	if json.Valid(data) {
		fmt.Println("有效 JSON")
	}

	// 带配置（可选尾参）
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

使用配置验证 JSON 字符串是否有效，并返回失败原因。

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

用 JSON Schema 验证 JSON 数据，返回全部验证错误。第二个返回值非 nil 表示校验过程本身失败（如输入不是合法 JSON、schema 为 nil），此时错误列表无意义。

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
			"name":  {Type: "string"},
			"email": {Type: "string", Format: "email"},
			"age":   {Type: "number"}, // 数值可用 "number" 或 "integer"
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

::: warning 两点注意
- `Type` 支持 `"number"` 与 `"integer"`：`"number"` 接受一切数字；`"integer"` 按 JSON Schema 语义接受**数学上为整数**的值（`1`、`1.0`、`1e2` 均通过，`1.5` 报 `expected type integer` 错误）。`Minimum`/`Maximum`/`MultipleOf` 等数值约束对两者均生效，详见 [Schema 校验](../schema#schema-约束字段总览)。
- `MinLength`/`Minimum` 等**长度/区间类约束**直接写在 `&json.Schema{...}` 字面量中不生效，必须经 [`NewSchema`](../schema#schema-的创建方式) 创建。详见 [Schema 校验](../schema)。
:::

::: tip 详见
完整的 Schema 类型定义和验证器用法请参考 [Schema 校验](../schema)。
:::

## 相关

- [查询获取函数](./query) - Get, GetString 等查询操作
- [Processor 解析方法](../processor/parse) - Processor 级解析与验证方法详解
