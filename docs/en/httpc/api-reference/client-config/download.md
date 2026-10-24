---
sidebar_label: "File Download"
title: "File Download - CyberGo HTTPC | Download & Verification"
description: "HTTPC file download API: Download, DownloadConfig, progress callbacks, DownloadResult, SHA-256 checksum verification, and multi-layer path security."
sidebar_position: 40
---

# File Download

`Download` is HTTPC's file-download entry, shared by the package-level function, the `Client` method, and the `DomainClient` method. This page documents `DownloadConfig`, resumable transfers, checksums, and path-safety rules.

## Package-Level Download Function

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Downloads a file using the default client. The package-level function, the `Client` interface, and `DomainClient` share a single signature, which makes `Download` the **single canonical download entry point**. `cfg` must not be nil, and `cfg.FilePath` must be set (otherwise `ErrEmptyFilePath` is returned).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
```

The `Download` signature is identical on the `Client` interface and on `DomainClient`; all three entry points behave the same.

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

### Field Details

| Field | Type | Default | Description |
|------|------|--------|------|
| `DownloadConfig.FilePath` | `string` | — | File save path (**required**, cannot be empty) |
| `DownloadConfig.ProgressCallback` | `DownloadProgressCallback` | `nil` | Progress callback; nil disables progress reporting |
| `DownloadConfig.Overwrite` | `bool` | `false` | Whether to overwrite an existing file; returns `ErrFileExists` when `false` and the file exists |
| `DownloadConfig.ResumeDownload` | `bool` | `false` | Whether to enable resumable download; `true` reuses an existing partial file |
| `DownloadConfig.Checksum` | `string` | `""` | Expected hex-encoded checksum; when set, verified automatically on completion |
| `DownloadConfig.ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | Checksum algorithm (currently only SHA-256 is supported) |

:::tip Priority of Overwrite and ResumeDownload
When the file exists and both are true, `ResumeDownload` takes priority: the existing file is **appended to** rather than replaced. When the file does not exist, both behave the same (a normal download).
:::

### DefaultDownloadConfig

```go
func DefaultDownloadConfig() *DownloadConfig
```

Returns the default download config: `Overwrite` and `ResumeDownload` both false, `ChecksumAlgorithm` set to `ChecksumSHA256`. The caller must set `FilePath` before use; the remaining fields are set as needed.

## DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| Parameter | Type | Description |
|------|------|------|
| `downloaded` | `int64` | Bytes downloaded (including the resume offset) |
| `total` | `int64` | Total bytes (`-1` means unknown, no Content-Length) |
| `speed` | `float64` | Current speed (bytes/second) |

### Progress Callback Mechanism

The progress callback is implemented by wrapping `io.Writer` with a `progressWriter`, which checks on every `Write` whether the throttle interval has elapsed.

| Feature | Description |
|------|------|
| Throttle interval | 200ms (`progressInterval`), limiting callback frequency |
| Resume offset adjustment | `downloaded = offset + written`; during resume, reports the total downloaded, not this session's delta |
| Total adjustment | During resume, `total = contentLength + offset`, restoring the full file size |
| Final callback | Fires one extra callback after the download completes, reporting the final stats |

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

### Field Details

| Field | Type | Description |
|------|------|------|
| `DownloadResult.FilePath` | `string` | The **absolute path** where the file was actually saved (the path after `prepareFilePath` validation) |
| `DownloadResult.BytesWritten` | `int64` | Bytes written this session (during resume, the appended amount, not the total file size) |
| `DownloadResult.Duration` | `time.Duration` | Download duration (from start of writing to file close) |
| `DownloadResult.AverageSpeed` | `float64` | Average speed (bytes/second, = BytesWritten / Duration) |
| `DownloadResult.StatusCode` | `int` | HTTP status code (200 or 206) |
| `DownloadResult.ContentLength` | `int64` | Content-Length reported by the server (during resume, the remaining-part length) |
| `DownloadResult.Resumed` | `bool` | Whether completed via resume (Range requested and 206 received) |
| `DownloadResult.ResponseCookies` | `[]*http.Cookie` | Response cookies |
| `DownloadResult.ActualChecksum` | `string` | Actually computed checksum (filled only when `Checksum` is set) |
| `DownloadResult.Proto` | `string` | HTTP protocol version (e.g. `"HTTP/1.1"`, `"HTTP/2.0"`) |
| `DownloadResult.ResponseHeaders` | `http.Header` | Response headers |
| `DownloadResult.RequestURL` | `string` | Actual request URL |
| `DownloadResult.RequestMethod` | `string` | Request HTTP method (always `"GET"`) |
| `DownloadResult.RequestHeaders` | `http.Header` | Request headers actually sent |

