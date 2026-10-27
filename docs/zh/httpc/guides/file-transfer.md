---
sidebar_label: "文件上传与下载"
title: "文件上传与下载 - CyberGo HTTPC | 上传与下载"
description: "HTTPC 文件上传与下载指南：WithFile 与 WithFormData 多文件上传、Download 流式下载、进度回调、断点续传与 ResumeDownload、SHA-256 校验和验证、文件冲突与清理语义，以及 UNC 路径等多层路径安全防护。"
sidebar_position: 50
---

# 文件上传与下载

文件传输指通过 HTTPC 上传请求体中的文件内容，或把响应体流式写入本地磁盘。

## 文件上传

### 简单文件上传

```go
package main

import (
	"log"
	"os"

	"github.com/cybergodev/httpc"
)

func main() {
	fileContent, err := os.ReadFile("document.pdf")
	if err != nil {
		log.Fatal(err)
	}

	result, err := httpc.Post("https://api.example.com/upload",
		httpc.WithFile("file", "document.pdf", fileContent),
	)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("上传完成：%d", result.StatusCode()) // 输出示例：上传完成：200（实际状态码取决于服务端）
}
```

`WithFile` 的字段名与文件名只接受**裸文件名**：含路径分隔符或 `..` 的名字直接拒绝（不解析）。多个 `WithFile` 选项合并进同一个 multipart 体，同名字段后者覆盖前者。

### Multipart 表单

上传文件的同时附带表单字段：

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

`FileData` 还提供 `ContentType` 字段，用于显式声明每个文件的 MIME 类型（不设置时该 part 默认为 `application/octet-stream`）：

```go
Files: map[string]*httpc.FileData{
    "file": {
        Filename:    "document.pdf",
        Content:     fileContent,
        ContentType: "application/pdf", // 显式声明 MIME 类型
    },
},
```

### 多文件上传

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "批量上传",
    },
    Files: map[string]*httpc.FileData{
        "file1": {Filename: "doc1.pdf", Content: content1},
        "file2": {Filename: "doc2.pdf", Content: content2},
        "file3": {Filename: "image.png", Content: content3},
    },
}

