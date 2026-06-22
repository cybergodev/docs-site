---
title: "File Download - CyberGo HTTPC | Download & Verify"
description: "HTTPC file download API reference: the unified Download entry, DownloadConfig, progress callbacks, DownloadResult, SHA-256 checksums, and UNC path protection."
---

# File Download

## Package-Level Download Functions

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Downloads a file using the default client. `Download` is the **single canonical download entry point** shared across the package-level function, the `Client` interface, and `DomainClient`, replacing the previous variant matrix with a single signature. `cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
```

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
    fmt.Printf("\r%.1f%% (%s)", pct, httpc.FormatSpeed(speed))
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

| Field | Type | Description |
|-------|------|-------------|
| `FilePath` | `string` | File save path |
| `BytesWritten` | `int64` | Bytes written |
| `Duration` | `time.Duration` | Download duration |
| `AverageSpeed` | `float64` | Average speed (bytes/second) |
| `StatusCode` | `int` | HTTP status code |
| `ContentLength` | `int64` | Content-Length header value |
| `Resumed` | `bool` | Whether completed via resume |
| `ResponseCookies` | `[]*http.Cookie` | Response cookies |
| `ActualChecksum` | `string` | Actually computed checksum |
| `Proto` | `string` | HTTP protocol version (e.g. `"HTTP/1.1"`, `"HTTP/2.0"`) |
| `ResponseHeaders` | `http.Header` | Response headers |
| `RequestURL` | `string` | Actual request URL |
| `RequestMethod` | `string` | Request HTTP method |
| `RequestHeaders` | `http.Header` | Request headers |

```go
fmt.Printf("Download complete: %s, duration %v, average speed %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

:::tip
Use [FormatBytes](./functions#formatbytes) and [FormatSpeed](./functions#formatspeed) for human-readable byte and speed strings, avoiding manual `1024`-step unit conversion.
:::

## Checksum Verification

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

Download file integrity verification algorithm.

| Constant | Value | Description |
|----------|-------|-------------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 hash algorithm |

### Usage Example

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    // Automatically returns error and deletes downloaded file on checksum mismatch
    log.Fatal(err)
}
fmt.Println("Checksum:", result.ActualChecksum)
```

:::tip
When `Checksum` is set, file integrity is automatically verified upon download completion. A failed verification automatically deletes the file and returns an error -- no manual comparison needed.
:::

## Security Protection

File downloads include multiple layers of built-in security:

| Protection | Description |
|------------|-------------|
| UNC path blocking | Blocks `\\server\share` format paths |
| Control character filtering | Blocks control characters in paths |
| System path protection | Blocks writing to system directories |
| Path traversal detection | Detects `../` path traversal |
| Symlink detection | Prevents symlink attacks |
| Parent directory check | Recursively checks parent directory symlinks |

## Resumable Downloads

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if result.Resumed {
    fmt.Println("Resumed download complete")
}
```

Resume mechanism:
1. Check local file size -> use as `Range` request offset
2. Server returns 206 (Partial Content) -> append write
3. Server returns 416 (Range Not Satisfiable) -> return error
4. Server returns 200 (Range not supported) -> return error (protect local partial file from being overwritten)

## See Also

- [File Upload and Download](../guides/file-transfer) - Usage guide
- [Package Functions](./functions) - Helper function reference
- [Domain Client](./domain-client) - Domain client download methods