```go
fmt.Printf("download complete: %s, duration %v, average speed %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

:::tip
Use [FormatBytes](../core/functions#formatbytes) and [FormatSpeed](../core/functions#formatspeed) for human-readable byte and speed strings, without manual `1024`-step unit conversion.
:::

## Checksum Verification

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

Algorithm for verifying downloaded-file integrity.

| Constant | Value | Description |
|------|-----|------|
| `ChecksumSHA256` | `"sha256"` | SHA-256 hash algorithm |

### SHA-256 Streaming Verification Flow

Once `Checksum` is set, the hash is computed **while data is written** during the download, avoiding a second full-file read after completion:

```text
Verification flow:

  ① hasher = sha256.New()
  ② writer = io.MultiWriter(file, hasher)
     |
     network stream -> file (written to disk)
                    -> hasher (updates hash state)
     |
  ③ After download: actualChecksum = hex(hasher.Sum(nil))
  ④ Compare: actualChecksum == strings.ToLower(cfg.Checksum)?
     |- match    -> return DownloadResult (with ActualChecksum)
     +- mismatch -> delete file + return checksum error
```

| Step | Description |
|------|------|
| MultiWriter | `io.MultiWriter(file, hasher)` writes data to the file and the hasher simultaneously, with no extra memory |
| Algorithm pre-check | Validates the algorithm name **before** touching the target file, so a config mistake cannot truncate an existing file |
| Failure cleanup | When writing, Sync, close, or verification fails, the downloaded file is **automatically deleted** (in non-resume mode), avoiding leftover corrupt files; resume mode keeps the existing bytes for the next attempt |
| Case-insensitive | The expected value is auto-`ToLower`'d; the actual value is lowercase hex, so case does not affect comparison |

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    // On checksum mismatch, an error is returned automatically and the downloaded file is deleted
    log.Fatal(err)
}
fmt.Println("checksum:", result.ActualChecksum)
```

## Resumable Download Mechanism

### ResumeDownload Workflow

```text
prepareResumeState(filePath, opts, options):

  ① prepareFilePath(filePath) -> validate path safety -> validatedPath
  ② os.Stat(validatedPath)
     |- file does not exist -> resumeOffset = 0, normal download
     |- is a directory      -> return error
     |- file exists + Overwrite=false + Resume=false -> ErrFileExists
     |- file exists + Resume=true -> resumeOffset = fileInfo.Size()
     |     -> append WithHeader("Range", "bytes={offset}-") to options
     +- file exists + Overwrite=true (not Resume) -> resumeOffset = 0, overwrite download
```

### Server-Response Handling

| Server returns | Handling |
|-----------|------|
| `206 Partial Content` | Resume succeeded: `O_APPEND` append-mode write, `Resumed = true` |
| `200 OK` (Range not supported) | **Return error**: the server ignored the Range request. Writing on would overwrite the existing partial file from scratch, so an error is returned and the partial data is kept intact (no truncation). The response body is drained, then the error is returned |
| `416 Range Not Satisfiable` | **Return error**: the requested offset exceeds the file size. The response body is drained, then the error is returned |
| Other status codes (4xx/5xx) | Return error, with a preview of the first 200 characters of the response body |

:::warning Why error on 200
When `ResumeDownload=true` but the server returns 200 (instead of 206), the server does not support Range requests. Continuing the download would overwrite the existing partial file from scratch, **silently discarding the data the user intended to resume**. HTTPC therefore returns an error rather than truncating, protecting the local partial file. To force an overwrite, set `Overwrite=true` + `ResumeDownload=false`.
:::

