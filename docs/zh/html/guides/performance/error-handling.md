---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo html | 超时、编码与文件错误"
description: "CyberGo html 错误处理：五类错误与哨兵清单、errors.Is 与 errors.As 的用法、路径遍历与 AllowedBaseDir 越界的哨兵差异、ProcessingTimeout 与调用方 context 的超时差异，附 FileError 路径脱敏与 HTTP 映射。"
sidebar_position: 40
---

# 错误处理

html 库的错误处理以 `error` 返回值为中心：所有失败都通过 `error` 返回，库内 panic 会被恢复为 `ErrInternalPanic`。本页覆盖错误分类与判断方式，以及超时、编码、文件路径三类高频错误的处理规则。

## 错误分类

| 类别 | 哨兵错误 | 触发来源 |
|------|----------|----------|
| 输入错误 | `ErrInputTooLarge`, `ErrInvalidHTML`, `ErrBatchTooLarge` | 输入内容本身 |
| 配置错误 | `ErrInvalidConfig`, `ErrMultipleConfigs` | 配置值或调用方式 |
| 文件错误 | `ErrFileNotFound`, `ErrInvalidFilePath` | 文件读取与路径校验 |
| 处理错误 | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | 超时预算，或由输入结构触发的深度超限 |
| 系统错误 | `ErrProcessorClosed`, `ErrInternalPanic`, `ErrTooManyConcurrentOps` | 生命周期、内部故障、并发上限 |

