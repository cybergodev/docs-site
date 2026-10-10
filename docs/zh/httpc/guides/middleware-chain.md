---
sidebar_label: "中间件链"
title: "中间件链 - CyberGo HTTPC | 洋葱模型与链组合"
description: "HTTPC 中间件链指南：洋葱模型与完整执行顺序语义、请求/响应双向处理、与请求选项及重试的关系、Recovery/Logging 等七个内置中间件、Chain 组合、自定义 MiddlewareFunc 与断路器短路示例，构建可观测请求管道。"
sidebar_position: 80
---

# 中间件链

## 洋葱模型

HTTPC 中间件采用洋葱模型，请求从外到内，响应从内到外：

```text
请求 →  Recovery  →  Logging  →  RequestID  → Handler
                                                          ↓
响应 ←  Recovery  ←  Logging  ←  RequestID  ← Response
```

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),                                      // 最外层：panic 恢复
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}), // 第二层：日志记录
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),          // 最内层：请求 ID
}

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

两个核心类型（均为导出别名）：

```go
// Handler 处理一个 HTTP 请求并返回响应——链的终点是引擎
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)

// MiddlewareFunc 把一个 Handler 包装成新的 Handler
type MiddlewareFunc func(Handler) Handler
```

`RequestMutator` / `ResponseMutator` 提供请求与响应的全部读写方法，中间件两阶段都能用。

### 完整执行顺序

把镜头拉远，一次请求经过的完整管道是：

```text
client.Get(url, opts...)
   │
   ├─ 1. 应用请求选项（WithHeader/WithJSON/WithQuery/...）
   │
   ├─ 2. 中间件链 · 请求阶段（外 → 内）
   │       Recovery → Logging → RequestID → ……
   │
   ├─ 3. 终端处理器：把中间件修改后的请求字段交给引擎
   │
   ├─ 4. 引擎内部：安全验证 → 重试循环（指数退避）→ 传输层发送
   │
   └─ 5. 中间件链 · 响应阶段（内 → 外）
           …… ← RequestID ← Logging ← Recovery
```

关键结论：

- **请求选项先于中间件执行**：中间件读到的是「选项已生效」的请求，也可以覆盖选项设置的任何字段（头、查询参数、超时、重定向策略等）
- **选项不会执行第二次**：终端处理器把中间件修改后的请求字段复制进一个全新的引擎请求再发送，而不是重新跑一遍选项
- `Defaults.Headers` / `Defaults.UserAgent` 等客户端默认值在引擎构建最终请求时按「仅在未设置时填充」应用，中间件设置的同名头优先生效

### 中间件与重试的关系

中间件链包裹的是**整个重试周期**：一次逻辑请求无论重试多少次，中间件都只执行一次，看到的是最终那次尝试的响应——`Meta.Attempts` 才反映总尝试次数。

