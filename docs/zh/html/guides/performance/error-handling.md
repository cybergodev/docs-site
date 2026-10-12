---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo html | 健壮错误处理指南"
description: "CyberGo html 健壮错误处理指南：五类错误分类（输入、配置、文件、处理、系统）、errors.Is 哨兵错误判断、errors.As 结构化错误字段提取、context 超时取消、批量处理部分失败与 panic 恢复的应对策略与最佳实践。"
sidebar_position: 4
---

# 错误处理

## 错误分类

HTML 库的错误分为以下几类：

| 类别 | 哨兵错误 | 说明 |
|------|----------|------|
| 输入错误 | `ErrInputTooLarge`, `ErrInvalidHTML` | 输入内容问题 |
| 配置错误 | `ErrInvalidConfig`, `ErrMultipleConfigs` | 配置问题 |
| 文件错误 | `ErrFileNotFound`, `ErrInvalidFilePath` | 文件操作问题 |
| 处理错误 | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | 处理过程问题 |
| 系统错误 | `ErrProcessorClosed`, `ErrInternalPanic` | 内部状态问题 |

## errors.Is 模式

使用 `errors.Is` 判断错误类型：

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("输入过大，请减小文档大小")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("无效 HTML，请检查输入")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("处理超时，文档可能过于复杂")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("文件不存在")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM 深度过深，可能是恶意构造")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("内部恐慌恢复，请报告此问题")
    default:
        slog.Error("未知错误", "err", err)
    }
}
```

## errors.As 模式

提取结构化错误信息：

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("大小 %d 超过限制 %d\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("字段 %s 值 %v 无效: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("文件操作: %s\n", fileErr.SafePath())
}
```

## 上下文取消

使用 `ExtractWithContext` 版本支持取消：

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrProcessingTimeout):
        // 处理超时（库内 ProcessingTimeout 触发，此时 ctx.Err() 可能为 nil）
    case ctx.Err() == context.DeadlineExceeded:
        // 用户上下文截止时间到
    case ctx.Err() == context.Canceled:
        // 手动取消
    default:
        // 其他错误（ErrInvalidHTML、ErrInputTooLarge 等）
        slog.Error("提取失败", "err", err)
    }
}
```

## 批量错误

批量处理的结果包含部分成功和部分失败：

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("第 %d 项失败: %v\n", i, err)
    }
}

fmt.Printf("成功：%d, 失败：%d, 取消：%d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```

## 错误恢复策略

实际应用中，仅判断错误类型还不够——需要根据错误类别采取不同的恢复策略。

### 编码检测失败

当 HTML 输入不含 `<meta charset>` 声明且自动检测无法确定编码时，库返回的错误消息以 `"encoding detection failed"` 为前缀。这是一个普通的 `fmt.Errorf` 包装错误（非哨兵错误、非类型化错误），只能通过错误消息字符串匹配来检测。

恢复策略：先用自动检测（`Config.Encoding` 留空），失败后用已知编码手动指定重试。

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

// extractWithEncodingFallback 先用自动检测尝试提取，编码检测失败时用手动编码重试。
func extractWithEncodingFallback(data []byte, fallbackEncoding string) (*html.Result, error) {
	// 第一次：自动检测编码（Config.Encoding 留空）
	result, err := html.Extract(data)
	if err == nil {
		return result, nil
	}

	// 编码检测失败时，用手动指定的编码重试
	if strings.Contains(err.Error(), "encoding detection failed") {
		fmt.Printf("自动检测失败（%v），使用编码 %q 重试...\n", err, fallbackEncoding)
		cfg := html.DefaultConfig()
		cfg.Encoding = fallbackEncoding
		return html.Extract(data, cfg)
	}

	// 其他错误（输入过大、无效 HTML 等）不重试，直接返回
	return nil, err
}

