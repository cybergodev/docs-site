---
sidebar_label: "测试指南"
title: "测试指南 - CyberGo HTTPC | httptest 与断言"
description: "HTTPC 测试指南：TestingConfig 测试专用配置、net/http/httptest 模拟服务器集成、Doer 接口 Mock 注入、模拟错误响应与延迟、确定性重试与文件下载测试、表格驱动测试，以及 Cookie 会话断言与测试隔离要点。"
sidebar_position: 120
---

# 测试指南

HTTPC 的测试分两层。集成测试用 `httptest` 模拟服务器走完整请求管道，单元测试用 `Doer` 接口替身直接构造 `Result`。两者都以 `TestingConfig()` 为配置起点。

## TestingConfig

`TestingConfig()` 面向测试环境：禁用安全检查，缩短连接与握手超时（`Request` 仍为默认 180s）。

```go
func TestAPI(t *testing.T) {
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("http://localhost:8080/test")
    // ...
}
```

:::danger
`TestingConfig` 禁用了 TLS 验证、SSRF 防护等安全特性，仅用于测试环境。在非测试环境使用时会向 stderr 打印一次安全警告。
:::

`TestingConfig` 的关键取值（在 `DefaultConfig` 基础上覆盖）：

- `InsecureSkipVerify=true`、`AllowPrivateIPs=true`、`ValidateURL=false`、`ValidateHeaders=false`：允许 127.0.0.1/内网 httptest 服务器；
- `EnableHTTP2=false`：协议行为更简单、易断言；
- `MaxRetries=1`、`EnableJitter=false`：重试节奏确定；
- 连接与握手超时缩到 5s，`Request` 仍为默认 180s。

:::tip 关于安全警告
告警通过检测 `.test` 可执行文件名与 `GO_TEST`/`GOTEST` 环境变量识别测试进程，`go test` 运行的测试不触发。在本地开发脚本等非测试进程中临时使用时，可用 `httpc.SetSecurityWarnOutput(io.Discard)` 静默输出，`io` 即标准库 `io` 包。
:::

## httptest.Server 集成

用标准库 `net/http/httptest` 创建模拟服务器，可在无真实后端的情况下做集成测试：

<!-- check-code: skip -->
```go
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/cybergodev/httpc"
)

func TestGetUser(t *testing.T) {
    // 创建模拟服务器
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/users/1" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-token" {
            t.Errorf("missing auth header")
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "id":   1,
            "name": "Test User",
        })
    }))
    defer server.Close()

    // 使用 TestingConfig 创建客户端
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // 发送请求到模拟服务器
    result, err := client.Get(server.URL+"/users/1",
        httpc.WithBearerToken("test-token"),
    )
    if err != nil {
        t.Fatal(err)
    }

    if !result.IsSuccess() {
        t.Fatalf("expected success, got %d", result.StatusCode())
    }

    var user struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }
    if err := result.Unmarshal(&user); err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("expected Test User, got %s", user.Name)
    }
}
```

## Mock 与 Transport 注入

自定义 Transport 注入（替换底层 `http.RoundTripper`）是 HTTPC 的内部机制。引擎的传输层接口与 mock 仅供库自身测试使用，根包 `httpc` 未导出注入入口。可用的两条路径如下：

| 方式 | 适用层次 | 特点 |
|------|----------|------|
| `httptest.Server` | 集成测试 | 走完整请求管道（安全校验、重试、中间件、连接池），最接近真实行为 |
| 实现 `httpc.Doer` 最小接口 | 单元测试 | 不起服务器、不发网络请求，直接返回构造的 `*Result`，无网络开销且完全确定 |

`Doer` 是只含 `Request` 一个方法的接口。`Result` 的 `Request`/`Response`/`Meta` 三个字段为调用方在测试中直接构造而导出：

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

// fakeDoer 实现 httpc.Doer：不起网络，直接返回预置结果
type fakeDoer struct {
	result *httpc.Result
	err    error
}

func (f *fakeDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
	return f.result, f.err
}

