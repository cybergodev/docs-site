---
sidebar_label: "编码检测实战"
title: "编码检测实战 - CyberGo html | 字符编码自动识别指南"
description: "CyberGo html 编码检测实战：从 HTML 字节判定字符编码并转 UTF-8，说明 Config.Encoding、BOM、meta 声明、合法 UTF-8 快路径与 windows-1252 兜底的先后顺序，附 32 种转换编码清单、GBK 与 Shift_JIS 示例及失败条件。"
sidebar_position: 50
---

# 编码检测实战

HTML 文档的字符编码由 `Config.Encoding`、BOM、`<meta>` 声明或数据本身决定。本页说明判定顺序、支持的编码，以及无声明页面会得到什么结果。

## 检测优先级

检测分两阶段：基础检测给出候选编码，随后对候选打分——得分 ≥90 直接采纳；基础结果为 `utf-8` 且得分 70–89 也采纳；其余进入统计打分。

| 优先级 | 阶段 | 来源 | 说明 |
|--------|------|------|------|
| ① | 强制 | `Config.Encoding` | 非空时直接使用，跳过后续全部检测 |
| ② | 基础 | BOM | UTF-8（`EF BB BF`）、UTF-16 LE（`FF FE`）、UTF-16 BE（`FE FF`） |
| ③ | 基础 | 纯 ASCII | 有 `<meta>` 声明则用声明值，否则按 UTF-8 |
| ④ | 基础 | 合法 UTF-8（含非 ASCII） | 直接按 UTF-8，**忽略** meta 声明 |
| ⑤ | 基础 | meta 声明 | `<meta charset>` 或 `http-equiv="content-type"`，只扫描前 1024 字节 |
| ⑥ | 基础 | windows-1252 兜底 | 以上都不成立时 |
| ⑦ | 统计 | 13 个候选编码打分 | 基础结果得分不足 90 时启用（`utf-8` 候选 70–89 分直接采纳）；采样最多 10KB |

第 ③ 与第 ④ 条的区别在于：纯 ASCII 数据本身不携带编码信息，所以先看声明；含非 ASCII 字节的合法 UTF-8 数据则直接采信数据——有页面声明 legacy 编码而实际输出 UTF-8。

```text
Config.Encoding 非空？── 是 ──→ 直接使用
        │
        否
        │
BOM？── 是 ──→ 使用 BOM 编码
        │
        否
        │
纯 ASCII？── 是 ──→ 有 meta 声明用声明值，否则 UTF-8
        │
        否
        │
合法 UTF-8？── 是 ──→ UTF-8（忽略 meta 声明）
        │
        否
        │
meta 声明？── 是 ──→ 使用声明值
        │
        否
        │
windows-1252 兜底
```

基础检测得出的编码还要过一遍打分，未达到采纳阈值的进入统计打分：采样 ≤10KB，对 13 个候选编码解码后打分，取最高分。

:::tip BOM 优先于 meta 声明
BOM 是数据自带的编码声明，在基础检测中最先检查。BOM 存在时直接确定编码，不再看 meta 声明。
:::

## 支持的编码

| 分类 | 编码 | 备注 |
|------|------|------|
| Unicode | UTF-8、UTF-16LE、UTF-16BE | UTF-8 走直通快路径，不进入转换表；纯 ASCII / 合法 UTF-8 输入直接按 UTF-8 处理 |
| 西欧 | Windows-1252、ISO-8859-1、ISO-8859-15 | ISO-8859-15 含欧元符号 |
| 中欧 | Windows-1250、ISO-8859-2、ISO-8859-3、ISO-8859-4 | ISO-8859-3 为南欧、ISO-8859-4 为波罗的海 |
| 西里尔 | Windows-1251、KOI8-R、ISO-8859-5 | 俄语等 |
| 希腊 | Windows-1253、ISO-8859-7 | — |
| 土耳其 | Windows-1254、ISO-8859-9 | — |
| 希伯来 | Windows-1255、ISO-8859-8 | — |
| 阿拉伯 | Windows-1256、ISO-8859-6 | — |
| 越南语 | Windows-1258 | — |
| 其他 ISO-8859 | ISO-8859-10（北欧）、ISO-8859-13（波罗的海）、ISO-8859-14（凯尔特）、ISO-8859-16（东南欧） | 系列不含 -11/-12 |
| 简体中文 | GBK、GB18030 | `gb2312` 自动归一化为 `gbk` |
| 繁体中文 | Big5 | — |
| 日语 | Shift_JIS、EUC-JP、ISO-2022-JP | — |
| 韩语 | EUC-KR | — |

