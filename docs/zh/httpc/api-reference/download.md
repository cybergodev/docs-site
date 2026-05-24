---
title: "文件下载 - HTTPC"
description: "HTTPC 文件下载 API 参考：DownloadFile 等四个包级下载函数签名、DownloadConfig 配置结构体、DownloadProgressCallback 进度回调、DownloadResult 结果类型、SHA-256 校验和验证与 UNC 路径防护等六层安全保护。"
---

# 文件下载

## 包级下载函数

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

使用默认客户端下载文件到指定路径。

```go
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

带配置的下载，支持断点续传和进度回调。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

带上下文控制的文件下载。

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

带配置和上下文控制的文件下载。

## DownloadConfig

```go
type DownloadConfig struct {
    FilePath          string
    ProgressCallback  DownloadProgressCallback
    Overwrite         bool
    ResumeDownload    bool
    Checksum          string
    ChecksumAlgorithm ChecksumAlgorithm
}

func DefaultDownloadConfig() *DownloadConfig
```

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `FilePath` | `string` | - | 保存路径（必填） |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | 进度回调函数 |
| `Overwrite` | `bool` | `false` | 覆盖已存在的文件 |
| `ResumeDownload` | `bool` | `false` | 启用断点续传 |
| `Checksum` | `string` | `""` | 期望的校验和值 |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | 校验和算法 |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `downloaded` | `int64` | 已下载字节数 |
| `total` | `int64` | 总字节数（-1 表示未知） |
| `speed` | `float64` | 当前速度（字节/秒） |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}
```

## DownloadResult

```go
type DownloadResult struct {
    FilePath        string
    BytesWritten    int64
    Duration        time.Duration
    AverageSpeed    float64
    StatusCode      int
    ContentLength   int64
    Resumed         bool
    ResponseCookies []*http.Cookie
    ActualChecksum  string
    Proto           string
    ResponseHeaders http.Header
    RequestURL      string
    RequestMethod   string
    RequestHeaders  http.Header
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `FilePath` | `string` | 文件保存路径 |
| `BytesWritten` | `int64` | 写入字节数 |
| `Duration` | `time.Duration` | 下载耗时 |
| `AverageSpeed` | `float64` | 平均速度（字节/秒） |
| `StatusCode` | `int` | HTTP 状态码 |
| `ContentLength` | `int64` | Content-Length 头值 |
| `Resumed` | `bool` | 是否为续传完成 |
| `ResponseCookies` | `[]*http.Cookie` | 响应 Cookie |
| `ActualChecksum` | `string` | 实际计算的校验和 |
| `Proto` | `string` | HTTP 协议版本（如 `"HTTP/1.1"`、`"HTTP/2.0"`） |
| `ResponseHeaders` | `http.Header` | 响应头 |
| `RequestURL` | `string` | 实际请求 URL |
| `RequestMethod` | `string` | 请求 HTTP 方法 |
| `RequestHeaders` | `http.Header` | 请求头 |

```go
fmt.Printf("下载完成: %s, 耗时 %v, 平均速度 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## 校验和验证

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

下载文件完整性校验算法。

| 常量 | 值 | 说明 |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 哈希算法 |

### 使用示例

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    // 校验和不匹配时自动返回错误并删除已下载文件
    log.Fatal(err)
}
fmt.Println("校验和:", result.ActualChecksum)
```

:::tip
设置 `Checksum` 后，下载完成时会自动校验文件完整性。校验失败会自动删除文件并返回错误，无需手动比较。
:::

## 安全保护

文件下载内置多层安全防护：

| 保护 | 说明 |
|------|------|
| UNC 路径阻止 | 禁止 `\\server\share` 格式路径 |
| 控制字符过滤 | 禁止路径中的控制字符 |
| 系统路径保护 | 禁止写入系统目录 |
| 路径遍历检测 | 检测 `../` 路径遍历 |
| 符号链接检测 | 防止符号链接攻击 |
| 父目录检测 | 递归检查父目录符号链接 |

## 断点续传

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if result.Resumed {
    fmt.Println("续传完成")
}
```

续传机制：
1. 检查本地文件大小 → 作为 `Range` 请求偏移量
2. 服务端返回 206 (Partial Content) → 追加写入
3. 服务端返回 416 (Range Not Satisfiable) → 返回错误
4. 服务端返回 200（不支持 Range）→ 返回错误（保护本地部分文件不被覆盖）

## 另见

- [文件上传与下载](../guides/file-transfer) - 使用指南
- [包函数](./functions) - 辅助函数参考
- [域名客户端](./domain-client) - 域名客户端下载方法
