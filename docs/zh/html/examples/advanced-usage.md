---
sidebar_label: "高级用法"
title: "高级示例 - CyberGo html | 进阶场景示例"
description: "CyberGo html 进阶示例集：自定义 Scorer、多 Sink 审计管道、批量文件并发处理、Processor 池化复用与统计、HTTP 服务优雅关闭、AllowedBaseDir 文件沙箱与按来源指定编码，每个示例均为可编译的完整程序。"
sidebar_position: 20
---

# 高级示例

生产场景的进阶用法：自定义评分、审计管道、批量文件、服务端复用与安全文件处理。

## 自定义 Scorer

针对特定网站结构定制内容识别逻辑。完整实现见 [测试与自定义扩展](../guides/integration/testing-custom)，以下为核心用法：

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// myScorer 按 class 属性给节点打分
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
	if node == nil {
		return 0
	}
	class := node.AttrValue("class")
	if strings.Contains(class, "article") || strings.Contains(class, "post") {
		return 100
	}
	if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
		return -50
	}
	return 0
}

// ShouldRemove 是接口的预留方法：当前版本不会被库调用，此处的逻辑不会生效
func (s myScorer) ShouldRemove(node html.ContentNode) bool {
	if node == nil {
		return false
	}
	switch node.Data() {
	case "nav", "footer", "header":
		return true
	}
	return false
}

func main() {
	cfg := html.DefaultConfig()
	cfg.Scorer = myScorer{}

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body>
        <nav><a href="/">首页</a></nav>
        <article class="post-content">
            <h1>深入理解 Go 并发</h1>
            <p>goroutine 是 Go 的轻量级线程。</p>
        </article>
        <aside class="sidebar">推荐阅读</aside>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("正文：", result.Text)
	// 输出：正文： 深入理解 Go 并发
	//
	// goroutine 是 Go 的轻量级线程。
}
```

导航与侧栏的移除来自库的默认清洗与评分器候选过滤，不是上面 `ShouldRemove` 的效果。

## 多 Sink 审计管道

构建分级审计管道：critical 事件写入独立文件，所有事件同时输出到日志。

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/cybergodev/html"
)

func main() {
	allFile, err := os.Create("audit-all.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	criticalFile, err := os.Create("audit-critical.jsonl")
	if err != nil {
		log.Fatal(err)
	}
	defer allFile.Close()
	defer criticalFile.Close()

	// 管道：全部事件写 allFile，critical 另写一份，同时输出到 stderr
	allSink := html.NewWriterAuditSink(allFile)
	criticalSink := html.NewFilteredSink(
		html.NewWriterAuditSink(criticalFile),
		func(e html.AuditEntry) bool {
			return e.Level == html.AuditLevelCritical
		},
	)
	loggerSink := html.NewLoggerAuditSink()
	pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

	cfg := html.HighSecurityConfig() // 已启用 HighSecurityAuditConfig
	cfg.Audit.Sink = pipeline

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>安全的内容</p></article>
    </body></html>`)

	result, err := p.Extract(data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("正文：", result.Text)
	// 输出：正文： 安全的内容
}
```

## 批量文件处理

批量处理目录下的 HTML 文件，分别收集结果与错误：

```go
package main

import (
	"fmt"
	"io/fs"
	"log"
	"path/filepath"

	"github.com/cybergodev/html"
)

func main() {
	// 收集文件路径
	var files []string
	err := filepath.WalkDir("./pages", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // 跳过无法访问的条目
		}
		if d.IsDir() {
			return nil
		}
		switch filepath.Ext(path) {
		case ".html", ".htm":
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("发现 %d 个文件\n", len(files))

	p, err := html.New(html.TextOnlyConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 单批上限 10000；超出会整批失败，需调用方自行分批
	batch := p.ExtractBatchFiles(files)
	fmt.Printf("成功：%d，失败：%d，取消：%d\n",
		batch.Success, batch.Failed, batch.Cancelled)

	for i, result := range batch.Results {
		if result != nil {
			fmt.Printf("[%d] %s（字数：%d）\n", i, result.Title, result.WordCount)
		}
	}

	for i, err := range batch.Errors {
		if err != nil {
			fmt.Printf("[%d] 错误：%v\n", i, err)
		}
	}
}
```

## 带超时的 Processor 复用

Web 服务中的 Processor 单例：进程启动时创建一次，所有请求共享。

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
	cfg := html.DefaultConfig()
	cfg.MaxCacheEntries = 5000
	cfg.CacheTTL = 30 * time.Minute
	cfg.ProcessingTimeout = 10 * time.Second

	var err error
	processor, err = html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	data := []byte(r.FormValue("html"))
	if len(data) == 0 {
		http.Error(w, "html field required", http.StatusBadRequest)
		return
	}

	result, err := processor.ExtractWithContext(ctx, data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	stats := processor.GetStatistics()
	fmt.Fprintf(w, "已处理：%d\n缓存命中：%d\n错误：%d\n",
		stats.TotalProcessed, stats.CacheHits, stats.ErrorCount)
}

func main() {
	defer processor.Close()

	http.HandleFunc("/extract", extractHandler)
	http.HandleFunc("/stats", statsHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## 提取并生成 Markdown 文件

把一批 HTML 文件转为 Markdown 文件：

```go
package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/cybergodev/html"
)

func main() {
	p, err := html.New(html.DefaultConfig())
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	paths := []string{
		"downloaded/page1.html",
		"downloaded/page2.html",
		"downloaded/page3.html",
	}

	for _, path := range paths {
		md, err := p.ExtractToMarkdownFromFile(path)
		if err != nil {
			log.Printf("处理 %s 失败: %v", path, err)
			continue
		}

		outPath := strings.Replace(path, ".html", ".md", 1)
		if err := os.WriteFile(outPath, []byte(md), 0o644); err != nil {
			log.Printf("写入 %s 失败: %v", outPath, err)
			continue
		}
		fmt.Printf("✓ %s → %s\n", path, outPath)
	}
}
```

## 上下文取消与优雅关闭

在 HTTP 服务中用 context 控制提取超时，支持请求级取消与信号触发的优雅关闭：

```go
package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
	cfg := html.DefaultConfig()
	cfg.ProcessingTimeout = 10 * time.Second
	cfg.MaxCacheEntries = 5000
	var err error
	processor, err = html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
	// 请求级超时 5s：先于 ProcessingTimeout（10s）到期时返回 context.DeadlineExceeded
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 10*1024*1024))
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			http.Error(w, "请求体过大", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "读取请求体失败", http.StatusBadRequest)
		return
	}

	result, err := processor.ExtractWithContext(ctx, body)
	if err != nil {
		switch {
		case errors.Is(err, html.ErrProcessingTimeout):
			http.Error(w, "处理超时", http.StatusGatewayTimeout)
		case errors.Is(err, context.DeadlineExceeded):
			http.Error(w, "请求超时", http.StatusGatewayTimeout)
		case errors.Is(err, html.ErrInputTooLarge):
			http.Error(w, "输入过大", http.StatusRequestEntityTooLarge)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"title":      result.Title,
		"word_count": result.WordCount,
	})
}

