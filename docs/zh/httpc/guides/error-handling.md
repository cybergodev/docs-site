---
sidebar_label: "错误处理"
title: "错误处理 - CyberGo HTTPC | 分类与哨兵匹配"
description: "HTTPC 错误处理指南：ErrorType 十二种错误分类与分类决策树、ClientError 字段与 IsRetryable 细粒度判定、平台 syscall 可重试映射、哨兵错误匹配、panic 恢复与中间件统一错误处理，以及超时分层与重试耗尽的处理策略。"
sidebar_position: 60
---

# 错误处理

HTTPC 将请求失败统一封装为 `ClientError`，携带错误分类、可重试判断与请求上下文。配合 `errors.Is`/`errors.As` 可匹配哨兵错误，也可按分类分支处理。

## ErrorType 完整参考

HTTPC 定义了 12 种错误类型，覆盖网络层到应用层的失败场景：

| ErrorType | Code() | 含义 | 典型场景 | 可重试 |
|-----------|--------|------|----------|--------|
| `ErrorTypeNetwork` | `NETWORK_ERROR` | 网络层错误 | 连接拒绝、连接重置、断管 | 视原因而定 |
| `ErrorTypeTimeout` | `TIMEOUT` | 超时 | 拨号超时、请求超时、context 截止 | 是 |
| `ErrorTypeContextCanceled` | `CONTEXT_CANCELED` | 上下文取消 | `ctx.Cancel()` 被调用 | 否 |
| `ErrorTypeDNS` | `DNS_ERROR` | DNS 解析失败 | 域名不存在、DNS 服务器故障 | 临时/超时可重试 |
| `ErrorTypeTLS` | `TLS_ERROR` | TLS 握手错误 | 协议版本不支持、算法协商失败 | 否 |
| `ErrorTypeCertificate` | `CERTIFICATE_ERROR` | 证书验证失败 | 证书过期、签名无效、CA 不受信 | 否 |
| `ErrorTypeTransport` | `TRANSPORT_ERROR` | HTTP 传输层错误 | 协议错误、传输异常中断 | 是 |
| `ErrorTypeResponseRead` | `RESPONSE_READ_ERROR` | 响应体读取错误 | 连接中断导致 EOF、读取超时 | 视原因而定 |
| `ErrorTypeRetryExhausted` | `RETRY_EXHAUSTED` | 重试耗尽 | 达到 `MaxRetries` 上限后仍失败 | 否 |
| `ErrorTypeValidation` | `VALIDATION_ERROR` | 请求验证失败 | URL 格式非法、HTTP 头含控制字符 | 否 |
| `ErrorTypeHTTP` | `HTTP_ERROR` | HTTP 状态码错误 | 4xx/5xx 响应 | 按状态码判断 |
| `ErrorTypeUnknown` | `UNKNOWN_ERROR` | 未分类错误 | 其他未匹配的异常 | 否 |

:::tip 可重试判断的完整规则
`IsRetryable()` 的判定比上表更细粒度：

- `ErrorTypeDNS` 仅在 `net.DNSError` 标记为临时或超时时可重试。
- `ErrorTypeNetwork` 检查 `syscall.Errno`（`ECONNREFUSED`/`ECONNRESET`/`EPIPE`/`ETIMEDOUT`/`ENETUNREACH`/`EHOSTUNREACH`）与错误消息模式。
- `ErrorTypeResponseRead` 仅在 `read`/`readfrom` 操作的网络错误时可重试。

规则见下方「可重试判定的实现细节」。
:::

## 错误分类决策树

非 nil 错误进入引擎后经过同一套分类流程，按优先级自上而下匹配，命中即止：