func main() {
	// 构造 GBK 编码的 HTML（无 charset meta 声明，可能触发自动检测失败）
	utf8HTML := `<html><head><title>测试</title></head>` +
		`<body><article><h1>标题</h1><p>你好世界</p></article></body></html>`
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(utf8HTML))
	if err != nil {
		log.Fatal(err)
	}

	result, err := extractWithEncodingFallback(gbkBytes, "gbk")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("标题: %s\n", result.Title)
	fmt.Printf("文本: %s\n", result.Text)
	// 输出：
	// 自动检测失败（encoding detection failed: ...），使用编码 "gbk" 重试...
	// 标题：测试
	// 文本：标题 你世界
}
```

:::tip 提示
编码检测重试适用于处理来源不明的 HTML 文档（如爬虫抓取的旧版中文网页）。如果你的输入来源固定，直接在 `Config.Encoding` 中指定编码即可，无需重试逻辑。
:::

### 超时恢复

`ErrProcessingTimeout` 表示处理时间超过了 `Config.ProcessingTimeout`。恢复策略取决于文档特性：

| 策略 | 适用场景 | 做法 |
|------|----------|------|
| 降低复杂度 | 文档结构复杂但内容简单 | 设置 `ExtractArticle = false` 跳过正文识别 |
| 延长超时 | 文档确实很大且合法 | 增大 `ProcessingTimeout` |
| 简化输出 | 仅需纯文本 | 使用 `TextOnlyConfig()` 禁用所有媒体提取 |

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	// 第一次：标准配置（30 秒超时）
	cfg := html.DefaultConfig()
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	largeHTML := []byte(`<html><body><article><h1>大文档</h1><p>` +
		strings.Repeat("内容 ", 100000) + `</p></article></body></html>`)

	_, err = p.Extract(largeHTML)
	if err != nil {
		if errors.Is(err, html.ErrProcessingTimeout) {
			fmt.Println("标准配置超时，切换到简化模式重试...")

			// 重试：关闭正文提取 + 纯文本模式 + 更长超时
			retryCfg := html.TextOnlyConfig()
			retryCfg.ExtractArticle = false
			retryCfg.ProcessingTimeout = 60 * time.Second
			p2, err := html.New(retryCfg)
			if err != nil {
				log.Fatal(err)
			}
			defer p2.Close()

			result, err := p2.Extract(largeHTML)
			if err != nil {
				log.Fatal(err)
			}
			fmt.Printf("重试成功，提取 %d 字\n", len(result.Text))
		} else {
			log.Fatal(err)
		}
	}
}
```

### 输入过大

`ErrInputTooLarge` 表示输入超过了 `Config.MaxInputSize`（默认 50MB，上限也是 50MB）。两种处理方式：

