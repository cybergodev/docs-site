---
sidebar_label: "File Upload & Download"
title: "File Upload and Download - CyberGo HTTPC | Upload/Download"
description: "HTTPC file guide: WithFile and WithFormData uploads, streaming Download with progress callbacks, ResumeDownload, SHA-256 checksums, and UNC-path blocking."
sidebar_position: 6
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

`FileData` also exposes a `ContentType` field for explicitly declaring each file's MIME type (when unset, the part defaults to `application/octet-stream`):

```go
Files: map[string]*httpc.FileData{
    "file": {
        Filename:    "document.pdf",
        Content:     fileContent,
        ContentType: "application/pdf", // explicit MIME type
    },
},
```

### Multi-File Upload

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "batch upload",
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

### Streaming Upload (Large Files)

`WithBody` accepts an `io.Reader` directly, so the whole file never has to be read into memory. Content-Type is not auto-detected for Reader bodies — set it explicitly:

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

Combine with `io.Pipe` for zero-copy streaming uploads — a producer goroutine sends data as it generates it, while the HTTP transport consumes concurrently:

```go
pr, pw := io.Pipe()
go func() {
    defer pw.Close()
    // write chunks to pw, e.g. produced from a database or generator
    _, _ = pw.Write(chunk)
}()

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithBody(pr),
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```

:::warning Reader bodies bypass size validation
An `io.Reader` has no way to know its length in advance, so HTTPC **does not size-validate** it. Wrap untrusted data with `io.LimitReader`, or set a global cap via `Security.MaxRequestBodySize`:

```go
result, err := httpc.Post(url,
    httpc.WithBody(io.LimitReader(reader, 10<<20)), // cap at 10MB
    httpc.WithHeader("Content-Type", "application/octet-stream"),
)
```
:::

## File Download

`Download(ctx, url, cfg, options...)` is the single canonical download entry point shared across the package-level function, `Client`, and `DomainClient`.

Downloads **always stream**: `WithStreamBody(true)` is attached automatically, the response body flows from the network straight to disk (`io.Copy`), and the file is never buffered whole in memory; when a checksum is enabled, the hash is computed on the fly during writing — no second pass over the file.

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

:::tip How progress callbacks fire
The callback signature is `(bytes downloaded, total bytes, current speed)`, and the cadence is guaranteed by the implementation:

- **Minimum 200ms interval**: on fast networks, high-frequency callbacks never slow down disk writes; on slow networks, refreshes stay steady.
- **One final callback at the end**: at that point `downloaded` equals the total byte count and `speed` is the average speed — handy for CLI newline cleanup.
- **Where `total` comes from**: the `Content-Length` returned by the server; on resumed downloads the server reports only the remaining bytes for a Range request, and HTTPC automatically adds the existing file offset to obtain the full size.
- **`total` may be 0 or negative**: when the server omits Content-Length (chunked transfer), the total is unknown — check `total > 0` in the callback before computing percentages.
:::

### With Authentication and Custom Headers

The variadic arguments of `Download` are ordinary `RequestOption`s, so auth headers, query parameters, and per-request timeouts can all be attached directly:

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"
cfg.Overwrite = true

