---
sidebar_label: "File Upload & Download"
title: "File Upload and Download - CyberGo HTTPC | Upload & Get"
description: "HTTPC file upload and download guide: WithFile upload, WithFormData multi-file upload, unified Download, progress callbacks, resumable ResumeDownload, SHA-256 checksums, and UNC path protection."
sidebar_position: 4
---

# File Upload and Download

## File Upload

### Simple File Upload

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

    log.Printf("Upload complete: %d", result.StatusCode()) // Sample output: Upload complete: 200 (actual status code depends on the server)
}
```

### Multipart Form

Upload files with accompanying form fields:

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

### Multi-File Upload

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "Batch upload",
    },
    Files: map[string]*httpc.FileData{
        "file1": {Filename: "doc1.pdf", Content: content1},
        "file2": {Filename: "doc2.pdf", Content: content2},
        "file3": {Filename: "image.png", Content: content3},
    },
}

result, err := httpc.Post(url, httpc.WithFormData(form))
```

### Binary Upload

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

## File Download

`Download(ctx, url, cfg, options...)` is the single canonical download entry point shared across the package-level function, `Client`, and `DomainClient`.

### Basic Download

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Download complete: %s\n", httpc.FormatBytes(result.BytesWritten))
fmt.Printf("Duration: %v\n", result.Duration)
```

### With Progress Callback

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rDownloading: %.1f%% (%s)", pct, httpc.FormatSpeed(speed))
}

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nDownload complete: %s, average speed %s\n",
    httpc.FormatBytes(result.BytesWritten),
    httpc.FormatSpeed(result.AverageSpeed),
)
```

### Resumable Downloads

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    log.Fatal(err)
}

if result.Resumed {
    fmt.Printf("Resumed download complete: recovered from breakpoint\n")
}
```

:::tip
Resumable downloads depend on server support for the Range request header. If the server does not support it (returns 200 instead of 206), an error is returned to protect the existing partial file.
:::

### With Context Control

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(ctx, url, cfg)
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("Download timed out")
    }
    log.Fatal(err)
}
```

## Security Protection

File downloads include multiple layers of built-in security:

| Protection Layer | Description |
|------------------|-------------|
| Path validation | Blocks UNC paths, control characters, path traversal |
| System path protection | Blocks writing to `/etc/`, `C:\Windows\`, and other system directories |
| Symlink detection | Prevents symlink attacks |
| File size limits | Subject to `MaxResponseBodySize` limit |

## Domain Client Downloads

Domain client downloads automatically capture response cookies into the session:

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"

// Download with automatic session management (path is relative to baseURL)
result, err := dc.Download(context.Background(), "/files/report.pdf", cfg)
if err != nil {
    log.Fatal(err)
}
```

## Next Steps

- [File Download API](../api-reference/client-config/download) - Complete download API reference
- [Domain Client and Sessions](./domain-session) - Session management
- [Request and Response](./request-response) - Basic request guide