The response-body drain on error paths is capped at **1 MiB** (`maxDrainBodySize`). Draining exists so the connection can be reused; bytes beyond the cap are not read, and the connection is dropped from reuse, avoiding time and memory spent on oversized error bodies.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    log.Fatal(err)
}
if result.Resumed {
    fmt.Printf("resume complete, appended %s this session\n", httpc.FormatBytes(result.BytesWritten))
}
```

## Streaming Download Principle

File download uses streaming mode (`WithStreamBody(true)`) and does not buffer the entire response body in memory:

```text
Streaming download data path:

  server response
    |
  engine.Response.RawBodyReader()  <- network reader (io.ReadCloser)
    |
  io.Copy(writer, bodyReader)      <- direct streaming write, zero full buffering
    |
  writer = progressWriter(MultiWriter(file, hasher))
    |
  disk file
```

| Feature | Description |
|------|------|
| Zero memory buffering | Data flows from network directly to disk, without passing through a full memory buffer |
| Streaming hash | Checksum computation happens in sync with writing, no second read needed |
| Auto-release | The response-body reader is closed via `defer`; the engine response is returned to the object pool via `defer` |

:::warning Downloads are bounded by MaxResponseBodySize
Streaming to disk only removes the full-body memory buffer; it is **not an exemption from size limits**. The download body is still subject to the client's `Security.MaxResponseBodySize`: 10MB by default with `DefaultConfig`; the other presets use `SecureConfig` 5MB, `PerformanceConfig` 50MB, and `MinimalConfig` 1MB.

A body over the limit fails the download with `ErrResponseBodyTooLarge` rather than being silently truncated at the limit. Raise the value before downloading large files:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 200 << 20 // 200MB, adjust as needed
```

:::

:::warning Middleware compatibility
Download needs direct access to `*engine.Response`'s `RawBodyReader()`. If middleware **wraps** the `ResponseMutator` with a custom type (rather than mutating the engine response in place), the download returns an error: `download is not compatible with middleware that wraps ResponseMutator`. All built-in middleware mutates in place and does not trigger this error.
:::

## File Path Security Protection

`prepareFilePath` implements multiple layers of security to prevent malicious paths from writing to sensitive system locations. Each layer intercepts the path before it reaches the filesystem.

### Protection-Layer Overview

| Layer | Protection | What it intercepts |
|------|------|----------|
| 1 | Length check | Empty paths / over 4096 characters |
| 2 | UNC path blocking | `\\server\share` or `//server/share` network paths |
| 3 | Control-character filtering | ASCII < 0x20, 0x7F (DEL), 0x00 (NUL) |
| 4 | System-path protection | Writes to OS-protected directories (see table below) |
| 5 | Path-traversal detection | `../` escaping the working directory |
| 6 | Symlink defense | The file itself + recursive parent-directory symlink checks |

### Layer 2: UNC Path Blocking

```text
Blocked formats:
  \\server\share\file     <- Windows UNC path
  //server/share/file     <- POSIX double-slash network path

Reason: UNC paths can access network resources and may be exploited for SSRF or SMB relay attacks
```

### Layer 3: Control-Character Filtering

Every byte in the path is checked: ASCII control characters (0x00-0x1F), DEL (0x7F), and NUL bytes are rejected. This check prevents terminal-escape-sequence injection and CRLF path-confusion attacks.

### Layer 4: System-Path Protection

Writes to protected system directories are blocked per operating system:

| OS | Protected paths |
|----|-----------|
| **Windows** | `C:\Windows\`, `C:\System32\`, `C:\Program Files\`, `C:\ProgramData\`, `C:\Program Files (x86)\` + env-var expansion: `${SystemRoot}`, `${windir}`, `${ProgramFiles}`, etc. |
| **macOS** | `/system/`, `/library/`, `/applications/`, `/usr/`, `/bin/`, `/sbin/`, `/etc/`, `/var/` |
| **Linux** | `/etc/`, `/sys/`, `/proc/`, `/dev/`, `/boot/`, `/root/`, `/usr/bin/`, `/usr/sbin/`, `/bin/`, `/sbin/`, `/lib/`, `/run/`, etc. |

Path matching uses prefix checks (with a trailing separator) to prevent prefix collisions (e.g. `C:\Windows` will not incorrectly match `C:\WindowsEvil`). Windows env-var patterns are expanded dynamically at check time, catching system directories installed on non-C drives.

### Layer 5: Path-Traversal Detection

```text
Working-directory boundary check:

  filePath = "../../etc/passwd"
  cleanPath = filepath.Clean -> "../../etc/passwd"
  absPath = filepath.Abs -> "/home/user/../../etc/passwd" -> "/etc/passwd"

  Check: is absPath inside the working directory?
  Result: no -> "path traversal detected: path outside working directory"
