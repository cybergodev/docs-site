---
title: "文件上传与下载 - CyberGo HTTPC | 上传与下载"
description: "HTTPC 文件上传与下载指南：WithFile 简单上传、WithFormData Multipart 多文件上传、Download 统一下载、带进度回调、断点续传 ResumeDownload、SHA-256 校验与 UNC 路径等安全防护。"
---

# 文件上传与下载

## 文件上传

### 简单文件上传

```go
fileContent, err := os.ReadFile("document.pdf")
if err != nil {
    log.Fatal(err)
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

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
data, _ := os.ReadFile("data.bin")
result, err := httpc.Post(url,
    httpc.WithBinary(data, "application/octet-stream"),
)
```

## 文件下载

`Download(ctx, url, cfg, options...)` 是贯穿包级函数、`Client` 和 `DomainClient` 的唯一规范下载入口。

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
    fmt.Printf("续传完成: 从断点恢复\n")
}
```

:::tip
断点续传依赖服务端支持 `Range` 请求头。如果服务端不支持（返回 200 而非 206），将返回错误以保护已下载的部分文件。
:::

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

## 安全防护

文件下载内置多层安全保护：

| 保护层 | 说明 |
|--------|------|
| 路径验证 | 阻止 UNC 路径、控制字符、路径遍历 |
| 系统路径保护 | 禁止写入 `/etc/`、`C:\Windows\` 等系统目录 |
| 符号链接检测 | 防止符号链接攻击 |
| 文件大小限制 | 受 `MaxResponseBodySize` 限制 |

## 域名客户端下载

域名客户端的下载会自动捕获响应 Cookie 到会话：

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"

// 下载并自动管理会话（path 相对于 baseURL）
result, err := dc.Download(context.Background(), "/files/report.pdf", cfg)
```

## 下一步

- [文件下载 API](../api-reference/download) - 完整下载 API 参考
- [域名客户端与会话](./domain-session) - 会话管理
- [请求与响应](./request-response) - 基本请求指南