需要「每次尝试」粒度的钩子时用 [`WithOnRequest`/`WithOnResponse` 回调](./request-response#回调)：它们在引擎内部、每次尝试（含重试）都会触发。

### 错误传播与短路

- 任一中间件返回错误，链立即中断：更内层的中间件不再执行，错误原样传回调用方
- 中间件**不调用 `next()`** 直接返回响应（或错误）即为「短路」——外层中间件的响应阶段仍会执行（例如 Recovery 的 defer），内层与引擎完全不执行，这是缓存命中、熔断打开等场景的实现方式
- 同时返回 `(resp, err)` 时，客户端会兜底释放响应避免对象池泄漏；但把 `next()` 拿到的响应丢弃后返回 `(nil, err)` 会造成泄漏——不要吞掉响应（见下方自定义中间件的警告）
- panic 有两道防线：`RecoveryMiddleware` 恢复链内 panic；`Request` 方法本身还有一层默认 recover，把漏网 panic 转成错误而不是让进程崩溃

## 内置中间件

### RecoveryMiddleware

panic 恢复，防止进程崩溃：

```go
httpc.RecoveryMiddleware()
```

panic 值会被转成包含堆栈的错误返回。通常放在链的**最外层**，保护其后所有层。

### LoggingMiddleware

请求/响应日志，URL 自动脱敏：

```go
httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
}})
// 输出示例：[HTTP] GET https://api.example.com/data -> 200 (150ms)（状态码与耗时为实际测量值，非固定）
```

传 `nil` 配置或 `LogFunc` 为 nil 时日志关闭（中间件变为透传）。URL 中的凭据信息（`user:pass@host`）会在记录前清除。

### RequestIDMiddleware

为每个请求添加唯一 ID，使用 `crypto/rand` 生成：

```go
httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()) // 默认 32 字符 hex

// 自定义生成器
httpc.RequestIDMiddleware(&httpc.RequestIDConfig{
    HeaderName: "X-Request-ID",
    Generator:  func() string {
        return uuid.New().String()
    },
})
```

若请求已带同名头（如上游网关注入），中间件**不会覆盖**已有值，便于全链路追踪透传。

### TimeoutMiddleware

中间件层超时，在客户端超时之前强制执行：

```go
httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second})
```

超时基于请求自身的 context 派生（保留已设置的截止时间/取消信号），到期后 context 被取消并返回超时错误。`Duration` 为 0 或负数时禁用（透传）。

:::warning 不要用于 Download 或流式请求
`TimeoutMiddleware` 的 `defer cancel()` 会在处理器返回（即收到响应头）后立即触发，对 `Download` 或 `WithStreamBody` 请求会在读取响应体之前提前取消上下文，表现为「context canceled」错误。流式/下载场景请改用 [`WithTimeout`](../api-reference/core/options#withtimeout) 选项。
:::

### HeaderMiddleware

为所有请求添加静态头：

```go
httpc.HeaderMiddleware(&httpc.HeaderConfig{Headers: map[string]string{
    "X-App-Version": "1.0.0",
    "X-Platform":    "server",
}})
```

头表在**中间件创建时**完成 CRLF 校验并做防御性拷贝——之后修改传入的 map 不影响中间件；校验失败则该中间件对每个请求都返回错误。已有同名头会被覆盖。

### MetricsMiddleware

收集请求指标：

```go
httpc.MetricsMiddleware(&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
    metrics.IncrCounter("http.requests", 1)
    metrics.RecordTimer("http.latency", duration)
    if err != nil {
        metrics.IncrCounter("http.errors", 1)
    }
}})
```

传给回调的 URL 与错误信息都经过脱敏（URL 凭据清除、错误信息中的原始 URL 替换为脱敏版），不会把敏感数据带进指标系统。请求失败时 `statusCode` 为 0。

### AuditMiddleware

安全审计，用于金融、医疗等合规场景：

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
}
httpc.AuditMiddleware(auditCfg)
```

`OnAudit` 为 nil 时中间件是 no-op（直接透传）。

### 配置审计选项

通过 `DefaultAuditConfig()` 获取默认配置后修改字段，可控制输出格式、头部记录与脱敏：

```go
auditCfg := httpc.DefaultAuditConfig()
auditCfg.Format = "json"
auditCfg.IncludeHeaders = true
auditCfg.MaskHeaders = []string{"Authorization", "Cookie"}
auditCfg.SanitizeError = true
auditCfg.OnAudit = func(event httpc.AuditEvent) {
    data, err := json.Marshal(event)
    if err != nil {
        log.Println("序列化审计事件失败：", err)
        return
    }
    log.Println(string(data))
}

httpc.AuditMiddleware(auditCfg)
```

`AuditEvent` 携带时间戳、方法、脱敏 URL、状态码、耗时、尝试次数、重定向链等字段；`SanitizeError = true` 时错误统一替换为 `[sanitized]`，避免错误细节泄露敏感信息。JSON 序列化时 `Duration` 会额外输出 `durationMs` 字段（毫秒数）。

审计事件支持从上下文提取 SourceIP 和 UserID：

```go
ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.1")
ctx = context.WithValue(ctx, httpc.UserIDKey, "user-123")
```

## 手动链式组合

使用 `Chain` 函数组合中间件：

```go
middleware := httpc.Chain(
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
)

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{middleware}
```

`Chain` 从最后一个中间件向前逐层包裹，因此**切片顺序 = 从外到内的执行顺序**：第一个元素最外层（最先看到请求、最后看到响应）。`Chain` 把多个中间件收敛成一个 `MiddlewareFunc`，适合作为库复用或按需装配不同组合。

## 自定义中间件

```go
func CORSMiddleware(origin string) httpc.MiddlewareFunc {
    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            // 请求阶段：修改请求
            req.SetHeader("Origin", origin)

            // 调用下一个处理器
            resp, err := next(ctx, req)

            // 响应阶段：记录或修改响应
            if resp != nil {
                log.Printf("响应状态：%d", resp.StatusCode())
            }

            return resp, err
        }
    }
}
```

完整可运行示例——一个记录耗时与状态的计时中间件：

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware 记录每个请求的方法、URL、状态码与耗时
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()

			// 请求阶段：可读取/修改请求
			req.SetHeader("X-Client-Trace", "demo")

			// 调用下一层（最终到达引擎）
			resp, err := next(ctx, req)

			// 响应阶段：可读取/修改响应
			status := 0
			if resp != nil {
				status = resp.StatusCode()
			}
			log.Printf("%s %s -> %d (%v)", req.Method(), req.URL(), status, time.Since(start))

			return resp, err
		}
	}
}

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(),
		timingMiddleware(),
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
	fmt.Println(result.StatusCode()) // 200
}
```