func main() {
	server := &http.Server{Addr: ":8080"}
	http.HandleFunc("/extract", extractHandler)

	// 收到信号后先关 Processor，再关 HTTP 服务
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("正在关闭...")
		processor.Close()
		server.Shutdown(context.Background())
	}()

	log.Println("服务启动于 :8080")
	log.Fatal(server.ListenAndServe())
}
```

## 安全文件处理

用 `AllowedBaseDir` 沙箱处理用户提供的文件路径：

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.HighSecurityConfig()
	// 限制文件读取到此目录及其子目录
	// 通过已打开的文件句柄解析真实路径，防 symlink/junction 绕过
	cfg.AllowedBaseDir = "/var/www/uploads"

	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// 模拟用户提供的文件路径
	userFiles := []string{
		"/var/www/uploads/article1.html", // ✅ 允许
		"/var/www/uploads/sub/page.html", // ✅ 允许（子目录）
		"../../../etc/passwd",            // ❌ 路径遍历
		"/etc/shadow",                    // ❌ 目录外
	}

	for _, file := range userFiles {
		_, err := p.ExtractFromFile(file)
		if err != nil {
			var fileErr *html.FileError
			if errors.As(err, &fileErr) {
				// SafePath 只返回文件名，不泄露完整路径
				fmt.Printf("❌ 拒绝 %s: %s\n", fileErr.SafePath(), fileErr.FileErr)
			} else {
				fmt.Printf("❌ 错误: %v\n", err)
			}
			continue
		}
		fmt.Printf("✅ 处理成功: %s\n", file)
	}
}
```

## 按来源指定编码

没有 `<meta charset>` 的 GBK/Shift_JIS 字节不会报错，而是按 windows-1252 兜底解码成乱码。因此编码应由来源决定：HTTP `Content-Type` 头、站点约定或探测结果。下面的示例演示强制指定了错误编码时如何捕获错误并改用正确编码：

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// extractWithEncoding 用指定编码提取，便于对比不同编码的结果
func extractWithEncoding(data []byte, encoding string) (*html.Result, error) {
	cfg := html.DefaultConfig()
	cfg.Encoding = encoding
	return html.Extract(data, cfg)
}

func main() {
	// 一段 GBK 编码的 HTML，不含 <meta charset>
	data := []byte("<html><body><h1>" + string([]byte{0xc4, 0xe3, 0xba, 0xc3}) + "</h1></body></html>")

	// 错误地按 utf-8 解码 → 报错
	_, err := extractWithEncoding(data, "utf-8")
	if err == nil {
		log.Fatal("预期应出现编码错误")
	}
	fmt.Println("首次失败：", strings.HasPrefix(err.Error(), "encoding detection failed"))
	// 输出：首次失败： true

	// 按来源改用 gbk 解码 → 成功
	result, err := extractWithEncoding(data, "gbk")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("标题：", result.Title)
	// 输出：标题： 你好
}
```

编码错误没有对应的哨兵错误，`errors.Is` 无法判定；需要区分时，检查 `err.Error()` 是否以 `encoding detection failed` 开头。

## 下一步

- [常见问题](../faq/) - 高频疑问与排查思路
- [生产检查清单](../guides/security/production-checklist) - 部署前安全核对
- [API 参考：接口定义](../api-reference/types/interfaces) - Scorer、AuditSink 等扩展接口
