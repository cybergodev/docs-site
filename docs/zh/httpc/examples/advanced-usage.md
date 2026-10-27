---
sidebar_label: "高级示例"
title: "高级示例 - CyberGo HTTPC | 生产级代码"
description: "HTTPC 高级示例集：自定义 RetryPolicy 重试策略、超时与重试组合、请求响应回调、完整中间件链、RESTful 客户端封装、域名客户端配置、Cookie 与 SessionManager 会话、worker pool 并发与 HMAC 签名中间件。"
sidebar_position: 20
---

# 高级示例

本页给出 HTTPC 进阶场景的可运行示例：自定义重试策略、超时与重试组合、请求/响应回调、完整中间件链、REST 客户端封装与并发控制。

## 自定义重试策略

仅对 502/503/504 重试，使用固定延迟：

:::tip 类型已公开导出
RetryPolicy.ShouldRetry 的 `resp` 参数类型 `ResponseReader` 已由 `httpc` 包通过公开类型别名导出（`httpc.ResponseReader`），外部包可直接引用。自定义 `RetryPolicy` 可在任何业务包中实现，以下示例可直接编译使用。无需自定义 `RetryPolicy` 时，改用 `RetryConfig` 字段配置。
:::

```go
// ResponseReader 已由 httpc 包公开导出（httpc.ResponseReader）。
// 本示例可在任何导入 github.com/cybergodev/httpc 的业务包中直接编译。

type selectiveRetry struct {
    maxAttempts int
    baseDelay   time.Duration
}

// 判断是否应该重试
func (p *selectiveRetry) ShouldRetry(resp httpc.ResponseReader, err error, attempt int) bool {
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

无需自定义策略时的替代方案 — 使用 `RetryConfig` 配置：

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

	fmt.Println(result.StatusCode())
}
```

## 超时与重试组合

三层时间控制的分工：context 截止时间与 `WithTimeout` 都是覆盖全部重试与退避等待的总预算（同时设置时取更早到达的截止时间），`WithMaxRetries` 单独限定尝试次数。

```go
package main

import (
	"context"
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

	// ctx 30s：含全部重试与退避等待的总预算
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Post("https://httpbin.org/post",
		httpc.WithJSON(map[string]string{"data": "important"}),
		httpc.WithContext(ctx),            // ctx 截止 30s（同为总预算）
		httpc.WithTimeout(10*time.Second), // 覆盖客户端默认，总预算收紧为 10s
		httpc.WithMaxRetries(3),           // 最多重试 3 次
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.StatusCode())           // 输出：200
	fmt.Println("尝试次数：", result.Meta.Attempts) // 输出：尝试次数：1（失败重试后增加）
	fmt.Println("总耗时：", result.Meta.Duration)
}
```

需要禁用重试（如非幂等的创建操作）时，以 `WithMaxRetries(0)` 显式声明：

```go
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]string{"action": "create"}),
    httpc.WithMaxRetries(0), // 不重试：避免重复创建
)
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
		&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
			atomic.AddInt64(&requestCount, 1)
			log.Printf("[METRICS] %s %s -> %d (%v)", method, url, statusCode, duration)
		}},
	)

	// 审计日志（回调内 json.Marshal 输出 JSON 行；Format 字段无效果）
	auditCfg := httpc.DefaultAuditConfig()
	auditCfg.IncludeHeaders = true
	auditCfg.MaskHeaders = []string{"Authorization", "Cookie"}
	auditCfg.SanitizeError = true
	auditCfg.OnAudit = func(event httpc.AuditEvent) {
		data, _ := json.Marshal(event)
		log.Printf("[AUDIT] %s", data)
	}
	auditMiddleware := httpc.AuditMiddleware(auditCfg)

	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.RecoveryMiddleware(), // panic 恢复
		httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}), // 强制超时
		httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),                           // 请求 ID
		httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: func(format string, args ...any) {
			log.Printf("[HTTP] "+format, args...)
		}}),
		metricsMiddleware,
		auditMiddleware,
	}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	_, err = client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("总请求数：%d", atomic.LoadInt64(&requestCount))
}
```

## 请求/响应回调