12 个哨兵错误的完整清单、错误消息原文与三个结构化类型的字段定义见 [API 参考：常量与错误](../../api-reference/types/constants#哨兵错误)；本页只展开判断方法与处理策略。

## 判断错误：errors.Is 与 errors.As

`errors.Is` 沿 `Unwrap` 链匹配哨兵错误；`errors.As` 取出结构化错误后读取字段。

| 结构化类型 | 字段 | 用途 |
|------------|------|------|
| `*InputError` | `Op`、`Size`、`MaxSize`、`InputErr` | 输入大小与读取失败 |
| `*ConfigError` | `Field`、`Value`、`Message` | 定位非法配置项 |
| `*FileError` | `Op`、`Path`、`FileErr` | 文件操作；`SafePath()` 给出脱敏路径 |

判断顺序：先系统错误（`ErrProcessorClosed`、`ErrInternalPanic`、`ErrTooManyConcurrentOps`），再用 `errors.As` 取文件错误，最后是输入与配置错误。

路径遍历错误**匹配** `ErrInvalidFilePath`（见[错误包装链](#错误包装链)）；唯一不匹配任何哨兵的是 `AllowedBaseDir` 越界，判断方式同样见该节。

## 错误包装链

三种结构化错误类型都实现了 `Unwrap`，它决定 `errors.Is` / `errors.As` 能否命中：

| 类型 | `Unwrap()` 返回值 | 结果 |
|------|-------------------|------|
| `*InputError` | `Unwrap() []error`：`InputErr` 非 nil → `[InputErr, ErrInputTooLarge]`，否则 → `[ErrInputTooLarge]` | `errors.Is(err, ErrInputTooLarge)` 对任意 `*InputError` 成立 |
| `*ConfigError` | 始终 `ErrInvalidConfig` | 固定映射 |
| `*FileError` | ① `errors.Is(FileErr, ErrFileNotFound)` 成立 → `ErrFileNotFound`；② 否则 `FileErr != nil` → `FileErr`；③ 否则 → `ErrInvalidFilePath` | 三级回退 |

:::warning 两类文件路径拒绝的哨兵归属不同

**路径遍历**（路径含 `..` 组件）：`FileErr` 形如 `path traversal detected: <cleanPath>: html: invalid file path`，末尾包装了 `ErrInvalidFilePath`。因此 `errors.Is(err, html.ErrInvalidFilePath)` 返回 `true`。要区分遍历与其他路径错误，仍须 `errors.As` 取出 `*FileError`，再检查 `FileErr` 消息中的 `path traversal`。

**`AllowedBaseDir` 越界**（真实路径落在允许目录之外）：`FileErr` 是 `path outside allowed directory`，未包装任何哨兵，`errors.Is` 对 `ErrFileNotFound` 与 `ErrInvalidFilePath` 都返回 `false`。这种情况只能按 `FileErr` 的消息判断。

:::

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// diagnose 打印错误能命中的哨兵错误与结构化字段。
func diagnose(err error) {
	var inputErr *html.InputError
	if errors.As(err, &inputErr) {
		fmt.Printf("InputError: op=%s size=%d max=%d\n", inputErr.Op, inputErr.Size, inputErr.MaxSize)
	}

	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Printf("FileError: op=%s safePath=%s\n", fileErr.Op, fileErr.SafePath())
		if fileErr.FileErr != nil && strings.Contains(fileErr.FileErr.Error(), "path traversal") {
			fmt.Println("安全事件：路径遍历")
		}
	}

	fmt.Printf("Is(ErrInputTooLarge)=%v Is(ErrFileNotFound)=%v Is(ErrInvalidFilePath)=%v\n",
		errors.Is(err, html.ErrInputTooLarge),
		errors.Is(err, html.ErrFileNotFound),
		errors.Is(err, html.ErrInvalidFilePath))
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 输入过大：*InputError 命中 ErrInputTooLarge
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	diagnose(err)
	// 输出：
	// InputError: op=Extract size=200 max=100
	// Is(ErrInputTooLarge)=true Is(ErrFileNotFound)=false Is(ErrInvalidFilePath)=false

	// 路径遍历：*FileError 的 FileErr 包装 ErrInvalidFilePath
	_, err = p.ExtractFromFile("../../../etc/passwd")
	diagnose(err)
	// 输出：
	// FileError: op=ReadFile safePath=passwd
	// 安全事件：路径遍历
	// Is(ErrInputTooLarge)=false Is(ErrFileNotFound)=false Is(ErrInvalidFilePath)=true
}
```

## 超时与取消

`ExtractWithContext` 返回哪种错误取决于哪个 deadline 先到期：

| 场景 | 返回错误 |
|------|----------|
| 库内 `ProcessingTimeout` 到期，用户 ctx 仍有效 | `ErrProcessingTimeout` |
| 用户 ctx deadline 先到期（或与库内超时同时到期） | `context.DeadlineExceeded`，原样透传 |
| 用户主动 `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0`（不限时）且用户 ctx 到期 | `context.DeadlineExceeded`（库不派生超时） |

`ProcessingTimeout > 0` 时，库用 `context.WithTimeout(parentCtx, ProcessingTimeout)` 派生 deadline，实际生效的是两者中较早者。只有当派生 deadline 触发、且 `ctx.Err() == nil` 时，错误才归一化为 `ErrProcessingTimeout`。

用户 deadline 与 `cancel()` 原样返回，所以用户超时时 `errors.Is(err, html.ErrProcessingTimeout)` 为 `false`。

超时不会强制终止处理：库立即返回，提取 goroutine 在下一个协作检查点退出。用户 `cancel()` 的返回是 `context.Canceled`，同样不归一化。

示例配置了 30s 的库内预算，传入的 deadline 已到期，输出因此是确定的：

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig() // ProcessingTimeout = 30s
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	doc := []byte(`<html><body><article><h1>标题</h1><p>正文</p></article></body></html>`)

	// 用户 deadline 已到期：返回 context.DeadlineExceeded，不归一化
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	_, err = p.ExtractWithContext(ctx, doc)
	fmt.Println(errors.Is(err, html.ErrProcessingTimeout)) // false
	fmt.Println(errors.Is(err, context.DeadlineExceeded))  // true
}
```

## 批量错误

批量返回 `*BatchResult` 而非 `error`，失败信息逐项保存在 `Errors` 中：

| 情况 | 计数 | `Errors[i]` |
|------|------|-------------|
| 单项失败（文件不存在等） | 该项计入 `Failed`，其他项正常返回 | 该项的错误 |
| 整批拒绝（超过 10000 项、Processor 已关闭） | `Failed` 等于输入项数 | 同一个错误填进每一项 |
| 上下文取消 | 未开始的项计入 `Cancelled`，已完成项结果保留 | `ctx.Err()` |

超限错误的文案是 `html: batch size exceeds maximum: N exceeds maximum 10000`，可用 `errors.Is(err, html.ErrBatchTooLarge)` 判断。批量 API 与并发调优见[批量处理实战](./batch-processing)。

## 错误恢复策略

| 错误 | 恢复动作 |
|------|----------|
| `ErrProcessingTimeout` | 关闭 `ExtractArticle` 或改用 `TextOnlyConfig()`；确认文档合法后再延长 `ProcessingTimeout` |
| `context.DeadlineExceeded` | 调用方预算不足：放宽 `context.WithTimeout`，或把处理移出请求路径 |
| `context.Canceled` | 调用方已放弃，不重试 |
| `ErrInputTooLarge` | 入口处按 `MaxInputSize` 拒绝；上限不能调高 |
| `encoding detection failed` | 该来源的编码标错：改用真实编码 |
| `ErrFileNotFound` | 返回 404 或跳过该项（批量中只影响该项） |
| `ErrInvalidFilePath` / 路径遍历 | 拒绝并记审计（遍历命中 `ErrInvalidFilePath`） |
| `path outside allowed directory` | `AllowedBaseDir` 越界，无哨兵：按 `FileErr` 消息拒绝并记审计 |
| `ErrMaxDepthExceeded` | 由输入结构触发：拒绝，或先裁剪结构 |
| `ErrTooManyConcurrentOps` | 进程级超时 goroutine 已达 1000：降低并发或稍后重试 |
| `ErrProcessorClosed` / `ErrInvalidConfig` / `ErrMultipleConfigs` | 编程错误：修代码，不重试 |
| `ErrInternalPanic` | 上报 issue，附输入样本 |

### 编码：按来源指定，不要等失败后重试

`encoding detection failed` 只在声明或强制的编码与实际字节冲突时出现，共两种情况：

- 强制 `Config.Encoding = "utf-8"`（或页面声明 utf-8）但数据不是合法 UTF-8 → `encoding detection failed: declared charset "utf-8" but data is not valid UTF-8`
- 强制了不支持的编码名且数据不是合法 UTF-8 → `encoding detection failed: unsupported encoding "..."`

无 `<meta charset>` 的 GBK、Shift_JIS 页面不会报错：库按 windows-1252 兜底解码，得到乱码且 `err == nil`（完整行为见[编码检测实战](../core-features/encoding-detection#无声明编码的页面会得到乱码)）。所以「检测失败再换编码重试」不会触发。按来源显式指定编码：HTTP `Content-Type` 头、站点白名单，或对已知来源写死 `Config.Encoding`。

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func main() {
	// GBK 编码的 HTML，没有 <meta charset> 声明
	utf8HTML := `<html><head><title>测试</title></head>` +
		`<body><article><h1>标题</h1><p>你好世界</p></article></body></html>`
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(utf8HTML))
	if err != nil {
		log.Fatal(err)
	}

	// 1. 不声明编码：不报错，按 windows-1252 兜底解码 → 乱码
	_, err = html.Extract(gbkBytes)
	fmt.Printf("自动检测：err = %v\n", err)
	// 输出：自动检测：err = <nil>

	// 2. 强制 utf-8 解 GBK 字节：这才是 encoding detection failed 的场景
	cfg := html.DefaultConfig()
	cfg.Encoding = "utf-8"
	_, err = html.Extract(gbkBytes, cfg)
	fmt.Println(err)
	// 输出：encoding detection failed: declared charset "utf-8" but data is not valid UTF-8

	// 3. 按来源指定真实编码
	cfg.Encoding = "gbk"
	result, err := html.Extract(gbkBytes, cfg)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title)
	// 输出：测试
}
```

该错误是普通 `fmt.Errorf` 包装，没有对应哨兵，只能按消息前缀 `encoding detection failed` 判断。

### 输入过大：在入口处限制

`ErrInputTooLarge` 表示输入超过 `Config.MaxInputSize`。默认值 50MB 同时也是配置上限，因此只能调小，不能调高。实际字节数与上限在 `InputError.Size` 与 `MaxSize` 中，直接回给调用方即可。

## FileError 的路径脱敏

`FileError` 在输出时截断路径，避免错误消息泄露服务器目录结构：

| 层次 | 方法 | 行为 |
|------|------|------|
| 错误消息 | `Error()` | 只显示 basename，底层错误消息同步脱敏 |
| 路径截断 | `SafePath()` | `/var/data/secret/page.html` → `page.html` |
| 错误清洗 | `sanitizeErrorMessage()` | 保留错误类型（path traversal / not found / permission denied），移除路径 |
| JSON 序列化 | `MarshalJSON()` | 序列化为 `{op, path, message}`，`path` 经 `SafePath()` |
| 内部调试 | `Path` 字段 | 保留完整路径，不要对外输出 |

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	_, err := html.ExtractFromFile("/var/www/private/secret.html", html.DefaultConfig())
	if err != nil {
		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			fmt.Printf("Error(): %v\n", fileErr)
			// 输出：Error(): html: ReadFile "secret.html": file not found

			fmt.Printf("SafePath(): %s\n", fileErr.SafePath())
			// 输出：SafePath(): secret.html

			raw, _ := json.Marshal(fileErr)
			fmt.Printf("MarshalJSON(): %s\n", raw)
			// 输出：MarshalJSON(): {"op":"ReadFile","path":"secret.html","message":"file not found"}
		}
	}
}
```

