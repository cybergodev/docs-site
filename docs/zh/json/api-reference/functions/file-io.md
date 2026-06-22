---
title: "文件操作函数 - CyberGo JSON | API 参考"
description: "CyberGo JSON 文件操作函数：LoadFromReader 流读取、ParseJSONL/ToJSONL 处理、StreamLinesInto[T] 泛型流与 NewJSONLWriter，支持大文件流式场景。"
---

# 文件操作函数

json 包提供的文件操作和 JSONL 处理函数。

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

## JSONL 处理函数

JSONL（JSON Lines）是换行分隔的 JSON 格式，每行一个独立的 JSON 对象。

### ParseJSONL

签名：`func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

解析 JSONL（换行分隔 JSON）数据。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]byte` | 是 | JSONL 字节数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
results, err := json.ParseJSONL([]byte(jsonl))
if err != nil {
    panic(err)
}
for i, r := range results {
    fmt.Printf("[%d] %v\n", i, r)
}
```

### StreamLinesInto

签名：`func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

从 io.Reader 流式读取 JSONL 数据并通过回调函数处理每一行。这是推荐的泛型 JSONL 处理方式。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `reader` | `io.Reader` | 是 | 数据源 |
| `fn` | `func(lineNum int, data T) error` | 是 | 处理回调（接收行号和数据） |
| `cfg` | `Config` | 否 | 可选配置 |

**返回值**

| 类型 | 说明 |
|------|------|
| `[]T` | 所有处理后的结果切片 |
| `error` | 错误信息 |

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

// 基本用法
results, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("行 %d: 用户 %s\n", lineNum, user.Name)
    return nil // 返回 error 可中断处理
})
if err != nil {
    panic(err)
}
fmt.Printf("共处理 %d 条记录\n", len(results))
```

### ToJSONL

签名：`func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

将数据切片转换为 JSONL 格式。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]any` | 是 | 数据切片 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
items := []any{
    map[string]any{"name": "Alice"},
    map[string]any{"name": "Bob"},
}
jsonl, err := json.ToJSONL(items)
if err != nil {
    panic(err)
}
fmt.Println(string(jsonl))
// {"name":"Alice"}
// {"name":"Bob"}
```

### ToJSONLString

签名：`func ToJSONLString(data []any, cfg ...Config) (string, error)`

将数据切片转换为 JSONL 字符串。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `data` | `[]any` | 是 | 数据切片 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
jsonlStr, err := json.ToJSONLString(items)
```

## JSONL 配置

::: warning
`JSONLConfig` 独立结构和 `DefaultJSONLConfig()` 函数已移除。JSONL 配置已统一集成到 `Config` 的 `JSONL*` 字段中。
:::

### 通过 Config 配置 JSONL

```go
cfg := json.DefaultConfig()

// JSONL 配置
cfg.JSONLBufferSize    = 64 * 1024    // 读取缓冲区大小 (默认: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // 单行最大大小 (默认: 1MB)
cfg.JSONLSkipEmpty     = true         // 跳过空行 (默认: true)
cfg.JSONLSkipComments  = false        // 跳过注释行 (默认: false)
cfg.JSONLContinueOnErr = false        // 遇错继续 (默认: false)
cfg.JSONLWorkers       = 4            // 并行工作协程数 (默认: 4)
cfg.JSONLChunkSize     = 1000         // 每批处理行数 (默认: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // 最大内存 (默认: 100MB)

processor, err := json.New(cfg)
```

详见 [Config 配置](../config#config-结构体)

## JSONL 写入器

### NewJSONLWriter

签名：`func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

创建 JSONL 写入器。

```go
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
```

**JSONLWriter 方法**

| 方法 | 签名 | 说明 |
|------|------|------|
| `Write` | `(data any) error` | 写入单行 |
| `WriteAll` | `(data []any) error` | 写入多行 |
| `WriteRaw` | `(line []byte) error` | 写入原始字节行 |
| `Err` | `() error` | 返回累积错误 |
| `Stats` | `() JSONLStats` | 返回写入统计 |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## 相关

- [编码解码函数](./encode-decode) - Marshal, Unmarshal 等序列化操作
- [流式处理](../../large-files) - 流式处理器详解
- [Processor JSONL 方法](../processor/jsonl) - Processor 级 JSONL 方法详解