- **缩减输入**：如果是 Web 服务，提示用户上传更小的文件
- **增大限制**：如果业务确实需要处理大文件，增大 `MaxInputSize`（上限 50MB）

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 1024 // 1KB 限制（演示用）
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 构造超过限制的输入
	largeInput := []byte(strings.Repeat("<div>", 500))
	_, err = p.Extract(largeInput)
	if err != nil {
		var inputErr *html.InputError
		if errors.As(err, &inputErr) {
			fmt.Printf("输入 %d 字节超过限制 %d 字节\n", inputErr.Size, inputErr.MaxSize)
			// 输出：输入 2500 字节超过限制 1024 字节
		}
	}
}
```

## 错误包装链

三种结构化错误类型（`InputError`、`ConfigError`、`FileError`）都实现了 `Unwrap()` 方法，支持 `errors.Is()` 和 `errors.As()` 标准模式。理解 `Unwrap()` 的行为对于正确判断错误至关重要。

### Unwrap 行为对照

| 类型 | `Unwrap()` 返回值 | 说明 |
|------|-------------------|------|
| `*InputError` | 签名为 `Unwrap() []error`：`InputErr` 非 nil 时 → `[InputErr, ErrInputTooLarge]`，否则 → `[ErrInputTooLarge]` | 无论是否携带底层错误，`ErrInputTooLarge` 恒在列表中——`errors.Is(err, ErrInputTooLarge)` 对任意 `*InputError` 为真 |
| `*ConfigError` | 始终 `ErrInvalidConfig` | 固定映射到配置哨兵 |
| `*FileError` | ① 若 `FileErr` 包装了 `ErrFileNotFound` → `ErrFileNotFound`；② 否则若 `FileErr != nil` → `FileErr`（原始错误）；③ 否则 → `ErrInvalidFilePath` | 三级回退：文件不存在 → 原始错误 → 路径无效 |

:::warning 注意
`FileError.Unwrap()` 的三级逻辑意味着：路径遍历攻击产生的错误（`FileErr` = `"path traversal detected: ..."`）不会匹配任何哨兵错误——因为 `Unwrap()` 返回的是原始的路径遍历错误，而非 `ErrFileNotFound` 或 `ErrInvalidFilePath`。检测路径遍历需要用 `errors.As` 提取 `FileError` 后检查消息。
:::

### 综合判断示例

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// diagnoseError 用 errors.Is + errors.As 综合诊断错误。
func diagnoseError(err error) {
	if err == nil {
		fmt.Println("无错误")
		return
	}

	// 1. errors.Is：检查哨兵错误（沿 Unwrap 链查找）
	fmt.Printf("errors.Is 检查:\n")
	fmt.Printf("  ErrInputTooLarge:    %v\n", errors.Is(err, html.ErrInputTooLarge))
	fmt.Printf("  ErrInvalidConfig:    %v\n", errors.Is(err, html.ErrInvalidConfig))
	fmt.Printf("  ErrFileNotFound:     %v\n", errors.Is(err, html.ErrFileNotFound))
	fmt.Printf("  ErrInvalidFilePath:  %v\n", errors.Is(err, html.ErrInvalidFilePath))

	// 2. errors.As：提取结构化错误类型
	var inputErr *html.InputError
	if errors.As(err, &inputErr) {
		fmt.Printf("InputError 详情: op=%s size=%d max=%d\n",
			inputErr.Op, inputErr.Size, inputErr.MaxSize)
	}

	var configErr *html.ConfigError
	if errors.As(err, &configErr) {
		fmt.Printf("ConfigError 详情: field=%s value=%v message=%s\n",
			configErr.Field, configErr.Value, configErr.Message)
	}

	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Printf("FileError 详情: op=%s safePath=%s\n",
			fileErr.Op, fileErr.SafePath())
		// 检测路径遍历（不匹配哨兵，需检查消息）
		if fileErr.FileErr != nil &&
			strings.Contains(fileErr.FileErr.Error(), "path traversal") {
			fmt.Println("  [安全警告] 检测到路径遍历攻击")
		}
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 场景 1：输入过大 → InputError → ErrInputTooLarge
	fmt.Println("=== 场景 1：输入过大 ===")
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	diagnoseError(err)

	// 场景 2：文件不存在 → FileError → ErrFileNotFound
	fmt.Println("\n=== 场景 2：文件不存在 ===")
	_, err = p.ExtractFromFile("nonexistent.html")
	diagnoseError(err)

	// 场景 3：路径遍历 → FileError → 不匹配哨兵
	fmt.Println("\n=== 场景 3：路径遍历 ===")
	_, err = p.ExtractFromFile("../../etc/passwd")
	diagnoseError(err)
}
```

## FileError 的路径脱敏机制

`FileError` 在设计上内置了**路径信息脱敏**机制，防止通过错误消息泄露服务器文件系统结构。这在处理来自不可信用户的文件路径时尤为重要。

### 脱敏层次

| 层次 | 方法 | 行为 |
|------|------|------|
| 错误消息 | `Error()` | 调用 `SafePath()` 仅显示文件名，调用 `sanitizeErrorMessage()` 移除路径细节 |
| 路径截断 | `SafePath()` | 返回路径的 basename（如 `/var/data/secret/page.html` → `page.html`） |
| 错误清洗 | `sanitizeErrorMessage()` | 保留错误类型（path traversal / not found / permission denied / access denied），移除路径字符串 |
| JSON 序列化 | `MarshalJSON()` | 自动用 `SafePath()` 脱敏，适用于 HTTP API 响应 |
| 内部调试 | `Path` 字段 | 保留完整路径，供日志和审计使用（不对外暴露） |