```text
错误 err
├─ errors.Is(err, context.Canceled)          → ContextCanceled「请求被取消」
├─ errors.Is(err, context.DeadlineExceeded)  → Timeout「请求超时」
├─ 连接池耗尽（内部哨兵 ErrPoolExhausted）   → Network「connection pool exhausted」
├─ *url.Error（先解包，按内层错误继续分类）
│   ├─ 消息含 "http2" + "invalid"           → Validation「非法 HTTP/2 请求头」
│   ├─ 消息含 "parse" / "invalid url" / "missing protocol" → Validation「URL 校验失败」
│   └─ 其余用内层错误走下列分支
├─ *net.DNSError                             → DNS「DNS resolution timed out / failed」
├─ *net.OpError                              → Network「网络操作超时 / 失败」
├─ net.Error                                 → Timeout（超时）/ Network（其他）
└─ 错误消息模式匹配（大小写不敏感，节选）
    ├─ "stopped after … redirect"            → Validation「redirect limit exceeded」
    ├─ "circular redirect"                   → Validation「circular redirect detected」
    ├─ "redirect blocked"                    → Validation「redirect blocked by policy」
    ├─ "connection refused / reset / closed"、"broken pipe" → Network
    ├─ "no such host"                        → DNS
    ├─ "tls" / "ssl" + "handshake"           → TLS
    ├─ "certificate"、"x509"                 → Certificate
    ├─ "transport"、"protocol error"         → Transport
    ├─ "failed to read response body"、"unexpected eof"    → ResponseRead
    ├─ "http 4xx" / "http 5xx"               → HTTP（同时提取状态码）
    └─ "timeout" / "timed out"（不含 "context"）           → Timeout
```

:::tip 已分类的错误不会二次包装
错误链中已存在 `ClientError`（如中间件返回的引擎错误）时，分类器复用其字段，只补全 URL、方法与尝试次数，不再嵌套包装。`errors.As` 命中最外层即可拿到完整上下文。
:::

## ClientError 字段详解

`ClientError` 携带请求失败的完整上下文：

| 字段 | 类型 | 用途 |
|------|------|------|
| Type | `ErrorType` | 错误分类，用于 `switch` 分支处理 |
| Message | `string` | 人类可读的错误描述 |
| Cause | `error` | 底层原始错误，支持 `errors.Unwrap` 链 |
| `URL` | `string` | 请求的 URL（已脱敏，见下方） |
| `Method` | `string` | HTTP 方法（GET/POST/...） |
| `Attempts` | `int` | 已尝试次数（含首次），重试耗尽时 > 1 |
| `StatusCode` | `int` | HTTP 状态码（仅 `ErrorTypeHTTP` 有值） |
| Host | `string` | 目标主机名（用于断路器等） |

### Error() 输出格式

`ClientError.Error()` 按固定格式输出（URL 已脱敏）：

```text
METHOD url: message: cause (attempt N)
```

实际示例：

```text
GET https://api.example.com/data: network error occurred: dial tcp 1.2.3.4:443: connect: connection refused (attempt 4)
```

`Unwrap()` 返回 `Cause`，因此可穿透包装直达底层错误：`errors.Is(err, context.DeadlineExceeded)`、`errors.As(err, &opErr)`（提取 `*net.OpError`）。`err` 的字符串已含方法、脱敏 URL、原因链与尝试次数，可直接写入日志。

### 错误类型判断

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			switch clientErr.Type {
			case httpc.ErrorTypeTimeout:
				log.Printf("请求超时（已尝试 %d 次）: %v", clientErr.Attempts, err)
			case httpc.ErrorTypeNetwork:
				log.Printf("网络错误: %v", err)
			case httpc.ErrorTypeDNS:
				log.Printf("DNS 解析失败: %v", err)
			case httpc.ErrorTypeTLS:
				log.Printf("TLS 握手失败: %v", err)
			case httpc.ErrorTypeCertificate:
				log.Printf("证书验证失败: %v", err)
			case httpc.ErrorTypeRetryExhausted:
				log.Printf("重试 %d 次后仍失败: %v", clientErr.Attempts, err)
			case httpc.ErrorTypeValidation:
				log.Printf("请求验证失败: %v", err)
			case httpc.ErrorTypeContextCanceled:
				log.Printf("请求已取消: %v", err)
			default:
				log.Printf("其他错误 [%s]: %v", clientErr.Code(), err)
			}
		}
		return
	}
	fmt.Printf("成功：%d\n", result.StatusCode())
}
```

### 可重试判断

`IsRetryable()` 综合考虑错误类型和底层原因，返回是否值得重试：

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	_, err = client.Get("https://api.example.com/data")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			if clientErr.IsRetryable() {
				fmt.Println("可重试错误，上层逻辑可稍后重试")
			} else {
				fmt.Printf("不可重试错误 [%s]，需人工介入\n", clientErr.Code())
			}
		}
	}
}
```