不需要完整中间件时，`WithOnRequest` / `WithOnResponse` 两个请求级回调可覆盖轻量的观测与调试需求：发送前回调收到可修改的请求，完成后回调收到可读取的响应。

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

	onRequest := func(req httpc.RequestMutator) error {
		fmt.Printf("[请求] %s %s（携带 %d 个请求头）\n",
			req.Method(), req.URL(), len(req.Headers()))
		return nil // 返回非 nil error 会中止请求
	}

	onResponse := func(resp httpc.ResponseMutator) error {
		fmt.Printf("[响应] %d %s，耗时 %v，尝试 %d 次\n",
			resp.StatusCode(), resp.Status(), resp.Duration(), resp.Attempts())
		return nil
	}

	result, err := client.Get("https://httpbin.org/get",
		httpc.WithOnRequest(onRequest),
		httpc.WithOnResponse(onResponse),
		httpc.WithQuery("test", "callbacks"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("状态码：", result.StatusCode()) // 输出：状态码：200
}
```

与中间件的分工：回调是**单请求**的钩子（日志、调试、简单指标）；跨全部请求、可组合、可短路请求的管道化处理由[中间件链](../guides/middleware-chain)承担。

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
	dc, err := httpc.NewDomainDefault(baseURL)
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
	fmt.Printf("创建：%+v\n", user)

	// 获取用户
	user, err = api.GetUser(ctx, user.ID)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("获取：%+v\n", user)
}
```

## 域名客户端（自定义配置）

`NewDomainDefault(baseURL)` 之外，`NewDomain(baseURL, cfg)` 接受完整 `Config`，预设、超时、重试、代理均可定制。域名客户端自动管理会话头与 Cookie；单次请求也可临时覆盖会话头：

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 在默认配置基础上逐字段定制
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 15 * time.Second
	cfg.Retry.MaxRetries = 2
	cfg.Defaults.UserAgent = "domain-client-demo/1.0"

	dc, err := httpc.NewDomain("https://httpbin.org", cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer dc.Close()

	fmt.Println("Base URL:", dc.URL())  // 输出：Base URL: https://httpbin.org
	fmt.Println("Domain:", dc.Domain()) // 输出：Domain: httpbin.org

	// 会话头：随该域名下的每个请求自动携带
	if err := dc.SetHeaders(map[string]string{
		"X-API-Version": "v1",
		"X-Client-ID":   "client-123",
	}); err != nil {
		log.Fatal(err)
	}

	// 单次请求覆盖会话头，不影响持久会话
	resp, err := dc.Get("/get",
		httpc.WithHeader("X-API-Version", "v2"), // 仅本次请求生效
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("请求状态：", resp.StatusCode())     // 输出：请求状态：200
	fmt.Println("会话头数量：", len(dc.GetHeaders())) // 输出：会话头数量：2

	// 手动注入会话 Cookie；响应 Cookie 也会自动并入会话
	if err := dc.SetCookies([]*http.Cookie{
		{Name: "session", Value: "abc123"},
	}); err != nil {
		log.Fatal(err)
	}

	resp2, err := dc.Get("/cookies") // 会话 Cookie 自动随请求发送
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("第二次请求：", resp2.StatusCode()) // 输出：第二次请求：200

	// Session() 拿到底层 SessionManager（下一节演示其独立用法）
	// UpdateFromResult 手动回填演示：dc.Get 已自动捕获响应 Cookie，此处重复写入无副作用
	session := dc.Session()
	session.UpdateFromResult(resp2)
	fmt.Println("会话 Cookie 数量：", len(session.GetCookies()))
}
```

:::warning 相对路径与会话捕获
`path` 参数为相对路径（如 `/get`）时自动拼接 baseURL；完整 URL（带 scheme）直接使用。域名客户端的请求选项只执行一次，`WithHeader`/`WithCookies` 等会额外被静态捕获进会话；自定义 `RequestOptionFunc` 里的 `SetHeader`/`SetCookies` 不会被捕获。
:::

## Cookie 高级用法

### 四种发送 Cookie 的方式

```go
// 1. WithCookies（完整 http.Cookie 结构，可带属性；单个 Cookie 传单元素切片）
result, err := client.Get("https://httpbin.org/cookies",
    httpc.WithCookies([]http.Cookie{{
        Name:     "auth_token",
        Value:    "xyz789",
        Path:     "/api",
        Expires:  time.Now().Add(24 * time.Hour),
        Secure:   true,
        HttpOnly: true,
    }}),
)

// 2. Cookie 字符串（从浏览器 DevTools 直接复制）
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieString("cookie1=value1; cookie2=value2"),
)

// 3. Cookie map
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieMap(map[string]string{
        "theme": "dark",
        "lang":  "en",
    }),
)