:::tip 客户端响应只带 SafePath

`json.Marshal(fileErr)` 与直接编码 `fileErr` 都会走 `MarshalJSON()`，路径已截断。`Path` 字段保留完整路径，只用于内部日志与审计。

:::

## Web 服务错误映射

把库的错误映射为 HTTP 状态码，客户端才能区分可重试与不可重试：

| 哨兵错误 | HTTP 状态码 | 说明 |
|----------|-------------|------|
| `ErrInputTooLarge` | 413 Payload Too Large | 客户端应缩减输入 |
| `ErrInvalidHTML` | 422 Unprocessable Entity | 无法解析的 HTML |
| `ErrFileNotFound` | 404 Not Found | 文件不存在 |
| `ErrInvalidFilePath` | 400 Bad Request | 路径格式无效，**含路径遍历拒绝** |
| `ErrMaxDepthExceeded` | 400 Bad Request | 输入结构过深 |
| `ErrProcessingTimeout` | 504 Gateway Timeout | 处理超时，可稍后重试 |
| `ErrProcessorClosed` | 500 Internal Server Error | 编程错误（生命周期） |
| `ErrInvalidConfig` | 500 Internal Server Error | 编程错误（配置应在启动时校验） |
| `ErrInternalPanic` | 500 Internal Server Error | 内部 bug，应上报 |
| `ErrMultipleConfigs` | 500 Internal Server Error | 编程错误（传了多个 Config） |
| `ErrTooManyConcurrentOps` | 503 Service Unavailable | 进程级并发已满，可稍后重试 |

