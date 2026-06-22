---
title: "Processor 输出方法 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 输出方法：Encode、EncodePretty、EncodeWithConfig、EncodeBatch/EncodeFields 批量与 Compact/Indent/HTMLEscape 格式化，满足多种输出需求。"
---

# 输出方法

Processor 提供多种 JSON 编码输出方法。

## 基础输出

### Encode

签名：`func (p *Processor) Encode(value any, config ...Config) (string, error)`

将任意值编码为 JSON 字符串。

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

签名：`func (p *Processor) EncodePretty(value any, config ...Config) (string, error)`

将任意值编码为格式化 JSON 字符串。

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## 高级编码

### EncodeWithConfig

签名：`func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

使用指定配置编码值为 JSON 字符串。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `value` | `any` | 是 | 要编码的值 |
| `cfg` | `Config` | 否 | 编码配置（可选） |

```go
// 使用 PrettyConfig
result, err := p.EncodeWithConfig(data, json.PrettyConfig())

// 使用 SecurityConfig
result, err = p.EncodeWithConfig(data, json.SecurityConfig())

// 使用自定义配置
cfg := json.DefaultConfig()
cfg.Pretty = true
cfg.SortKeys = true
cfg.EscapeHTML = true
result, err = p.EncodeWithConfig(data, cfg)
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

仅编码指定字段，常用于部分序列化。

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

将多个值编码为 JSON 数组流（array stream）。`values` 通常是切片或可枚举集合，输出形如 `[v1,v2,...]` 的 JSON 数组字符串。

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## 编码/解码

### Marshal

签名：`func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

将 Go 值编码为 JSON 字节切片。100% 兼容 `encoding/json.Marshal`。

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

签名：`func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

将 Go 值编码为格式化的 JSON 字节切片。100% 兼容 `encoding/json.MarshalIndent`。

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

签名：`func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

解析 JSON 字节切片到目标变量。100% 兼容 `encoding/json.Unmarshal`。

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

将 JSON 字符串格式化为缩进形式。

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// 输出:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Print (已移除)

::: warning API 变更说明
`Print`、`PrintE`、`PrintPretty`、`PrintPrettyE` 已从库中移除，不再提供。请使用以下替代方案：

```go
// 紧凑输出
s, err := p.EncodeWithConfig(data)
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

验证 JSON 数据是否符合指定的 Schema。

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

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// 输出: {"name":"CyberGo"}
```

### CompactBuffer

签名：`func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

将 JSON 压缩后写入 Buffer。

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
