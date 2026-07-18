---
sidebar_label: "文件操作"
title: "Processor 文件操作方法 - CyberGo JSON | API 参考"
description: "CyberGo JSON Processor 文件方法：LoadFromFile/LoadFromReader 加载、SaveToFile/MarshalToFile 保存、UnmarshalFromFile 读取、SaveToWriter 写入流。"
sidebar_position: 9
---

# 文件操作方法

Processor 提供 JSON 文件读写与流式加载方法，覆盖文件、`io.Reader`、`io.Writer` 三类数据源。

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
LoadFromFileAsData 已转为内部方法（`loadFromFileAsData`），不再作为公开 API 导出。请使用 `LoadFromFile` + `Parse` 组合代替：

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
LoadFromReaderAsData 已转为内部方法（`loadFromReaderAsData`），不再作为公开 API 导出。请使用 `LoadFromReader` + `Parse` 组合代替：

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

## 方法选择

| 场景 | 推荐方法 |
|------|----------|
| 需要原始字符串 | `LoadFromFile` / `LoadFromReader` |
| 需要解析后数据 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| 保存数据到文件 | `SaveToFile` / `MarshalToFile` |
| 写入到 Writer | `SaveToWriter` |
| 从文件读取并解码 | `UnmarshalFromFile` |

## 相关

- [解析验证](./parse) - Parse/Valid 解析方法
- [文件函数](../functions/file-io) - 包级文件读写函数
