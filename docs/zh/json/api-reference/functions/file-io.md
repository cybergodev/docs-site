---
sidebar_label: "文件操作"
title: "文件操作函数 - CyberGo JSON | LoadFromFile 与 SaveToFile"
description: "文件与流式 I/O：LoadFromFile/SaveToFile 做路径安全校验与原子写入，LoadFromReader/SaveToWriter 面向 Reader 与 Writer。"
sidebar_position: 90
---

# 文件操作函数

json 包的文件操作函数，覆盖文件读写、流式 I/O 与类型化序列化。所有文件路径在读写前都经过安全校验，见[安全：文件路径校验](#安全-文件路径校验)。

## 文件读写

### LoadFromFile

签名：`func LoadFromFile(filePath string, cfg ...Config) (string, error)`

从文件加载 JSON 数据，返回**原始字符串**（不重新编码，保留文件中的字节顺序与空白）。文件大小受 `Config.MaxJSONSize` 限制（默认 100MB）。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径（须通过安全校验） |
| `cfg` | `Config` | 否 | 可选配置（如收紧 `MaxJSONSize`） |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // 原始 JSON 字符串
```

### SaveToFile

签名：`func SaveToFile(filePath string, data any, cfg ...Config) error`

将数据保存为 JSON 文件。自动创建不存在的父目录；采用**原子写入**（先写临时文件再 rename，崩溃不会截断已有文件）。字符串 / `[]byte` 输入会先解析，避免二次转义。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径（须通过安全校验） |
| `data` | `any` | 是 | 要保存的数据（Go 值或 JSON 字符串） |
| `cfg` | `Config` | 否 | 可选配置（如 `PrettyConfig()` 格式化输出） |

```go
// 紧凑保存（默认）
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})

// 格式化保存
err = json.SaveToFile("output.json", data, json.PrettyConfig())
```

**完整示例：SaveToFile + LoadFromFile 往返**

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

func main() {
	// 创建临时文件，确保示例可独立运行
	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	// 写入：map 按键名排序编码
	err = json.SaveToFile(path, map[string]any{"name": "Alice", "age": 30})
	if err != nil {
		panic(err)
	}

	// 读回：返回文件的原始内容
	data, err := json.LoadFromFile(path)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// 输出：{"age":30,"name":"Alice"}
}
```

## 流式 I/O

### LoadFromReader

签名：`func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

从 `io.Reader` 加载 JSON 数据并返回原始字符串。读取字节数受 `Config.MaxJSONSize` 限制（默认 100MB），防止内存耗尽；适用于网络连接、HTTP 响应体、管道等流式数据源。

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

**完整示例：从 strings.Reader 与 os.File 读取**

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/json"
)

func main() {
	// 从 strings.Reader 读取（原始内容原样返回）
	reader := strings.NewReader(`{"name":"Alice","age":30}`)
	data, err := json.LoadFromReader(reader)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// 输出：{"name":"Alice","age":30}
}
```

从 `os.File` 读取时用法相同：`os.File` 实现了 `io.Reader`。

```go
file, err := os.Open("data.json")
if err != nil {
    panic(err)
}
defer file.Close()

data, err := json.LoadFromReader(file)
```

### SaveToWriter

签名：`func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

将数据编码为 JSON 并写入 `io.Writer`。与 `SaveToFile` 一样会对字符串 / `[]byte` 输入先解析防二次转义，但**不做文件路径校验**（目标由调用方控制）。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `writer` | `io.Writer` | 是 | 输出目标 |
| `data` | `any` | 是 | 要写入的数据 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"}, json.PrettyConfig())
```

**完整示例：写入 bytes.Buffer**

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	var buf bytes.Buffer
	err := json.SaveToWriter(&buf, map[string]any{"name": "Alice", "age": 30}, json.PrettyConfig())
	if err != nil {
		panic(err)
	}
	fmt.Print(buf.String())
	// 输出：
	// {
	//   "age": 30,
	//   "name": "Alice"
	// }
}
```

写入 `os.File` 时同理，传入文件句柄即可。

## 结构体序列化

### MarshalToFile

签名：`func MarshalToFile(filePath string, data any, cfg ...Config) error`

将数据序列化为 JSON 并写入文件。它与 `SaveToFile` 共用同一条「编码 + 原子写入」流水线：自动创建父目录，先写临时文件再 rename。字符串 / `[]byte` 输入会先解析，避免二次转义。传入的 `cfg` 全部生效（缩进、转义、数字处理等）。两者行为等价，按语义选用：写入 Go 值用 `MarshalToFile`，强调「保存 JSON 文档」用 `SaveToFile`。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `data` | `any` | 是 | 要序列化的数据 |
| `cfg` | `Config` | 否 | 可选配置（`PrettyConfig()` 生成缩进输出） |

```go
err := json.MarshalToFile("data.json", myStruct)
err = json.MarshalToFile("data.json", myStruct, json.PrettyConfig())
```

### UnmarshalFromFile

签名：`func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

