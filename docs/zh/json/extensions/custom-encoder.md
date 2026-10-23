---
sidebar_label: "自定义编码器"
title: "CustomEncoder - CyberGo JSON | 自定义类型编码"
description: "CyberGo JSON 自定义编码器指南：实现 json.Marshaler 或 TextMarshaler 接口为 Go 类型定制 JSON 形态，配合 Config.CustomEscapes 字符转义与 time.Time 内置格式，与标准库通用、可跨库复用、移植性最佳，并附完整可运行示例。"
sidebar_position: 30
---

# 自定义编码器

json 库与标准库 `encoding/json` 保持编码兼容，因此自定义类型的 JSON 形态主要通过实现标准库接口来完成。本页介绍**当前版本实际生效**的编码扩展点：

- [`json.Marshaler`](#json-marshaler-接口) —— 类型自定义其 JSON 编码
- [`encoding.TextMarshaler`](#encoding-textmarshaler-接口) —— 类型自定义其文本编码（输出为 JSON 字符串）
- [`time.Time`](#time-time-的内置处理) —— 库内置的 RFC3339Nano 时间格式
- [`Config.CustomEscapes`](#自定义字符转义-customescapes) —— 自定义字符转义映射

::: tip 接口优先
对「某个类型如何编码」的需求，优先实现 `MarshalJSON` 或 `MarshalText`；这类实现可被本库、标准库 `encoding/json` 以及任何兼容库共用，可移植性最强。
:::

## json.Marshaler 接口

实现 `MarshalJSON() ([]byte, error)` 的类型可以完全决定自己的 JSON 表示。库在编码时会优先调用该方法（值接收者与指针接收者均支持），与标准库 `encoding/json` 行为一致。

接口签名（与 `encoding/json.Marshaler` 兼容）：

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

下面定义一个 Hex 类型，把 `uint64` 编码为带 `0x` 前缀的十六进制字符串：

```go
package main

import (
	"fmt"
	"strconv"

	"github.com/cybergodev/json"
)

// Hex 将 uint64 包装为十六进制表示的类型。
type Hex uint64

// MarshalJSON 实现 json.Marshaler，将数值编码为 "0x.." 字符串。
func (h Hex) MarshalJSON() ([]byte, error) {
	return []byte(`"0x` + strconv.FormatUint(uint64(h), 16) + `"`), nil
}

func main() {
	type Device struct {
		ID    Hex    `json:"id"`
		Label string `json:"label"`
	}
	d := Device{ID: Hex(255), Label: "sensor-1"}

	out, err := json.Marshal(d)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// 输出：{"id":"0xff","label":"sensor-1"}
}
```

::: warning 避免无限递归
在 `MarshalJSON` 内部若需要「常规编码」辅助，请使用标准库 `stdjson.Marshal` 或针对一个**不同的具体类型**调用本库。直接对本类型再次调用 `Marshal` 会重新进入 `MarshalJSON`，形成无限递归。
:::

::: tip 错误与特殊类型
`MarshalJSON`/`MarshalText` 返回的错误会被包装为 `MarshalerError`（保留 `errors.As`/`Unwrap` 能力）向上传播；返回值必须是合法 JSON。另有两个与标准库一致的特殊处理：`[]byte` 编码为 base64 字符串（`[N]byte` 数组不会）；实现 `MarshalText` 的类型也会被用作 map 键的编码形式。
:::

## encoding.TextMarshaler 接口

未实现 `MarshalJSON` 但实现了 `MarshalText() ([]byte, error)` 的类型，会被编码为以文本内容为值的 JSON 字符串（自动补引号与转义）。适合用文本即可完整表达形态的类型。

接口签名（与 `encoding.TextMarshaler` 兼容）：

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

下面定义一个 Slug 类型，编码时自动规范化为小写连字符形式：

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

// Slug 表示 URL 友好的短文本。
type Slug string

// MarshalText 实现 encoding.TextMarshaler，输出规范化后的文本。
func (s Slug) MarshalText() ([]byte, error) {
	return []byte(strings.ToLower(strings.ReplaceAll(string(s), " ", "-"))), nil
}

func main() {
	type Article struct {
		Title string `json:"title"`
		Slug  Slug   `json:"slug"`
	}
	a := Article{Title: "Hello World", Slug: Slug("Hello World")}

	out, err := json.Marshal(a)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// 输出：{"title":"Hello World","slug":"hello-world"}
}
```

::: tip 两种接口的优先级
同一类型若同时实现两个接口，`MarshalJSON` 优先于 `MarshalText`。若需要把类型编码为 JSON 字符串，实现 `MarshalText` 通常更简洁（无需自行处理引号与转义）。
:::

## time.Time 的内置处理

`time.Time` 无需任何配置即可正确编码：它自身实现了 `MarshalJSON`（值接收者，输出 RFC3339Nano，保留亚秒精度），库通过上文的 [`json.Marshaler`](#json-marshaler-接口) 机制直接采用，行为与标准库 `encoding/json` 一致。

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/json"
)

func main() {
	type Event struct {
		Name string    `json:"name"`
		At   time.Time `json:"at"`
	}
	t := time.Date(2026, 1, 15, 10, 30, 0, 0, time.UTC)
	e := Event{Name: "deploy", At: t}

	out, err := json.Marshal(e)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))
	// 输出：{"name":"deploy","at":"2026-01-15T10:30:00Z"}
}
```

若需要不同的时间格式，为该类型实现 `MarshalJSON`（见[上文](#json-marshaler-接口)）即可覆盖内置行为——自定义类型的 `MarshalJSON` 总是优先于 `time.Time` 的默认处理。

## 自定义字符转义 CustomEscapes

`Config.CustomEscapes` 是一个 `map[rune]string`，用于**全局覆盖**某些字符的转义方式。编码字符串时，库会先查这个映射：命中则把对应的字符串原样写入输出（你需自行保证其 JSON 合法性），未命中才走默认转义。

下面把版权符号 `©` 改写为 ASCII 文本（命中即原样写入，其余字符走默认处理）：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	cfg := json.DefaultConfig()
	// © 默认原样输出；这里改写为 ASCII 文本
	cfg.CustomEscapes = map[rune]string{
		'©': "(c)",
	}

	out, err := json.Encode(map[string]string{"note": "Copyright © 2026"}, cfg)
	if err != nil {
		panic(err)
	}
	fmt.Println(out)
	// 输出：{"note":"Copyright (c) 2026"}
}
```

::: warning 自定义转义串必须 JSON 合法
`CustomEscapes` 的值会被**原样写入**输出，不再二次处理，因此要当心 Go 源码自身的字符串转义：若希望输出中带字面的反斜杠转义序列，Go 源码里需写双反斜杠 `\\`（写单反斜杠会被 Go 当作转义处理，得到的是该字符本身而非转义序列）。
:::

::: tip 何时触发自定义转义路径
设置 `CustomEscapes`（非 nil）即激活自定义编码路径。该路径同时也会读取 `EscapeHTML`、`EscapeUnicode`、`EscapeSlash`、`EscapeNewlines`、`EscapeTabs`、`SortKeys`、`FloatPrecision`、`IncludeNulls` 等字段（详见[配置选项](../api-reference/config)）。
:::

## 如何选择扩展点

| 需求 | 使用方式 |
|------|----------|
| 某个类型自定义其 JSON 形态 | 实现 `MarshalJSON()` |
| 某个类型编码为 JSON 字符串（文本表达） | 实现 `MarshalText()` |
| 全局改变某些字符的转义规则 | `Config.CustomEscapes` |
| 控制缩进、HTML 转义、Unicode 转义、键排序、浮点精度等 | `Config` 的 `Pretty`/`EscapeHTML`/`EscapeUnicode`/`SortKeys`/`FloatPrecision` 等字段（见[配置选项](../api-reference/config)） |
| 覆盖 `time.Time` 的默认时间格式 | 给自定义时间类型实现 `MarshalJSON()` |

## Config 中生效的编码相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `CustomEscapes` | `map[rune]string` | 自定义字符转义映射（命中即原样输出） |
| `EscapeHTML` | `bool` | 是否转义 `<` `>` `&`（默认 `true`） |
| `EscapeUnicode` | `bool` | 是否将 `>0x7F` 的字符转义为 `\uXXXX` |
| `EscapeSlash` | `bool` | 是否转义 `/` |
| `EscapeNewlines` / `EscapeTabs` | `bool` | 是否转义换行/制表符 |
| `SortKeys` | `bool` | 是否对对象键排序（对象键默认已排序） |
| `FloatPrecision` | `int` | 浮点精度（`-1` 为默认） |
| `IncludeNulls` | `bool` | 是否包含空值字段 |

## 已废弃的扩展字段

::: warning 已废弃的扩展字段
`Config.CustomEncoder`（`CustomEncoder` 接口）与 `Config.CustomTypeEncoders`（`TypeEncoder` 接口）**已废弃**（源码标注 Deprecated）：二者已声明并参与配置克隆与缓存键计算，但**从未被编码流水线调用**，设置后不会改变编码输出；内置编码器不可替换。两者在 v1 生命周期内保留。编码定制请使用上文 `MarshalJSON`/`MarshalText`/`CustomEscapes` 等已生效的机制。

```go
// 已废弃：以下两个字段已声明但不挂接，设置后无效果
type CustomEncoder interface {
    Encode(value any) (string, error)
}

type TypeEncoder interface {
    Encode(v reflect.Value) (string, error)
}
```
:::

## 相关

- [接口定义](../api-reference/interfaces) - `Marshaler` / `TextMarshaler` / `CustomEncoder` / `TypeEncoder` 接口
- [配置选项](../api-reference/config) - 编码相关配置字段
- [Hooks 钩子](./hooks) - 操作前后拦截（含可用的验证钩子）
