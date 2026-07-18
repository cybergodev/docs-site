---
sidebar_label: "文件操作"
title: "文件操作函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 文件操作函数：LoadFromFile/SaveToFile 读写、LoadFromReader/SaveToWriter 流式 I/O 与 MarshalToFile/UnmarshalFromFile 序列化。"
sidebar_position: 9
---

# 文件操作函数

json 包提供的文件操作函数，支持文件读写和流式 I/O。

## 文件读取函数

### LoadFromFile

签名：`func LoadFromFile(filePath string, cfg ...Config) (string, error)`

从文件加载 JSON 数据。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data)
```

### SaveToFile

签名：`func SaveToFile(filePath string, data any, cfg ...Config) error`

将 JSON 数据保存到文件。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `data` | `any` | 是 | 要保存的数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})
if err != nil {
    panic(err)
}
```

### MarshalToFile

签名：`func MarshalToFile(filePath string, data any, cfg ...Config) error`

将数据序列化并写入文件。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `data` | `any` | 是 | 要序列化的数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

签名：`func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

从文件读取并反序列化数据。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `v` | `any` | 是 | 目标对象指针 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### LoadFromReader

签名：`func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

从 io.Reader 加载 JSON 数据。适用于从网络连接、HTTP 请求体等流式数据源读取 JSON。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `reader` | `io.Reader` | 是 | 数据源 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
// 从 HTTP 响应体读取
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// 从字符串读取
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

签名：`func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

将 JSON 数据写入 io.Writer。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `writer` | `io.Writer` | 是 | 输出目标 |
| `data` | `any` | 是 | 要写入的数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

## 相关

- [JSONL 处理函数](./jsonl) - ParseJSONL, StreamLinesInto 等换行分隔 JSON 处理
- [编码输出函数](./output) - Marshal, Unmarshal 等序列化操作
- [流式处理](../../streaming/large-files) - 流式处理器详解