:::warning IsRetryable 与自动重试的区别
`IsRetryable()` 判断该错误是否值得重试，HTTPC 内部的重试引擎也使用同一判定。配置了 `RetryConfig.MaxRetries` 时，网络/超时类错误到达调用方即表示重试已耗尽。上层逻辑（断路器、任务队列）可用 `IsRetryable()` 决定是否再次发起请求。
:::

## 可重试判定的实现细节

`IsRetryable()` 在类型分类之下还有一层原因级判定，这是各类型可重试行为差异的来源。

### 网络错误：syscall 与消息模式

`ErrorTypeNetwork` 逐层检查错误原因，任一层命中即可重试：

| 检查层 | 可重试条件 |
|--------|------------|
| `net.OpError.Timeout()` | 超时 → 重试 |
| `syscall.Errno`（POSIX） | `ECONNREFUSED` / `ECONNRESET` / `EPIPE` / `ETIMEDOUT` / `ENETUNREACH` / `EHOSTUNREACH` |
| Windows WSA 错误码 | 10054（连接被重置）/ 10060（连接超时）/ 10061（连接被拒绝）/ 10051（网络不可达）/ 10065（主机不可达） |
| 错误消息模式 | `connection reset` / `eof` / `connection closed` / `broken pipe` / `network error` / `transport failed` |
| 其他 `net.Error` | 默认重试（服务端主动断开、EOF 等瞬时故障） |

:::tip 为什么 Windows 需要单独的 WSA 映射表
Go 1.25 起，Windows 上的 POSIX 风格 `syscall.E*` 常量带 `1<<29` 偏移（如 `ECONNREFUSED = 536870934`），而网络栈返回的是原始 WSA 码（如 `WSAECONNREFUSED = 10061`），两种编码永不相等。

HTTPC 内置 WSA 码映射表，使 Windows 与 Unix 的重试判定保持一致。
:::

### DNS：仅临时/超时可重试

`ErrorTypeDNS` 仅在 `net.DNSError` 标记 `IsTemporary` 或 `IsTimeout` 时可重试。域名不存在（NXDOMAIN）等永久性失败不占用重试次数。

### 响应体读取：只重试读操作

`ErrorTypeResponseRead` 仅对读取类网络错误重试：`net.OpError` 的操作名为 `read` / `readfrom`，或错误消息含 eof / connection / timeout。文件错误与写错误不在此列。

### HTTP 状态码

`ErrorTypeHTTP` 直接查可重试状态码表：408/429/500/502/503/504（含 `ProxyRotateOnStatus` 注入的扩展码）。`StatusCode` 缺失（= 0）时退化为按错误消息中的 `HTTP 4xx` / `HTTP 5xx` 前缀判断。

## 哨兵错误完整参考

HTTPC 定义以下哨兵错误变量，可通过 `errors.Is` 精确匹配：