### Web 服务脱敏示例

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/cybergodev/html"
)

// apiResponse 是返回给客户端的 JSON 结构。
type apiResponse struct {
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("file")
	if filePath == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(apiResponse{Error: "missing file parameter"})
		return
	}

	cfg := html.DefaultConfig()
	result, err := html.ExtractFromFile(filePath, cfg)
	if err != nil {
		// 错误消息已自动脱敏——客户端不会看到服务器路径
		w.WriteHeader(http.StatusUnprocessableEntity)

		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			// MarshalJSON 自动用 SafePath() 脱敏，可安全返回客户端
			fileErrJSON, _ := json.Marshal(fileErr)
			fmt.Fprintf(w, `{"error":"file_error","detail":%s}`, fileErrJSON)
			// 客户端看到：{"error":"file_error","detail":{"op":"ReadFile","path":"secret.html","message":"file not found"}}
			// 而非完整的服务器路径 /var/www/uploads/secret.html
		} else {
			json.NewEncoder(w).Encode(apiResponse{Error: "extraction_failed"})
		}
		return
	}

	json.NewEncoder(w).Encode(result)
}

func main() {
	// 演示脱敏效果：模拟处理一个不存在的文件路径
	cfg := html.DefaultConfig()
	_, err := html.ExtractFromFile("/var/www/private/secret.html", cfg)
	if err != nil {
		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			fmt.Printf("Error() 输出（脱敏）: %v\n", fileErr)
			// 输出：Error() 输出（脱敏）: html: ReadFile "secret.html": file not found

			fmt.Printf("SafePath(): %s\n", fileErr.SafePath())
			// 输出：SafePath(): secret.html

			jsonBytes, _ := json.Marshal(fileErr)
			fmt.Printf("MarshalJSON(): %s\n", jsonBytes)
			// 输出：MarshalJSON(): {"op":"ReadFile","path":"secret.html","message":"file not found"}

			fmt.Printf("Path 字段（内部调试用）: %s\n", fileErr.Path)
			// 输出：Path 字段（内部调试用）: /var/www/private/secret.html
		}
	}

	// 注册 HTTP 处理器（仅注册，不启动服务器）
	http.HandleFunc("/extract", extractHandler)
	fmt.Println("\n处理器已注册，错误消息自动脱敏")
}
```

:::tip 提示
`MarshalJSON()` 使得 `FileError` 可以直接 `json.Marshal()` 后返回给 HTTP 客户端，无需额外处理——路径信息在序列化时已自动脱敏。但 `Path` 字段仍保留完整路径，仅用于内部日志和调试，切勿将其直接返回给客户端。
:::

## Web 服务错误映射

在 Web 服务中，需要将库的错误映射为合适的 HTTP 状态码，让客户端能正确处理。

### HTTP 状态码映射表

| 哨兵错误 | 建议 HTTP 状态码 | 说明 |
|----------|------------------|------|
| `ErrInputTooLarge` | 413 Payload Too Large | 输入超限，客户端应缩减输入 |
| `ErrInvalidHTML` | 422 Unprocessable Entity | 无法解析的 HTML 格式 |
| `ErrFileNotFound` | 404 Not Found | 文件不存在 |
| `ErrInvalidFilePath` | 400 Bad Request | 路径格式无效 |
| `ErrMaxDepthExceeded` | 400 Bad Request | 可能恶意构造的深度嵌套 |
| `ErrProcessingTimeout` | 504 Gateway Timeout | 处理超时，客户端可稍后重试 |
| `ErrProcessorClosed` | 500 Internal Server Error | 编程错误（未正确管理生命周期） |
| `ErrInvalidConfig` | 500 Internal Server Error | 编程错误（配置校验应在启动时完成） |
| `ErrInternalPanic` | 500 Internal Server Error | 内部 bug，应上报 |
| `ErrMultipleConfigs` | 500 Internal Server Error | 编程错误（传入了多个 Config） |

### 状态码映射实现

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/html"
)

// errorToHTTPStatus 将 html 库的错误映射为合适的 HTTP 状态码。
func errorToHTTPStatus(err error) int {
	switch {
	case errors.Is(err, html.ErrInputTooLarge):
		return http.StatusRequestEntityTooLarge // 413
	case errors.Is(err, html.ErrInvalidHTML):
		return http.StatusUnprocessableEntity // 422
	case errors.Is(err, html.ErrFileNotFound):
		return http.StatusNotFound // 404
	case errors.Is(err, html.ErrInvalidFilePath):
		return http.StatusBadRequest // 400
	case errors.Is(err, html.ErrMaxDepthExceeded):
		return http.StatusBadRequest // 400
	case errors.Is(err, html.ErrProcessingTimeout):
		return http.StatusGatewayTimeout // 504
	case errors.Is(err, html.ErrProcessorClosed):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrInvalidConfig):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrInternalPanic):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrMultipleConfigs):
		return http.StatusInternalServerError // 500
	default:
		return http.StatusInternalServerError // 500
	}
}

func main() {
	// 演示各种错误的 HTTP 状态码映射

	// ErrInputTooLarge → 413
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 10
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	testCases := []struct {
		name string
		err  error
	}{
		{"输入过大", func() error {
			_, e := p.Extract(make([]byte, 100))
			return e
		}()},
		{"文件不存在", func() error {
			_, e := p.ExtractFromFile("missing.html")
			return e
		}()},
		{"处理器已关闭", html.ErrProcessorClosed},
		{"内部恐慌", html.ErrInternalPanic},
	}

	for _, tc := range testCases {
		if tc.err != nil {
			fmt.Printf("%-12s → HTTP %d\n", tc.name, errorToHTTPStatus(tc.err))
		}
	}
	// 输出：
	// 输入过大      → HTTP 413
	// 文件不存在    → HTTP 404
	// 处理器已关闭  → HTTP 500
	// 内部恐慌      → HTTP 500

	p.Close()
}
```

