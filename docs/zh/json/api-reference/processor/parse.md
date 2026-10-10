---
sidebar_label: "解析验证"
title: "Processor 解析与验证 - CyberGo JSON | Parse 与 Valid"
description: "CyberGo JSON 的 Processor 提供 Valid/ValidBytes 验证与 Parse/ParseAny 解析，错误携带具体失败原因；PreParse 预解析配合 GetFromParsed 加速重复查询，支持 PreserveNumbers 高精度数字，适合严格校验外部输入并反复查询同一文档的读取场景。"
sidebar_position: 60
---

# 解析与验证方法

Processor 提供 JSON 解析与有效性验证方法。文件读写与流式加载见[文件操作](./file-io)。解析/验证行为与[包级解析函数](../functions/parse)镜像一致；包级 `Valid` 返回单个 `bool`（标准库兼容），需要失败原因时用本页的 `Valid` 或包级 `ValidWithConfig`。

## 验证方法

### Valid

签名：`func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

验证 JSON 字符串是否有效。合法时返回 `(true, nil)`；非法时返回 `(false, error)`，错误携带具体原因。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	cases := []string{
		`{"name":"CyberGo","age":25}`,
		`{"name":}`,
	}
	for _, c := range cases {
		valid, err := p.Valid(c)
		fmt.Printf("valid=%-5v 有错误=%v\n", valid, err != nil)
	}
}

// 输出：
// valid=true  有错误=false
// valid=false 有错误=true
```

### ValidBytes

签名：`func (p *Processor) ValidBytes(data []byte) bool`

验证字节切片是否为有效 JSON，仅返回布尔值（与 `encoding/json.Valid` 签名兼容，适合不需要错误详情的快速判定）。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	fmt.Println(p.ValidBytes([]byte(`{"ok":true}`))) // true
	fmt.Println(p.ValidBytes([]byte(`{not json}`)))  // false
}

// 输出：
// true
// false
```

## 解析方法

### Parse

签名：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

解析 JSON 字符串到目标变量，`target` 必须是非空指针。支持解析到 `map[string]any`、结构体或 `any`，并可通过 `Config` 切换数字保留模式。

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
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"name":"CyberGo","age":25}`

	// 解析到 map[string]any（数字默认为 float64）
	var obj map[string]any
	if err := p.Parse(data, &obj); err != nil {
		panic(err)
	}
	fmt.Printf("map: name=%v age=%T(%v)\n", obj["name"], obj["age"], obj["age"])

	// 解析到结构体
	var u User
	if err := p.Parse(data, &u); err != nil {
		panic(err)
	}
	fmt.Printf("struct: %+v\n", u)
}

// 输出：
// map: name=CyberGo age=float64(25)
// struct: {Name:CyberGo Age:25}
```

### ParseAny

签名：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

解析 JSON 字符串并直接以 `any` 返回根值，无需预先声明目标类型。内部等价于 `Parse(jsonStr, &v)`。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data, err := p.ParseAny(`{"name":"CyberGo","age":25}`)
	if err != nil {
		panic(err)
	}
	obj := data.(map[string]any)
	fmt.Printf("name=%v age=%v\n", obj["name"], obj["age"])
}

// 输出：
// name=CyberGo age=25
```

### PreserveNumbers 模式

默认（`PreserveNumbers=false`）所有 JSON 数字都解析为 `float64`，这会丢失大整数精度并改变小数书写形式。开启 `PreserveNumbers=true` 后，数字保留为库内 `Number` 类型（`%T` 打印为 `json.Number`——库包名与标准库同名；底层即原始字符串，API 与标准库 `json.Number` 完全一致），完整保留原文格式与精度，适合金额、大整数、科学计数法等场景。下例用 `%T` 直观展示两种模式下数字的 Go 类型差异：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"id":42,"price":19.99}`

	// 默认模式：所有数字解析为 float64
	var def any
	if err := p.Parse(data, &def); err != nil {
		panic(err)
	}
	defM := def.(map[string]any)
	fmt.Printf("默认   : id 类型=%T 值=%v\n", defM["id"], defM["id"])

	// PreserveNumbers 模式：数字保留为 json.Number
	cfg := json.DefaultConfig()
	cfg.PreserveNumbers = true
	var preserved any
	if err := p.Parse(data, &preserved, cfg); err != nil {
		panic(err)
	}
	preM := preserved.(map[string]any)
	fmt.Printf("保留数字: id 类型=%T 值=%v\n", preM["id"], preM["id"])
}

// 输出：
// 默认   : id 类型=float64 值=42
// 保留数字: id 类型=json.Number 值=42
```

::: tip 何时开启
处理金融金额、超过 `float64` 精确表示范围（约 ±2^53，即 9007199254740992）的整数、或需要原样回写数字（避免 `19.99` 与 `19.990000` 互相转化）时，建议开启 `PreserveNumbers`。例如 `9007199254740993`（2^53+1）在默认模式下会被舍入成 `9007199254740992`，而 `json.Number` 模式下保持原值不变。注意 `json.Number` 需用 `.Int64()` / `.Float64()` / `.String()` 显式取值。
:::

## 预解析优化（PreParse）

当需要对**同一份 JSON** 进行多次路径查询时，逐次调用 [`Get`](./query) 会重复解析整篇文档。`PreParse` 只解析一次，随后 `GetFromParsed` 直接在已解析的数据结构上导航，省去重复解析开销。

