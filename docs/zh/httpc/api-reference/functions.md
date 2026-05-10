---
title: 包函数 - HTTPC
description: HTTPC 包级函数与客户端方法 API 参考，涵盖七种 HTTP 方法、New 创建函数、Download 系列与 ReleaseResult 对象池复用方法。
---

# 包函数

## 包级 HTTP 方法

无需创建客户端，直接发送请求。内部使用惰性初始化的默认客户端。

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

发送 GET 请求。

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

发送 POST 请求。

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

带上下文的通用请求方法，支持超时和取消控制。

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## 客户端方法

Client 接口提供与包级函数相同的 HTTP 方法，加上带上下文的 `Request` 方法。

### New

```go
func New(config ...*Config) (Client, error)
```

创建新的 HTTP 客户端。不传配置或传 `nil` 使用 `DefaultConfig()`。

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### 客户端 HTTP 方法

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

### Close

Client 接口方法，释放客户端持有的资源（连接池、Transport）。调用后不可再使用。

```go
// Client 接口方法
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## 默认客户端管理

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

设置自定义客户端为默认客户端，供包级函数使用。旧的默认客户端会被自动关闭。

:::warning 限制
仅接受通过 `httpc.New()` 创建的客户端，不能设置已关闭的客户端。
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// 后续包级函数使用 PerformanceConfig
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

关闭默认客户端并重置。下次调用包级函数时会创建新客户端。

## 结果管理

### ReleaseResult

```go
func ReleaseResult(r *Result)
```

将 Result 归还到对象池以减少 GC 压力。调用后不可再使用 Result。

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
```

:::warning
调用 `ReleaseResult` 后不要访问 Result，其内部数据会被清零。
:::

## 下载函数

包级下载函数使用默认客户端，Client 接口也提供同名方法。

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

使用默认客户端下载文件到指定路径。

```go
// 包级函数
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")

// Client 接口方法
result, err := client.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

带配置的文件下载，支持断点续传和进度回调。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// 包级函数
result, err := httpc.DownloadWithOptions(url, cfg)
// Client 接口方法
result, err = client.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

带上下文控制的文件下载，支持超时和取消。

```go
// 包级函数
result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
// Client 接口方法
result, err = client.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
```

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

带配置和上下文控制的文件下载。

```go
// 包级函数
result, err := httpc.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
// Client 接口方法
result, err = client.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
```

## 辅助函数

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

格式化字节数为人类可读字符串。

```go
httpc.FormatBytes(1536)      // "1.50 KB"
httpc.FormatBytes(1048576)   // "1.00 MB"
```

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

格式化传输速率为人类可读字符串。

```go
httpc.FormatSpeed(1536.0)    // "1.50 KB/s"
httpc.FormatSpeed(1048576.0) // "1.00 MB/s"
```

## 域名客户端

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

创建域名作用域客户端，自动管理 Cookie 和请求头。

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## 另见

- [Result](./result) - 响应结果类型和方法
- [请求选项](./options) - 请求配置选项
- [域名客户端](./domain-client) - 域名作用域客户端
- [文件下载](./download) - 下载函数和类型