// 4. 多种方式组合使用
result, err = client.Get("https://httpbin.org/cookies",
    httpc.WithCookieString("session=abc123"),
    httpc.WithCookies([]http.Cookie{{Name: "manual", Value: "cookie"}}),
)
```

### 读取响应 Cookie 与自动管理

```go
result, _ := client.Get("https://httpbin.org/response-headers?Set-Cookie=session=abc123")

fmt.Println(len(result.Response.Cookies))       // 输出示例：1（响应携带的 Cookie 数）
if c := result.GetCookie("session"); c != nil { // 按名精确查找
    fmt.Println(c.Value) // 输出：abc123
}
fmt.Println(result.HasCookie("nonexistent")) // 输出：false

// 跨请求自动管理：开启 Cookie Jar 后，响应 Cookie 自动存储并在后续请求中回带
cfg := httpc.DefaultConfig()
cfg.Connection.EnableCookies = true
jarClient, _ := httpc.New(cfg)
defer jarClient.Close()

_, _ = jarClient.Get("https://httpbin.org/cookies/set?session=xyz789") // Cookie 存入 Jar
resp, _ := jarClient.Get("https://httpbin.org/cookies")                 // 自动回带
fmt.Println(resp.StatusCode()) // 输出：200
```

会话级的 Cookie 与安全校验（`WithSecureCookie` + `StrictCookieSecurityConfig`）详见[域名客户端与会话](../guides/domain-session)。

## SessionManager 独立会话

会话（持久头 + Cookie）不绑定域名客户端，可独立创建并注入任意请求。适用于「同一服务多套身份」或「手动编排请求选项」的场景：

```go
package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/httpc"
)

func main() {
	session, err := httpc.NewSessionManagerDefault()
	if err != nil {
		log.Fatal(err)
	}

	// 持久头：应用到走这个会话的所有请求
	if err := session.SetHeader("Authorization", "Bearer my-token"); err != nil {
		log.Fatal(err)
	}
	if err := session.SetHeaders(map[string]string{
		"X-API-Version": "v2",
		"X-Client-ID":   "session-demo",
	}); err != nil {
		log.Fatal(err)
	}

	// 持久 Cookie
	if err := session.SetCookies([]*http.Cookie{
		{Name: "session_id", Value: "abc123"},
		{Name: "preferences", Value: "theme_dark"},
	}); err != nil {
		log.Fatal(err)
	}

	fmt.Println("会话头：", len(session.GetHeaders()))       // 输出：会话头：3
	fmt.Println("会话 Cookie:", len(session.GetCookies())) // 输出：会话 Cookie: 2

	if c := session.GetCookie("session_id"); c != nil {
		fmt.Printf("找到 Cookie: %s = %s\n", c.Name, c.Value) // 输出：找到 Cookie: session_id = abc123
	}

	// 选择性删除与整体清空
	session.DeleteHeader("X-API-Version")
	session.DeleteCookie("preferences")
	fmt.Println("删除后头/Cookie:", len(session.GetHeaders()), "/", len(session.GetCookies()))
	// 输出：删除后头/Cookie: 2 / 1

	session.ClearHeaders()
	session.ClearCookies()
	fmt.Println("清空后头/Cookie:", len(session.GetHeaders()), "/", len(session.GetCookies()))
	// 输出：清空后头/Cookie: 0 / 0
}
```

## 并发下载

```go
package main

