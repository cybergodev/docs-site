---
title: "Processor 解析与加载 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 解析方法：Valid 验证、Parse 解析、ParseAny 任意类型、PreParse 预解析优化与 GetFromParsed 快速查询，支持配置化解析。"
---

# 解析与加载方法

Processor 提供 JSON 解析和数据加载功能。

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

## 文件加载

### LoadFromFile

签名：`func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

从文件加载 JSON 数据并返回原始字符串。

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // 原始 JSON 字符串
```

### LoadFromFileAsData (已私有化)

::: warning API 变更说明
`LoadFromFileAsData` 已转为内部方法（`loadFromFileAsData`），不再作为公开 API 导出。请使用 `LoadFromFile` + `Parse` 组合代替：

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data 类型为 map[string]any 或 []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```
:::

## Reader 加载

### LoadFromReader

签名：`func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

从 Reader 加载 JSON 数据并返回原始字符串。

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData (已私有化)

::: warning API 变更说明
`LoadFromReaderAsData` 已转为内部方法（`loadFromReaderAsData`），不再作为公开 API 导出。请使用 `LoadFromReader` + `Parse` 组合代替：

```go
file, _ := os.Open("data.json")
defer file.Close()

jsonStr, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
```
:::

## 方法选择

| 场景 | 推荐方法 |
|------|----------|
| 需要原始字符串 | `LoadFromFile` / `LoadFromReader` |
| 需要解析后数据 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| 多次查询同一数据 | `PreParse` + `GetFromParsed` |
| 仅验证有效性 | `Valid` / `ValidBytes` |
| 解析到目标变量 | `Parse` |
| 保存数据到文件 | `SaveToFile` / `MarshalToFile` |
| 写入到 Writer | `SaveToWriter` |
| 从文件读取并解码 | `UnmarshalFromFile` |

## 文件写入

### SaveToFile

签名：`func (p *Processor) SaveToFile(filePath string, data any, cfg ...Config) error`

将数据保存为 JSON 文件。自动创建父目录。

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// 使用 PrettyConfig 保存格式化输出
err = p.SaveToFile("data.json", data, json.PrettyConfig())
```

### MarshalToFile

签名：`func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

将数据编码为 JSON 并写入文件。自动创建父目录。

```go
err := p.MarshalToFile("output.json", data)

// 格式化保存
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
```

### UnmarshalFromFile

签名：`func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

从文件读取 JSON 并解码到目标变量。

```go
var config Config
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

签名：`func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

将数据编码为 JSON 并写入 io.Writer。

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
```

## 相关

- [输出方法](./output) - Encode/EncodePretty 方法
- [路径查询](./query) - Get 系列方法