```

The check fires when the cleaned path (`filepath.Clean`) starts with `..`. Only **relative paths** are checked; absolute paths are not constrained to the working directory (but are still subject to system-path protection).

### Layer 6: Symlink Defense

| Check | Description |
|------|------|
| The file itself | `os.Lstat` checks whether the target file is a symlink; an attacker can create a symlink pointing to a sensitive file |
| Parent-directory recursion | `checkParentDirSymlinks` recursively checks all parent directories (up to 32 levels), preventing TOCTOU attacks (a directory replaced by a symlink after the check) |
| Resolved system path | If a parent-directory symlink resolves to a system directory, it is also rejected |

```go
// Each protection layer blocks these attack scenarios:
cfg.FilePath = "\\malicious-server\share\payload"  // UNC blocked
cfg.FilePath = "/etc/passwd"                        // system-path protection
cfg.FilePath = "../../../etc/shadow"                // path-traversal detection
cfg.FilePath = "/tmp/safe/../../../etc/passwd"      // Clean + traversal + system path
```

:::tip Directories and permissions
After the safety checks pass, `prepareFilePath` creates any missing parent directories (mode 0755). New files are created with mode 0644; resume mode opens the existing file in append mode and keeps its original permissions.
:::

## Complete Example: Production-Grade Download

The example below shows a complete download flow with progress callback, SHA-256 checksum, and resumable download.

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
		// Throttle control: the progress callback fires every 200ms; filter once more here
		if time.Since(lastUpdate) < time.Second {
			return
		}
		lastUpdate = time.Now()

		if total > 0 {
			pct := float64(downloaded) / float64(total) * 100
			fmt.Printf("progress: %s / %s (%.1f%%) speed: %s/s\n",
				httpc.FormatBytes(downloaded),
				httpc.FormatBytes(total),
				pct,
				httpc.FormatSpeed(speed))
		} else {
			fmt.Printf("downloaded: %s  speed: %s/s\n",
				httpc.FormatBytes(downloaded),
				httpc.FormatSpeed(speed))
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	result, err := httpc.Download(ctx,
		"https://example.com/files/large-archive.zip", cfg)
	if err != nil {
		log.Fatalf("download failed: %v", err)
	}

	fmt.Println("download complete")
	fmt.Printf("  file path: %s\n", result.FilePath)
	fmt.Printf("  written:   %s\n", httpc.FormatBytes(result.BytesWritten))
	fmt.Printf("  duration:  %v\n", result.Duration)
	fmt.Printf("  avg speed: %s/s\n", httpc.FormatSpeed(result.AverageSpeed))
	fmt.Printf("  status:    %d\n", result.StatusCode)
	fmt.Printf("  resumed:   %v\n", result.Resumed)
	fmt.Printf("  checksum:  %s\n", result.ActualChecksum)
	// Sample output:
	// progress: 5.2 MB / 52.4 MB (9.9%) speed: 12.3 MB/s
	// progress: 26.1 MB / 52.4 MB (49.8%) speed: 11.8 MB/s
	// progress: 52.4 MB / 52.4 MB (100.0%) speed: 12.1 MB/s
	// download complete
	//   file path: /tmp/large-archive.zip
	//   written:   52.4 MB
	//   duration:  4.331s
	//   avg speed: 12.1 MB/s
	//   status:    200
	//   resumed:   false
	//   checksum:  abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
}
```

## See Also

- [File Upload and Download](../../guides/file-transfer) - Usage guide
- [Package Functions](../core/functions) - `FormatBytes`/`FormatSpeed` helper-function reference
- [Domain Client](./domain-client) - Domain-client download method
