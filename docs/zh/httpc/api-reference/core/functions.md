---
sidebar_label: "函数与方法"
title: "包级函数与客户端方法 - CyberGo HTTPC | HTTP 方法 API"
description: "HTTPC 包级函数与客户端方法 API 参考：Get/Post 等七种 HTTP 方法、New 与 NewDefault 客户端创建、Download 统一下载入口、NewDomain 域名客户端、SetDefaultClient 默认客户端管理，以及 FormatBytes/FormatSpeed 格式化工具。"
sidebar_position: 10
---

# 包级函数与客户端方法

包级函数与客户端方法构成 HTTPC 的请求入口：前者使用共享的默认客户端，后者绑定显式实例。本页给出全部函数签名、返回值与边界行为。

## 包级 HTTP 方法

`Get`/`Post`/`Put`/`Patch`/`Delete`/`Head`/`Options` 无需创建客户端即可发送请求，内部使用惰性初始化的默认客户端；`Request` 接收调用方传入的上下文。

| 函数 | HTTP 方法 | 上下文 |
|------|-----------|--------|
| `Get` / `Post` / `Put` / `Patch` / `Delete` / `Head` / `Options` | 对应同名动词 | `context.Background()` |
| `Request` | 任意（参数指定） | 调用方传入 |

默认客户端由包内部管理：

- **惰性初始化**：默认客户端在首次包级调用时创建（使用 `DefaultConfig()` 配置），无启动开销。
- **自动重建**：默认客户端被关闭（`CloseDefaultClient` 或直接 `Close`）后，下一次包级调用会重新创建它。
- **并发安全**：初始化与替换由双重检查锁保护，可从多个 goroutine 并发调用。

:::tip 生产建议
包级函数适用于脚本与一次性请求。长期运行的服务应使用 `NewDefault()`/`New()` 创建显式客户端，自行控制配置与生命周期。
:::

> 默认客户端的惰性创建与关闭后重建机制，详见[核心概念](../../getting-started/concepts)。

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

:::tip panic 安全网
`Request`（包级函数与客户端方法）内置 panic 恢复：执行路径中出现的意外 panic 会被转换为错误返回，不会终止调用方的 goroutine；底层资源在栈展开时正常释放。
:::

## 客户端方法

Client 接口提供与包级函数相同的 HTTP 方法，另加带上下文的 `Request` 方法。

Client 接口（详见[接口定义](../types/interfaces)）= 最小接口 `Doer`（仅含 `Request` 一个方法）+ 七个 HTTP 动词便捷方法 + `Download` + `Close`。接受 `Doer` 的代码同样接受自定义实现，只要该实现满足 `Doer`。

### New

```go
func New(cfg Config) (Client, error)
```

创建新的 HTTP 客户端。传入 `Config` 值，推荐先用 `DefaultConfig()` 或预设函数获取，再按需修改。配置无效时返回错误（如无效的 `SecurityConfig.SSRFExemptCIDRs`）。

配置在创建时深拷贝：构造后修改原 `Config` 不影响已创建的客户端。例外是按引用共享的字段：`Retry.CustomPolicy` 与 `Security.CertificatePinner`。含可变状态的自定义 policy 不要跨多个客户端并发共享。

```go
// 使用默认配置（或调用 NewDefault() 效果相同）
client, err := httpc.New(httpc.DefaultConfig())

// 使用预设配置
client, err := httpc.New(httpc.SecureConfig())

// 使用自定义配置
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### NewDefault

```go
func NewDefault() (Client, error)
```

便捷构造，等价于 `New(DefaultConfig())`，适用于无需自定义配置的场景。

```go
client, err := httpc.NewDefault()
defer func() { _ = client.Close() }()
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

`Client` 接口的完整方法集：

- 七个动词便捷方法：`Client.Get`、`Client.Post`、`Client.Put`、`Client.Patch`、`Client.Delete`、`Client.Head`、`Client.Options`，签名均为 `(url string, options ...RequestOption) (*Result, error)`。
- 经 `Doer` 接口嵌入获得的 `Doer.Request`。
- `Client.Download`。
- 生命周期方法 `Client.Close`。

### Close

Client 接口方法，释放客户端持有的资源（连接池、Transport）。调用后再发请求返回 `ErrClientClosed`；重复调用是安全的。