import (
	"context"
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

	client, _ := httpc.NewDefault()
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
					float64(speed)/1024/1024)
			}

			result, err := client.Download(context.Background(), u, cfg)
			if err != nil {
				log.Printf("%s 下载失败: %v", name, err)
				return
			}

			atomic.AddInt64(&successCount, 1)
			atomic.AddInt64(&totalBytes, result.BytesWritten)
			fmt.Printf("\n%s 完成: %d\n", name, result.BytesWritten)
		}(filename, url)
	}

	wg.Wait()
	fmt.Printf("\n下载完成：%d/%d, 总计 %d\n",
		successCount, len(urls), totalBytes)
}
```

## 并发请求：worker pool 与信号量

批量请求 URL 时，worker pool 将并发度固定在 worker 数上；信号量模式允许任务动态伸缩，但限制同时在途的请求数。两者共用同一个 `Client`（HTTPC 的 Client 并发安全，连接池跨 goroutine 复用）：

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 本地模拟服务器：每个请求耗时 20ms
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(20 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // 允许 127.0.0.1 本地服务器
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	const (
		numWorkers = 5
		numJobs    = 20
	)

	jobs := make(chan string, numJobs)
	results := make(chan int, numJobs)

	// 固定数量 worker 消费任务：并发度恒为 numWorkers
	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for url := range jobs {
				resp, err := client.Get(url)
				if err != nil {
					log.Printf("请求失败: %v", err)
					results <- 0
					continue
				}
				results <- resp.StatusCode()
			}
		}()
	}

	start := time.Now()
	for i := 0; i < numJobs; i++ {
		jobs <- fmt.Sprintf("%s/api/item/%d", server.URL, i)
	}
	close(jobs)
	wg.Wait()
	close(results)

	var okCount int64
	for status := range results {
		if status >= 200 && status < 300 {
			okCount++
		}
	}
	fmt.Printf("worker pool：%d/%d 成功，耗时 %v（串行约需 %v）\n",
		okCount, numJobs, time.Since(start), numJobs*20*time.Millisecond)
	// 输出示例：worker pool：20/20 成功，耗时约 90ms（串行约需 400ms）

	// 信号量模式：goroutine 数可以多，但在途请求最多 maxInFlight 个
	const maxInFlight = 3
	sem := make(chan struct{}, maxInFlight)
	var wg2 sync.WaitGroup
	var okCount2 int64
	start = time.Now()

	for i := 0; i < numJobs; i++ {
		wg2.Add(1)
		go func(id int) {
			defer wg2.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			resp, err := client.Get(fmt.Sprintf("%s/api/request/%d", server.URL, id))
			if err != nil {
				return
			}
			if resp.IsSuccess() {
				atomic.AddInt64(&okCount2, 1)
			}
		}(i)
	}
	wg2.Wait()
	fmt.Printf("信号量：%d/%d 成功，耗时 %v\n", okCount2, numJobs, time.Since(start))
	// 输出示例：信号量：20/20 成功，耗时约 140ms
}
```

:::tip 并发度与连接池的配合
在 HTTP/1.1 场景下，worker 数/信号量上限长期高于 `Connection.MaxConnsPerHost` 时，请求会在传输层排队，总吞吐不再提升。HTTP/2（默认开启）下同一主机共享连接多路复用，受此限制影响更小。详见[性能优化](../guides/performance)。
:::

## 结构化错误处理

