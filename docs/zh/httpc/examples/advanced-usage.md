---
title: 高级示例 - HTTPC
description: HTTPC 高级用法示例集，包含自定义重试策略、中间件链配置、RESTful API 封装、并发下载与 HMAC 签名认证进阶示例。
---

# 高级示例

## 自定义重试策略

仅对 502/503/504 重试，使用固定延迟：

:::warning 内部类型
`RetryPolicy.ShouldRetry` 的 `resp` 参数类型 `ResponseReader` 为内部接口（定义在 `internal/types` 包中），外部包无法直接引用。自定义 `RetryPolicy` 必须在与 `httpc` 同一模块内的包中实现。大多数场景可通过 `RetryConfig` 配置满足需求。以下示例展示实现模式，实际代码需在 `httpc` 模块内部编译。
:::

```go
// 注意：ResponseReader 是内部类型（internal/types 包）。
// 此代码仅能在 github.com/cybergodev/httpc 模块内部编译。
// 大多数用户应通过 RetryConfig 和 WithMaxRetries 配置重试。

type selectiveRetry struct {
    maxAttempts int
    baseDelay   time.Duration
}

// 判断是否应该重试
func (p *selectiveRetry) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    if err != nil {
        return true // 网络错误重试
    }
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

func (p *selectiveRetry) GetDelay(attempt int) time.Duration {
    return p.baseDelay * time.Duration(attempt+1)
}

func (p *selectiveRetry) MaxRetries() int {
    return p.maxAttempts
}

// 应用自定义策略
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &selectiveRetry{maxAttempts: 5, baseDelay: time.Second}
```

外部项目的替代方案 — 使用 `RetryConfig` 配置：

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 5
    cfg.Retry.Delay = 500 * time.Millisecond
    cfg.Retry.BackoffFactor = 1.5
    cfg.Retry.EnableJitter = true

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://api.example.com/unstable")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode())
}
```

## 完整中间件链

```go
package main

import (
    "encoding/json"
    "log"
    "sync/atomic"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // 请求计数器
    var requestCount int64

    // 指标收集
    metricsMiddleware := httpc.MetricsMiddleware(
        func(method, url string, statusCode int, duration time.Duration, err error) {
            atomic.AddInt64(&requestCount, 1)
            log.Printf("[METRICS] %s %s -> %d (%v)", method, url, statusCode, duration)
        },
    )

    // 审计日志（JSON 格式）
    auditCfg := &httpc.AuditMiddlewareConfig{
        Format:         "json",
        IncludeHeaders: true,
        MaskHeaders:    []string{"Authorization", "Cookie"},
        SanitizeError:  true,
    }
    auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
        data, _ := json.Marshal(event)
        log.Printf("[AUDIT] %s", data)
    }, auditCfg)

    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),                              // panic 恢复
        httpc.TimeoutMiddleware(30 * time.Second),              // 强制超时
        httpc.RequestIDMiddleware("X-Request-ID", nil),         // 请求 ID
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        metricsMiddleware,
        auditMiddleware,
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Printf("总请求数: %d", atomic.LoadInt64(&requestCount))
}
```

## REST API 客户端封装

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

type APIClient struct {
    dc httpc.DomainClienter
}

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

func NewAPIClient(baseURL, token string) (*APIClient, error) {
    dc, err := httpc.NewDomain(baseURL)
    if err != nil {
        return nil, err
    }
    if err := dc.SetHeader("Authorization", "Bearer "+token); err != nil {
        dc.Close()
        return nil, err
    }
    if err := dc.SetHeader("Accept", "application/json"); err != nil {
        dc.Close()
        return nil, err
    }

    return &APIClient{dc: dc}, nil
}

func (c *APIClient) GetUser(ctx context.Context, id int) (*User, error) {
    result, err := c.dc.Request(ctx, "GET", fmt.Sprintf("/users/%d", id))
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        return nil, fmt.Errorf("API error: %d", result.StatusCode())
    }

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) CreateUser(ctx context.Context, name string) (*User, error) {
    result, err := c.dc.Request(ctx, "POST", "/users",
        httpc.WithJSON(map[string]string{"name": name}),
    )
    if err != nil {
        return nil, err
    }
    defer httpc.ReleaseResult(result)

    var user User
    if err := result.Unmarshal(&user); err != nil {
        return nil, err
    }
    return &user, nil
}

func (c *APIClient) Close() error {
    return c.dc.Close()
}

func main() {
    api, err := NewAPIClient("https://api.example.com", "my-token")
    if err != nil {
        log.Fatal(err)
    }
    defer api.Close()

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // 创建用户
    user, err := api.CreateUser(ctx, "Alice")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("创建: %+v\n", user)

    // 获取用户
    user, err = api.GetUser(ctx, user.ID)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("获取: %+v\n", user)
}
```

## 并发下载

```go
package main

import (
    "fmt"
    "log"
    "sync"
    "sync/atomic"

    "github.com/cybergodev/httpc"
)

func main() {
    urls := map[string]string{
        "file1.zip": "https://example.com/files/file1.zip",
        "file2.zip": "https://example.com/files/file2.zip",
        "file3.zip": "https://example.com/files/file3.zip",
    }

    client, _ := httpc.New()
    defer client.Close()

    var successCount int64
    var totalBytes int64
    var wg sync.WaitGroup

    for filename, url := range urls {
        wg.Add(1)
        go func(name, u string) {
            defer wg.Done()

            cfg := httpc.DefaultDownloadConfig()
            cfg.FilePath = "/tmp/" + name
            cfg.Overwrite = true
            cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
                fmt.Printf("\r%s: %.1f%% (%s/s)", name,
                    float64(downloaded)/float64(total)*100,
                    httpc.FormatSpeed(speed))
            }

            result, err := client.DownloadWithOptions(u, cfg)
            if err != nil {
                log.Printf("%s 下载失败: %v", name, err)
                return
            }

            atomic.AddInt64(&successCount, 1)
            atomic.AddInt64(&totalBytes, result.BytesWritten)
            fmt.Printf("\n%s 完成: %s\n", name, httpc.FormatBytes(result.BytesWritten))
        }(filename, url)
    }

    wg.Wait()
    fmt.Printf("\n下载完成: %d/%d, 总计 %s\n",
        successCount, len(urls), httpc.FormatBytes(totalBytes))
}
```

## 自定义中间件：请求签名

```go
package main

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func SigningMiddleware(secret string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            timestamp := time.Now().Unix()
            message := fmt.Sprintf("%s%s%d", req.Method(), req.URL(), timestamp)

            mac := hmac.New(sha256.New, []byte(secret))
            mac.Write([]byte(message))
            signature := hex.EncodeToString(mac.Sum(nil))

            req.SetHeader("X-Timestamp", fmt.Sprintf("%d", timestamp))
            req.SetHeader("X-Signature", signature)

            return next(ctx, req)
        }
    }
}

func main() {
    cfg := httpc.DefaultConfig()
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        SigningMiddleware("my-secret-key"),
    }

    client, _ := httpc.New(cfg)
    defer client.Close()

    result, err := client.Get("https://api.example.com/protected")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    log.Println(result.StatusCode())
}
```

## 下一步

- [中间件链](../guides/middleware-chain) - 中间件架构详解
- [重试与容错](../guides/retry-fault-tolerance) - 自定义重试策略
- [性能优化](../advanced/performance) - 性能调优建议