:::warning 不要吞掉 next() 的响应
调用 `next()` 拿到非 nil 响应后，要么原样返回，要么继续调用更内层后返回内层响应。丢弃响应并返回 `(nil, err)` 会导致引擎对象池泄漏；若同时返回 `(resp, err)`，客户端会兜底释放响应，但仍应优先原样传递。
:::

:::warning 中间件状态与并发
同一个中间件实例在客户端创建时装配一次，会被**所有并发请求共享**。闭包里保存的可变状态（计数器、熔断阈值等）必须像下面断路器示例一样用互斥锁保护；无状态中间件无需额外处理。
:::

### 短路中间件

```go
func CircuitBreakerMiddleware(threshold int) httpc.MiddlewareFunc {
    var failures int
    var mu sync.Mutex

    return func(next httpc.Handler) httpc.Handler {
        return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
            mu.Lock()
            if failures >= threshold {
                mu.Unlock()
                return nil, fmt.Errorf("circuit breaker open")
            }
            mu.Unlock()

            resp, err := next(ctx, req)
            if err != nil {
                mu.Lock()
                failures++
                mu.Unlock()
            }
            return resp, err
        }
    }
}
```

短路返回 `(nil, err)` 时**没有调用过 `next()`**，因此不持有需要释放的响应，不存在泄漏问题。也可以短路返回一个自造的响应（如缓存命中场景）——实现 `ResponseMutator` 接口返回即可，引擎响应会被正常替换。

## 中间件配置

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
}
cfg.Defaults.UserAgent = "my-app/1.0"
cfg.Defaults.Headers = map[string]string{"X-App": "my-app"}
cfg.Defaults.FollowRedirects = true
cfg.Defaults.MaxRedirects = 10

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

注意区分两类「默认值」：`Middleware.Middlewares` 是拦截管道；`Defaults.*` 是引擎构建请求时填充的静态默认值（仅在请求未设置时生效，优先级低于选项与中间件）。

## 下一步

- [内置中间件 API](../api-reference/client-config/middleware) - 完整中间件参考
- [重试与容错](./retry-fault-tolerance) - 重试策略指南
- [安全概述](../security/) - 审计中间件安全实践
