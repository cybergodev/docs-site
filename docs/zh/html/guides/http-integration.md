---
title: "HTTP 集成 - CyberGo HTML | Web 服务实战"
description: "CyberGo HTML 与 HTTP 集成实战：net/http 单页抓取、并发批量优化、上下文超时、Web 服务集成、Processor 单例复用与生产部署实践。"
---

# HTTP 集成

HTML 库不内置 HTTP 客户端，而是与标准库 `net/http` 无缝配合。本文展示常见的集成模式。

## 基本抓取与提取

最简单的模式：获取页面，提取内容。

```go
package main

import (
    "fmt"
    "io"
    "log"
    "net/http"

    "github.com/cybergodev/html"
)

func main() {
    resp, err := http.Get("https://example.com/article")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        log.Fatalf("HTTP %d", resp.StatusCode)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        log.Fatal(err)
    }

    result, err := html.Extract(body)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("标题:", result.Title)
    fmt.Println("字数:", result.WordCount)
}
```

:::tip 优化建议
对输入大小做好限制，防止内存溢出：

```go
body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB
```
:::

## 配置 HTTP 客户端

生产环境应配置合理的超时和连接池参数：

```go
client := &http.Client{
    Timeout: 15 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `Timeout` | 10-30s | 包含连接+TLS+读写全流程 |
| `MaxIdleConns` | 10-50 | 全局最大空闲连接 |
| `MaxIdleConnsPerHost` | 5-10 | 单主机最大空闲连接 |
| `IdleConnTimeout` | 90s | 空闲连接保持时间 |

## Processor 单例 + HTTP 服务

在 Web 服务中，复用单个 Processor 实例处理所有请求：

```go
package main

import (
    "context"
    "encoding/json"
    "io"
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

    body, err := io.ReadAll(io.LimitReader(r.Body, 10*1024*1024))
    if err != nil {
        http.Error(w, "读取失败", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

:::warning 输入验证
Web 服务中务必限制请求体大小，防止恶意大文件攻击。使用 `io.LimitReader` 或 `http.MaxBytesReader`。
:::

## 并发抓取多个 URL

结合 Processor 的并发安全性，高效处理多个页面：

```go
type URLResult struct {
    URL    string
    Result *html.Result
    Error  error
}

func processURLs(processor *html.Processor, urls []string) []URLResult {
    results := make([]URLResult, len(urls))
    var wg sync.WaitGroup

    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()

            resp, err := http.Get(u)
            if err != nil {
                results[idx] = URLResult{URL: u, Error: err}
                return
            }
            defer resp.Body.Close()

            if resp.StatusCode != http.StatusOK {
                results[idx] = URLResult{URL: u, Error: fmt.Errorf("HTTP %d", resp.StatusCode)}
                return
            }

            body, _ := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
            result, err := processor.Extract(body)
            results[idx] = URLResult{URL: u, Result: result, Error: err}
        }(i, url)
    }

    wg.Wait()
    return results
}
```

使用示例：

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

urls := []string{
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
}

for _, r := range processURLs(p, urls) {
    if r.Error != nil {
        log.Printf("%s: 错误 - %v", r.URL, r.Error)
        continue
    }
    fmt.Printf("%s: %s (%d 字)\n", r.URL, r.Result.Title, r.Result.WordCount)
}
```

## 带重试的抓取

处理网络不稳定场景：

```go
func fetchWithRetry(client *http.Client, url string, maxRetries int) ([]byte, error) {
    var lastErr error

    for i := 0; i < maxRetries; i++ {
        resp, err := client.Get(url)
        if err != nil {
            lastErr = err
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("服务端错误: HTTP %d", resp.StatusCode)
            resp.Body.Close()
            time.Sleep(time.Second * time.Duration(1<<uint(i)))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            resp.Body.Close()
            return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
        }

        body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
        resp.Body.Close()
        if err != nil {
            return nil, err
        }
        return body, nil
    }

    return nil, fmt.Errorf("重试 %d 次后仍失败: %w", maxRetries, lastErr)
}
```

:::tip 重试策略
- 4xx 错误不要重试（客户端问题）
- 5xx 和网络错误可重试
- 使用指数退避：1s、2s、4s
- 设置最大重试次数（通常 3 次）
:::

## 批量 + 上下文取消

对大批量 URL 使用带上下文的批量处理，支持超时取消：

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
    // 设置总超时
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
    defer cancel()

    // 抓取所有页面
    pages := make([][]byte, len(urls))
    for i, u := range urls {
        select {
        case <-ctx.Done():
            fmt.Println("抓取超时，已取消")
            return
        default:
            body, err := fetchWithRetry(http.DefaultClient, u, 2)
            if err != nil {
                log.Printf("跳过 %s: %v", u, err)
                continue
            }
            pages[i] = body
        }
    }

    // 批量提取
    batch := processor.ExtractBatchWithContext(ctx, pages)
    fmt.Printf("成功: %d, 失败: %d, 取消: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)
}
```

## 编码处理

HTTP 响应可能使用非 UTF-8 编码，HTML 库会自动检测并处理：

```go
// 即使响应是 GBK 编码，也能正确提取
resp, _ := http.Get("https://example.cn/page")
body, _ := io.ReadAll(resp.Body)
result, _ := html.Extract(body) // 自动检测编码
```

也可从 `Content-Type` 头获取编码信息后手动指定：

```go
charset := "utf-8" // 从 Content-Type 解析
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if idx := strings.Index(ct, "charset="); idx != -1 {
        charset = ct[idx+8:]
    }
}

cfg := html.DefaultConfig()
cfg.Encoding = charset
result, _ := html.Extract(body, cfg)
```

## 最佳实践

| 场景 | 建议 |
|------|------|
| 单页提取 | `http.Get()` + `html.Extract()` |
| Web 服务 | Processor 单例 + `ExtractWithContext()` |
| 批量抓取 | `processURLs()` + Processor 复用 |
| 不可信来源 | `HighSecurityConfig()` + `io.LimitReader()` |
| 编码不确定 | 依赖自动检测，或从 Content-Type 头指定 |

## 下一步

- [缓存与复用](../guides/processor-cache) - Processor 生命周期管理
- [审计系统实战](../guides/audit-pipeline) - 生产环境安全监控
- [API 参考：批量处理](../api-reference/batch) - 完整批量 API
- [性能优化](../advanced/performance) - 性能调优技巧
