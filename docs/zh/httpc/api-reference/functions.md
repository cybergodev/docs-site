---
title: "包函数 - CyberGo HTTPC | 包级函数"
description: "HTTPC 包级函数与客户端方法 API 参考：Get/Post 等七种 HTTP 方法、New 客户端创建、Download 统一下载入口、FormatBytes/FormatSpeed 工具与 NewDomain 域名客户端创建。"
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

## 下载函数

包级下载函数使用默认客户端，Client 接口与 DomainClient 也提供同名方法，三者签名一致。

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download` 是贯穿包级函数、`Client` 接口和 `DomainClient` 的**唯一规范下载入口**——用单一签名取代了以往的 `{config}` × `{context}` 变体矩阵。

`cfg` 不能为 nil，且 `cfg.FilePath` 必须设置（否则返回 `ErrEmptyFilePath`）。无需取消或超时控制时传入 `context.Background()`，请求选项用于设置请求头、认证、查询参数等。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// 包级函数（使用默认客户端）
result, err := httpc.Download(context.Background(), url, cfg)

// Client 接口方法
result, err = client.Download(ctx, url, cfg)

// DomainClient 方法（path 相对于 baseURL，自动捕获响应 Cookie）
result, err = dc.Download(ctx, "/files/report.pdf", cfg)
```

:::tip 迁移说明
旧的 `DownloadFile`、`DownloadWithOptions`、`DownloadFileWithContext`、`DownloadWithOptionsWithContext` 已在 v1.5.2 移除。统一改用 `Download(ctx, url, cfg, options...)`，并通过 `DownloadConfig` 配置路径、覆盖、续传与校验。
:::

## 辅助函数

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

重定向安全警告输出（如 `TestingConfig`、`InsecureSkipVerify` 警告）。传入 `io.Discard` 可静默所有警告。

```go
// 静默所有安全警告
httpc.SetSecurityWarnOutput(io.Discard)

// 重定向到自定义日志
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
此函数主要用于测试。生产环境应使用 `SecureConfig()` 或 `DefaultConfig()`，而非抑制警告。
:::

## 格式化工具

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

将字节数格式化为人类可读的字符串（如 `"1.50 KB"`、`"500 B"`）。常用于下载结果展示与日志输出。

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("已下载 %s\n", httpc.FormatBytes(result.BytesWritten))
// 已下载 12.34 MB
```

| 输入 | 输出 |
|------|------|
| `500` | `500 B` |
| `1536` | `1.50 KB` |
| `1048576` | `1.00 MB` |
| `1073741824` | `1.00 GB` |

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

将字节/秒速率格式化为人类可读的字符串（如 `"1.50 MB/s"`）。常配合 `DownloadResult.AverageSpeed` 或 `DownloadProgressCallback` 的 `speed` 参数使用。

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("平均速度 %s\n", httpc.FormatSpeed(result.AverageSpeed))
// 平均速度 5.67 MB/s

// 进度回调中使用
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%s / %s (%s)",
        httpc.FormatBytes(downloaded),
        httpc.FormatBytes(total),
        httpc.FormatSpeed(speed),
    )
}
```

| 输入（字节/秒） | 输出 |
|----------------|------|
| `500` | `500 B/s` |
| `1536` | `1.50 KB/s` |
| `1048576` | `1.00 MB/s` |

:::tip
两者采用二进制单位（1024 进位），单位序列为 `B → KB → MB → GB → TB → PB → EB`。
:::

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