转换注册表合计支持 32 种转换编码；UTF-8 不在其中，走直通快路径。

### 编码别名归一化

编码名称与别名**不区分大小写**，自动归一化为标准名。常见别名示例（别名表未穷举）：

| 输入别名 | 归一化结果 |
|----------|-----------|
| `gb2312`、`GB2312` | `gbk` |
| `sjis`、`x-sjis`、`shift-jis` | `shift_jis` |
| `latin1`、`latin-1` | `iso-8859-1` |
| `utf8`、`utf_8` | `utf-8` |
| `8859-1`、`iso88591` | `iso-8859-1` |
| `cp1252`、`windows1252` | `windows-1252` |

## 带 meta 声明的 GBK 页面

GBK 编码的中文页面在 `<meta charset>` 中声明编码，基础检测据此识别：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func main() {
	// GBK 编码的中文 HTML（meta 标签声明 charset=gbk）
	gbkHTML := `<html><head><meta charset="gbk">` +
		`<title>中文网页</title></head>` +
		`<body><article><h1>你好世界</h1>` +
		`<p>这是一段中文内容。</p></article></body></html>`

	// 将 UTF-8 字符串编码为 GBK 字节（模拟真实 GBK 网页）
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(gbkHTML))
	if err != nil {
		log.Fatal(err)
	}

	// 自动检测：从 meta charset 识别 GBK，转 UTF-8 后提取
	result, err := html.Extract(gbkBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	// 标题：中文网页

	fmt.Println("正文：", result.Text)
	// 正文：# 你好世界
	//       这是一段中文内容。
}
```

## 手动指定编码

meta 缺失、声明有误，或已知来源编码时，用 `Config.Encoding` 直接指定：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"

result, err := html.Extract(gbkBytes, cfg)
```

| 适用场景 | 说明 |
|----------|------|
| 已知来源编码 | 从 HTTP `Content-Type` 头取到编码后直接指定 |
| 无 meta 声明的旧页面 | GBK/Shift_JIS 页面缺少 `<meta charset>`，会被兜底成 windows-1252 乱码 |
| 声明与数据不符 | meta 声明错误时以 `Config.Encoding` 为准 |

:::tip Config.Encoding 会跳过全部检测
设置 `Config.Encoding` 后，库不读 BOM、不看 meta、也不跑统计打分，直接按指定编码解码。它适合确定性场景；反过来，指定错误会直接得到乱码或报错。
:::

### 无声明编码的页面会得到乱码

:::warning 缺少 meta 声明时不返回错误
没有 `<meta charset>` 的 GBK 或 Shift_JIS 页面，基础检测兜底为 windows-1252。实测这类页面解码出乱码，且 `err == nil`，调用方无法从 `err` 察觉。统计打分能否纠正视内容而定，不应依赖它兜底。生产上应显式设置 `Config.Encoding`，或从 HTTP 响应头取得编码。
:::

### Shift_JIS 页面：靠 meta 声明识别

Shift_JIS 编码的日文页面，声明 `<meta charset="shift_jis">` 后由基础检测识别：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/japanese"
)