```go
// Client 接口方法
Close() error
```

```go
client, _ := httpc.NewDefault()
defer client.Close()
```

## 默认客户端管理

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

设置自定义客户端为默认客户端，供包级函数使用。旧默认客户端会被自动关闭。该函数并发安全。

:::warning 限制
`SetDefaultClient` 仅接受通过 `httpc.New()` 或 `httpc.NewDefault()` 创建的客户端。传入 nil、非本包创建或已关闭的客户端时，返回错误。

替换先于关闭：新客户端即使已安装，若旧客户端关闭失败，函数仍返回 `default client replaced, but closing the previous default failed: ...`。该错误表示旧实例清理失败，不代表替换未生效。
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

关闭默认客户端并重置。下次调用包级函数时会创建新客户端。该函数并发安全。默认客户端已被直接 `Close` 时，下一次包级调用同样会重新创建它（详见[核心概念](../../getting-started/concepts)）。

### CloseRoutedClients

```go
func CloseRoutedClients() error
```

关闭并释放全部包级路由客户端（`WithProxy`、`WithSystemProxy`、`WithTLSFingerprint` 缓存的专用客户端），并清空缓存。幂等且并发安全。与 `CloseDefaultClient` 有两点差异：

- `CloseRoutedClients` 不关闭默认客户端；默认客户端仍由 `CloseDefaultClient` 管理。
- `CloseRoutedClients` 会遍历全部缓存条目并逐个关闭：单个客户端关闭失败不影响其余客户端的关闭，全部失败用 `errors.Join` 汇总后返回。

## 下载函数

包级下载函数使用默认客户端。Client 接口与 DomainClient 也提供同名方法，三处签名一致。

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download` 是包级函数、`Client` 接口与 `DomainClient` 共用的下载入口，三者签名一致。

`cfg` 不能为 nil，且 `cfg.FilePath` 必须设置（否则返回 `ErrEmptyFilePath`）。无需取消或超时控制时传入 `context.Background()`。请求选项用于设置请求头、认证、查询参数等。

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
旧版下载函数（DownloadFile、DownloadWithOptions、DownloadFileWithContext、DownloadWithOptionsWithContext）已在 v1.5.2 移除。统一改用 `Download(ctx, url, cfg, options...)`，路径、覆盖、续传与校验通过 `DownloadConfig` 配置。
:::

## 辅助函数

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

重定向安全警告输出（如 `TestingConfig`、`InsecureSkipVerify` 警告）。默认输出到 `os.Stderr`，每类警告每进程至多打印一次。传入 `io.Discard` 可静默所有警告。

```go
// 静默所有安全警告
httpc.SetSecurityWarnOutput(io.Discard)

// 重定向到自定义日志
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
`SetSecurityWarnOutput` 主要用于测试。生产环境应使用 `SecureConfig()` 或 `DefaultConfig()`，而不是抑制警告。
:::

## 格式化工具

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

将字节数格式化为人类可读的字符串（如 `"1.50 KB"`、`"500 B"`）。常用于下载结果展示与日志输出。小于 1024 的值不带小数位（`0` 输出 `0 B`），1024 及以上保留两位小数。

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
func NewDomain(baseURL string, cfg Config) (DomainClienter, error)
```

创建域名客户端，自动管理 Cookie 和请求头。传入 `Config` 值。`baseURL` 必须包含 scheme 与 host（如 `https://api.example.com`），否则返回错误。配置校验规则与 `New` 相同。

`NewDomain` 创建的 DomainClient 内置一个 `SessionManager`：请求前注入会话头与 Cookie，响应后回写 `Set-Cookie`。该会话存储独立于 `Connection.EnableCookies`。

```go
dc, err := httpc.NewDomain("https://api.example.com", httpc.DefaultConfig())
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

### NewDomainDefault

```go
func NewDomainDefault(baseURL string) (DomainClienter, error)
```

便捷构造，等价于 `NewDomain(baseURL, DefaultConfig())`。

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
defer dc.Close()
```

## 另见

- [Result](./result) - 响应结果类型和方法
- [请求选项](./options) - 请求配置选项
- [域名客户端](../client-config/domain-client) - 域名客户端与 URL 拼接规则
- [文件下载](../client-config/download) - 下载函数和类型