从文件读取 JSON 并反序列化到目标变量。等价于「读文件 + `Unmarshal`」，读取过程受 `MaxJSONSize` 限制（默认 100MB）。

**参数**

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `filePath` | `string` | 是 | 文件路径 |
| `v` | `any` | 是 | 目标对象指针 |
| `cfg` | `Config` | 否 | 可选配置 |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
```

**完整示例：MarshalToFile + UnmarshalFromFile 结构体往返**

```go
package main

import (
	"fmt"
	"os"

	"github.com/cybergodev/json"
)

type User struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func main() {
	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	// 序列化结构体写入文件
	err = json.MarshalToFile(path, User{Name: "Alice", Age: 30})
	if err != nil {
		panic(err)
	}

	// 从文件读取并反序列化
	var user User
	err = json.UnmarshalFromFile(path, &user)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s, %d\n", user.Name, user.Age)
	// 输出：Alice, 30
}
```

## 安全：文件路径校验

所有文件读写函数（`LoadFromFile` / `SaveToFile` / `MarshalToFile` / `UnmarshalFromFile`）在操作前对路径执行多层安全校验，由 `Config.ValidateFilePath`（默认 `true`）控制。覆盖以下攻击向量：

| 防护项 | 说明 |
|--------|------|
| 路径遍历 | 检测 `..`、`..\` 及其 URL 编码变体（`%2e%2e`、多层编码）、Unicode 同形字符（全角点 / 斜杠） |
| 空字节注入 | 拒绝路径中的 `\x00` |
| 符号链接逃逸 | 解析 symlink 真实路径，防止指向受限区域 |
| 系统目录（Unix） | 阻止访问 `/dev/`、`/proc/`、`/etc/passwd`、`/root/` 等敏感路径 |
| Windows 保留名 | 拒绝 `CON`、`PRN`、`COM1-9`、`LPT1-9`、UNC 路径、备用数据流（ADS） |
| 文件大小 | 读前检查已有文件是否超过 `MaxJSONSize`，读取时用 `io.LimitReader` 防 TOCTOU |

```go
// 路径遍历攻击会被拒绝，返回 security error
_, err := json.LoadFromFile("../../etc/passwd")
// err 非 nil：path traversal pattern detected

// 正常路径不受影响
data, err := json.LoadFromFile("config/app.json")
```

::: warning 注意
文件路径校验始终对文件类操作生效；`LoadFromReader` / `SaveToWriter` 不涉及路径，因此不校验。处理用户提供的文件名时，这些校验只是一层纵深防御，仍应在应用层做白名单约束。
:::

## 文件迭代函数

json 包提供 `ForeachFile` 系列函数，直接从文件迭代 JSON 数组 / 对象，无需手动读取再解析：

| 函数 | 用途 |
|------|------|
| `ForeachFile(path, fn, cfg...)` | 迭代文件根级数组 / 对象 |
| `ForeachFileWithPath(path, pathExpr, fn, cfg...)` | 迭代文件中指定路径下的集合 |
| `ForeachFileChunked(path, chunkSize, fn, cfg...)` | 按批次（chunk）迭代大数组 |
| `ForeachFileNested(path, fn, cfg...)` | 递归迭代所有嵌套结构 |

```go
err := json.ForeachFile("users.json", func(key any, item *json.IterableValue) error {
    fmt.Println(item.GetString("name"))
    return nil
})
```

这些函数等价于 `LoadFromFile` 加逐条迭代回调。注意它们先把整个文件载入内存（受 `MaxJSONSize` 限制），再逐条回调；恒定内存的大文件处理见[流式处理](../../streaming/large-files)。

## 方法选择

| 场景 | 推荐函数 |
|------|----------|
| 读文件得到原始字符串 | `LoadFromFile` |
| 读文件并反序列化到结构体 | `UnmarshalFromFile` |
| 从 Reader / HTTP Body 读取 | `LoadFromReader` |
| 保存 Go 值到文件（紧凑） | `SaveToFile` / `MarshalToFile` |
| 保存并格式化 | `SaveToFile(path, data, json.PrettyConfig())` |
| 写入 Writer / Buffer | `SaveToWriter` |
| 迭代文件中的集合 | `ForeachFile` 系列 |

## 相关

- [JSONL 处理函数](./jsonl) - ParseJSONL, StreamLinesInto 等换行分隔 JSON 处理
- [编码输出函数](./output) - Marshal, Unmarshal 等序列化操作
- [流式处理](../../streaming/large-files) - 流式处理器与大文件迭代详解
- [Processor 文件操作](../processor/file-io) - 对应的 Processor 实例方法
