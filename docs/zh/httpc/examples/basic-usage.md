---
sidebar_label: "基础示例"
title: "基础用法 - CyberGo HTTPC | 可运行示例"
description: "HTTPC 基础用法示例集：GET/POST/PUT/DELETE/HEAD/PATCH 全方法、XML 与二进制请求体、查询参数与认证、响应状态判定与 Result 三元组、DefaultConfig 配置、代理、中间件与进度回调文件下载可运行示例。"
sidebar_position: 10
---

# 基础用法

本页给出 HTTPC 基础用法的可运行示例：各 HTTP 方法、请求体类型、查询参数、认证、响应状态判定与配置预设。

## GET 请求

### 基本 GET

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
	fmt.Println(result.Body())
}
```

### 带查询参数

```go
result, err := httpc.Get("https://httpbin.org/get",
    httpc.WithQuery("name", "test"),
    httpc.WithQuery("page", 1),
    httpc.WithQueryMap(map[string]any{
        "limit": 10,
        "sort":  "desc",
    }),
)
```

### 带认证

```go
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBearerToken("my-token"),
)
```

Bearer 令牌之外，HTTPC 提供三种认证与请求头写法。

```go
// Basic 认证
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithBasicAuth("username", "password"),
)

// API Key（自定义请求头形式）
result, err := httpc.Get("https://api.example.com/me",
    httpc.WithHeader("X-API-Key", "your-api-key"),
)

// 批量设置请求头 + 自定义 User-Agent
result, err = httpc.Get("https://api.example.com/me",
    httpc.WithHeaderMap(map[string]string{
        "X-API-Version": "v1",
        "X-Client-ID":   "client-123",
    }),
    httpc.WithUserAgent("MyApp/1.0"),
)
```

## POST 请求

### JSON 请求体

```go
data := map[string]any{
    "name":  "John",
    "email": "john@example.com",
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithJSON(data),
)
if err != nil {
    log.Fatal(err)
}

// 解析 JSON 响应
var response map[string]any
if err := result.Unmarshal(&response); err != nil {
    log.Fatal(err)
}
fmt.Println(response)
```

### 表单提交

```go
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### 文件上传

```go
fileContent, _ := os.ReadFile("document.pdf")

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### 多字段表单

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

### XML 请求体

```go
type Person struct {
    XMLName xml.Name `xml:"person"`
    Name    string   `xml:"name"`
    Age     int      `xml:"age"`
}

result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithXML(Person{Name: "Jane", Age: 28}),
)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.StatusCode()) // 200
```

### 纯文本与二进制

字符串请求体以 `text/plain` 发送；二进制数据需显式给出 MIME 类型：

```go
// 纯文本：Content-Type 自动为 text/plain
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithBody("Hello, this is plain text!"),
)

// 二进制：Content-Type 为可选参数
pngHeader := []byte{0x89, 0x50, 0x4E, 0x47}
result, err = httpc.Post("https://httpbin.org/post",
    httpc.WithBinary(pngHeader, "image/png"),
)
```

### 强制指定请求体类型（BodyKind）

`WithBody` 按输入类型推断编码；第二个参数强制指定编码类型：

```go
// map 会被强制按 JSON 编码（而不是走通用格式化分支）
result, err := httpc.Post("https://httpbin.org/post",
    httpc.WithBody(map[string]string{"key": "value"}, httpc.BodyJSON),
)
```

## 其他 HTTP 方法

PUT、DELETE、HEAD、PATCH、OPTIONS 与通用 `Request` 均可调用。以下示例按方法逐一演示：

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

	// PUT：整体替换资源
	put, err := client.Put("https://httpbin.org/put",
		httpc.WithJSON(map[string]string{"name": "Jane", "status": "active"}),
		httpc.WithBearerToken("your-token"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("PUT:", put.StatusCode()) // 输出：PUT: 200

	// DELETE：删除资源
	del, err := client.Delete("https://httpbin.org/delete",
		httpc.WithHeader("X-Request-ID", "delete-123"),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("DELETE:", del.StatusCode()) // 输出：DELETE: 200

	// HEAD：只取响应头（无响应体），适合探测资源存在性与大小
	head, err := client.Head("https://httpbin.org/get")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("HEAD:", head.StatusCode())                                 // 输出：HEAD: 200
	fmt.Println("Content-Type:", head.Response.Headers.Get("Content-Type")) // 输出：Content-Type: application/json

	// PATCH：部分更新（只提交变化的字段）
	patch, err := client.Patch("https://httpbin.org/patch",
		httpc.WithJSON(map[string]string{"status": "inactive"}),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("PATCH:", patch.StatusCode()) // 输出：PATCH: 200

	// OPTIONS：探测服务端允许的方法（CORS 预检同款）
	opt, err := client.Options("https://httpbin.org/post")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("OPTIONS:", opt.StatusCode()) // 输出：OPTIONS: 200
}
```

方法速查：

