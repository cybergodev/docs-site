---
sidebar_label: "编码检测实战"
title: "编码检测实战 - CyberGo html | 字符编码自动识别指南"
description: "CyberGo html 字符编码自动识别指南：四级检测优先级详解（手动指定、meta 标签声明、统计算法、UTF-8 兜底）、15+ 编码支持、Config.Encoding 手动指定与 GBK、Shift_JIS、Windows-1252 自动检测示例。"
sidebar_position: 5
---

# 编码检测实战

HTML 文档可能使用各种字符编码（GBK、Shift_JIS、Windows-1252 等）。库内置自动编码检测，从 HTML 字节识别编码并转 UTF-8，支持 15+ 种编码，无需手动处理。

## 检测优先级

库按以下顺序确定输入编码，依次尝试，首个命中即生效：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| ① 最高 | `Config.Encoding` 手动指定 | 非空时直接使用，跳过所有自动检测 |
| ② | HTML meta 标签声明 | `<meta charset>` 或 `http-equiv="content-type"`，扫描前 1024 字节 |
| ③ | 统计算法智能检测 | 采样最多 10KB，置信度 ≥ 80 才采纳 |
| ④ 兜底 | UTF-8 | 以上均未命中时回退 UTF-8 |

```text
Config.Encoding 非空？── 是 ──→ 直接使用
        │
        否
        │
meta 标签声明编码？── 是 ──→ 使用声明值
        │
        否
        │
统计算法置信度 ≥ 80？── 是 ──→ 采纳统计结果
        │
        否
        │
        └──→ UTF-8
```

:::tip BOM 检测
除上述四级外，库还会检测 BOM（字节顺序标记）：UTF-8 BOM（`EF BB BF`）、UTF-16 LE BOM（`FF FE`）、UTF-16 BE BOM（`FE FF`）。BOM 存在时直接确定编码。
:::

## 支持的编码

| 分类 | 编码 | 备注 |
|------|------|------|
| Unicode | UTF-8、UTF-16LE、UTF-16BE | 默认回退 UTF-8 |
| 西欧 | Windows-1252、ISO-8859-1、ISO-8859-15 | ISO-8859-15 含欧元符号 |
| 中欧 | Windows-1250 | — |
| 西里尔 | Windows-1251 | 俄语等 |
| 简体中文 | GBK | 别名 `gb2312` 自动归一化为 `gbk` |
| 繁体中文 | Big5 | — |
| 日语 | Shift_JIS、EUC-JP | — |
| 韩语 | EUC-KR | — |

### 编码别名归一化

编码名称和别名**不区分大小写**，自动归一化为标准名：

| 输入别名 | 归一化结果 |
|----------|-----------|
| `gb2312`、`GB2312` | `gbk` |
| `sjis`、`x-sjis`、`shift-jis` | `shift_jis` |
| `latin1`、`latin-1` | `iso-8859-1` |
| `utf8`、`utf_8` | `utf-8` |
| `8859-1`、`iso88591` | `iso-8859-1` |
| `cp1252`、`windows1252` | `windows-1252` |

## 自动检测示例

GBK 编码的中文 HTML，通过 meta 标签声明自动识别：

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

	// 自动检测编码并提取（从 meta charset 识别 GBK，转 UTF-8 后提取）
	result, err := html.Extract(gbkBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	// 标题：中文网页

	fmt.Println("正文：", result.Text)
	// 正文：你好世界
	//       这是一段中文内容。
}
```

## 手动指定编码

当 meta 标签缺失、声明错误，或自动检测结果不确定时，通过 `Config.Encoding` 强制指定：

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"

result, err := html.Extract(gbkBytes, cfg)
```

| 适用场景 | 说明 |
|----------|------|
| 已知来源编码 | 从 HTTP `Content-Type` 头获取编码，直接指定避免误检 |
| meta 标签缺失 | 无 `<meta charset>` 声明的旧网页 |
| 自动检测出错 | 统计算法置信度不足，结果不正确 |

:::tip Config.Encoding 优先级最高
设置 `Config.Encoding` 后，库完全跳过自动检测，直接使用指定编码解码。适合确定性场景，避免统计检测的不确定性。
:::

### Shift_JIS 自动检测实战

日文网页常使用 Shift_JIS 编码。即使没有 meta 声明，统计算法也能识别：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/japanese"
)

func main() {
	// Shift_JIS 编码的日文 HTML（无 meta charset 声明）
	sjisHTML := `<html><head><title>日本語ページ</title></head>` +
		`<body><article><h1>こんにちは</h1>` +
		`<p>東京の天気は晴れです。</p></article></body></html>`

	// 编码为 Shift_JIS 字节
	sjisBytes, err := japanese.ShiftJIS.NewEncoder().Bytes([]byte(sjisHTML))
	if err != nil {
		log.Fatal(err)
	}

	// 统计算法自动识别 Shift_JIS（采样字节分析日文字符分布）
	result, err := html.Extract(sjisBytes)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("标题：", result.Title)
	// 标题：日本語ページ

	fmt.Println("正文：", result.Text)
	// 正文：こんにちは
	//       東京の天気は晴れです。
}
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
	// 正文：Café
	//       Price: 100 €. Résumé available.
}
```

## 编码检测失败

当编码检测或转换失败时（如数据损坏、使用了不支持的编码），返回 wrapping error：

```go
result, err := html.Extract(data)
if err != nil {
    if strings.Contains(err.Error(), "encoding detection failed") {
        // 编码检测失败，fallback 手动指定
        cfg := html.DefaultConfig()
        cfg.Encoding = "windows-1252"
        result, err = html.Extract(data, cfg)
        if err != nil {
            log.Fatal(err)
        }
    } else {
        log.Fatal(err)
    }
}
```

:::warning 错误消息格式
编码检测失败的错误消息固定包含 `"encoding detection failed"` 前缀，可用 `strings.Contains` 匹配。检测失败时建议 fallback 到手动指定编码。
:::

## 审计记录

启用审计后，编码检测问题会记录为 `AuditEventEncodingIssue`（info 级别）：

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
	// LogEncodingIssues 默认为 true（DefaultAuditConfig 已启用）

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 处理 HTML（编码问题时自动记录到审计日志）
	p.Extract([]byte(`<html><body><p>content</p></body></html>`))

	// 查询审计日志中的编码事件
	for _, entry := range p.GetAuditLog() {
		if entry.EventType == html.AuditEventEncodingIssue {
			fmt.Printf("[编码问题] %s\n", entry.Message)
		}
	}

	fmt.Println("编码事件检查完成")
	// 编码事件检查完成
}
```

:::tip 触发条件
`AuditEventEncodingIssue` 仅在编码检测或转换失败时记录（如使用了不支持的编码且数据非有效 UTF-8）。正常文档不会产生此事件。编码问题属于 `info` 级别（最低），表明数据可能未被完美解码但不影响安全性。如需过滤，使用 `LevelFilteredSink` 设置最低级别为 `warning` 即可排除。
:::

## 下一步

- [内容提取实战](./content-extraction) - 提取流程与文章识别
- [错误处理](../performance/error-handling) - 哨兵错误与结构化错误处理
- [API 参考：配置](../../api-reference/core/config) - Encoding 字段与所有配置选项