`AllowedBaseDir` 越界（`path outside allowed directory`）没有哨兵，映射表无法命中它，需要在 `errors.As` 取到 `*FileError` 后按消息判为 400。

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/html"
)

// errorToHTTPStatus 把库的错误映射为 HTTP 状态码。
func errorToHTTPStatus(err error) int {
	switch {
	case errors.Is(err, html.ErrInputTooLarge):
		return http.StatusRequestEntityTooLarge
	case errors.Is(err, html.ErrInvalidHTML):
		return http.StatusUnprocessableEntity
	case errors.Is(err, html.ErrFileNotFound):
		return http.StatusNotFound
	case errors.Is(err, html.ErrInvalidFilePath), errors.Is(err, html.ErrMaxDepthExceeded):
		return http.StatusBadRequest
	case errors.Is(err, html.ErrProcessingTimeout):
		return http.StatusGatewayTimeout
	case errors.Is(err, html.ErrTooManyConcurrentOps):
		return http.StatusServiceUnavailable
	default:
		// ErrProcessorClosed、ErrInvalidConfig、ErrMultipleConfigs、ErrInternalPanic
		return http.StatusInternalServerError
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 10
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	cases := []struct {
		name string
		err  error
	}{
		{"输入过大", func() error { _, e := p.Extract(make([]byte, 100)); return e }()},
		{"文件不存在", func() error { _, e := p.ExtractFromFile("missing.html"); return e }()},
		{"路径遍历", func() error { _, e := p.ExtractFromFile("../../../etc/passwd"); return e }()},
		{"并发已满", html.ErrTooManyConcurrentOps},
	}

	for _, c := range cases {
		fmt.Printf("%s → HTTP %d\n", c.name, errorToHTTPStatus(c.err))
	}
	// 输出：
	// 输入过大 → HTTP 413
	// 文件不存在 → HTTP 404
	// 路径遍历 → HTTP 400
	// 并发已满 → HTTP 503
}
```

## 结构化日志

记录字段而不是拼接字符串，才能在日志系统里按 `size`、`max_size`、`path` 检索：

```go
package main

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/cybergodev/html"
)

