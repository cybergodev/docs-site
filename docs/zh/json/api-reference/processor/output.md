---
sidebar_label: "编码输出"
title: "Processor 编码输出 - CyberGo JSON | Marshal/Encode 方法"
description: "Processor 输出方法：Encode/EncodePretty 编码、Marshal/Unmarshal 标准库签名兼容、Compact 压缩与 ValidateSchema 校验。"
sidebar_position: 50
---

# 输出方法

输出方法分三类：返回字符串的编码方法（`Encode` 系列）、与 `encoding/json` 签名一致的字节切片方法（`Marshal`/`Unmarshal`），以及直接改写 Buffer 的格式化方法（`CompactBuffer`/`Indent`/`HTMLEscape`）。

## 基础输出

### Encode

签名：`func (p *Processor) Encode(value any, cfg ...Config) (string, error)`

将任意值编码为 JSON 字符串，是返回 `string` 的规范编码入口（返回 `[]byte` 的是 [`Marshal`](#marshal)）。可选的尾随 `Config` 控制本次调用的编码行为；省略时使用处理器配置。

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

签名：`func (p *Processor) EncodePretty(value any, cfg ...Config) (string, error)`

将任意值编码为缩进格式的 JSON 字符串。省略 `cfg` 时使用处理器配置并强制 `Pretty=true`；传入 `cfg` 时按原样使用，不会自动把 `Pretty` 置为 `true`。

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## 高级编码

### EncodeWithConfig

<Badge type="danger" text="已废弃" />

签名：`func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

使用指定配置编码值为 JSON 字符串。

::: warning 已废弃
`Processor.EncodeWithConfig` 与 [`Encode`](#encode) 等价（两者委托同一实现）：该命名早于 `Encode` 接受可选尾随 `Config`。新代码用 `p.Encode(value, cfg)`；需要 `[]byte` 输出时用 [`Marshal`](#marshal)。`EncodeWithConfig` 在 v1 生命周期内保留、不会移除。
:::

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `value` | `any` | 是 | 要编码的值 |
| `cfg` | `Config` | 否 | 编码配置（可选） |

```go
// 与 p.Encode(data, json.PrettyConfig()) 等价
result, err := p.EncodeWithConfig(data, json.PrettyConfig())
```

### EncodeBatch

签名：`func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

批量编码键值对为 JSON 对象。

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

签名：`func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

仅编码指定字段，用于部分序列化。`value` 必须是结构体、map 或指向它们的指针；传入标量或切片时返回的错误满足 `errors.Is(err, ErrTypeMismatch)`。

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// 仅编码 name 和 email 字段
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

签名：`func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

将多个值编码为 JSON 数组流。`values` 为切片时输出形如 `[v1,v2,...]` 的 JSON 数组字符串；其他类型按 [`Encode`](#encode) 的规则编码。实现上等同于 `p.Encode(values, cfg...)`。

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## 编码/解码

### Marshal

签名：`func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

将 Go 值编码为 JSON 字节切片。签名与 `encoding/json.Marshal` 一致，替换 import 即可编译；输出字节与标准库在典型值上相同，默认安全校验与标准库存在差异，见下方提示。

::: tip 输出始终 HTML 转义
与 `encoding/json.Marshal` 一致，本方法输出**始终** HTML 转义：即使传入的 `cfg` 设置 `EscapeHTML=false`，在该路径上也会被覆盖。需要控制转义时用 [`Encode`](#encode)。
:::

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

签名：`func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

将 Go 值编码为格式化的 JSON 字节切片。签名与 `encoding/json.MarshalIndent` 一致。

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

签名：`func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

解析 JSON 字节切片到目标变量。签名与 `encoding/json.Unmarshal` 一致；默认路径会做安全校验（输入大小、危险模式、非法 UTF-8 拒绝），与标准库存在少量行为差异。

```go
var user User
err := p.Unmarshal([]byte(`{"name":"Alice","age":30}`), &user)
if err != nil {
    panic(err)
}
```

## 格式化

### Prettify

签名：`func (p *Processor) Prettify(jsonStr string, cfg ...Config) (string, error)`

将 JSON 字符串格式化为缩进形式。`cfg.Indent` 为空时按 2 空格缩进；`cfg.Prefix` 指定每行前缀。结果按 `cfg` 写入结果缓存。

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// 输出：
// {
//   "name": "Alice",
//   "age": 30
// }

// 4 空格缩进
cfg := json.DefaultConfig()
cfg.Indent = "    "
pretty, err = p.Prettify(`{"name":"Alice","age":30}`, cfg)
```

### Print (已移除)

::: warning API 变更说明
Print、PrintE、PrintPretty、PrintPrettyE 已从库中移除。替代写法：

```go
// 紧凑输出
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// 格式化输出
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

签名：`func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

验证 JSON 数据是否符合指定 Schema。**违反 Schema 的细节由返回的 `[]ValidationError` 报告**；`error` 仅在解析或前置校验失败（JSON 非法、`schema` 为 `nil`）时非空：校验通过返回 `(nil, nil)`，校验失败但流程正常返回 `(非空切片, nil)`。

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
    },
}

errors, err := p.ValidateSchema(jsonStr, schema)
if err != nil {
    panic(err)
}
for _, ve := range errors {
    fmt.Printf("路径 %s: %s\n", ve.Path, ve.Message)
}
```

## 格式化操作

### Compact

签名：`func (p *Processor) Compact(jsonStr string, cfg ...Config) (string, error)`

压缩 JSON 字符串，移除所有空白字符。

::: warning 方法与包级函数的命名差异
「字符串进、字符串出」的压缩在两个入口下**名字不同**：包级是 `json.CompactString(s)`，方法版的首选名是 `p.Compact(s)`（另提供等价的 [`CompactString`](#compactstring) 方法）。包级 `json.Compact(dst, src)` 是与 `encoding/json.Compact` 兼容的 Buffer 形式，对应方法是 [`CompactBuffer`](#compactbuffer)。
:::

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// 输出：{"name":"CyberGo"}
```

### CompactString

签名：`func (p *Processor) CompactString(jsonStr string, cfg ...Config) (string, error)`

以字符串入、字符串出的形式压缩 JSON，行为与 [`Compact`](#compact) 相同，是包级 [`json.CompactString`](../functions/output#compactstring) 的 Processor 镜像。

```go
compact, err := p.CompactString(`{"name": "CyberGo"}`)
// 输出：{"name":"CyberGo"}
```

### CompactBuffer

签名：`func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

将 JSON 压缩后写入 Buffer。与 `encoding/json.Compact` 签名兼容，是 [`Compact`](#compact) 的 Buffer 形式（包级对应 `json.Compact`）。

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

签名：`func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

将 JSON 格式化后写入 Buffer。

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

签名：`func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

将 JSON 进行 HTML 转义后写入 Buffer。

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## 相关

- [Config](../config) - 配置选项
- [解析与加载](./parse) - Parse/Load 方法
