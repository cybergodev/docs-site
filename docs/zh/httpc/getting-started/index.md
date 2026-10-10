---
sidebar_label: "快速开始"
title: "快速开始 - CyberGo HTTPC | 5 分钟上手"
description: "HTTPC 快速开始指南：go get 安装与项目初始化、GET/POST 请求发送与响应处理、五种配置预设选型、JSON 解析与类型绑定、Bearer Token 认证与 ClientError 错误分类处理，五分钟上手安全 HTTP 客户端库。"
sidebar_position: 10
---

# 快速开始

## 安装

```bash
# 1. 创建项目并初始化 Go 模块（已有项目跳过本步）
mkdir httpc-demo && cd httpc-demo
go mod init example.com/httpc-demo

# 2. 添加依赖
go get github.com/cybergodev/httpc
```

在代码中导入：

```go
import "github.com/cybergodev/httpc"
```

HTTPC 要求 Go 1.26 及以上版本；除 `golang.org/x/sys` 外没有其他第三方依赖，无需任何配置即可发起第一个请求。

## 基本请求

无需创建客户端，直接使用包级函数：

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	result, err := httpc.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode()) // 200
	fmt.Println(result.Body())       // 响应内容
}
```

支持的 HTTP 方法：`Get`、`Post`、`Put`、`Patch`、`Delete`、`Head`、`Options`。

### 发生了什么

- 包级函数内部使用**惰性初始化的共享默认客户端**——首次调用时创建，之后复用，并发安全；
- 返回值 `*Result` 聚合了状态码、响应头、响应体以及请求元信息（耗时、尝试次数、重定向链）；
- `err != nil` 只代表**网络层错误**（连接失败、超时、TLS 错误等）；4xx/5xx 状态码需用 `result.IsSuccess()` 等方法自行检查；
- 默认配置自带 TLS 1.2+、SSRF 防护、响应体 10MB 上限与最多 3 次智能重试，无需额外设置。

## 创建客户端

需要自定义配置时，创建客户端实例：

```go
client, err := httpc.NewDefault()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

客户端持有连接池等资源，用完记得 `Close()`。长期运行的服务通常在进程生命周期内只创建一次、全局共享——`Client` 是并发安全的，不需要按请求或按 goroutine 创建。

### 预设配置

| 配置 | 用途 | 特点 |
|------|------|------|
| `DefaultConfig()` | 通用场景 | 安全默认值，SSRF 防护开启 |
| `SecureConfig()` | 安全敏感场景 | 禁用自动重定向，严格超时 |
| `PerformanceConfig()` | 高吞吐场景 | 大连接池，长超时，启用 Cookie |
| `TestingConfig()` | 测试环境 | 禁用安全检查与 HTTP/2，启用 Cookie |
| `MinimalConfig()` | 轻量请求 | 无重试，无重定向 |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

也可以设置对所有请求生效的默认值（User-Agent、默认请求头、重定向策略）：

```go
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers["Authorization"] = "Bearer " + token
cfg.Defaults.FollowRedirects = false

client, err := httpc.New(cfg)
```

## 响应处理

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}

// 状态检查
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// JSON 解析
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

解析到自定义结构体：

```go
var repo struct {
    Name  string `json:"name"`
    Stars int    `json:"stargazers_count"`
}
if err := result.Unmarshal(&repo); err != nil {
    log.Fatal(err)
}
```

查看请求元信息：

```go
result.Meta.Duration       // 总耗时（含重试等待）
result.Meta.Attempts       // 尝试次数（首次 + 重试）
result.Meta.RedirectChain  // 经过的重定向 URL 链
result.Meta.ProxyURL       // 本次使用的代理（直连或系统代理为空）
```

:::tip
`Unmarshal` 在响应体为空时返回 `ErrResponseBodyEmpty`，超过 50MB 时返回 `ErrResponseBodyTooLarge`。
:::

## 发送数据

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// 表单
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// 带认证
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

```go
// 查询参数
result, err := client.Get("https://httpbin.org/get",
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{"limit": 10, "sort": "desc"}),
)
```

```go
// 文件上传（multipart/form-data）
result, err := client.Post("https://httpbin.org/post",
    httpc.WithFile("file", "report.pdf", fileBytes),
)
```

## 错误处理

HTTPC 区分**网络层错误**和 **HTTP 状态码**：

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("错误代码: %s", clientErr.Code())
    }
    log.Fatal(err)
}

