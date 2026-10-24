---
sidebar_label: "实战教程"
title: "实战教程 - CyberGo HTTPC | GitHub API 实战"
description: "以 GitHub API 为场景的 HTTPC 端到端教程：包级函数与默认客户端的关系、五种配置预设与默认值、WithQuery/WithJSON 等请求选项、NewDomain 域名客户端、中间件链、ClientError 错误分类、文件下载与并发请求。"
sidebar_position: 10
---

# 实战教程：构建 GitHub API 客户端

本教程是一个以 GitHub API 为场景的 HTTPC 端到端示例，覆盖客户端创建、请求选项、域名客户端、中间件与错误处理。阅读前建议先看[核心概念](../getting-started/concepts)；各节也可单独阅读。

**覆盖范围：**

- 创建客户端与配置预设
- 包级函数与默认客户端的关系
- 客户端实例的生命周期与默认配置
- 发送 GET/POST 请求与解析 JSON 响应
- 查询参数与常用请求选项
- 用域名客户端管理 API 基础 URL
- 中间件：日志与请求 ID
- 错误分类与重试
- Result 响应对象

## 基本请求

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

	fmt.Println(result.StatusCode()) // 200
	fmt.Println(result.Body())       // JSON 响应
}
```

要点：`httpc.Get` 无需创建客户端，适合快速验证；`Result` 每次请求新建，由 GC 回收。

### 包级函数与默认客户端

包级函数（`Get`/`Post`/`Request` 等）共享一个**惰性初始化的默认客户端**：首次调用时创建，后续调用复用同一实例。默认客户端关闭后，下一次包级调用自动重建。机制说明见[核心概念](../getting-started/concepts)。

替换默认客户端的方式如下：

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 自定义配置并设为默认客户端（旧默认客户端会自动关闭）
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := httpc.SetDefaultClient(client); err != nil {
		log.Fatal(err)
	}

	// 此后的包级函数都使用这个客户端
	result, err := httpc.Get("https://api.github.com/repos/golang/go")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200

	// 程序退出前释放默认客户端
	if err := httpc.CloseDefaultClient(); err != nil {
		log.Fatal(err)
	}
}
```

:::tip
长期运行的服务应使用下方「创建与配置客户端实例」中的显式客户端管理生命周期；默认客户端适用于脚本与一次性请求。
:::

## 解析 JSON 响应

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

var repo Repo
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}

fmt.Printf("%s (⭐ %d)\n", repo.FullName, repo.Stars)
fmt.Printf("语言: %s\n", repo.Language)
fmt.Printf("描述: %s\n", repo.Description)
```

要点：`result.Unmarshal(&v)` 将 JSON 响应解析到结构体，结构体字段需与 API 响应对应。响应体为空时返回 `ErrResponseBodyEmpty`，超过 50MB 返回 `ErrResponseBodyTooLarge`。

## 创建与配置客户端实例

包级函数背后始终是一个默认客户端；需要控制配置与生命周期时，用 `New` 显式创建实例：

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 30 * time.Second
	cfg.Timeouts.Dial = 5 * time.Second
	cfg.Retry.MaxRetries = 2

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err) // 配置校验失败（如非法超时值）在此返回
	}
	defer client.Close()

	result, err := client.Get("https://api.github.com/repos/golang/go",
		httpc.WithUserAgent("my-github-app/1.0"),
	)
	if err != nil {
		if errors.Is(err, httpc.ErrClientClosed) {
			log.Fatal("客户端已关闭：", err)
		}
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 200
}
```

要点：

- `New(cfg)` 先校验配置，再深拷贝一份，创建后修改原 `cfg` 不影响客户端
- `Close()` 释放连接池与传输层资源，关闭后的请求返回 `ErrClientClosed`
- 客户端可安全并发使用（见「并发请求」），应长驻复用
- `NewDefault()` 等价于 `New(DefaultConfig())`

### 配置预设

不必每次从零编写配置：HTTPC 提供五种预设作为起点。

| 预设 | 定位 | 相对 DefaultConfig 的关键差异 |
|------|------|------|
| `DefaultConfig()` | 通用默认 | 请求超时 180s、重试 3 次、响应上限 10MB、跟随重定向 |
| `SecureConfig()` | 安全优先 | 超时收紧（请求 15s、拨号/TLS 5s）、响应上限 5MB、禁用重定向跟随、重试 1 次 |
| `PerformanceConfig()` | 高吞吐 | 连接池放大（空闲 100/每主机 20）、响应上限 50MB、重试延迟 500ms、启用 Cookie |
| `TestingConfig()` | 仅测试 | 跳过 TLS 校验、放行私有 IP、关闭 URL/头校验（生产禁用，非测试环境调用会打印警告） |
| `MinimalConfig()` | 一次性请求 | 不重试、不跟随重定向、响应上限 1MB、小连接池 |