func main() {
	// Shift_JIS 编码的日文 HTML（meta 声明 charset=shift_jis）
	sjisHTML := `<html><head><meta charset="shift_jis">` +
		`<title>日本語ページ</title></head>` +
		`<body><article><h1>こんにちは</h1>` +
		`<p>東京の天気は晴れです。</p></article></body></html>`

	// 编码为 Shift_JIS 字节
	sjisBytes, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte(sjisHTML))
	if err != nil {
		log.Fatal(err)
	}

	// 基础检测读取 meta 声明，转 UTF-8 后提取
	result, err := html.Extract(sjisBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	// 标题：日本語ページ

	fmt.Println("正文：", result.Text)
	// 正文：# こんにちは
	//       東京の天気は晴れです。
}
```

同样的字节去掉 meta 声明后，标题会变成乱码（形如 `“ъ–{ЊкѓyЃ[ѓW`），`err` 仍为 `nil`。若来源无法添加声明，就显式指定编码：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "shift_jis"

result, err := html.Extract(sjisBytes, cfg)
```

### Windows-1252 手动指定

西欧编码（含 `é`、`€` 等字符）可手动指定：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/charmap"
)

func main() {
	// Windows-1252 编码的西欧文本
	winHTML := `<html><head><title>Café Menu</title></head>` +
		`<body><article><h1>Café</h1>` +
		`<p>Price: 100 €. Résumé available.</p></article></body></html>`

	winBytes, err := charmap.Windows1252.NewEncoder().Bytes([]byte(winHTML))
	if err != nil {
		log.Fatal(err)
	}

	// 手动指定 Windows-1252 编码
	cfg := html.DefaultConfig()
	cfg.Encoding = "windows-1252"

	result, err := html.Extract(winBytes, cfg)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	// 标题：Café Menu

	fmt.Println("正文：", result.Text)
	// 正文：# Café
	//       Price: 100 €. Résumé available.
}
```

## 编码检测失败

`encoding detection failed` 只在**指定的编码与数据不符**时出现，也就是强制指定了错误编码。两种情况：

| 情况 | 错误消息 |
|------|----------|
| 指定 `"utf-8"`，但数据不是合法 UTF-8 | `encoding detection failed: declared charset "utf-8" but data is not valid UTF-8` |
| 指定了不支持的编码名，且数据不是合法 UTF-8 | `encoding detection failed: unsupported encoding "..."` |

```go
// data 实际是 GBK，却强制按 UTF-8 解码
cfg := html.DefaultConfig()
cfg.Encoding = "utf-8"

_, err := html.Extract(gbkBytes, cfg)
if err != nil {
    log.Println(err)
    // encoding detection failed: declared charset "utf-8" but data is not valid UTF-8
}
```

:::warning 按消息前缀判断，没有哨兵错误
这类错误没有可用的哨兵值，`errors.Is` 无法命中，只能按 `"encoding detection failed"` 前缀匹配。反过来，数据没有声明编码时库不会报这个错——它按 windows-1252 静默解码，得到乱码。因此「检测失败就回退重试」并不能发现乱码页面，编码应从来源确定。
:::

## 审计记录

启用审计后，编码转换失败会记为 `AuditEventEncodingIssue`（info 级别）：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.Audit = html.DefaultAuditConfig()
	cfg.Audit.Enabled = true
	cfg.Encoding = "utf-8" // 强制 UTF-8，让 GBK 字节转换失败
	// LogEncodingIssues 默认为 true（DefaultAuditConfig 已启用）

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// GBK 编码的「你好」，按 UTF-8 解码会失败并记入审计日志
	gbkBytes := []byte{0xC4, 0xE3, 0xBA, 0xC3}
	if _, err := p.Extract(gbkBytes); err != nil {
		fmt.Println("提取失败：", err)
		// 提取失败： encoding detection failed: declared charset "utf-8" but data is not valid UTF-8
	}

	for _, entry := range p.GetAuditLog() {
		if entry.EventType == html.AuditEventEncodingIssue {
			fmt.Printf("[编码问题] %s\n", entry.Message)
			// [编码问题] declared charset "utf-8" but data is not valid UTF-8
		}
	}
}
```

:::tip 何时记录该事件
`AuditEventEncodingIssue` 只在编码转换失败时记录，也就是强制指定了错误编码的情况。正常文档不会产生此事件。该事件属于 `info` 级别（最低），表示解码结果不可靠，但不影响安全判定。需要过滤时用 `NewLevelFilteredSink` 把最低级别设为 `warning`。
:::

## 下一步

- [内容提取实战](./content-extraction) - 提取流程与文章识别
- [错误处理](../performance/error-handling) - 哨兵错误与结构化错误处理
- [API 参考：配置](../../api-reference/core/config) - Encoding 字段与全部配置项