// getUser 演示被测的业务函数：依赖 httpc.Doer 而非具体 Client
func getUser(d httpc.Doer, id int) (string, error) {
	result, err := d.Request(context.Background(), "GET", fmt.Sprintf("https://api.example.com/users/%d", id))
	if err != nil {
		return "", err
	}
	if !result.IsSuccess() {
		return "", fmt.Errorf("API error: %d", result.StatusCode())
	}
	var name struct {
		Name string `json:"name"`
	}
	if err := result.Unmarshal(&name); err != nil {
		return "", err
	}
	return name.Name, nil
}

func main() {
	fake := &fakeDoer{
		result: &httpc.Result{
			Response: &httpc.ResponseInfo{
				StatusCode: 200,
				Status:     "200 OK",
				Body:       `{"name":"Test User"}`,
				RawBody:    []byte(`{"name":"Test User"}`),
				Headers:    map[string][]string{"Content-Type": {"application/json"}},
			},
			Meta: &httpc.RequestMeta{Attempts: 1},
		},
	}

	name, err := getUser(fake, 1)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(name) // 输出：Test User
}
```

:::tip 构造 Result 时同时填充 Body 与 RawBody
`Body()` 返回预存字符串，`RawBody()` 返回字节切片，`Unmarshal` 使用原始字节。mock 中两个字段都需填充，各访问器才能返回一致结果。
:::

## 模拟不同场景

### 模拟错误响应

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### 模拟延迟

```go
// TestingConfig 关闭 SSRF 防护——否则默认客户端会阻止 127.0.0.1 测试服务器，
// 得到的是 SSRF 错误而非超时错误。
client, _ := httpc.New(httpc.TestingConfig())
defer client.Close()

server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// 测试超时处理：1s 上下文超时 < 5s 服务端延迟
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := client.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### 模拟重定向

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/old":
        http.Redirect(w, r, "/new", http.StatusMovedPermanently)
    case "/new":
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("redirected"))
    }
}))
defer server.Close()
```

### 模拟文件上传

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // 解析 multipart 表单
    r.ParseMultipartForm(10 << 20)
    file, header, err := r.FormFile("upload")
    if err != nil {
        t.Fatal(err)
    }
    defer file.Close()

    if header.Filename != "test.txt" {
        t.Errorf("expected test.txt, got %s", header.Filename)
    }

    w.WriteHeader(http.StatusOK)
}))
defer server.Close()
```

### 模拟 TLS 服务器

`httptest.NewTLSServer` 使用自签名证书。`TestingConfig` 已设置 `InsecureSkipVerify=true`，可直接请求，无需额外 TLS 配置：

```go
server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("secure"))
}))
defer server.Close()

client, _ := httpc.New(httpc.TestingConfig())
defer client.Close()

result, err := client.Get(server.URL) // 直接请求自签名 TLS 服务器
```

### 确定性重试测试

让服务器前 N 次返回可重试状态码（408/429/500/502/503/504）、之后成功，即可在不依赖定时器与网络抖动的前提下验证重试行为。`result.Meta.Attempts` 给出实际尝试次数：

```go
func TestRetry(t *testing.T) {
    var calls int32

    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if atomic.AddInt32(&calls, 1) <= 2 {
            w.WriteHeader(http.StatusServiceUnavailable) // 前两次 503（可重试）
            return
        }
        w.WriteHeader(http.StatusOK) // 第三次成功
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get(server.URL, httpc.WithMaxRetries(2))
    if err != nil {
        t.Fatal(err)
    }

    if result.Meta.Attempts != 3 { // 1 次原始 + 2 次重试
        t.Errorf("expected 3 attempts, got %d", result.Meta.Attempts)
    }
}
```

:::tip 测试中显式固定重试参数
`TestingConfig` 默认 `MaxRetries=1` 且无抖动。测试中应以 `WithMaxRetries(N)` 显式给出期望值，断言才稳定。
:::

## 测试文件下载

`Download` 同样可用 httptest 覆盖：服务器端写入已知内容，`DownloadConfig.FilePath` 指向 `t.TempDir()`（测试结束自动清理），再断言字节数与校验和：