| 哨兵变量 | 触发条件 | 推荐处理 |
|----------|----------|----------|
| `ErrClientClosed` | 在 `client.Close()` 之后继续使用该客户端 | 初始化新 Client 或修复生命周期管理 |
| `ErrNilConfig` | 传给 `New()` 的 Config 指针为 nil | 使用 `DefaultConfig()` 获取默认值 |
| `ErrInvalidHeader` | HTTP 头校验失败（含控制字符或格式非法） | 修正 Header 值后重试 |
| `ErrInvalidTimeout` | 超时值非法：负值、0 或超过 30 分钟上限 | 调整到合法区间；解除超时用 `WithNoTimeout()` |
| `ErrInvalidRetry` | 重试配置非法（MaxRetries 不在 0-10，BackoffFactor 不在 1.0-10.0） | 修正重试参数 |
| `ErrInvalidConnection` | 连接配置非法（连接池大小超出范围、代理 URL 格式错误） | 修正连接参数 |
| `ErrInvalidSecurity` | 安全配置非法（响应体大小限制超出范围） | 修正安全参数 |
| `ErrInvalidMiddleware` | 中间件配置非法（重定向次数超 50、UserAgent 过长或含控制字符） | 修正中间件参数 |
| `ErrEmptyFilePath` | 下载时未指定文件路径 | 设置 `DownloadConfig.FilePath` |
| `ErrFileExists` | 目标文件已存在且 `Overwrite=false`、`ResumeDownload=false` | 设置覆盖或续传，或换路径 |
| `ErrResponseBodyEmpty` | 响应体为空时调用 `Unmarshal()` 等解析方法 | 先检查 `RawBody` 再解析 |
| `ErrResponseBodyTooLarge` | 响应体超过 `MaxResponseBodySize` 限制 | 增大限制或分页获取 |

:::tip 配置类错误 vs 运行时错误
`ErrInvalid*` 系列（`ErrInvalidHeader`/`ErrInvalidTimeout`/`ErrInvalidRetry`/`ErrInvalidConnection`/`ErrInvalidSecurity`/`ErrInvalidMiddleware`）是配置验证错误，在 `New()` 调用时返回，不出现在请求热路径中。

运行时错误通过 `ClientError` 分类处理。
:::

```go
package main

import (
	"errors"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")

	switch {
	case errors.Is(err, httpc.ErrClientClosed):
		fmt.Println("客户端已关闭，需重新创建")
	case errors.Is(err, httpc.ErrResponseBodyTooLarge):
		fmt.Println("响应体过大，考虑增大 MaxResponseBodySize")
	case errors.Is(err, httpc.ErrResponseBodyEmpty):
		fmt.Println("响应体为空，调用解析方法前先检查 RawBody")
	case errors.Is(err, httpc.ErrInvalidHeader):
		fmt.Println("请求头无效，修正后重试")
	}

	if result != nil {
		fmt.Printf("状态码：%d\n", result.StatusCode())
	}
}
```

## URL 自动脱敏

`ClientError.Error()` 会移除 URL 中的敏感信息：含用户名密码的 URL（如 `https://user:pass@host/path`）被脱敏为 `https://***:***@host/path`，日志与错误消息中不出现凭证。

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// URL 中包含凭证信息
	result, err := client.Get("https://admin:s3cret@api.example.com/data")
	if err != nil {
		// 错误消息中的凭证被自动脱敏：
		// "GET https://***:***@api.example.com/data: network error occurred"
		fmt.Println(err)
	}
	if result != nil {
		fmt.Println(result.StatusCode())
	}
}
```

:::tip 脱敏的覆盖范围
脱敏除移除 `user:pass@host` 格式的凭证外，也处理敏感查询参数（如 `token`、`key`、`secret`）。不含凭证或敏感参数的 URL 走快速路径跳过解析，避免 `url.Parse` 开销。
:::

## panic 恢复安全网

`Request()` 与 `Download()` 内置 panic 安全网：来自引擎、传输层、TLS 库或中间件的意外 panic 会被捕获并转换为 `ClientError`，调用方进程不会崩溃：

<!-- check-code: skip -->
```go
// client.go 内部实现（概念示意）
func (c *clientImpl) Request(ctx context.Context, method, url string, ...) (*Result, error) {
    defer func() {
        if r := recover(); r != nil {
            result = nil
            err = panicToError(r) // 转换为 ClientError
        }
    }()
    // ... 正常请求逻辑
}
```

:::warning 安全网不替代中间件恢复
内置安全网是最后的防线，将 panic 转换为错误而非崩溃。中间件自身会触发 panic 时，应额外使用 `RecoveryMiddleware()`，它在中间件链中更早捕获 panic，并保留更完整的日志上下文：

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),       // 中间件层 panic 恢复
    httpc.LoggingMiddleware(nil),     // 日志
    httpc.MetricsMiddleware(nil),     // 指标
}
```
:::