// logExtractionError 按错误类型提取字段写入 slog。
func logExtractionError(err error) {
	var inputErr *html.InputError
	var fileErr *html.FileError

	switch {
	case errors.As(err, &inputErr):
		slog.Warn("提取失败：输入错误",
			"op", inputErr.Op, "size", inputErr.Size, "max_size", inputErr.MaxSize)

	case errors.As(err, &fileErr):
		attrs := []any{"op", fileErr.Op, "path", fileErr.SafePath()}
		if fileErr.FileErr != nil {
			attrs = append(attrs, "cause", fileErr.FileErr.Error())
			if strings.Contains(fileErr.FileErr.Error(), "path traversal") {
				attrs = append(attrs, "security_event", "path_traversal")
			}
		}
		slog.Warn("提取失败：文件错误", attrs...)

	case errors.Is(err, html.ErrProcessingTimeout):
		slog.Warn("提取失败：处理超时")

	case errors.Is(err, html.ErrInternalPanic):
		slog.Error("提取失败：内部恐慌，请上报",
			"err", err, "issue", "https://github.com/cybergodev/html/issues")

	default:
		slog.Error("提取失败：其他错误", "err", err)
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		slog.Error("创建处理器失败", "err", err)
		return
	}
	defer p.Close()

	if _, err := p.Extract([]byte(strings.Repeat("x", 200))); err != nil {
		logExtractionError(err) // size=200、max_size=100
	}
	if _, err := p.ExtractFromFile("../../../etc/passwd"); err != nil {
		logExtractionError(err) // security_event=path_traversal
	}
}
```

对 `FileError` 始终用 `SafePath()` 而非 `Path`，否则日志文件本身成为路径泄露源。配置错误应在启动时由 `New()` 的校验拦下，不必进日志分支。

## 下一步

- [批量处理实战](./batch-processing) - 批量错误与并发控制
- [生产检查清单](../security/production-checklist) - 部署前安全核对
- [API 参考：常量与错误](../../api-reference/types/constants) - 哨兵错误完整清单
- [API 参考：Processor](../../api-reference/core/processor) - 生命周期与统计
