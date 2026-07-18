---
sidebar_label: "解析验证"
title: "Processor 解析与验证 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 解析方法：Valid 验证、Parse 解析、ParseAny 任意类型、PreParse 预解析优化与 GetFromParsed 快速查询，支持配置化解析。"
sidebar_position: 6
---

# 解析与验证方法

Processor 提供 JSON 解析与有效性验证方法。文件读写与流式加载见[文件操作](./file-io)。

## 验证方法

### Valid

签名：`func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

验证 JSON 字符串是否有效。

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // 有效的 JSON
}
```

### ValidBytes

签名：`func (p *Processor) ValidBytes(data []byte) bool`

验证字节切片是否为有效 JSON。

```go
if p.ValidBytes([]byte(data)) {
    // 有效的 JSON
}
```

## 解析方法

### Parse

签名：`func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

解析 JSON 字符串到目标变量。支持标准模式和数字保留模式。

```go
// 解析为 map
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// 解析为结构体
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// 使用数字保留模式
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

签名：`func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

解析 JSON 字符串为 `any` 类型。

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

签名：`func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

预解析 JSON 数据，用于后续多次查询同一数据时避免重复解析。

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// 多次查询已解析的数据
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

签名：`func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

从预解析数据中获取值。配合 `PreParse` 使用以提高多次查询性能。

### SetFromParsed

签名：`func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

在预解析数据上设置值，返回新的 `ParsedJSON`。

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## 方法选择

| 场景 | 推荐方法 |
|------|----------|
| 仅验证有效性 | `Valid` / `ValidBytes` |
| 解析到目标变量 | `Parse` |
| 多次查询同一数据 | `PreParse` + `GetFromParsed` |

## 相关

- [文件操作](./file-io) - LoadFromFile/SaveToFile 等文件方法
- [输出方法](./output) - Encode/EncodePretty 编码方法
- [路径查询](./query) - Get 系列方法