result, err := httpc.Post(url, httpc.WithFormData(form))
```

### 二进制上传

```go
data, err := os.ReadFile("data.bin")
if err != nil {
    log.Fatal(err)
}
result, err := httpc.Post(url,
    httpc.WithBinary(data, "application/octet-stream"),
)
if err != nil {
    log.Fatal(err)
}
```

### 流式上传（大文件）

`WithBody` 直接接受 `io.Reader`，无需把整个文件读入内存。Reader 请求体的 Content-Type 不会被自动检测，需显式设置。

```go
file, err := os.Open("large-video.mp4")
if err != nil {
    log.Fatal(err)
}
defer file.Close()

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithBody(file),
    httpc.WithHeader("Content-Type", "video/mp4"),
)
```

配合 `io.Pipe` 可流式上传：生产者 goroutine 逐块写入，HTTP 传输层同时消费，无需整体缓冲。

```go
pr, pw := io.Pipe()
go func() {
    defer pw.Close()
    // 分块写入 pw，例如从数据库或生成器逐块产出
    _, _ = pw.Write(chunk)
}()

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithBody(pr),
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```

:::warning Reader 请求体的大小校验取决于 MaxRequestBodySize
`io.Reader` 无法预知长度，默认（`MaxRequestBodySize = 0`）不做大小校验。设置 `Security.MaxRequestBodySize > 0` 后，发送时由计数读取器在超限处中止传输，并返回 `request body exceeds limit of N bytes`。上传不可信数据时，仍建议用 `io.LimitReader` 在源头限流：

```go
result, err := httpc.Post(url,
    httpc.WithBody(io.LimitReader(reader, 10<<20)), // 上限 10MB
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```
:::

## 文件下载

`Download(ctx, url, cfg, options...)` 是包级函数、`Client` 和 `DomainClient` 共用的下载入口。

下载**始终以流式进行**：内部自动附加 `WithStreamBody(true)`，响应体从网络直接写入磁盘（`io.Copy`），全程不把整个文件缓冲进内存。启用校验和时，哈希计算在写入过程中同步完成，不产生第二遍读盘（续传场景例外：既有前缀需先补读一次以计入完整文件的哈希）。

:::warning 下载受 MaxResponseBodySize 约束
流式写盘**不等于没有大小上限**：下载响应体仍受客户端 `Security.MaxResponseBodySize` 约束。`DefaultConfig` 默认 10MB，其他预设为 `SecureConfig` 5MB、`PerformanceConfig` 50MB、`MinimalConfig` 1MB。

超出上限时下载失败，错误信息含 `streamed response body exceeds size limit of N bytes`（外层包装为 `failed to write file: …`），**不会**在限额处静默截断为成功：非续传删除临时文件、既有目标文件不变，续传则保留已追加的字节供下次续试。该错误**不是** `ErrResponseBodyTooLarge`。下载大文件前需先调大该值：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 200 << 20 // 200MB，按需调整
```
:::

### 基本下载

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("下载完成: %s\n", httpc.FormatBytes(result.BytesWritten))
fmt.Printf("耗时: %v\n", result.Duration)
```

:::warning 未请求 Range 却收到 206
未请求 `Range` 的下载收到 `206 Partial Content` 时，HTTPC 按内容保存并视为下载成功（源码 `download.go` 注释明确该行为）。唯一例外是响应以 `Content-Range: bytes 0-…/<total>` 声明了总长度——实收字节与该总长度不符时按截断报错，非续传删除临时文件、目标文件不变。畸形、缺失、起点非 0 或总长为 `*` 的 `Content-Range` 仍按原样保存，不规范的服务器可借此只返回部分内容而不报错；需要完整性保证时设置 `DownloadConfig.Checksum` 校验。
:::

### 带进度回调

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r下载中: %.1f%% (%s)", pct, httpc.FormatSpeed(speed))
}

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\n下载完成: %s, 平均速度 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    httpc.FormatSpeed(result.AverageSpeed),
)
```

:::tip 进度回调的触发规则
回调参数为 `(已下载字节, 总字节, 当前速度)`，触发节奏由实现保证：

- **最短间隔 200ms**：高速网络下不因高频回调拖慢写盘，低速网络下也能稳定刷新；
- **结束时补一次最终回调**：此时 `downloaded` 为总字节数，`speed` 为平均速度，便于 CLI 收尾换行；
- **`total` 的来源**：服务器返回的 `Content-Length`。续传场景下服务器对 Range 请求只报告剩余字节数，HTTPC 会自动加上已有文件偏移得到完整大小；
- **`total` 为 0 或负数的情况**：服务器未返回 Content-Length（chunked 传输）时无法预知总量，回调里需先判 `total > 0` 再计算百分比。
:::

### 带认证与自定义请求头

`Download` 的可变参数就是普通的 `RequestOption`，认证头、查询参数、单次超时都可直接附加：

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := client.Download(context.Background(),
    "https://api.example.com/files/report.pdf",
    cfg,
    httpc.WithBearerToken("my-token"),                  // 认证
    httpc.WithHeader("Accept", "application/pdf"),      // 自定义头
    httpc.WithTimeout(5*time.Minute),                   // 单次下载超时预算
)
```

### 断点续传

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    log.Fatal(err)
}

if result.Resumed {
    fmt.Printf("续传完成：从断点恢复\n")
}
```

:::tip
断点续传依赖服务端支持 Range 请求头。服务端不支持时返回 200 而非 206，HTTPC 返回错误以保护已下载的部分文件。
:::

续传的完整判定逻辑：

| 服务端响应 | 行为 |
|------------|------|
| `206 Partial Content` | 以 `O_APPEND` 追加写入已有文件，`result.Resumed` 为 `true` |
| `200 OK`（不支持 Range） | 返回错误 `server does not support range requests`，**不截断**已有部分文件 |
| `416 Range Not Satisfiable` | 返回错误，常见于本地文件已完整或服务端资源已变更变小 |
| 其他非 2xx 状态码 | 返回 `unexpected status code` 错误，错误信息附带响应体前 200 字节预览 |

:::warning Overwrite 与 ResumeDownload 同时为 true 时
`ResumeDownload` 优先：已有文件被**追加扩展**而非替换重写。续传模式下若中途写盘失败，已有字节会被保留，供下一次续传；非续传模式下失败则删除写了一半的临时文件，既有目标不受影响。进程崩溃残留的 `.httpc-tmp` 临时文件会在下次下载同一目标时被覆盖清理。
:::

### 校验和验证（SHA-256）

设置 `Checksum` 后，HTTPC 在写盘的同时对流过的数据计算 SHA-256，下载完成时与期望值比对：

- 比对**不区分大小写、忽略期望值首尾空白**（期望值内部统一转小写并 TrimSpace）；
- **不匹配时返回错误**：非续传删除临时文件，既有目标不受影响；续传把文件截断回本次续传起点，保留已下载前缀供下次重试；
- 续传时期望值应是**完整文件**的哈希——既有前缀会被补读进哈希，最终校验覆盖整个文件；
- 成功时 `result.ActualChecksum` 携带实际计算出的哈希，可供记录；
- 算法合法性在**发出请求与打开目标文件之前**各校验一次（仅支持 SHA-256），配置错误（如未知的 `ChecksumAlgorithm`）不会发起网络请求，也不会截断磁盘上的既有文件。

```go
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"

	"github.com/cybergodev/httpc"
)

func main() {
	payload := []byte("hello httpc checksum")

	// 本地模拟服务器返回固定内容；生产中期望值应来自发布清单等可信渠道
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(payload)
	}))
	defer server.Close()

	sum := sha256.Sum256(payload)
	expected := hex.EncodeToString(sum[:])

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // 允许连接 127.0.0.1 本地服务器
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	dlCfg := httpc.DefaultDownloadConfig()
	dlCfg.FilePath = "checksum-demo.txt"
	dlCfg.Overwrite = true
	dlCfg.Checksum = expected // 期望 SHA-256（hex 编码）
	dlCfg.ChecksumAlgorithm = httpc.ChecksumSHA256

	result, err := client.Download(context.Background(), server.URL, dlCfg)
	if err != nil {
		log.Fatal(err) // 校验失败：临时文件被删除，错误信息含期望值与实际值
	}
	fmt.Printf("校验通过：%s\n", result.ActualChecksum) // 输出：校验通过：2f2b7c...（payload 的 SHA-256）
}
```

### 带上下文控制

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(ctx, url, cfg)
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("下载超时")
    }
    log.Fatal(err)
}
```

### 文件冲突与清理语义

下载对目标文件的处理规则如下，配合 `ErrFileExists`、`ErrEmptyFilePath` 两个哨兵错误用 `errors.Is` 判断：

| 场景 | 行为 |
|------|------|
| 目标文件已存在，`Overwrite`/`ResumeDownload` 均为 false | 返回 `ErrFileExists`，不修改文件 |
| 目标路径是目录 | 返回错误 |
| `Overwrite = true`（非续传） | 写入同目录临时文件 `<目标>.httpc-tmp`，校验通过后原子改名替换目标 |
| `ResumeDownload = true` 且服务器支持 Range | `O_APPEND` 追加写目标文件本身 |
| 写入/落盘（sync/close）失败 | 非续传：删除临时文件，目标不变；续传：保留已有字节 |
| 校验和不匹配 | 非续传：删除临时文件，目标不变；续传：截断回本次续传起点，保留前缀 |
| 期望的算法不受支持（仅 SHA-256） | 发出请求**之前**即返回错误，不触碰既有文件 |
| 目标目录不存在 | 自动递归创建（权限 0755），文件权限 0644 |
| 路径为空 | 返回 `ErrEmptyFilePath` |
| 同一目标路径的并发下载 | 进程内串行化：后到的下载立即返回 `ErrDownloadInProgress`，不阻塞等待 |

错误状态码（非 200/206）时，错误信息附带响应体前 200 字节的预览便于排查。同时最多排空 1MiB 响应体，以便连接回归连接池复用。

### Download 与 SaveToFile 如何选择

`Result.SaveToFile(path)` 把**已在内存中**的响应体写到磁盘；`Download` 则从头到尾流式写盘：

| 方式 | 适用场景 | 说明 |
|------|----------|------|
| `result.SaveToFile(path)` | 小到中等响应体（已在内存） | 路径经过与 Download 相同的安全校验；空响应体返回 `ErrResponseBodyEmpty` |
| `client.Download(ctx, url, cfg)` | 大文件 | 流式写盘，支持进度、续传、校验和，内存占用与文件大小无关 |

```go
// 响应体已在内存：直接落盘
result, err := client.Get("https://example.com/small.json")
if err != nil {
    log.Fatal(err)
}
if err := result.SaveToFile("/tmp/small.json"); err != nil {
    log.Fatal(err)
}
```

### DownloadResult 字段一览

`Download` 返回的 `DownloadResult` 除常见的字节数与耗时外，还携带完整的请求/响应元数据：

| 字段 | 类型 | 说明 |
|------|------|------|
| `FilePath` | `string` | 校验后的绝对保存路径 |
| `BytesWritten` | `int64` | 本次写入磁盘的字节数（续传时**不含**续传前已有偏移） |
| `Duration` | `time.Duration` | 下载总耗时 |
| `AverageSpeed` | `float64` | 平均速度（字节/秒） |
| `StatusCode` | `int` | 响应状态码（200 或 206） |
| `ContentLength` | `int64` | 服务器报告的 Content-Length（续传时为剩余字节数） |
| `Resumed` | `bool` | 本次是否为断点续传 |
| `ResponseCookies` | `[]*http.Cookie` | 响应返回的 Cookie（`DomainClient` 会自动捕获进会话） |
| `ActualChecksum` | `string` | 实际计算出的校验和（仅设置 `Checksum` 时非空） |
| `Proto` | `string` | 协议版本（如 `HTTP/2.0`） |
| `ResponseHeaders` | `http.Header` | 响应头 |
| `RequestURL` / `RequestMethod` | `string` | 实际请求的 URL 与方法 |
| `RequestHeaders` | `http.Header` | 实际发送的请求头 |

## 安全防护

文件下载内置多层安全保护，以下检查全部在**打开目标文件之前**完成：

| 保护层 | 说明 |
|--------|------|
| 路径验证 | 阻止 UNC 路径（`\\server\share`、`//server`）、控制字符、路径遍历（`Clean` 后以 `..` 开头且逃出工作目录即拒绝） |
| 长度限制 | 路径最长 4096 字符，超长直接拒绝 |
| 系统路径保护 | 禁止写入系统目录：Windows 覆盖 `C:\Windows\`、`C:\Program Files\` 及 `%SystemRoot%` 等环境变量展开位置；Linux/macOS 覆盖 `/etc/`、`/usr/`、`/bin/`、`/System/`、`/Library/` 等 |
| 符号链接检测 | 目标本身是符号链接、或任一父目录解析进系统目录（TOCTOU 防护，递归检查至多 32 层）均拒绝 |
| Windows 专项 | 拒绝 DOS 设备名（`CON`、`COM1` 等，含带扩展名与尾部空格的变体）、NTFS 备用数据流（`file.txt:ads`）与目录组件的 8.3 短名别名（`PROGRA~1`，防绕过系统路径与符号链接检查） |
| 文件大小限制 | 受 `MaxResponseBodySize` 限制 |

:::tip 目录也会被校验
自动创建父目录（`MkdirAll`）发生在路径校验**之后**，因此 `FilePath` 中的每一级目录都不能借道系统路径或符号链接绕过防护。`Result.SaveToFile` 复用同一套校验。
:::

## 域名客户端下载

域名客户端的下载会自动捕获响应 Cookie 到会话。

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"

// 下载并自动管理会话（path 相对于 baseURL）
result, err := dc.Download(context.Background(), "/files/report.pdf", cfg)
if err != nil {
    log.Fatal(err)
}
```

:::warning 域名客户端的两个注意事项
- **会话捕获是静态的**：请求选项只执行一次，只有 `WithHeader`/`WithHeaderMap`/`WithCookies`/`WithCookieMap`/`WithCookieString` 携带的头与 Cookie 写入会话；自定义 `RequestOptionFunc` 里的 `SetHeader`/`SetCookies` 不被捕获，需要持久化时用 `dc.SetHeader`/`dc.SetCookie`。
- **Download 与包装响应对象的自定义中间件不兼容**：下载路径需要直接访问原始响应流，若自定义中间件把 `ResponseMutator` 替换为包装类型，`Download` 会返回明确错误。内置中间件（Recovery/Logging/Metrics 等）均为透传，不受影响。
:::

## 下一步

- [文件下载 API](../api-reference/client-config/download) - 完整下载 API 参考
- [域名客户端与会话](./domain-session) - 会话管理
- [请求与响应](./request-response) - 基本请求指南
- [性能优化](./performance) - 大文件下载的性能预设与调优
- [测试指南](./testing) - 用 httptest 测试下载逻辑