### PreParse

签名：`func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

预解析 JSON 并返回可复用的 `*ParsedJSON`。用完应调用 `parsed.Release()` 释放对处理器的引用。

### GetFromParsed

签名：`func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

从预解析数据中按路径取值，跳过 JSON 解析、直接做路径导航。

### 完整对比示例

下例对比「多次包级 `Get`（每次重新解析）」与「`PreParse` + `GetFromParsed`（只解析一次）」两种方式，二者结果一致，但后者在查询次数多/文档大时显著更快：

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	data := `{"user":{"name":"CyberGo","age":25},"meta":{"version":2,"env":"prod"}}`

	// 方式一：每次包级 Get 都要重新解析 JSON
	name1, err := json.Get(data, "user.name")
	if err != nil {
		panic(err)
	}
	age1, err := json.Get(data, "user.age")
	if err != nil {
		panic(err)
	}
	ver1, err := json.Get(data, "meta.version")
	if err != nil {
		panic(err)
	}

	// 方式二：PreParse 解析一次，GetFromParsed 复用解析结果（推荐用于多次查询）
	parsed, err := p.PreParse(data)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	name2, err := p.GetFromParsed(parsed, "user.name")
	if err != nil {
		panic(err)
	}
	age2, err := p.GetFromParsed(parsed, "user.age")
	if err != nil {
		panic(err)
	}
	ver2, err := p.GetFromParsed(parsed, "meta.version")
	if err != nil {
		panic(err)
	}

	fmt.Println("Get     :", name1, age1, ver1)
	fmt.Println("PreParse:", name2, age2, ver2)
}

// 输出：
// Get     : CyberGo 25 2
// PreParse: CyberGo 25 2
```

### SetFromParsed

签名：`func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

在预解析数据上设置值，返回一个**新的** `*ParsedJSON`（内部深拷贝，原数据保持不变），可在新结果上继续 `GetFromParsed` 查询。

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
)

func main() {
	p, err := json.New(json.DefaultConfig())
	if err != nil {
		panic(err)
	}
	defer p.Close()

	parsed, err := p.PreParse(`{"user":{"name":"CyberGo","age":25}}`)
	if err != nil {
		panic(err)
	}
	defer parsed.Release()

	// SetFromParsed 返回新的 ParsedJSON，原数据保持不变
	modified, err := p.SetFromParsed(parsed, "user.name", "Bob")
	if err != nil {
		panic(err)
	}
	defer modified.Release()

	oldName, _ := p.GetFromParsed(parsed, "user.name")
	newName, _ := p.GetFromParsed(modified, "user.name")
	ageAfter, _ := p.GetFromParsed(modified, "user.age")
	fmt.Println("原数据 name :", oldName)
	fmt.Println("修改后 name :", newName)
	fmt.Println("修改后 age :", ageAfter)
}

// 输出：
// 原数据 name : CyberGo
// 修改后 name : Bob
// 修改后 age : 25
```

### ParsedJSON 类型

`ParsedJSON` 封装已解析的数据与缓存信息，字段不导出，仅暴露两个方法：

| 方法 | 说明 |
|------|------|
| `Data() any` | 返回底层已解析数据（通常为 `map[string]any` 或 `[]any`） |
| `Release()` | 释放对处理器的引用；调用后 `Data()` 返回 `nil`，应配合 `defer` 使用 |

## 方法选择指南

| 场景 | 推荐方法 | 输入 | 输出 |
|------|----------|------|------|
| 仅判定是否合法（不要错误详情） | `ValidBytes` | `[]byte` | `bool` |
| 判定合法性并获取失败原因 | `Valid` | `string` | `(bool, error)` |
| 解析到结构体/具体类型 | `Parse` | `string` | 写入 `target` 指针 |
| 解析到 `any`（无需预声明类型） | `ParseAny` | `string` | `any` |
| `encoding/json` 兼容（`[]byte` 输入） | [`Unmarshal`](./output#unmarshal) | `[]byte` | 写入 `target` 指针 |
| 同一 JSON 多次路径查询 | `PreParse` + `GetFromParsed` | `string` | `*ParsedJSON` / `any` |
| 修改已解析数据后继续查询 | `PreParse` + `SetFromParsed` + `GetFromParsed` | `string` | `*ParsedJSON` |
| 保留数字原始精度 | 上述任一解析方法 + `Config{PreserveNumbers: true}` | — | 数字为 `json.Number` |

::: tip Parse vs ParseAny vs Unmarshal
- **`Unmarshal(data, &v)`**：与标准库 `encoding/json` 完全兼容，输入是 `[]byte`，适合直接替换标准库或处理网络/文件字节流。
- **`Parse(jsonStr, &v)`**：输入是 `string`，语义与 `Unmarshal` 一致，但原生支持 `Config`（安全限制、`PreserveNumbers` 等），是日常解析的首选。
- **`ParseAny(jsonStr)`**：无需预声明目标类型，直接返回 `any`，适合结构未知或一次性取值的场景。

三者底层解析能力等价，差别仅在输入类型与是否需要预先准备目标变量。
:::

## 相关

- [文件操作](./file-io) - LoadFromFile/SaveToFile 等文件方法
- [输出方法](./output) - Encode/EncodePretty/Unmarshal 编码方法
- [路径查询](./query) - Get 系列方法
- [包级解析函数](../functions/parse) - 无需 Processor 的 Parse/ParseAny/Valid
