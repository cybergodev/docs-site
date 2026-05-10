---
title: File Download - HTTPC
description: HTTPC file download API reference, covering four download function signatures, DownloadConfig configuration, progress callbacks, checksum enums, and path traversal protection mechanisms.
---

# File Download

## Package-Level Download Functions

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

Downloads a file to the specified path using the default client.

```go
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Download with configuration, supporting resumable downloads and progress callbacks.

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

File download with context control.

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

File download with configuration and context control.

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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `FilePath` | `string` | - | Save path (required) |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | Progress callback function |
| `Overwrite` | `bool` | `false` | Overwrite existing file |
| `ResumeDownload` | `bool` | `false` | Enable resumable download |
| `Checksum` | `string` | `""` | Expected checksum value |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | Checksum algorithm |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `downloaded` | `int64` | Bytes downloaded |
| `total` | `int64` | Total bytes (-1 if unknown) |
| `speed` | `float64` | Current speed (bytes/second) |

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
}
```

| Field | Type | Description |
|-------|------|-------------|
| `FilePath` | `string` | File save path |
| `BytesWritten` | `int64` | Bytes written |
| `Duration` | `time.Duration` | Download duration |
| `AverageSpeed` | `float64` | Average speed (bytes/second) |
| `StatusCode` | `int` | HTTP status code |
| `ContentLength` | `int64` | Content-Length header value |
| `Resumed` | `bool` | Whether resumed from breakpoint |
| `ResponseCookies` | `[]*http.Cookie` | Response cookies |
| `ActualChecksum` | `string` | Actually computed checksum |

```go
fmt.Printf("Download complete: %s, duration %v, average speed %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## Checksum Verification

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

File integrity verification algorithm for downloads.

| Constant | Value | Description |
|----------|-------|-------------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 hash algorithm |

### Usage Example

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    // Checksum mismatch automatically returns an error and deletes the downloaded file
    log.Fatal(err)
}
fmt.Println("Checksum:", result.ActualChecksum)
```

:::tip
When `Checksum` is set, file integrity is automatically verified upon download completion. If verification fails, the file is automatically deleted and an error is returned -- no manual comparison needed.
:::

## Security Protection

File downloads include multiple layers of built-in security:

| Protection | Description |
|------------|-------------|
| UNC path blocking | Blocks `\\server\share` format paths |
| Control character filtering | Blocks control characters in paths |
| System path protection | Prevents writing to system directories |
| Path traversal detection | Detects `../` path traversal |
| Symlink detection | Prevents symlink attacks |
| Parent directory detection | Recursively checks parent directory symlinks |

## Resumable Downloads

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if result.Resumed {
    fmt.Println("Resumed download complete")
}
```

Resume mechanism:
1. Check local file size → use as `Range` request offset
2. Server returns 206 (Partial Content) → append write
3. Server returns 416 (Range Not Satisfiable) → return error
4. Server returns 200 (Range not supported) → return error (protects local partial file from being overwritten)

## See Also

- [File Upload and Download](../guides/file-transfer) - Usage guide
- [Package Functions](./functions) - Helper functions reference
- [Domain Client](./domain-client) - Domain client download methods
