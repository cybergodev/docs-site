---
sidebar_label: "文件下载"
title: "文件下载 - CyberGo HTTPC | Download 与校验"
description: "HTTPC 文件下载 API 参考：Download 统一下载入口函数、DownloadConfig 配置结构体、DownloadProgressCallback 进度回调、DownloadResult 结果类型、SHA-256 校验和验证与 UNC 路径防护等六层安全保护。"
sidebar_position: 40
---

# 文件下载

`Download` 是 HTTPC 的文件下载入口，由包级函数、`Client` 方法与 `DomainClient` 方法共用；本页说明 `DownloadConfig` 字段、断点续传、校验和与路径安全规则。

## 包级下载函数

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

使用默认客户端下载文件。包级函数、`Client` 接口和 `DomainClient` 上的 `Download` 共用单一签名，构成**唯一规范下载入口**。`cfg` 不能为 nil，且 `cfg.FilePath` 必须设置（否则返回 `ErrEmptyFilePath`）。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
```

`Download` 在 `Client` 接口和 `DomainClient` 上签名一致，三处入口行为统一。

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

### 字段详解

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `DownloadConfig.FilePath` | `string` | — | 文件保存路径（**必填**，不能为空） |
| `DownloadConfig.ProgressCallback` | `DownloadProgressCallback` | `nil` | 进度回调函数；为 nil 时不上报进度 |
| `DownloadConfig.Overwrite` | `bool` | `false` | 是否覆盖已存在的文件；`false` 且文件已存在时返回 `ErrFileExists` |
| `DownloadConfig.ResumeDownload` | `bool` | `false` | 是否启用断点续传；`true` 时复用已有部分文件 |
| `DownloadConfig.Checksum` | `string` | `""` | 期望的十六进制编码校验和；设置后在下载完成时自动校验 |
| `DownloadConfig.ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | 校验算法（目前仅支持 SHA-256） |

:::tip Overwrite 与 ResumeDownload 的优先级
当文件已存在且两者都为 true 时，`ResumeDownload` 优先：已有文件被**追加扩展**而非替换。当文件不存在时，两者行为相同（正常下载）。
:::

### DefaultDownloadConfig

```go
func DefaultDownloadConfig() *DownloadConfig
```

返回默认下载配置：`Overwrite` 和 `ResumeDownload` 均为 false，`ChecksumAlgorithm` 为 `ChecksumSHA256`。调用方必须设置 `FilePath` 后才能使用；其余字段按需设置。

## DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

下载进度回调函数的类型，赋值给 `DownloadConfig` 的 `ProgressCallback` 字段使用；为 `nil`（默认）时下载过程不上报进度。

| 参数 | 类型 | 说明 |
|------|------|------|
| `downloaded` | `int64` | 已下载字节数（含续传偏移量） |
| `total` | `int64` | 总字节数（`-1` 表示未知，无 Content-Length） |
| `speed` | `float64` | 当前速度（字节/秒） |

### 进度回调机制

进度回调由 `progressWriter` 包装 `io.Writer` 实现：每次 Write 时检查是否到达节流间隔。