| 方法 | 携带请求体 | 幂等 | 典型用途 |
|------|:---:|:---:|----------|
| GET | 否 | 是 | 获取资源 |
| HEAD | 否 | 是 | 只取响应头（探测存在性/大小/缓存元信息） |
| POST | 是 | 否 | 创建资源、提交数据 |
| PUT | 是 | 是 | 整体替换资源 |
| PATCH | 是 | 否 | 部分更新 |
| DELETE | 否 | 是 | 删除资源 |
| OPTIONS | 否 | 是 | 探测允许的方法 |

### 通用 Request 方法

HTTP 方法在运行时才确定时（来自配置、请求构建器或代理转发），调用 `Request(ctx, method, url, options...)`：

```go
ctx := context.Background()

for _, m := range []struct{ method, url string }{
    {"GET", "https://httpbin.org/get"},
    {"POST", "https://httpbin.org/post"},
    {"PUT", "https://httpbin.org/put"},
} {
    resp, err := client.Request(ctx, m.method, m.url,
        httpc.WithJSON(map[string]string{"key": "value"}),
    )
    if err != nil {
        log.Printf("%s error: %v", m.method, err)
        continue
    }
    fmt.Printf("%s %s -> %d\n", m.method, m.url, resp.StatusCode())
}
```

## 响应处理

每个请求返回的 `*Result` 是请求/响应/元数据三元组。三个嵌套结构一次分配、共用一块内存：

| 分组 | 主要字段 | 说明 |
|------|----------|------|
| `result.Request` | `URL` / `Method` / `Headers` / `Cookies` | 实际发出的请求信息 |
| `result.Response` | `StatusCode` / `Status` / `Proto` / `Headers` / `Body` / `RawBody` / `ContentLength` / `Cookies` | 响应数据 |
| `result.Meta` | `Duration` / `Attempts` / `RedirectCount` / `RedirectChain` / `ProxyURL` | 执行元数据（重试次数、重定向链等） |

### 状态判定

```go
result, err := client.Get("https://httpbin.org/get")
if err != nil {
    log.Fatal(err) // 网络层错误（DNS、超时、连接失败等）
}

switch {
case result.IsSuccess():     // 2xx
    fmt.Println("成功")
case result.IsRedirect():    // 3xx（未跟随重定向时）
    fmt.Println("重定向到：", result.Response.Headers.Get("Location"))
case result.IsClientError(): // 4xx
    fmt.Println("客户端错误，检查请求参数/认证")
    if result.StatusCode() == http.StatusTooManyRequests {
        fmt.Println("被限流，稍后重试：", result.Response.Headers.Get("Retry-After"))
    }
case result.IsServerError(): // 5xx
    fmt.Println("服务端错误，重试可能有帮助")
}
```

:::tip err 与状态码是两层错误
网络层失败（DNS、超时、TLS）表现为 `err != nil`。HTTP 4xx/5xx **不算** `err`：响应正常返回，由调用方用 `IsSuccess()` 等方法判定。
:::

### Body / RawBody / String 的选择

| 方法 | 返回 | 适用 |
|------|------|------|
| `result.Body()` | `string`（预存） | 直接读文本；无额外开销 |
| `result.RawBody()` | `[]byte`（原始） | 传给需要字节切片的 API（哈希、二次解码） |
| `result.String()` | 格式化摘要 | 调试打印（含状态、头、体摘要）；开销最大，不放热路径 |

```go
result, _ := client.Get("https://httpbin.org/get")

fmt.Println(len(result.Body()))     // 输出示例：268（正文长度）
fmt.Println(len(result.RawBody()))  // 输出示例：268（同一数据的字节视图）
fmt.Println(result.Meta.Attempts)   // 输出：1（重试后会增加）
fmt.Println(result.Meta.RedirectCount) // 输出：0（跟随过重定向则大于 0）
```

## 客户端创建

### 自定义配置

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
cfg.Retry.Delay = 2 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true

client, err := httpc.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer client.Close()
```

### 代理配置

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"

client, _ := httpc.New(cfg)
```

## 中间件

### 日志 + 恢复

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RecoveryMiddleware(),
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
}
cfg.Defaults.UserAgent = "my-app/1.0"

client, _ := httpc.New(cfg)
```

### 请求 ID + 指标

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.MetricsMiddleware(&httpc.MetricsConfig{OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }}),
}

client, _ := httpc.New(cfg)
```

## 文件下载

```go
client, _ := httpc.NewDefault()
defer client.Close()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r下载中：%.1f%% (%.2f MB/s)", pct, float64(speed)/1024/1024)
}

result, err := client.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n下载完成: %d bytes, 耗时 %v, 平均速度 %.2f MB/s\n",
    result.BytesWritten,
    result.Duration,
    float64(result.AverageSpeed)/1024/1024,
)
```

## 域名客户端

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 设置会话信息
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 请求自动携带会话头和 Cookie
users, _ := dc.Get("/users")
user, _ := dc.Get("/users/1")

fmt.Println(users.StatusCode()) // 200
```

## 下一步

- [高级示例](./advanced-usage) - 自定义重试、中间件链、并发下载
- [请求与响应](../guides/request-response) - 请求选项详解
- [域名客户端与会话](../guides/domain-session) - 会话管理