// HTTP 状态码需手动检查
switch {
case result.IsSuccess():
    // 2xx 成功
case result.IsClientError():
    log.Printf("客户端错误：%d", result.StatusCode())
case result.IsServerError():
    log.Printf("服务端错误：%d", result.StatusCode())
}
```

:::tip
4xx/5xx 不会作为 `error` 返回，需通过 `result.IsSuccess()` 等方法检查。详见 [错误处理](../guides/error-handling)。
:::

## 第一个完整程序

下面是可直接 `go run` 的完整例子：调用 GitHub API 查询仓库信息，覆盖创建客户端、设置请求头、超时控制、状态检查与 JSON 解析：

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// Repo 对应 GitHub API 的仓库响应
type Repo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Stars       int    `json:"stargazers_count"`
}

func main() {
	// 1. 创建客户端（默认配置：TLS 1.2+、SSRF 防护、最多重试 3 次）
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 2. 发送请求：默认头 + 请求级超时
	result, err := client.Get("https://api.github.com/repos/golang/go",
		httpc.WithUserAgent("httpc-demo/1.0"),
		httpc.WithTimeout(15*time.Second),
	)
	if err != nil {
		log.Fatal(err) // 网络层错误（连接/超时/TLS 等）
	}

	// 3. 检查 HTTP 状态码（4xx/5xx 不是 error，需手动检查）
	if !result.IsSuccess() {
		log.Fatalf("HTTP 错误：%d", result.StatusCode())
	}

	// 4. 解析 JSON 到结构体
	var repo Repo
	if err := result.Unmarshal(&repo); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%s：%s（%d 星）\n", repo.Name, repo.Description, repo.Stars)
	fmt.Printf("耗时 %v，尝试 %d 次\n", result.Meta.Duration, result.Meta.Attempts)
}

// 输出（星数与耗时随实际变化）：
// go：The Go programming language（124000 星）
// 耗时 350ms，尝试 1 次
```

## 常见第一步场景

### 调用 JSON API（认证 + 查询参数）

```go
result, err := client.Get("https://api.example.com/v1/issues",
    httpc.WithBearerToken(token),                                   // Bearer 认证
    httpc.WithQueryMap(map[string]any{"state": "open", "page": 2}), // 查询参数
    httpc.WithHeader("Accept", "application/json"),
)
```

### 带超时与重试的请求

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
	cfg.Timeouts.Request = 30 * time.Second // 整体超时预算（含所有重试）
	cfg.Retry.MaxRetries = 3                // 最多重试 3 次（0 禁用）
	cfg.Retry.Delay = time.Second           // 初始退避 1s
	cfg.Retry.BackoffFactor = 2.0           // 每次退避 ×2（1s → 2s → 4s）
	cfg.Retry.EnableJitter = true           // 抖动，避免惊群

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// httpbin 的 /status/503 恒定返回 503（可重试状态码）
	result, err := client.Get("https://httpbin.org/status/503")
	if err != nil {
		log.Fatal(err) // 网络层错误
	}

	// 503 属于可重试状态码：重试耗尽后返回最后一次响应（而非 error）
	fmt.Println("状态码：", result.StatusCode())   // 503
	fmt.Println("尝试次数：", result.Meta.Attempts) // 4（首次 + 3 次重试）
}

// 输出：
// 状态码： 503
// 尝试次数： 4
```

### 访问本地或内网服务

默认配置会阻止连接 `127.0.0.1`、`10.x`、`192.168.x` 等私有/保留地址（SSRF 防护）。本地联调有三种打开方式：

```go
// 方式一：按请求豁免（推荐，影响面最小）
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// 方式二：精确豁免内网 CIDR（如 Tailscale、VPC）
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
client, _ := httpc.New(cfg)

// 方式三：测试预设（仅限本地开发/测试，切勿用于生产）
client, _ = httpc.New(httpc.TestingConfig())
```

详见 [SSRF 防护](../security/ssrf)。

## 下一步

**入门路径**

- **[核心概念](./concepts)** - 双层架构、配置体系与请求生命周期
- **[请求与响应](../guides/request-response)** - 完整的请求选项和响应处理
- **[从 net/http 迁移](../guides/migration)** - 标准库经验逐项映射

**按主题深入**

- **[重试与容错](../guides/retry-fault-tolerance)** - 退避策略、自定义重试与代理池交互
- **[中间件链](../guides/middleware-chain)** - 日志、指标、审计与自定义中间件
- **[连接池](../guides/connection-pool)** - 连接池调优与 DoH
- **[代理与代理池](../guides/proxy)** - 单代理、系统代理、代理池轮换与熔断
- **[文件传输](../guides/file-transfer)** - 下载、断点续传与文件上传
- **[域名会话](../guides/domain-session)** - DomainClient 与 Cookie 会话管理
- **[重定向](../guides/redirects)** - 跟随策略与域名白名单
- **[性能](../guides/performance)** - 调优清单与场景配置
- **[测试](../guides/testing)** - TestingConfig 与 mock 方案

**更多资源**

- **[实战教程](../guides/tutorial)** - 30 分钟构建 GitHub API 客户端
- **[速查表](./cheatsheet)** - 常用操作快速参考
- **[基础示例](../examples/basic-usage)** - 可运行的最小示例集
- **[API 总览](../api-reference/)** - 全部公开 API 索引
- **[安全](../security/)** - 安全最佳实践与生产检查清单