`ClientError` 携带分类（`Code()`/`Type`）、重试性（`IsRetryable()`）与请求上下文（URL/Method/Attempts/StatusCode）。用 `errors.As` 提取后，可按分类走向不同处理分支：

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

	// 1 纳秒超时：稳定触发超时错误用于演示
	_, err = client.Get("https://httpbin.org/get",
		httpc.WithTimeout(1*time.Nanosecond),
	)
	if err == nil {
		log.Fatal("expected timeout error")
	}

	// errors.Is：哨兵错误判定（context 错误经 Unwrap 透传）
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		fmt.Println("请求超时，考虑放宽超时或检查网络")
	case errors.Is(err, context.Canceled):
		fmt.Println("请求被取消")
	}

	// errors.As：提取结构化错误
	var clientErr *httpc.ClientError
	if errors.As(err, &clientErr) {
		fmt.Println("Code:", clientErr.Code())             // 输出：Code: TIMEOUT
		fmt.Println("Method:", clientErr.Method)           // 输出：Method: GET
		fmt.Println("Attempts:", clientErr.Attempts)       // 输出：Attempts: 1
		fmt.Println("Retryable:", clientErr.IsRetryable()) // 输出：Retryable: false

		switch clientErr.Code() {
		case "TIMEOUT":
			fmt.Println("→ 分支：超时，可放宽预算后重试")
		case "NETWORK_ERROR", "DNS_ERROR":
			fmt.Println("→ 分支：网络/DNS 故障，检查连通性")
		case "TLS_ERROR", "CERTIFICATE_ERROR":
			fmt.Println("→ 分支：证书问题，校验 CA 与系统时间")
		case "RETRY_EXHAUSTED":
			fmt.Println("→ 分支：重试耗尽，进入降级逻辑")
		}
	}
}
```

错误消息含 `HTTP 4xx`/`HTTP 5xx` 而归入 `HTTP_ERROR` 的错误同样携带 `clientErr.StatusCode`（常规 4xx/5xx 响应不作为 error 返回，用 `result.IsSuccess()` 等方法检查）；`Cause` 字段保留底层错误供 `errors.Unwrap` 继续下钻。错误分类全表见[错误处理](../guides/error-handling)与[错误类型](../api-reference/types/errors)。

## 响应落盘：SaveToFile 与 Download

响应体已在内存时用 `SaveToFile` 直接落盘；大文件用 `Download` 流式写盘，支持进度、续传与校验：

```go
package main

import (
	"context"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 响应体已在内存：直接落盘（路径走与 Download 相同的安全校验）
	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}
	if err := result.SaveToFile("response.json"); err != nil {
		log.Fatal(err)
	}

	// 大文件：Download 流式写盘 + SHA-256 校验（不匹配自动删文件）
	cfg := httpc.DefaultDownloadConfig()
	cfg.FilePath = "large-file.bin"
	cfg.Overwrite = true
	cfg.Checksum = "从发布清单等可信渠道获取的 SHA-256 hex"

	if _, err := client.Download(
		context.Background(), // 无需取消/超时时传 Background，勿传 nil
		"https://example.com/large-file.bin",
		cfg,
	); err != nil {
		log.Fatal(err)
	}
	log.Println("落盘完成")
}
```

## 默认客户端管理

包级函数（`httpc.Get` 等）背后是一个懒初始化的默认客户端。用 `SetDefaultClient` 换成自定义配置的实例（旧实例自动关闭），此后包级调用统一走新配置：

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/httpc"
)

func main() {
	// 从默认配置出发，只改需要的字段
	cfg := httpc.DefaultConfig()
	cfg.Timeouts.Request = 5 * time.Second
	cfg.Retry.MaxRetries = 0

	customClient, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	// 设为默认客户端：此后包级函数全部走新配置（旧默认客户端自动关闭）
	if err := httpc.SetDefaultClient(customClient); err != nil {
		log.Fatal(err)
	}

	result, err := httpc.Get("https://httpbin.org/get") // 使用 5s 超时、0 重试
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.StatusCode()) // 输出：200

	// 收尾：关闭默认客户端释放连接池
	if err := httpc.CloseDefaultClient(); err != nil {
		log.Fatal(err)
	}
}
```

适用场景：应用启动时统一定制全局行为、按环境（开发/生产）切换配置。

`SetDefaultClient` 只接受 `httpc.New` 创建的客户端，且不能传入已关闭的实例。替换会关闭旧默认客户端并中断其仍在途的请求（并发调用方会观察到连接错误），因此只在启动期或静默期调用，不在活跃流量下替换。默认客户端的惰性创建与关闭后重建见[核心概念](../getting-started/concepts)。

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
	log.Println(result.StatusCode())
}
```

## 下一步

- [中间件链](../guides/middleware-chain) - 中间件架构详解
- [重试与容错](../guides/retry-fault-tolerance) - 自定义重试策略
- [域名客户端与会话](../guides/domain-session) - 会话与 Cookie 深入
- [文件上传与下载](../guides/file-transfer) - 下载语义与校验和
- [性能优化](../guides/performance) - 并发模型与性能调优
- [测试指南](../guides/testing) - httptest 与 Doer Mock