| 特性 | 说明 |
|------|------|
| 节流间隔 | 200ms（`progressInterval`），限制回调频率 |
| 续传偏移调整 | `downloaded = offset + written`，续传时上报已下载总量而非本次增量 |
| 总量调整 | 续传时 `total = contentLength + offset`，还原完整文件大小 |
| 最终回调 | 下载完成后额外触发一次回调，上报最终统计值 |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    if total > 0 {
        pct := float64(downloaded) / float64(total) * 100
        fmt.Printf("\r%.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
    } else {
        fmt.Printf("\r%s (%s/s)", httpc.FormatBytes(downloaded), httpc.FormatSpeed(speed))
    }
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

### 字段详解

| 字段 | 类型 | 说明 |
|------|------|------|
| `DownloadResult.FilePath` | `string` | 文件实际保存的**绝对路径**（经 `prepareFilePath` 验证后的路径） |
| `DownloadResult.BytesWritten` | `int64` | 本次写入的字节数（续传时为追加量，非文件总大小） |
| `DownloadResult.Duration` | `time.Duration` | 下载耗时（从打开目标文件到写入、Sync 并关闭完成） |
| `DownloadResult.AverageSpeed` | `float64` | 平均速度（字节/秒，= BytesWritten / Duration） |
| `DownloadResult.StatusCode` | `int` | HTTP 状态码（200 或 206） |
| `DownloadResult.ContentLength` | `int64` | 服务器报告的 Content-Length（续传时为剩余部分长度） |
| `DownloadResult.Resumed` | `bool` | 是否为续传完成（请求了 Range 且收到 206） |
| `DownloadResult.ResponseCookies` | `[]*http.Cookie` | 响应 Cookie |
| `DownloadResult.ActualChecksum` | `string` | 实际计算的校验和（仅 `Checksum` 设置时填充） |
| `DownloadResult.Proto` | `string` | HTTP 协议版本（如 `"HTTP/1.1"`、`"HTTP/2.0"`） |
| `DownloadResult.ResponseHeaders` | `http.Header` | 响应头 |
| `DownloadResult.RequestURL` | `string` | 实际请求 URL |
| `DownloadResult.RequestMethod` | `string` | 请求 HTTP 方法（固定为 `"GET"`） |
| `DownloadResult.RequestHeaders` | `http.Header` | 实际发送的请求头 |

```go
fmt.Printf("下载完成: %s, 耗时 %v, 平均速度 %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

:::tip
使用 [FormatBytes](../core/functions#formatbytes) 与 [FormatSpeed](../core/functions#formatspeed) 可得人类可读的字节与速率字符串，无需手动换算 `1024` 进位。
:::

## 校验和验证

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

下载文件完整性校验算法。

| 常量 | 值 | 说明 |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 哈希算法 |

### SHA-256 流式校验流程

设置 `Checksum` 后，下载过程中**写入同时计算**哈希，避免下载完成后二次读取整个文件：

```text
校验流程：

  ① hasher = sha256.New()
  ② writer = io.MultiWriter(file, hasher)
     ↓
     网络数据流 → file（写入磁盘）
                → hasher（更新哈希状态）
     ↓
  ③ 下载完成后：actualChecksum = hex(hasher.Sum(nil))
  ④ 比较：actualChecksum == strings.ToLower(cfg.Checksum)？
     ├─ 匹配 → 返回 DownloadResult（含 ActualChecksum）
     └─ 不匹配 → 删除文件 + 返回校验错误
```

| 步骤 | 说明 |
|------|------|
| MultiWriter | `io.MultiWriter(file, hasher)` 让数据同时写入文件和哈希器，无额外内存开销 |
| 算法预检 | 在触碰目标文件**之前**校验算法名，配置错误不会截断已有文件 |
| 失败清理 | 写入、Sync、关闭或校验任一环节失败时**自动删除**已下载文件（非续传模式），避免残留损坏文件；续传模式保留已有字节供下次续传 |
| 大小写无关 | 期望值自动 ToLower，实际值为小写 hex，大小写不影响比较 |

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    // 校验和不匹配时自动返回错误并删除已下载文件
    log.Fatal(err)
}
fmt.Println("校验和：", result.ActualChecksum)
```

## 断点续传机制

### ResumeDownload 工作流程

```text
prepareResumeState(filePath, opts, options):

  ① prepareFilePath(filePath) → 验证路径安全性 → validatedPath
  ② os.Stat(validatedPath)
     ├─ 文件不存在 → resumeOffset = 0，正常下载
     ├─ 是目录 → 返回错误
     ├─ 文件存在 + Overwrite=false + Resume=false → ErrFileExists
     ├─ 文件存在 + Resume=true → resumeOffset = fileInfo.Size()
     │     → 追加 WithHeader("Range", "bytes={offset}-") 到 options
     └─ 文件存在 + Overwrite=true（非 Resume）→ resumeOffset = 0，覆盖下载
```

### 服务器响应处理

| 服务器返回 | 处理 |
|-----------|------|
| `206 Partial Content` | 续传成功：以 `O_APPEND` 追加模式写入，`Resumed = true` |
| `200 OK`（不支持 Range） | **返回错误**：服务器忽略了 Range 请求。继续写入会从头覆盖已有部分文件，因此返回错误并保留已有数据（不截断）。排空响应体后报错 |
| `416 Range Not Satisfiable` | **返回错误**：请求的偏移量超出文件大小。排空响应体后报错 |
| 其他状态码（4xx/5xx） | 返回错误，附响应体前 200 字符预览 |

与上表的续传行不同：**未请求 Range 的普通下载若收到 `206 Partial Content`，按其内容保存并按成功返回**（源码 `download.go` 注释明确该行为，并由测试固定；有意为之）。响应若自带有效的 `Content-Range` 总量声明，则按该声明做短体检查。不规范的服务器可能借此静默截断内容，需要设置 `DownloadConfig.Checksum` 才能检测。

:::warning 为什么 200 时报错
当 `ResumeDownload=true` 而服务器返回 200（而非 206）时，说明服务器不支持 Range 请求。此时继续下载会从头覆盖已有部分文件，**静默丢失调用方意图续传的数据**。

HTTPC 因此返回错误而非截断，以保护本地部分文件。如需强制覆盖，设置 `Overwrite=true` + `ResumeDownload=false`。
:::

错误路径上的响应体排空有 **1 MiB 上限**（`maxDrainBodySize`）。排空的目的是让连接可复用；超出上限的剩余响应体不再读取，该连接也随之放弃复用，避免在超大错误体上耗费时间与内存。

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    log.Fatal(err)
}
if result.Resumed {
    fmt.Printf("续传完成，本次追加 %s\n", httpc.FormatBytes(result.BytesWritten))
}
```

## 流式下载原理

文件下载使用流式模式（`WithStreamBody(true)`），不将整个响应体缓冲到内存：

```text
流式下载数据通路：

  服务器响应
    ↓
  engine.Response.RawBodyReader()  ← 网络读取器（io.ReadCloser）
    ↓
  io.Copy(writer, bodyReader)      ← 直接流式写入，零全量缓冲
    ↓
  writer = progressWriter(MultiWriter(file, hasher))
    ↓
  磁盘文件
