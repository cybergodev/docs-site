---
title: "编码解码函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 编码解码函数：Marshal/Unmarshal 序列化、Compact/Indent/HTMLEscape 格式化与 Encode/EncodePretty/Prettify 配置化编码，100% 兼容标准库。"
---

# 编码解码函数

json 包提供的编码解码函数，包括序列化、反序列化、格式化和配置化编码。

## 序列化函数

### Marshal

签名：`func Marshal(value any) ([]byte, error)`

将 Go 值序列化为 JSON 字节切片。100% 兼容 `encoding/json.Marshal`。

```go
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}
```

:::tip
`Marshal` 不接受配置参数。如需配置化编码，请使用 [EncodeWithConfig](#encodewithconfig)。
:::

### Unmarshal

签名：`func Unmarshal(data []byte, value any) error`

将 JSON 字节切片反序列化到 Go 值。100% 兼容 `encoding/json.Unmarshal`。

```go
var result struct {
    Name string `json:"name"`
}
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)
```

### MarshalIndent

签名：`func MarshalIndent(v any, prefix, indent string) ([]byte, error)`

带缩进的序列化。100% 兼容 `encoding/json.MarshalIndent`。

```go
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

:::tip
`MarshalIndent` 不接受配置参数。如需配置化编码，请使用 [EncodeWithConfig](#encodewithconfig)。
:::

## 格式化函数

### Compact

签名：`func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

压缩 JSON，移除不必要的空白字符，将结果写入 `dst`。兼容 `encoding/json.Compact`。

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

### Indent

签名：`func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

格式化 JSON 并添加缩进，将结果写入 `dst`。兼容 `encoding/json.Indent`。

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(buf.String())
// {
//   "name": "test"
// }
```

### HTMLEscape

签名：`func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML 转义 JSON 内容，将 `<`、`>`、`&` 等特殊字符（以及 U+2028、U+2029）替换为对应的 Unicode 转义序列，结果写入 `dst`。无返回值。

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
```

### Prettify

签名：`func Prettify(jsonStr string, cfg ...Config) (string, error)`

使用默认的漂亮打印缩进格式化 JSON 字符串，返回格式化后的字符串。

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "Alice",
//   "age": 30
// }
```

## 配置化编码函数

### Encode

签名：`func Encode(value any, cfg ...Config) (string, error)`

将 Go 值编码为 JSON 字符串，支持可选配置参数。

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**带配置**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

签名：`func EncodePretty(value any, cfg ...Config) (string, error)`

将 Go 值编码为格式化的 JSON 字符串（带缩进），支持可选配置参数。

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**带配置**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

签名：`func EncodeWithConfig(value any, cfg ...Config) (string, error)`

使用指定配置将 Go 值编码为 JSON 字符串。适合需要精细控制编码行为的场景。

```go
// 使用漂亮打印配置
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**使用安全配置**

```go
result, err := json.EncodeWithConfig(data, json.SecurityConfig())
```

## 批量编码函数

### EncodeBatch

签名：`func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

将键值对批量编码为 JSON 对象字符串。

```go
result, err := json.EncodeBatch(map[string]any{
    "name":  "Alice",
    "age":   30,
    "email": "alice@example.com",
})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"age":30,"email":"alice@example.com","name":"Alice"}
```

### EncodeFields

签名：`func EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

仅编码指定字段，实现字段过滤输出。

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// 仅输出公开字段
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

签名：`func EncodeStream(values any, cfg ...Config) (string, error)`

将多个值编码为 JSON 数组流（array stream）。`values` 通常是切片或可枚举集合，输出形如 `[v1,v2,...]` 的 JSON 数组字符串。

```go
values := []map[string]any{
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
}

result, err := json.EncodeStream(values)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Processor 格式化方法

`Processor` 类型提供额外的格式化方法。使用 `json.New()` 创建 Processor（返回 `(*Processor, error)`）：

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

签名：`func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

压缩 JSON 字节并写入 `dst` 缓冲区。包级 `Compact` 函数委托给此方法。

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "Alice"}`))
// buf.String() => {"name":"Alice"}
```

### Processor.Indent

签名：`func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

将缩进格式的 JSON 写入 `dst` 缓冲区。与 `encoding/json.Indent` 兼容。

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"Alice"}`), "", "  ")
```

### Processor.HTMLEscape

签名：`func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

将 HTML 转义后的 JSON 写入 `dst` 缓冲区，无返回值。与 `encoding/json.HTMLEscape` 兼容。

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

:::tip
完整的 Processor 文档请参阅 [Processor](../interfaces)。
:::

## 配置预设

以下辅助函数返回预配置的 `Config` 值，可传递给任何接受 `...Config` 的函数：

```go
// 默认配置
cfg := json.DefaultConfig()

// 漂亮打印配置
cfg = json.PrettyConfig()

// 安全配置
cfg = json.SecurityConfig()
```

:::tip
完整的 Config 字段文档请参阅 [配置](../config)。
:::

## 相关

- [查询获取函数](./get) - Get, GetString 等查询操作
- [修改函数](./modify) - Set, Delete 等修改操作
- [文件操作](./file-io) - LoadFromFile, SaveToFile 等文件操作
- [配置](../config) - Config 类型和选项
- [接口](../interfaces) - Processor, Encoder, Decoder 类型
