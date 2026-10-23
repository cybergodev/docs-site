---
sidebar_label: "文件操作"
title: "Processor 文件操作 - CyberGo JSON | LoadFromFile/SaveToFile"
description: "CyberGo JSON 的 Processor 提供 LoadFromFile/SaveToFile 文件读写方法，配合流式 I/O 与结构体序列化方法，写入前执行安全路径校验、读取字节数受 MaxJSONSize 限制，适合读写配置文件与处理 HTTP Body、管道等流式数据源的开发场景。"
sidebar_position: 90
---

# 文件操作方法

Processor 提供 JSON 文件读写与流式加载方法，覆盖文件、`io.Reader`、`io.Writer` 三类数据源。文件类方法在操作前均进行安全路径校验（见[函数参考](../functions/file-io#安全-文件路径校验)）。

## 文件加载

### LoadFromFile

签名：`func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

从文件加载 JSON 数据并返回**原始字符串**（保留文件字节顺序与空白，不重新编码）。读取字节数受 `MaxJSONSize` 限制。

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

从 `io.Reader` 加载 JSON 数据并返回原始字符串。读取受 `MaxJSONSize` 限制，适合 `os.File`、HTTP Body、管道等流式源。

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

将数据保存为 JSON 文件。自动创建父目录，采用**原子写入**（临时文件 + rename）。字符串 / `[]byte` 输入会被预解析避免二次转义。

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// 使用 PrettyConfig 保存格式化输出
err = p.SaveToFile("data.json", data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	err = p.SaveToFile(path, map[string]any{"name": "Alice", "age": 30})
	if err != nil {
		panic(err)
	}

	data, err := p.LoadFromFile(path)
	if err != nil {
		panic(err)
	}
	fmt.Println(data)
	// 输出：{"age":30,"name":"Alice"}
}
```

### MarshalToFile

签名：`func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

将数据编码为 JSON 并写入文件。自动创建父目录，原子写入。与 `SaveToFile` **共用同一条「编码 + 原子写」管线**：同样对字符串 / `[]byte` 输入做预解析避免二次转义，同样完整尊重传入 `cfg`（`Pretty` / `Indent` / `EscapeHTML` 等全部生效）——两者如今仅在错误信息的操作名上有差别，历史行为差异已消除。

```go
err := p.MarshalToFile("output.json", data)

// 格式化保存
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	tmp, err := os.CreateTemp("", "cybergo-*.json")
	if err != nil {
		panic(err)
	}
	path := tmp.Name()
	tmp.Close()
	defer os.Remove(path)

	err = p.MarshalToFile(path, User{Name: "Alice", Age: 30})
	if err != nil {
		panic(err)
	}

	var user User
	err = p.UnmarshalFromFile(path, &user)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s, %d\n", user.Name, user.Age)
	// 输出：Alice, 30
}
```

### UnmarshalFromFile

签名：`func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

从文件读取 JSON 并解码到目标变量。读取受 `MaxJSONSize` 限制。

```go
type AppConfig struct {
    Host string `json:"host"`
    Port int    `json:"port"`
}

var config AppConfig
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

签名：`func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

将数据编码为 JSON 并写入 `io.Writer`。字符串 / `[]byte` 输入同样会被预解析避免二次转义；不涉及文件路径，故不做路径校验。

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
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
	p, err := json.New()
	if err != nil {
		panic(err)
	}
	defer p.Close()

	var buf bytes.Buffer
	err = p.SaveToWriter(&buf, map[string]any{"name": "Alice", "age": 30}, json.PrettyConfig())
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

## 文件迭代

Processor 提供 `ForeachFile` 系列方法，直接从文件迭代 JSON 集合，是 `LoadFromFile` 与逐条迭代回调的便捷组合：

| 方法 | 用途 |
|------|------|
| `ForeachFile(path, fn, cfg...)` | 迭代文件根级数组 / 对象 |
| `ForeachFileWithPath(path, pathExpr, fn, cfg...)` | 迭代文件中指定路径下的集合 |
| `ForeachFileChunked(path, chunkSize, fn, cfg...)` | 按批次迭代大数组 |
| `ForeachFileNested(path, fn, cfg...)` | 递归迭代所有嵌套结构 |

```go
err := p.ForeachFile("users.json", func(key any, item *json.IterableValue) error {
    fmt.Println(item.GetString("name"))
    return nil
})
```

回调支持 `item.Break()` 提前终止迭代。流式处理与大文件优化细节见[流式处理](../../streaming/large-files)。

## 方法选择

| 场景 | 推荐方法 |
|------|----------|
| 需要原始字符串 | `LoadFromFile` / `LoadFromReader` |
| 需要解析后数据 | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| 保存 Go 值到文件 | `SaveToFile` / `MarshalToFile` |
| 从文件读取并解码到结构体 | `UnmarshalFromFile` |
| 写入到 Writer | `SaveToWriter` |
| 迭代文件中的集合 | `ForeachFile` 系列 |

## 相关

- [解析验证](./parse) - Parse/Valid 解析方法
- [文件函数](../functions/file-io) - 包级文件读写函数（含路径安全校验详解）
- [流式处理](../../streaming/large-files) - 流式处理器与大文件迭代详解