```

| 特性 | 说明 |
|------|------|
| 零内存缓冲 | 数据从网络直接流向磁盘，不经过完整内存缓冲 |
| 流式哈希 | 校验和计算与写入同步进行，无需二次读取 |
| 自动释放 | 响应体读取器经 `defer` 关闭，引擎响应经 `defer` 归还对象池 |

:::warning 下载受 MaxResponseBodySize 约束
流式写盘只是免去全量内存缓冲，**并非没有大小上限**：下载响应体仍受客户端 `Security.MaxResponseBodySize` 约束。`DefaultConfig` 默认 10MB；其他预设为 `SecureConfig` 5MB、`PerformanceConfig` 50MB、`MinimalConfig` 1MB。

超出上限时下载失败，错误信息含 `streamed response body exceeds size limit of N bytes`（由 `io.Copy` 包装为 `failed to write file: …`），本地文件不会被静默截断——**不是** `ErrResponseBodyTooLarge`。下载大文件前需调大该值：

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 200 << 20 // 200MB，按需调整
```
:::

:::warning 中间件兼容性
下载需要直接访问 `*engine.Response` 的 `RawBodyReader()`。若中间件用自定义类型**包装**了 `ResponseMutator`（而非就地修改引擎响应），下载返回错误 `download is not compatible with middleware that wraps ResponseMutator`。所有内置中间件都就地修改，不会触发此错误。
:::

## 文件路径安全防护

`prepareFilePath` 实现多层安全防护，防止恶意路径写入系统敏感位置。每一层在路径到达文件系统前拦截：

### 防护层级总览

| 层级 | 防护 | 拦截内容 |
|------|------|----------|
| 1 | 长度检查 | 空路径 / 超过 4096 字符 |
| 2 | UNC 路径阻止 | `\\server\share` 或 `//server/share` 网络路径 |
| 3 | 控制字符过滤 | ASCII < 0x20、0x7F（DEL）、0x00（NUL）；Windows 上另拦截 DOS 设备名、NTFS 备用数据流与 8.3 短名目录别名 |
| 4 | 系统路径保护 | 写入 OS 受保护目录（见下表） |
| 5 | 路径穿越检测 | `../` 逃逸工作目录 |
| 6 | symlink 防护 | 文件本身 + 父目录递归检查符号链接 |

### 第 2 层：UNC 路径阻止

```text
阻止格式：
  \\server\share\file     ← Windows UNC 路径
  //server/share/file     ← POSIX 双斜杠网络路径

原因：UNC 路径可访问网络资源，可能被利用进行 SSRF 或 SMB 中继攻击
```

### 第 3 层：控制字符过滤

路径中的每个字节都被检查：ASCII 控制字符（0x00-0x1F）、DEL（0x7F）和 NUL 字节被拒绝。该检查阻止终端转义序列注入与 CRLF 路径混淆攻击。

Windows 平台另有三重专有防护（其他平台为 no-op）：末段为 DOS 设备名（`CON`、`COM1` 等，忽略扩展名、大小写与尾随点/空格）时拒绝，防止响应体写入设备；冒号超出盘符分隔符（如 `file.txt:stream`）时拒绝，防止写入 NTFS 备用数据流；目录段含 8.3 短名别名（`PROGRA~1`）时拒绝，防止以别名绕过系统路径与符号链接检查。

### 第 4 层：系统路径保护

根据操作系统阻止写入受保护的系统目录：

