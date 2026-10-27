---
sidebar_label: "格式化输出"
title: "格式化输出 - CyberGo JSON | 打印与美化 JSON 指南"
description: "CyberGo JSON 格式化输出：Prettify、EncodePretty、MarshalIndent、Compact 与 HTMLEscape 的选型对比与示例。"
sidebar_position: 30
---

# 格式化输出

::: tip 迁移提示
早期版本的 Print / PrintPretty 系列直接打印函数（Print、PrintE、PrintPretty、PrintPrettyE）已从库中移除，不再提供。迁移细节与替代方案见[历史沿革](#历史沿革-已移除的-print-系列)。
:::

`Marshal`/`Encode` 等编码函数返回紧凑 JSON；需要缩进、重排或压缩已有文本时，按输入类型选下表的函数。

## 格式化工具对照

按「输入是 Go 值还是 JSON 文本」选择工具：

| 函数 | 输入 | 输出 | 典型用途 |
|------|------|------|----------|
| `Marshal(v, cfg...)` | Go 值 | `[]byte` 紧凑 | 标准库签名，最通用 |
| `Encode(v, cfg...)` | Go 值 | `string` 紧凑 | 推荐入口（可带配置） |
| `EncodePretty(v, cfg...)` | Go 值 | `string` 缩进 | 直接编码并美化 |
| `MarshalIndent(v, prefix, indent)` | Go 值 | `[]byte` 缩进 | 标准库签名，兼容旧代码 |
| `Prettify(jsonStr, cfg...)` | JSON 文本 | `string` 缩进 | 美化已有 JSON 文本 |
| `Compact(dst, src)` | JSON 文本 | 写入 `*bytes.Buffer` | 压缩已有文本 |
| `CompactString(jsonStr)` | JSON 文本 | `string` 紧凑 | 压缩已有文本（免 buffer） |
| `Indent(dst, src, prefix, indent)` | JSON 文本 | 写入 `*bytes.Buffer` | 重排缩进 |
| `HTMLEscape(dst, src)` | JSON 文本 | 写入 `*bytes.Buffer` | 转义 `<` `>` `&` |
| `NewEncoder(w)` + `SetIndent` | Go 值 | 写入 `io.Writer` | 流式输出（文件/网络） |

::: tip 三步选型
1. 输入是 **Go 值**：要 `[]byte` 用 `Marshal`，要 `string` 用 `Encode`；需要缩进时分别换 `MarshalIndent`、`EncodePretty`
2. 输入已是 **JSON 文本**：美化用 `Prettify`，压缩用 `CompactString`；需要与标准库签名一致时用 buffer 版 `Compact`/`Indent`
3. 输出到**流**（文件/网络）：`NewEncoder` + `SetIndent` 逐条写出，避免拼一个大字符串
:::

## 自定义缩进

`EncodePretty` 默认两空格缩进。需要其他缩进时用 `Config.Pretty` + `Config.Indent`，或直接用标准库签名的 `MarshalIndent`：

```go
package main

import (
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	data := map[string]any{"name": "Alice", "age": 30}

	// 方式一：标准库签名 MarshalIndent（prefix 留空）
	b, err := json.MarshalIndent(data, "", "    ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
	// 输出：
	// {
	//     "age": 30,
	//     "name": "Alice"
	// }

	// 方式二：EncodePretty + 配置（制表符缩进）
	cfg := json.DefaultConfig()
	cfg.Pretty = true
	cfg.Indent = "\t"
	s, err := json.EncodePretty(data, cfg)
	if err != nil {
		panic(err)
	}
	fmt.Println(s)
}
```

::: tip
`json.PrettyConfig()` 是现成预设：默认配置 + `Pretty: true` + 两空格缩进，等价于 `EncodePretty` 的默认行为。
:::

## 处理已有 JSON 文本

输入已是 JSON 文本（日志、接口返回）时，用格式化函数就地转换，不必先解码成结构体：

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	pretty := "{\n  \"name\": \"Alice\",\n  \"age\": 30\n}"

	// 压缩：去除所有非必要空白
	var compact bytes.Buffer
	if err := json.Compact(&compact, []byte(pretty)); err != nil {
		panic(err)
	}
	fmt.Println(compact.String())
	// 输出：{"name":"Alice","age":30}

	// 免 buffer 版：CompactString 直接返回字符串
	s, err := json.CompactString(pretty)
	if err != nil {
		panic(err)
	}
	fmt.Println(s)

	// 重排：换一种缩进风格
	var reindented bytes.Buffer
	if err := json.Indent(&reindented, []byte(pretty), "", "\t"); err != nil {
		panic(err)
	}
	fmt.Println(reindented.String())
	// 输出：
	// {
	// 	"name": "Alice",
	// 	"age": 30
	// }
}
```

## HTML 安全转义

`HTMLEscape` 与标准库签名一致：把 JSON 文本中的 `<`、`>`、`&`、U+2028、U+2029 转义为 `\u00XX` 形式，避免 JSON 内嵌 HTML 时被浏览器误解析。它只做**字符级转义**，不重新编码、不改空白：

```go
package main