```go
func TestDownload(t *testing.T) {
    payload := []byte("file content for download test")

    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
        _, _ = w.Write(payload)
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    sum := sha256.Sum256(payload)

    cfg := httpc.DefaultDownloadConfig()
    cfg.FilePath = filepath.Join(t.TempDir(), "out.bin")
    cfg.Checksum = hex.EncodeToString(sum[:]) // 顺带验证校验和路径

    result, err := client.Download(context.Background(), server.URL, cfg)
    if err != nil {
        t.Fatal(err)
    }

    if result.BytesWritten != int64(len(payload)) {
        t.Errorf("expected %d bytes, got %d", len(payload), result.BytesWritten)
    }
    if result.ActualChecksum != cfg.Checksum {
        t.Errorf("checksum mismatch: %s != %s", result.ActualChecksum, cfg.Checksum)
    }
}
```

## Cookie 与会话断言

Cookie 行为可从两端断言。服务器端读取请求中实际收到的 Cookie，确认客户端确实发送；客户端用 `result.GetCookie`/`HasCookie` 验证响应 Cookie，或在 `DomainClient` 上验证会话自动捕获：

```go
func TestCookieSession(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/login":
            http.SetCookie(w, &http.Cookie{Name: "session", Value: "abc123", Path: "/"})
            w.WriteHeader(http.StatusOK)
        case "/me":
            // 服务器端断言：第二个请求应自动带上会话 Cookie
            if c, err := r.Cookie("session"); err != nil || c.Value != "abc123" {
                t.Errorf("expected session cookie abc123, got %v (err=%v)", c, err)
            }
            w.WriteHeader(http.StatusOK)
        }
    }))
    defer server.Close()

    dc, err := httpc.NewDomain(server.URL, httpc.TestingConfig()) // 绕过 SSRF 私网拦截
    if err != nil {
        t.Fatal(err)
    }
    defer dc.Close()

    if _, err := dc.Get("/login"); err != nil { // 响应 Cookie 自动进入会话
        t.Fatal(err)
    }
    if c := dc.GetCookie("session"); c == nil || c.Value != "abc123" {
        t.Errorf("session cookie not captured: %+v", c)
    }
    if _, err := dc.Get("/me"); err != nil { // 会话 Cookie 随请求发送
        t.Fatal(err)
    }
}
```

## 表格驱动测试

```go
func TestHTTPMethods(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(r.Method))
    }))
    defer server.Close()

    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    tests := []struct {
        name   string
        method func(url string, opts ...httpc.RequestOption) (*httpc.Result, error)
    }{
        {"GET", client.Get},
        {"POST", client.Post},
        {"PUT", client.Put},
        {"PATCH", client.Patch},
        {"DELETE", client.Delete},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := tt.method(server.URL + "/test")
            if err != nil {
                t.Fatal(err)
            }

            if result.Body() != tt.name {
                t.Errorf("expected %s, got %s", tt.name, result.Body())
            }
        })
    }
}
```

## 最佳实践

| 实践 | 说明 |
|------|------|
| 使用 `httptest.Server` | 模拟真实 HTTP 行为，无需网络依赖，覆盖完整请求管道 |
| 使用 `TestingConfig()` | 禁用安全检查，避免本地连接被 SSRF 防护阻止 |
| 业务层依赖 `Doer` 接口 | 最小接口依赖使单元测试可用替身，无需服务器 |
| 确定性重试 | 服务器前 N 次返回 503 再成功，用 `Meta.Attempts` 断言 |
| 下载测试用 `t.TempDir()` | 测试结束自动清理文件，路径亦通过安全校验 |
| 使用 `defer` | 确保资源释放，即使测试失败 |
| 表格驱动 | 用同一套逻辑覆盖多组输入 |
| 显式固定重试与超时参数 | 显式声明 `WithMaxRetries(N)` 等，断言才稳定 |

## 下一步

- [配置 API](../api-reference/client-config/config) - TestingConfig 详细参数
- [错误类型](../api-reference/types/errors) - 错误断言参考
- [中间件链](./middleware-chain) - 中间件测试模式
- [文件上传与下载](./file-transfer) - 下载语义详解（本页「测试文件下载」的展开）
- [高级示例](../examples/advanced-usage) - 生产级代码模式
- [从 net/http 迁移](./migration) - 标准库项目迁入时的行为差异与陷阱清单
