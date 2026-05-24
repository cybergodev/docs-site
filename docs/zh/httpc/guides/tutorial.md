---
title: "实战教程 - HTTPC"
description: "三十分钟实战教程：从 httpc.Get 逐步构建 GitHub REST API 客户端，涵盖 JSON 解析、NewDomain 域名客户端、WithJSON 发送数据、中间件链、ClientError 错误处理与文件下载。"
---

# 实战教程：构建 GitHub API 客户端

通过构建一个 GitHub API 客户端，串联 HTTPC 的核心概念。约 30 分钟完成。

**你将学到：**

- 创建客户端与配置预设
- 发送 GET/POST 请求与处理 JSON 响应
- 使用域名客户端管理 API 基础 URL
- 添加中间件实现日志和指标
- 处理错误与重试
- 使用对象池复用优化性能

## 第 1 步：基本请求

安装依赖并创建 `main.go`：

```bash
go get github.com/cybergodev/httpc
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://api.github.com/repos/golang/go")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // JSON 响应
}
```

要点：
- 包级函数 `httpc.Get` 无需创建客户端，适合快速验证
- `defer httpc.ReleaseResult(result)` 将结果归还对象池

## 第 2 步：解析 JSON 响应

```go
type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

result, err := httpc.Get("https://api.github.com/repos/golang/go")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("语言: %s\n", repo.Language)
fmt.Printf("描述: %s\n", repo.Description)
```

要点：
- `result.Unmarshal(&v)` 直接将 JSON 响应解析到结构体
- 定义与 API 响应对应的 Go 结构体

## 第 3 步：创建域名客户端

GitHub API 所有端点都在 `https://api.github.com` 下，使用域名客户端避免重复写 URL：

```go
client, err := httpc.NewDomain("https://api.github.com")
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

// 请求路径相对于 baseURL
result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)
```

要点：
- `NewDomain` 创建作用域客户端，路径相对于 baseURL
- `SetHeader` 设置持久请求头，每次请求自动携带
- `WithHeader` 作为请求选项传入，仅对当前请求生效
- 域名客户端自动管理 Cookie

## 第 4 步：发送数据（创建 Issue）

```go
type CreateIssueRequest struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}

newIssue := CreateIssueRequest{
    Title: "Bug report",
    Body:  "Found a bug in the API response",
}

result, err := client.Post("/repos/owner/repo/issues",
    httpc.WithJSON(newIssue),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

if !result.IsSuccess() {
    log.Fatalf("创建失败: %d %s", result.StatusCode(), result.Body())
}

var created struct {
    Number int    `json:"number"`
    URL    string `json:"html_url"`
}
result.Unmarshal(&created)
fmt.Printf("Issue #%d 已创建: %s\n", created.Number, created.URL)
```

要点：
- `WithJSON(data)` 自动序列化并设置 Content-Type
- `result.IsSuccess()` 检查 2xx 状态码

## 第 5 步：添加中间件

为客户端添加日志和请求 ID：

```go
// 配置中间件
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
}

// 将配置传入 NewDomain，创建带中间件的域名客户端
client, err := httpc.NewDomain("https://api.github.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()

if err := client.SetHeader("Authorization", "Bearer "+os.Getenv("GITHUB_TOKEN")); err != nil {
    log.Fatal(err)
}

result, err := client.Get("/repos/golang/go",
    httpc.WithHeader("Accept", "application/vnd.github+json"),
)
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

要点：
- 中间件在 `Config.Middleware.Middlewares` 中配置
- `LoggingMiddleware` 记录请求日志
- `RecoveryMiddleware` 防止 panic 崩溃
- `RequestIDMiddleware` 为每个请求生成唯一 ID

## 第 6 步：错误处理与重试

```go
result, err := client.Get("/repos/golang/go")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("请求超时，稍后重试")
        case httpc.ErrorTypeNetwork:
            log.Println("网络错误")
        case httpc.ErrorTypeTLS:
            log.Println("TLS 错误")
        default:
            log.Printf("HTTP 错误: %s", clientErr.Error())
        }

        if clientErr.IsRetryable() {
            log.Println("该错误可自动重试")
        }
    }
    return
}
defer httpc.ReleaseResult(result)

// 处理 HTTP 状态码
switch {
case result.IsSuccess():
    // 2xx 成功
case result.StatusCode() == 401:
    log.Println("Token 过期或无效")
case result.IsClientError():
    log.Printf("客户端错误: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("服务端错误: %d (已自动重试 %d 次)",
        result.StatusCode(), result.Meta.Attempts)
}
```

配置重试策略：

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

要点：
- HTTPC 将网络错误和 HTTP 状态码分离处理
- `ClientError` 提供错误分类和是否可重试判断
- 默认对 408, 429, 500, 502, 503, 504 自动重试

## 第 7 步：文件下载（下载发布包）

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r下载进度: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := client.DownloadWithOptions(
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n下载完成: %s (%s)\n",
    result.FilePath,
    httpc.FormatBytes(result.BytesWritten),
)
```

## 第 8 步：并发请求

同时获取多个仓库信息：

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, _ := httpc.New(httpc.PerformanceConfig())
    defer client.Close()

    results := make([]*httpc.Result, len(repos))
    errs := make([]error, len(repos))

    var wg sync.WaitGroup
    for i, name := range repos {
        wg.Add(1)
        go func(idx int, repo string) {
            defer wg.Done()
            r, err := client.Request(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s", repo))
            results[idx] = r
            errs[idx] = err
        }(i, name)
    }
    wg.Wait()

    for i, err := range errs {
        if err != nil {
            return err
        }

        var repo Repo
        results[i].Unmarshal(&repo)
        fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
        httpc.ReleaseResult(results[i])
    }
    return nil
}
```

:::tip
`PerformanceConfig()` 提供大连接池配置，适合高并发场景。记得在并发中正确使用 `ReleaseResult`。
:::

## 完整示例

将以上步骤整合的完整代码：

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/httpc"
)

type Repo struct {
    FullName    string `json:"full_name"`
    Description string `json:"description"`
    Stars       int    `json:"stargazers_count"`
    Language    string `json:"language"`
}

func main() {
    token := os.Getenv("GITHUB_TOKEN")

    cfg := httpc.DefaultConfig()
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.LoggingMiddleware(func(format string, args ...any) {
            log.Printf("[HTTP] "+format, args...)
        }),
        httpc.RecoveryMiddleware(),
    }

    client, err := httpc.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // 获取仓库信息
    result, err := client.Get("https://api.github.com/repos/golang/go",
        httpc.WithHeader("Authorization", "Bearer "+token),
    )
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && clientErr.IsRetryable() {
            log.Fatal("请求失败（已重试）:", err)
        }
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if result.IsSuccess() {
        var repo Repo
        result.Unmarshal(&repo)
        fmt.Printf("✅ %s\n", repo.FullName)
        fmt.Printf("   ⭐ %d | 语言: %s\n", repo.Stars, repo.Language)
        fmt.Printf("   %s\n", repo.Description)
        fmt.Printf("   耗时: %s (重试 %d 次)\n",
            result.Meta.Duration, result.Meta.Attempts)
    }
}
```

## 下一步

- [请求与响应](./request-response) — 完整的请求选项参考
- [中间件链](./middleware-chain) — 自定义中间件开发
- [重试与容错](./retry-fault-tolerance) — 高级重试策略
- [性能优化](../advanced/performance) — 生产环境调优
- [生产检查清单](../security/production-checklist) — 安全最佳实践