五种预设的完整对比与选型见[性能优化](./performance#预设配置对比)。

### 默认配置一览

`DefaultConfig()` 的关键默认值（完整字段见 [配置 API](../api-reference/client-config/config)）：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `Timeouts.Request` | 180s | 整体请求超时（覆盖全部重试尝试） |
| `Timeouts.Dial` / `Timeouts.TLSHandshake` | 10s / 10s | TCP 连接 / TLS 握手超时 |
| `Timeouts.IdleConn` | 90s | 空闲连接保活时长 |
| `Connection.MaxIdleConns` / `MaxConnsPerHost` | 50 / 10 | 空闲连接池 / 每主机连接上限 |
| `Retry.MaxRetries` / `Delay` / `BackoffFactor` | 3 / 1s / 2.0 | 重试次数、初始延迟、退避倍数（默认带抖动，单次延迟上限 30s） |
| `Security.MaxResponseBodySize` | 10MB | 响应体大小上限 |
| `Security.MaxDecompressedBodySize` | 100MB | 解压后响应体上限 |
| `Defaults.UserAgent` | `httpc/1.0` | 默认 User-Agent |
| `Security.FollowRedirects` / `MaxRedirects` | true / 10 | 重定向跟随策略 |

## 查询参数与请求选项

请求选项以 `With*` 函数表示，可组合使用，按传入顺序附加在 URL 之后：

```go
client, _ := httpc.NewDefault()
defer client.Close()

// 查询参数：逐个设置，或用 Map 批量设置
result, err := client.Get("https://api.github.com/search/repositories",
    httpc.WithQuery("q", "language:go"),
    httpc.WithQuery("sort", "stars"),
    httpc.WithQueryMap(map[string]any{
        "order": "desc",
        "page":  1,
    }),
)

// 单请求覆盖客户端默认值：超时与重试
result, err = client.Get("https://api.github.com/repos/golang/go",
    httpc.WithTimeout(10*time.Second),
    httpc.WithMaxRetries(1),
)
```

要点：

- `WithQuery` 支持 `string`、数值、布尔等类型，值为 `nil` 时不写入 URL
- `WithTimeout` 须大于 0 且不超过 30 分钟，0 与负值均返回 `ErrInvalidTimeout`；解除超时用 `WithNoTimeout()`，该选项覆盖 `Timeouts.Request`
- `WithMaxRetries` 取 0–10，覆盖 `Retry.MaxRetries`

全部选项见[请求选项 API](../api-reference/core/options)，请求与响应细节见[请求与响应](./request-response)。

## 创建域名客户端

GitHub API 的所有端点都在 `https://api.github.com` 下；域名客户端可避免重复书写该前缀：

```go
client, err := httpc.NewDomainDefault("https://api.github.com")
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
```

要点：

- `NewDomain` / `NewDomainDefault` 创建域名客户端，请求路径相对于 baseURL
- `SetHeader` 设置持久请求头，每次请求自动携带；`WithHeader` 仅对当前请求生效
- DomainClient 内置 `SessionManager`，请求前注入会话头与 Cookie、响应后回写 `Set-Cookie`；该会话存储独立于 `Connection.EnableCookies`

## 发送数据（创建 Issue）

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

要点：`WithJSON(data)` 自动序列化请求体并设置 `Content-Type`；`result.IsSuccess()` 检查状态码是否为 2xx。

## 添加中间件

以下示例为客户端添加日志与请求 ID 中间件：

```go
// 配置中间件
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }}),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
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

var repo Repo
result.Unmarshal(&repo)
fmt.Printf("%s: ⭐ %d\n", repo.FullName, repo.Stars)
```

要点：中间件在 `MiddlewareConfig.Middlewares` 中配置，切片顺序即由外到内的执行顺序。`LoggingMiddleware` 记录请求日志，`RecoveryMiddleware` 捕获 panic，`RequestIDMiddleware` 为每个请求生成唯一 ID。中间件模型见[中间件链](./middleware-chain)。

## 错误处理与重试

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

// 处理 HTTP 状态码
switch {
case result.IsSuccess():
    // 2xx 成功
case result.StatusCode() == 401:
    log.Println("Token 过期或无效")
case result.IsClientError():
    log.Printf("客户端错误：%d", result.StatusCode())
case result.IsServerError():
    log.Printf("服务端错误：%d (共尝试 %d 次，含首次请求)",
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

要点：HTTPC 将网络错误与 HTTP 状态码分开处理。`ClientError` 提供错误分类与 `IsRetryable()` 判断，408、429、500、502、503、504 默认自动重试。`Timeouts.Request` 是全部重试尝试的总预算，详见[重试与容错](./retry-fault-tolerance)。

## 文件下载（下载发布包）

```go
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "go1.22.0.linux-amd64.tar.gz"
dlCfg.Overwrite = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r下载进度：%.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(
    context.Background(),
    "https://go.dev/dl/go1.22.0.linux-amd64.tar.gz",
    dlCfg,
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n下载完成: %s (%d bytes)\n",
    result.FilePath,
    result.BytesWritten,
)
```

## 并发请求

以下是同时获取多个仓库信息的示例：

```go
func fetchRepos(ctx context.Context, repos []string) error {
    client, err := httpc.New(httpc.PerformanceConfig())
    if err != nil {
        return err
    }
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
    }
    return nil
}
```

:::tip
`PerformanceConfig()` 提供较大的连接池，适用于高并发场景；`Result` 每次请求新建，由 GC 回收。
:::

## 完整示例

以下是整合前述各节的完整代码：

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
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
			log.Printf("[HTTP] "+format, args...)
		}}),
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

	if result.IsSuccess() {
		var repo Repo
		result.Unmarshal(&repo)
		fmt.Printf("✅ %s\n", repo.FullName)
		fmt.Printf("   ⭐ %d | 语言: %s\n", repo.Stars, repo.Language)
		fmt.Printf("   %s\n", repo.Description)
		fmt.Printf("   耗时: %s (共尝试 %d 次，含首次请求)\n",
			result.Meta.Duration, result.Meta.Attempts)
	}
}
```

## 下一步

- [请求与响应](./request-response) — 完整的请求选项参考
- [中间件链](./middleware-chain) — 自定义中间件开发
- [重试与容错](./retry-fault-tolerance) — 高级重试策略
- [域名客户端与会话](./domain-session) — 会话状态管理
- [性能优化](./performance) — 生产环境调优
- [配置 API](../api-reference/client-config/config) — 全部配置字段与预设
- [生产检查清单](../security/production-checklist) — 安全最佳实践