import (
	"bytes"
	"fmt"

	"github.com/cybergodev/json"
)

func main() {
	src := []byte(`{"html":"<b>bold</b>","url":"a&b"}`)

	var buf bytes.Buffer
	json.HTMLEscape(&buf, src)
	out := buf.String()
	fmt.Println(out)
	// 输出的引号内不再有裸露的 <、>、&，
	// 它们分别被替换为 \u00XX 形式的转义序列，其余内容原样保留
}
```

::: tip 什么时候需要手动转义？
`Marshal`/`Encode` 默认已开启 HTML 转义（`Config.EscapeHTML: true`），编码产物本身是安全的。`HTMLEscape` 用于处理**外部拿到的 JSON 文本**——比如把第三方返回的 JSON 原样内嵌到 HTML 页面时，先过一遍再输出。
:::

## 流式输出到 Writer

写文件或网络流时，用 `NewEncoder`（标准库签名）避免整块拼字符串：

```go
package main

import (
	"os"

	"github.com/cybergodev/json"
)

func main() {
	type Item struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")

	for _, item := range []Item{{1, "Alice"}, {2, "Bob"}} {
		if err := enc.Encode(item); err != nil {
			panic(err)
		}
	}
	// 输出：
	// {
	//   "id": 1,
	//   "name": "Alice"
	// }
	// {
	//   "id": 2,
	//   "name": "Bob"
	// }
}
```

`Encoder.Encode` 与标准库一致，每条记录后自动换行——逐条输出日志、写 JSONL 文件都很自然。

## 完整示例

```go
package main

import (
	"fmt"
	"github.com/cybergodev/json"
	"log"
)

func main() {
	data := map[string]any{
		"users": []any{
			map[string]any{"id": 1, "name": "Alice"},
			map[string]any{"id": 2, "name": "Bob"},
		},
		"total": 2,
	}

	// 紧凑输出
	compact, err := json.Encode(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(compact)

	// 格式化输出
	pretty, err := json.EncodePretty(data)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(pretty)
}
```

## 历史沿革：已移除的 Print 系列

早期版本的 Print、PrintPretty、PrintE、PrintPrettyE 四个直接打印函数已在库中移除，不再提供。格式化 JSON 改用 [`Prettify`](../api-reference/index#格式化) 或标准库兼容的 `MarshalIndent`。各场景的替代方案如下。

### 打印紧凑 JSON

使用 `fmt.Println` + `Encode`（推荐）或 `Marshal`：

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 输出：{"age":30,"name":"Alice"}

// 或者使用 Marshal（[]byte 输出）
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning EncodeWithConfig 已废弃
`json.EncodeWithConfig` 已标记为废弃（与 `Encode` 功能等价），在 v1 生命周期内保留、不会移除。新代码用 `Encode` 或 `Marshal`。
:::

### 打印格式化 JSON

使用 `fmt.Println` + `EncodePretty`：

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// 输出：
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### 打印 JSON 字符串（美化已有 JSON）

使用 `Prettify`：

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
// 输出：
// {
//   "name": "Alice",
//   "age": 30
// }
```

### 使用 Processor 打印

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// 编码并打印（推荐 Encode）
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// 格式化打印
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## 相关

- [编码输出函数](../api-reference/functions/output) - Encode、EncodePretty、Prettify
- [包函数](../api-reference/functions/) - 包级函数总览