## 自动重试与错误的关系

HTTPC 的重试引擎自动处理可重试错误；应用层可据此避免重复重试。完整的重试条件与退避策略见[重试与容错](./retry-fault-tolerance)。

### 自动重试的错误

| 条件 | 是否重试 | 说明 |
|------|----------|------|
| 网络错误（连接拒绝、重置、EOF） | 是 | `isRetryableNetworkMessage` 匹配 |
| 拨号/请求超时 | 是 | `ErrorTypeTimeout` |
| 临时/超时类 DNS 失败 | 是 | `dnsErr.IsTemporary \|\| dnsErr.IsTimeout` |
| 响应体读取网络错误 | 是 | 读取操作的 `net.OpError` |
| 可重试 HTTP 状态码 | 是 | 408/429/500/502/503/504 |
| `ProxyRotateOnStatus` 指定的状态码 | 是 | 如 403 触发代理轮换 |

### 不重试的错误

| 条件 | 是否重试 | 说明 |
|------|----------|------|
| `context.Canceled` | 否 | 快速路径直接返回 |
| `context.DeadlineExceeded` | 否 | 快速路径直接返回 |
| TLS 握手失败 | 否 | `ErrorTypeTLS` 不可重试 |
| 证书验证失败 | 否 | `ErrorTypeCertificate` 不可重试 |
| 配置验证错误 | 否 | `ErrorTypeValidation` 不可重试 |
| 其他 4xx 客户端错误 | 否 | 如 400/401/403/404 |

:::tip context 取消是快速路径
`isRetryableError` 先检查 `context.Canceled` 与 `context.DeadlineExceeded`，命中即返回 false，跳过完整的错误分类。
:::

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := client.Request(ctx, "GET", "https://api.example.com/slow")
	if err != nil {
		var clientErr *httpc.ClientError
		if errors.As(err, &clientErr) {
			if clientErr.Type == httpc.ErrorTypeContextCanceled {
				// context 超时或手动取消，不会被自动重试
				fmt.Println("请求被取消（超时或手动取消），不会重试")
			} else if clientErr.Type == httpc.ErrorTypeTimeout {
				fmt.Println("请求超时，已自动重试仍失败")
			}
		}
		return
	}
	fmt.Println(result.StatusCode())
}
```

## 错误处理最佳实践

### 1. 区分客户端错误和服务端错误

`err != nil` 表示未取得响应（网络层失败）；`Result` 上的 4xx/5xx 表示已取得响应但状态码非 2xx。

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		// 网络层错误——连接、TLS、DNS 等问题
		log.Printf("网络层错误: %v", err)
		return
	}

	// HTTP 层错误——收到了响应但状态码非 2xx
	if result.IsClientError() {
		// 4xx：客户端请求有误（参数错误、权限不足等）
		log.Printf("客户端错误：%d", result.StatusCode())
	} else if result.IsServerError() {
		// 5xx：服务端故障（重试已耗尽，上游仍不可用）
		log.Printf("服务端错误：%d", result.StatusCode())
	} else {
		fmt.Printf("成功：%d\n", result.StatusCode())
	}
}
```

### 2. 断路器模式

服务持续失败时，断路器暂停请求，避免级联故障与资源浪费：

