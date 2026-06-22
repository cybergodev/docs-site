---
title: "高级示例 - CyberGo HTML | 进阶场景示例"
description: "CyberGo HTML 高级示例：自定义 Scorer、多 Sink 审计管道、批量文件与并发控制、Processor 池化与 ChannelAuditSink 实时监控等可运行示例。"
---

# 高级示例

## 自定义 Scorer

针对特定网站结构定制内容识别逻辑。完整实现请参考 [测试与自定义扩展](../guides/testing-custom)，以下展示核心用法：

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// 实现自定义 Scorer（完整示例见 guides/testing-custom）
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

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
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

    fmt.Println("正文:", result.Text)
    // 正文: 深入理解 Go 并发
    //
    // goroutine 是 Go 的轻量级线程。
}
```

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
    // 创建输出目标
    allFile, _ := os.Create("audit-all.jsonl")
    criticalFile, _ := os.Create("audit-critical.jsonl")
    defer allFile.Close()
    defer criticalFile.Close()

    // 构建多层级管道
    allSink := html.NewWriterAuditSink(allFile)
    criticalSink := html.NewFilteredSink(
        html.NewWriterAuditSink(criticalFile),
        func(e html.AuditEntry) bool {
            return e.Level == html.AuditLevelCritical
        },
    )
    loggerSink := html.NewLoggerAuditSink()

    pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

    // 配置
    cfg := html.HighSecurityConfig()
    cfg.Audit = html.HighSecurityAuditConfig()
    cfg.Audit.Sink = pipeline

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    // 处理内容
    data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>安全的内容</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("正文:", result.Text)
    // 审计日志自动记录到文件和 stderr
}
```

## 批量文件处理

批量处理目录下的 HTML 文件，收集结果和错误：

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/cybergodev/html"
)

func main() {
    // 收集文件路径
    var files []string
    filepath.Walk("./pages", func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        if filepath.Ext(path) == ".html" || filepath.Ext(path) == ".htm" {
            files = append(files, path)
        }
        return nil
    })

    fmt.Printf("发现 %d 个文件\n", len(files))

    // 批量处理
    p, _ := html.New(html.TextOnlyConfig())
    defer p.Close()

    // 最多 10000 个文件一批
    batch := p.ExtractBatchFiles(files)

    fmt.Printf("成功: %d, 失败: %d, 取消: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)

    // 处理结果
    for i, result := range batch.Results {
        if result != nil {
            fmt.Printf("[%d] %s (字数: %d)\n", i, result.Title, result.WordCount)
        }
    }

    // 检查错误
    for i, err := range batch.Errors {
        if err != nil {
            fmt.Printf("[%d] 错误: %v\n", i, err)
        }
    }
}
```

## 带超时的 Processor 复用

Web 服务场景下的 Processor 单例模式：

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
    fmt.Fprintf(w, "已处理: %d\n缓存命中: %d\n错误: %d\n",
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

从 HTML 页面提取内容并保存为 Markdown 文件：

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
    p, err := html.New(html.MarkdownConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    urls := []string{
        "downloaded/page1.html",
        "downloaded/page2.html",
        "downloaded/page3.html",
    }

    for _, path := range urls {
        md, err := p.ExtractToMarkdownFromFile(path)
        if err != nil {
            log.Printf("处理 %s 失败: %v", path, err)
            continue
        }

        // 生成输出文件名
        outPath := strings.Replace(path, ".html", ".md", 1)
        if err := os.WriteFile(outPath, []byte(md), 0644); err != nil {
            log.Printf("写入 %s 失败: %v", outPath, err)
            continue
        }
        fmt.Printf("✓ %s → %s\n", path, outPath)
    }
}
```