## 错误决策流程图

遇到错误时，按以下优先级顺序判断（从最严重到最轻微）：

```text
error != nil ?
│
├── errors.Is(err, ErrProcessorClosed)
│   → 编程错误：检查 Close() 调用时机，确认处理器未在使用后被关闭
│
├── errors.Is(err, ErrInternalPanic)
│   → 内部 bug：记录完整堆栈并上报，输入可能触发了未覆盖的边界情况
│
├── errors.As(err, &fileErr)
│   → 文件错误：用 SafePath() 记录脱敏路径，检查 FileErr 判断具体原因
│   ├── errors.Is(err, ErrFileNotFound)    → 文件不存在
│   ├── 消息含 "path traversal"              → 安全事件，审计日志 + 拒绝
│   └── errors.Is(err, ErrInvalidFilePath) → 路径格式问题
│
├── errors.As(err, &inputErr)
│   → 输入错误：检查 Size/MaxSize，提示用户缩减输入或调整限制
│
├── errors.Is(err, ErrProcessingTimeout)
│   → 超时：考虑简化处理（ExtractArticle=false）或增大超时后重试
│
├── errors.Is(err, ErrMaxDepthExceeded)
│   → 可能恶意构造：拒绝并记录审计日志
│
├── errors.Is(err, ErrInvalidHTML)
│   → 输入格式问题：提示用户检查 HTML 源
│
├── errors.Is(err, ErrInvalidConfig)
│   → 配置错误：应在服务启动时 Validate() 捕获，运行时出现说明逻辑有误
│
└── 其他
    → 未知错误：记录完整错误链，向上传播或返回 500
```