| OS | 受保护路径 |
|----|-----------|
| **Windows** | `C:\Windows\`、`C:\System32\`、`C:\Program Files\`、`C:\ProgramData\`、`C:\Program Files (x86)\` + 环境变量展开：`${SystemRoot}`、`${windir}`、`${ProgramFiles}` 等 |
| **macOS** | `/system/`、`/library/`、`/applications/`、`/usr/`、`/bin/`、`/sbin/`、`/etc/`、`/var/` |
| **Linux** | `/etc/`、`/sys/`、`/proc/`、`/dev/`、`/boot/`、`/root/`、`/usr/bin/`、`/usr/sbin/`、`/bin/`、`/sbin/`、`/lib/`、`/run/` 等 |

路径匹配使用前缀检查（带尾分隔符），防止前缀碰撞（如 `C:\Windows` 不会错误匹配 `C:\WindowsEvil`）。Windows 环境变量模式在检查时动态展开，可捕获安装在非 C 盘的系统目录。

### 第 5 层：路径穿越检测

```text
工作目录边界检查：

  filePath = "../../etc/passwd"
  cleanPath = filepath.Clean → "../../etc/passwd"
  absPath = filepath.Abs → "/home/user/../../etc/passwd" → "/etc/passwd"

  检查：absPath 是否在 工作目录 内？
  结果：否 → "path traversal detected: path outside working directory"
```

清理后的路径（`filepath.Clean`）以 `..` 开头时触发该检查。只有**相对路径**才检测；绝对路径不受工作目录限制（但仍受系统路径保护约束）。

### 第 6 层：symlink 防护

| 检查 | 说明 |
|------|------|
| 文件本身 | `os.Lstat` 检查目标文件是否为 symlink；攻击者可创建指向敏感文件的 symlink |
| 父目录递归 | `checkParentDirSymlinks` 递归检查所有父目录（最多 32 层），防止 TOCTOU 攻击（目录在检查后被替换为 symlink） |
| 解析后系统路径 | 父目录 symlink 解析后若指向系统目录，同样拒绝 |

```go
// 每一层防护都会阻止以下攻击场景：
cfg.FilePath = "\\malicious-server\share\payload"  // UNC 阻止
cfg.FilePath = "/etc/passwd"                        // 系统路径保护
cfg.FilePath = "../../../etc/shadow"                // 路径穿越检测
cfg.FilePath = "/tmp/safe/../../../etc/passwd"      // Clean + 穿越 + 系统路径
```

:::tip 目录与权限
通过安全检查后，`prepareFilePath` 自动创建缺失的父目录（权限 0755）。新文件以 0644 权限创建；续传模式以追加方式打开已有文件，并保留其原有权限。
:::

## 完整示例：生产级下载

以下示例展示带进度回调、SHA-256 校验和断点续传的完整下载流程。

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
	cfg := httpc.DefaultDownloadConfig()
	cfg.FilePath = "/tmp/large-archive.zip"
	cfg.Overwrite = true
	cfg.ResumeDownload = true
	cfg.Checksum = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	lastUpdate := time.Now()
	cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
		// 节流控制：进度回调每 200ms 触发一次，这里再过滤一次
		if time.Since(lastUpdate) < time.Second {
			return
		}
		lastUpdate = time.Now()

		if total > 0 {
			pct := float64(downloaded) / float64(total) * 100
			fmt.Printf("进度: %s / %s (%.1f%%) 速度: %s/s\n",
				httpc.FormatBytes(downloaded),
				httpc.FormatBytes(total),
				pct,
				httpc.FormatSpeed(speed))
		} else {
			fmt.Printf("已下载: %s  速度: %s/s\n",
				httpc.FormatBytes(downloaded),
				httpc.FormatSpeed(speed))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	result, err := httpc.Download(ctx,
		"https://example.com/files/large-archive.zip", cfg)
	if err != nil {
		log.Fatalf("下载失败: %v", err)
	}

	fmt.Println("下载完成")
	fmt.Printf("  文件路径: %s\n", result.FilePath)
	fmt.Printf("  写入量:   %s\n", httpc.FormatBytes(result.BytesWritten))
	fmt.Printf("  耗时:     %v\n", result.Duration)
	fmt.Printf("  平均速度: %s/s\n", httpc.FormatSpeed(result.AverageSpeed))
	fmt.Printf("  状态码：  %d\n", result.StatusCode)
	fmt.Printf("  续传:     %v\n", result.Resumed)
	fmt.Printf("  校验和:   %s\n", result.ActualChecksum)
	// 输出示例：
	// 进度：5.2 MB / 52.4 MB (9.9%) 速度：12.3 MB/s
	// 进度：26.1 MB / 52.4 MB (49.8%) 速度：11.8 MB/s
	// 进度：52.4 MB / 52.4 MB (100.0%) 速度：12.1 MB/s
	// 下载完成
	//   文件路径：/tmp/large-archive.zip
	//   写入量：52.4 MB
	//   耗时：4.331s
	//   平均速度：12.1 MB/s
	//   状态码：200
	//   续传：false
	//   校验和：abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
}
```

## 另见

- [文件上传与下载](../../guides/file-transfer) — 使用指南
- [包函数](../core/functions) — `FormatBytes`/`FormatSpeed` 辅助函数参考
- [域名客户端](./domain-client) — 域名客户端下载方法
