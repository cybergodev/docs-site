---
sidebar_label: "HTTP 集成"
title: "HTTP 集成 - CyberGo html | Web 服务实战"
description: "CyberGo html 与标准库 net/http 集成：单页抓取与提取、并发抓取多个 URL、Processor 单例复用、指数退避重试、批量与上下文取消，以及从 Content-Type 头读取 charset 显式指定编码的写法。"
sidebar_position: 10
---

# HTTP 集成

html 库不提供 HTTP 客户端；把 `net/http` 抓回的响应体交给 `Extract` 即可。以下是常见的集成写法。

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

	fmt.Println("标题：", result.Title)
	fmt.Println("字数：", result.WordCount)
}
```

:::tip 读取前先限流
`io.LimitReader` 把响应体截断在 50MB（`DefaultMaxInputSize`），避免先把超大页面读进内存再被库拒绝：

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
| `Timeout` | 10-30s | 包含连接+TLS+ 读写全流程 |
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

:::warning 输入大小限制
Web 服务必须限制请求体大小，否则恶意大文件会耗尽内存。使用 `io.LimitReader` 或 `http.MaxBytesReader`。
:::

## 并发抓取多个 URL

`Processor` 并发安全，可以同时处理多个页面：

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
            lastErr = fmt.Errorf("服务端错误：HTTP %d", resp.StatusCode)
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

    return nil, fmt.Errorf("重试 %d 次后仍失败：%w", maxRetries, lastErr)
}
```

:::tip 重试策略
- 4xx（除 408、429）不重试，重试也不会改变结果
- 5xx 与网络错误可以重试
- 退避间隔翻倍（1s、2s、4s），并设上限
- 重试次数设上限，常用 3 次
:::

## 批量 + 上下文取消

给整批任务设一个总超时，超时后未开始的任务计入 `Cancelled`：

```go
func batchProcessURLs(processor *html.Processor, urls []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// 只收集抓取成功的页面：nil 或空输入会被当成空文档正常提取，
	// 混进批次会让失败在统计里显示为成功
	pages := make([][]byte, 0, len(urls))
	for _, u := range urls {
		if ctx.Err() != nil {
			log.Println("抓取超时，停止取数")
			break
		}
		body, err := fetchWithRetry(http.DefaultClient, u, 2)
		if err != nil {
			log.Printf("跳过 %s: %v", u, err)
			continue
		}
		pages = append(pages, body)
	}

	batch := processor.ExtractBatchWithContext(ctx, pages)
	fmt.Printf("成功：%d, 失败：%d, 取消：%d\n",
		batch.Success, batch.Failed, batch.Cancelled)
}
```

抓取失败与提取失败是两回事：前者由调用方自己记录（上面的 `log.Printf`），后者才进 `BatchResult.Failed`。

## 编码处理

库只从 HTML 字节本身判断编码（BOM、`<meta charset>`、UTF-8 合法性、统计采样），**不读取 HTTP `Content-Type` 头**。因此响应头声明了 `charset=gbk`、而 HTML 里又没有 `<meta charset>` 时，库会把字节当作 windows-1252 解码，结果是乱码且不报错。

可靠的写法是从响应头取 charset 后显式传给 `Config.Encoding`：

```go
resp, err := http.Get("https://example.cn/page")
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
if err != nil {
    log.Fatal(err)
}

cfg := html.DefaultConfig()
if ct := resp.Header.Get("Content-Type"); ct != "" {
    if _, params, err := mime.ParseMediaType(ct); err == nil {
        cfg.Encoding = params["charset"] // 为空时留空，走自动检测
    }
}

result, err := html.Extract(body, cfg)
if err != nil {
    log.Fatal(err)
}
```

若响应头不带 charset，而站点已知使用 GBK 等非 UTF-8 编码，直接在 `cfg.Encoding` 中写死该编码即可。详见 [编码检测实战](../core-features/encoding-detection)。

## 最佳实践

| 场景 | 建议 |
|------|------|
| 单页提取 | `http.Get()` + `html.Extract()` |
| Web 服务 | Processor 单例 + `ExtractWithContext()` |
| 批量抓取 | `processURLs()` + Processor 复用 |
| 不可信来源 | `HighSecurityConfig()` + `io.LimitReader()` |
| 编码不确定 | 从 `Content-Type` 取 charset 显式指定；留空时依赖自动检测 |

## 下一步

- [Processor 复用与缓存](../performance/processor-cache) - Processor 生命周期管理
- [审计系统实战](../security/audit-pipeline) - 生产环境安全监控
- [API 参考：批量处理](../../api-reference/modules/batch) - 完整批量 API
- [性能优化](../performance/performance) - 性能调优技巧