:::tip 提示
判断顺序很重要：`ErrProcessorClosed` 和 `ErrInternalPanic` 应优先检查，因为它们代表编程错误或内部故障，需要与输入错误区别处理。`FileError` 的 `errors.As` 检查应在 `errors.Is` 哨兵检查之后或并用——因为路径遍历错误不匹配任何哨兵。
:::

## 结构化日志实践

使用 `slog` 记录错误时，应从结构化错误类型中提取字段（而非仅记录 `err.Error()` 字符串），以便后续日志查询和告警。

```go
package main

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/cybergodev/html"
)

// logExtractionError 根据错误类型提取结构化字段，记录到 slog。
func logExtractionError(err error) {
	var inputErr *html.InputError
	var configErr *html.ConfigError
	var fileErr *html.FileError

	switch {
	case errors.As(err, &inputErr):
		// 输入错误：记录 Op/Size/MaxSize 便于排查容量问题
		slog.Warn("提取失败：输入错误",
			"op", inputErr.Op,
			"size", inputErr.Size,
			"max_size", inputErr.MaxSize,
			"sentinel", "ErrInputTooLarge",
		)

	case errors.As(err, &configErr):
		// 配置错误：记录 Field/Value/Message 便于定位配置问题
		slog.Error("提取失败：配置错误",
			"field", configErr.Field,
			"value", configErr.Value,
			"message", configErr.Message,
			"sentinel", "ErrInvalidConfig",
		)

	case errors.As(err, &fileErr):
		// 文件错误：用 SafePath() 记录脱敏路径，检查路径遍历
		attrs := []any{
			"op", fileErr.Op,
			"path", fileErr.SafePath(), // 脱敏路径，避免日志泄露完整路径
		}
		if fileErr.FileErr != nil {
			attrs = append(attrs, "cause", fileErr.FileErr.Error())
			if strings.Contains(fileErr.FileErr.Error(), "path traversal") {
				attrs = append(attrs, "security_event", "path_traversal")
			}
		}
		slog.Warn("提取失败：文件错误", attrs...)

	case errors.Is(err, html.ErrProcessingTimeout):
		slog.Warn("提取失败：处理超时", "err", err)

	case errors.Is(err, html.ErrMaxDepthExceeded):
		slog.Warn("提取失败：深度超限，可能恶意构造", "err", err)

	case errors.Is(err, html.ErrProcessorClosed):
		slog.Error("提取失败：处理器已关闭（编程错误）", "err", err)

	case errors.Is(err, html.ErrInternalPanic):
		slog.Error("提取失败：内部恐慌，请上报",
			"err", err,
			"issue", "https://github.com/cybergodev/html/issues",
		)

	default:
		slog.Error("提取失败：未知错误", "err", err, "err_type", fmt.Sprintf("%T", err))
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

	// 场景 1：输入过大 → 结构化记录 Size/MaxSize
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	if err != nil {
		logExtractionError(err)
	}

	// 场景 2：文件不存在 → 结构化记录 SafePath
	_, err = p.ExtractFromFile("/data/secret/missing.html")
	if err != nil {
		logExtractionError(err)
	}

	// 场景 3：路径遍历 → 标记安全事件
	_, err = p.ExtractFromFile("../../../etc/passwd")
	if err != nil {
		logExtractionError(err)
	}
}
```

:::tip 提示
结构化日志的关键是提取**字段**而非拼接字符串。例如记录 `inputErr.Size` 和 `inputErr.MaxSize` 后，可以在日志系统中按 `size > max_size * 0.9` 查询接近上限的请求，提前发现容量问题。对 `FileError`，始终用 `SafePath()` 而非 `Path` 字段记录日志，避免日志文件本身成为信息泄露源。
:::

## 下一步

- [生产检查清单](../security/production-checklist) - 部署前安全核对
- [性能优化](./performance) - 吞吐量提升与超时设置
- [API 参考：常量与错误](../../api-reference/types/constants) - 哨兵错误完整清单
- [API 参考：Processor](../../api-reference/core/processor) - Processor 生命周期与统计