result, err := client.Download(context.Background(),
    "https://api.example.com/files/report.pdf",
    cfg,
    httpc.WithBearerToken("my-token"),                  // auth
    httpc.WithHeader("Accept", "application/pdf"),      // custom header
    httpc.WithTimeout(5*time.Minute),                   // per-download timeout budget
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

The complete resume decision logic:

| Server response | Behavior |
|-----------------|----------|
| `206 Partial Content` | Appends to the existing file with `O_APPEND`; `result.Resumed` is `true` |
| `200 OK` (Range unsupported) | Returns the error `server does not support range requests`; the existing partial file is **not truncated** |
| `416 Range Not Satisfiable` | Returns an error (typically because the local file is already complete, or the server-side resource shrank) |
| Any other non-2xx status | Returns an `unexpected status code` error whose message includes a preview of the first 200 bytes of the response body |

:::warning When Overwrite and ResumeDownload are both true
`ResumeDownload` wins — the existing file is **extended by appending** rather than replaced. Additionally, on a mid-write failure in resume mode, the bytes already on disk are kept (for the next resume attempt); in non-resume mode a failure deletes the half-written file so no corrupt artifact is left behind.
:::

### Checksum Verification (SHA-256)

Once `Checksum` is set, HTTPC computes SHA-256 over the data as it streams to disk and compares it against the expected value when the download finishes:

- the comparison is **case-insensitive** (the expected value is normalized to lowercase internally);
- **mismatch → the downloaded file is deleted and an error returned** — no tainted artifact is left behind;
- on success, `result.ActualChecksum` carries the actually computed hash, ready for logging;
- algorithm validity is checked **before the target file is opened** — a misconfiguration (such as an unknown `ChecksumAlgorithm`) never truncates an existing file on disk.

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

	// Local mock server returning fixed content; in production the expected
	// value should come from a trusted channel such as a release manifest.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(payload)
	}))
	defer server.Close()

	sum := sha256.Sum256(payload)
	expected := hex.EncodeToString(sum[:])

	cfg := httpc.DefaultConfig()
	cfg.Security.AllowPrivateIPs = true // allow connecting to the 127.0.0.1 local server
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	dlCfg := httpc.DefaultDownloadConfig()
	dlCfg.FilePath = "checksum-demo.txt"
	dlCfg.Overwrite = true
	dlCfg.Checksum = expected // expected SHA-256 (hex encoded)
	dlCfg.ChecksumAlgorithm = httpc.ChecksumSHA256

	result, err := client.Download(context.Background(), server.URL, dlCfg)
	if err != nil {
		log.Fatal(err) // verification failed: the file has been deleted; the error includes expected and actual values
	}
	fmt.Printf("Checksum verified: %s\n", result.ActualChecksum) // Output: Checksum verified: 2f2b7c... (SHA-256 of payload)
}
```

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

### File Conflict and Cleanup Semantics

A summary of how downloads treat the target file (pair with the `ErrFileExists` and `ErrEmptyFilePath` sentinel errors via `errors.Is`):

| Scenario | Behavior |
|----------|----------|
| Target file exists, both `Overwrite`/`ResumeDownload` false | Returns `ErrFileExists`; file untouched |
| Target path is a directory | Returns an error |
| `Overwrite = true` (non-resume) | Overwrites via `O_TRUNC` |
| `ResumeDownload = true` and the server supports Range | Appends via `O_APPEND` |
| Write/flush (sync/close) failure | Non-resume: the partial file is deleted; resume: existing bytes are kept |
| Checksum mismatch | The downloaded file is deleted |
| Requested algorithm unsupported (SHA-256 only) | Error returned **before** the file is opened; existing files are never truncated |
| Target directory missing | Created recursively (mode 0755); file mode 0644 |
| Empty path | Returns `ErrEmptyFilePath` |

On error status codes (anything other than 200/206), the error message includes a preview of the first 200 bytes of the response body for troubleshooting; up to 1MiB of the body is also drained so the connection can return to the pool for reuse.

### Download vs SaveToFile

`Result.SaveToFile(path)` writes a response body that is **already in memory** to disk; `Download` streams to disk from start to finish:

| Method | Best for | Notes |
|--------|----------|-------|
| `result.SaveToFile(path)` | Small-to-medium bodies (already in memory) | The path goes through the same safety checks as Download; an empty body returns `ErrResponseBodyEmpty` |
| `client.Download(ctx, url, cfg)` | Large files | Streaming writes with progress/resume/checksum support; memory use is independent of file size |

```go
// Response body already in memory: write it straight to disk
result, err := client.Get("https://example.com/small.json")
if err != nil {
    log.Fatal(err)
}
if err := result.SaveToFile("/tmp/small.json"); err != nil {
    log.Fatal(err)
}
```

### DownloadResult Fields

Besides the usual byte count and duration, the `DownloadResult` returned by `Download` carries complete request/response metadata:

| Field | Type | Description |
|-------|------|-------------|
| `FilePath` | `string` | Validated absolute save path |
| `BytesWritten` | `int64` | Bytes written to disk this run (**excludes** the pre-existing offset on a resumed download) |
| `Duration` | `time.Duration` | Total download duration |
| `AverageSpeed` | `float64` | Average speed (bytes per second) |
| `StatusCode` | `int` | Response status code (200 or 206) |
| `ContentLength` | `int64` | Content-Length reported by the server (remaining bytes on a resumed download) |
| `Resumed` | `bool` | Whether this run was a resumed download |
| `ResponseCookies` | `[]*http.Cookie` | Cookies returned in the response (`DomainClient` captures them into the session automatically) |
| `ActualChecksum` | `string` | Actually computed checksum (non-empty only when `Checksum` is set) |
| `Proto` | `string` | Protocol version (e.g. `HTTP/2.0`) |
| `ResponseHeaders` | `http.Header` | Response headers |
| `RequestURL` / `RequestMethod` | `string` | The URL and method actually requested |
| `RequestHeaders` | `http.Header` | The request headers actually sent |

## Security Protection

File downloads include multiple layers of built-in security, all applied **before the target file is opened**:

| Protection layer | Details |
|------------------|---------|
| Path validation | Blocks UNC paths (`\\server\share`, `//server`), control characters, and path traversal (rejected if the `Clean`ed path starts with `..` and escapes the working directory) |
| Length limit | Paths are capped at 4096 characters; longer paths are rejected outright |
| System path protection | Writing to system directories is forbidden: on Windows this covers `C:\Windows\`, `C:\Program Files\`, and `%SystemRoot%`-style environment-variable expansions; on Linux/macOS it covers `/etc/`, `/usr/`, `/bin/`, `/System/`, `/Library/`, and more |
| Symlink detection | Rejected if the target itself is a symlink, or if any parent directory resolves into a system directory (TOCTOU protection, checked recursively up to 32 levels) |
| File size limit | Subject to the `MaxResponseBodySize` limit |

:::tip Directories are validated too
Automatic parent-directory creation (`MkdirAll`) happens **after** path validation, so no directory level in `FilePath` can bypass protection via a system path or a symlink. `Result.SaveToFile` reuses the same checks.
:::

## Domain Client Downloads

Domain client downloads automatically capture response cookies into the session:

```go
dc, err := httpc.NewDomainDefault("https://api.example.com")
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

:::warning Two caveats for domain clients
- **Request options execute twice** (once to capture session state, once for the real request). Avoid passing options with side effects (counters, random-nonce generators, etc.); when you truly need them, download directly with the underlying `Client`.
- **Download is incompatible with custom middleware that wraps the response object**: the download path needs direct access to the raw response stream — if custom middleware replaces the `ResponseMutator` with a wrapper type, `Download` returns an explicit error. Built-in middleware (Recovery/Logging/Metrics, etc.) all pass through and are unaffected.
:::

## Next Steps

- [File Download API](../api-reference/client-config/download) - Complete download API reference
- [Domain Client and Sessions](./domain-session) - Session management
- [Request and Response](./request-response) - Basic request guide
- [Performance](./performance) - Performance presets and tuning for large downloads
- [Testing Guide](./testing) - Testing download logic with httptest