<!-- check-code: skip -->
```go
type CircuitBreaker struct {
    mu           sync.Mutex
    failures     int
    threshold    int           // 连续失败阈值
    cooldown     time.Duration // 熔断冷却时间
    trippedAt    time.Time
}

func (cb *CircuitBreaker) Allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.trippedAt) < cb.cooldown {
            return false // 熔断中，拒绝请求
        }
        cb.failures = 0 // 冷却期过，重置
    }
    return true
}

func (cb *CircuitBreaker) Record(err error) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if err != nil {
        cb.failures++
        if cb.failures >= cb.threshold {
            cb.trippedAt = time.Now()
        }
    } else {
        cb.failures = 0 // 成功则重置
    }
}

// 使用时结合 IsRetryable 判断
func requestWithBreaker(client httpc.Client, cb *CircuitBreaker, url string) error {
    if !cb.Allow() {
        return fmt.Errorf("circuit breaker open")
    }
    result, err := client.Get(url)
    cb.Record(err)
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) && !clientErr.IsRetryable() {
            cb.Record(nil) // 不可重试错误不算服务故障
        }
        return err
    }
    _ = result
    return nil
}
```

### 3. 降级 fallback

主服务不可用时回退到缓存或默认值：

<!-- check-code: skip -->
```go
package main

import (
    "errors"
    "log"

    "github.com/cybergodev/httpc"
)

func fetchWithFallback(client httpc.Client, url string, fallback []byte) []byte {
    result, err := client.Get(url)
    if err != nil {
        var clientErr *httpc.ClientError
        if errors.As(err, &clientErr) {
            switch clientErr.Type {
            case httpc.ErrorTypeTimeout, httpc.ErrorTypeRetryExhausted:
                log.Printf("主服务不可用，使用降级数据: %v", err)
                return fallback
            case httpc.ErrorTypeValidation:
                // 验证错误是本地 bug，不应降级
                log.Fatalf("请求配置错误: %v", err)
            }
        }
        log.Printf("未知错误，使用降级数据: %v", err)
        return fallback
    }
    return result.RawBody()
}
```

### 4. 使用中间件统一处理

```go
package main

import (
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		httpc.LoggingMiddleware(&httpc.LoggingConfig{
			LogFunc: func(format string, args ...any) {
				log.Printf("[HTTP] "+format, args...)
			},
		}),
		httpc.MetricsMiddleware(&httpc.MetricsConfig{
			OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
				if err != nil {
					log.Printf("[METRICS] %s %s 失败: %v (耗时 %v)", method, url, err, duration)
				} else {
					log.Printf("[METRICS] %s %s -> %d (耗时 %v)", method, url, statusCode, duration)
				}
			},
		}),
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("状态码：%d", result.StatusCode())
}
```

### 5. 超时分层

HTTPC 提供多个层级的超时控制，从粗到细：

<!-- check-code: skip -->
```go
// 第一层：客户端默认超时（所有请求的全局上限）
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 30 * time.Second

// 第二层：中间件强制超时（在客户端内置超时之前生效）
timeoutMW := httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{
    Duration: 30 * time.Second,
})

// 第三层：单请求覆盖（WithTimeout 只覆盖客户端默认超时；
// 中间件超时从请求自身的 Context() 派生，更短的中间件超时无法被 WithTimeout 延长）
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// 第四层：context 超时（最精确，推荐用于关键路径）
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url)
```

:::warning ResponseHeader 超时与 WithTimeout 的交互
`Timeouts.ResponseHeader = 0`（默认）时传输层不强制响应头超时，`WithTimeout` 拥有完全控制权。设为正值（如 `SecureConfig()` 的 10s）后，它在传输层对所有请求强制执行，`WithTimeout` 无法延长。设计原因见[配置 API](../api-reference/client-config/config)。
:::

## 下一步

- [重试与容错](./retry-fault-tolerance) — 退避算法详解与自定义重试策略
- [错误类型 API](../api-reference/types/errors) — 错误类型和哨兵变量完整参考
- [中间件链](./middleware-chain) — 使用中间件统一处理错误
- [配置 API](../api-reference/client-config/config) — 超时与安全配置参考
