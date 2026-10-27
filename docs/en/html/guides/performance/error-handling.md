---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo html | Timeout, Encoding, Files"
description: "CyberGo html error handling: five categories, sentinels, errors.Is/As, traversal vs sandbox escapes, ProcessingTimeout vs deadlines, and HTTP mapping."
sidebar_position: 40
---

# Error Handling

Every html library failure is returned as an `error`; panics inside the library are recovered as `ErrInternalPanic`. This page covers error categories and matching, plus the rules for timeouts, encoding, and file paths.

## Error Categories

| Category | Sentinel errors | Source |
|----------|-----------------|--------|
| Input errors | `ErrInputTooLarge`, `ErrInvalidHTML`, `ErrBatchTooLarge` | The input itself |
| Config errors | `ErrInvalidConfig`, `ErrMultipleConfigs` | Config values or call pattern |
| File errors | `ErrFileNotFound`, `ErrInvalidFilePath` | File reads and path validation |
| Processing errors | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | Timeout budget, or depth exceeded due to input structure |
| System errors | `ErrProcessorClosed`, `ErrInternalPanic`, `ErrTooManyConcurrentOps` | Lifecycle, internal faults, concurrency cap |

The complete list of the 12 sentinel errors, their exact messages, and the field definitions of the three structured types are in [API Reference: Constants & Errors](../../api-reference/types/constants#sentinel-errors); this page covers only matching methods and handling strategies.

## Matching Errors: errors.Is and errors.As

`errors.Is` matches sentinel errors along the `Unwrap` chain; `errors.As` extracts a structured error so you can read its fields.

| Structured type | Fields | Use |
|-----------------|--------|-----|
| `*InputError` | `Op`, `Size`, `MaxSize`, `InputErr` | Input size and read failures |
| `*ConfigError` | `Field`, `Value`, `Message` | Locating an invalid config field |
| `*FileError` | `Op`, `Path`, `FileErr` | File operations; `SafePath()` returns the sanitized path |

Check order: system errors first (`ErrProcessorClosed`, `ErrInternalPanic`, `ErrTooManyConcurrentOps`), then file errors via `errors.As`, then input and config errors.

Path traversal errors **do match** `ErrInvalidFilePath` (see [Error Wrapping Chain](#error-wrapping-chain)). The only refusal that matches no sentinel is an `AllowedBaseDir` escape, also described in that section.

## Error Wrapping Chain

All three structured error types implement `Unwrap`, which decides whether `errors.Is` / `errors.As` can match:

| Type | `Unwrap()` return value | Result |
|------|-------------------------|--------|
| `*InputError` | `Unwrap() []error`: `[InputErr, ErrInputTooLarge]` when `InputErr` is non-nil, otherwise `[ErrInputTooLarge]` | `errors.Is(err, ErrInputTooLarge)` holds for any `*InputError` |
| `*ConfigError` | Always `ErrInvalidConfig` | Fixed mapping |
| `*FileError` | ① `FileErr` wraps `ErrFileNotFound` → `ErrFileNotFound`; ② otherwise `FileErr != nil` → `FileErr`; ③ otherwise → `ErrInvalidFilePath` | Three-level fallback |

:::warning The two file-path refusals have different sentinel status

**Path traversal** (the path contains a `..` component): `FileErr` looks like `path traversal detected: <cleanPath>: html: invalid file path`, wrapping `ErrInvalidFilePath` at the end. So `errors.Is(err, html.ErrInvalidFilePath)` returns `true`. To tell traversal from other path errors, still use `errors.As` to obtain `*FileError` and check for `path traversal` in the `FileErr` message.

**`AllowedBaseDir` escape** (the real path falls outside the allowed directory): `FileErr` is `path outside allowed directory`, which wraps no sentinel, so `errors.Is` returns `false` for both `ErrFileNotFound` and `ErrInvalidFilePath`. Only the `FileErr` message identifies this case.

:::

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// diagnose prints the sentinel errors an error matches and its structured fields.
func diagnose(err error) {
	var inputErr *html.InputError
	if errors.As(err, &inputErr) {
		fmt.Printf("InputError: op=%s size=%d max=%d\n", inputErr.Op, inputErr.Size, inputErr.MaxSize)
	}

	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Printf("FileError: op=%s safePath=%s\n", fileErr.Op, fileErr.SafePath())
		if fileErr.FileErr != nil && strings.Contains(fileErr.FileErr.Error(), "path traversal") {
			fmt.Println("Security event: path traversal")
		}
	}

	fmt.Printf("Is(ErrInputTooLarge)=%v Is(ErrFileNotFound)=%v Is(ErrInvalidFilePath)=%v\n",
		errors.Is(err, html.ErrInputTooLarge),
		errors.Is(err, html.ErrFileNotFound),
		errors.Is(err, html.ErrInvalidFilePath))
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Input too large: *InputError matches ErrInputTooLarge
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	diagnose(err)
	// Output:
	// InputError: op=Extract size=200 max=100
	// Is(ErrInputTooLarge)=true Is(ErrFileNotFound)=false Is(ErrInvalidFilePath)=false

	// Path traversal: *FileError's FileErr wraps ErrInvalidFilePath
	_, err = p.ExtractFromFile("../../../etc/passwd")
	diagnose(err)
	// Output:
	// FileError: op=ReadFile safePath=passwd
	// Security event: path traversal
	// Is(ErrInputTooLarge)=false Is(ErrFileNotFound)=false Is(ErrInvalidFilePath)=true
}
```

## Timeouts and Cancellation

Which error `ExtractWithContext` returns depends on which deadline fires first:

| Scenario | Returned error |
|----------|----------------|
| Library `ProcessingTimeout` fires while the user ctx is still live | `ErrProcessingTimeout` |
| User ctx deadline fires first (or at the same time as the library timeout) | `context.DeadlineExceeded`, passed through unchanged |
| Caller calls `cancel()` | `context.Canceled` |
| `ProcessingTimeout = 0` (no limit) and the user ctx expires | `context.DeadlineExceeded` (no derived timeout) |

When `ProcessingTimeout > 0`, the library derives a deadline via `context.WithTimeout(parentCtx, ProcessingTimeout)`, so the earlier of the two applies. The error is normalized to `ErrProcessingTimeout` only when the derived deadline fires and `ctx.Err() == nil`. User deadlines and `cancel()` pass through unchanged, so `errors.Is(err, html.ErrProcessingTimeout)` is `false` on a user timeout.

A timeout does not forcibly terminate processing: the library returns immediately and the extraction goroutine exits at its next cooperative checkpoint. A user `cancel()` yields `context.Canceled`, also not normalized.

The example configures a 30s library budget but passes an already-expired deadline, so the output is deterministic:

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig() // ProcessingTimeout = 30s
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	doc := []byte(`<html><body><article><h1>Title</h1><p>Body</p></article></body></html>`)

	// User deadline already expired: context.DeadlineExceeded, not normalized
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	_, err = p.ExtractWithContext(ctx, doc)
	fmt.Println(errors.Is(err, html.ErrProcessingTimeout)) // false
	fmt.Println(errors.Is(err, context.DeadlineExceeded))  // true
}
```

## Batch Errors

Batch calls return `*BatchResult` instead of `error`, with per-item failures stored in `Errors`:

| Case | Counters | `Errors[i]` |
|------|----------|-------------|
| One item fails (e.g. missing file) | That item counts in `Failed`; other items return normally | That item's error |
| Whole batch rejected (over 10000 items, or processor closed) | `Failed` equals the input count | The same error for every item |
| Context cancelled | Items not started count in `Cancelled`; completed results are kept | `ctx.Err()` |

The over-limit message is `html: batch size exceeds maximum: N exceeds maximum 10000`; match it with `errors.Is(err, html.ErrBatchTooLarge)`. See [Batch Processing](./batch-processing) for the APIs and concurrency tuning.

## Recovery Strategies

| Error | Recovery |
|-------|----------|
| `ErrProcessingTimeout` | Set `ExtractArticle = false` or switch to `TextOnlyConfig()`; raise `ProcessingTimeout` only after confirming the document is legitimate |
| `context.DeadlineExceeded` | The caller's budget is too small: widen `context.WithTimeout` or move processing off the request path |
| `context.Canceled` | The caller gave up; do not retry |
| `ErrInputTooLarge` | Reject at the entry point by `MaxInputSize`; the cap cannot be raised |
| `encoding detection failed` | The encoding is mislabelled for this source: use the real one |
| `ErrFileNotFound` | Return 404 or skip the item (in a batch, only that item fails) |
| `ErrInvalidFilePath` / path traversal | Reject and record an audit entry (traversal matches `ErrInvalidFilePath`) |
| `path outside allowed directory` | An `AllowedBaseDir` escape with no sentinel: reject on the `FileErr` message and record an audit entry |
| `ErrMaxDepthExceeded` | Triggered by input structure: reject, or trim the structure first |
| `ErrTooManyConcurrentOps` | 1000 process-wide timeout goroutines already active: reduce concurrency or retry later |
| `ErrProcessorClosed` / `ErrInvalidConfig` / `ErrMultipleConfigs` | Programming errors: fix the code, do not retry |
| `ErrInternalPanic` | File an issue with an input sample |

### Encoding: Set It per Source, Do Not Retry on Failure

`encoding detection failed` appears only when the declared or forced encoding conflicts with the actual bytes, in two cases:

- `Config.Encoding = "utf-8"` is forced (or the page declares utf-8) but the data is not valid UTF-8 → `encoding detection failed: declared charset "utf-8" but data is not valid UTF-8`
- An unsupported encoding name is forced and the data is not valid UTF-8 → `encoding detection failed: unsupported encoding "..."`

A GBK or Shift_JIS page without `<meta charset>` does not error: the library falls back to windows-1252, returns mojibake, and `err == nil` (full behavior in [Encoding Detection](../core-features/encoding-detection#undeclared-pages-decode-to-mojibake)). So "retry with another encoding after detection fails" never triggers. Set the encoding per source instead: the HTTP `Content-Type` header, a site allowlist, or a fixed `Config.Encoding` for known sources.

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func main() {
	// GBK-encoded HTML with no <meta charset> declaration
	utf8HTML := `<html><head><title>Test</title></head>` +
		`<body><article><h1>Title</h1><p>Hello World</p></article></body></html>`
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(utf8HTML))
	if err != nil {
		log.Fatal(err)
	}

	// 1. No declared encoding: no error, decoded as windows-1252 → mojibake
	_, err = html.Extract(gbkBytes)
	fmt.Printf("auto-detect: err = %v\n", err)
	// Output: auto-detect: err = <nil>

	// 2. Force utf-8 on GBK bytes: this is where encoding detection failed appears
	cfg := html.DefaultConfig()
	cfg.Encoding = "utf-8"
	_, err = html.Extract(gbkBytes, cfg)
	fmt.Println(err)
	// Output: encoding detection failed: declared charset "utf-8" but data is not valid UTF-8

	// 3. Set the real encoding for the source
	cfg.Encoding = "gbk"
	result, err := html.Extract(gbkBytes, cfg)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Title)
	// Output: Test
}
```

This error is a plain `fmt.Errorf` wrapper with no sentinel; match it by the `encoding detection failed` message prefix.

### Input Too Large: Limit at the Entry Point

`ErrInputTooLarge` means the input exceeds `Config.MaxInputSize`. The default 50MB is also the configurable maximum, so the limit can only be lowered, never raised. `InputError.Size` and `MaxSize` carry the actual size and the limit; return them to the caller as-is.

## FileError Path Sanitization

`FileError` truncates paths on output so error messages do not leak the server's directory layout:

| Layer | Method | Behavior |
|-------|--------|----------|
| Error message | `Error()` | Shows only the basename; the underlying message is sanitized too |
| Path truncation | `SafePath()` | `/var/data/secret/page.html` → `page.html` |
| Error cleaning | `sanitizeErrorMessage()` | Keeps the error type (path traversal / not found / permission denied), removes the path |
| JSON serialization | `MarshalJSON()` | Serializes as `{op, path, message}` with `path` from `SafePath()` |
| Internal debugging | `Path` field | Keeps the full path; never expose it |

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/cybergodev/html"
)

func main() {
	_, err := html.ExtractFromFile("/var/www/private/secret.html", html.DefaultConfig())
	if err != nil {
		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			fmt.Printf("Error(): %v\n", fileErr)
			// Output: Error(): html: ReadFile "secret.html": file not found

			fmt.Printf("SafePath(): %s\n", fileErr.SafePath())
			// Output: SafePath(): secret.html

			raw, _ := json.Marshal(fileErr)
			fmt.Printf("MarshalJSON(): %s\n", raw)
			// Output: MarshalJSON(): {"op":"ReadFile","path":"secret.html","message":"file not found"}
		}
	}
}
```

:::tip Client responses carry only SafePath

`json.Marshal(fileErr)` and encoding `fileErr` directly both go through `MarshalJSON()`, so the path is already truncated. The `Path` field keeps the full path for internal logs and auditing only.

:::

## Web Service Error Mapping

Map library errors to HTTP status codes so clients can tell retryable from terminal failures:

| Sentinel error | HTTP status | Notes |
|----------------|-------------|-------|
| `ErrInputTooLarge` | 413 Payload Too Large | Client should send less data |
| `ErrInvalidHTML` | 422 Unprocessable Entity | HTML could not be parsed |
| `ErrFileNotFound` | 404 Not Found | File does not exist |
| `ErrInvalidFilePath` | 400 Bad Request | Invalid path format, **including path traversal refusals** |
| `ErrMaxDepthExceeded` | 400 Bad Request | Input structure too deep |
| `ErrProcessingTimeout` | 504 Gateway Timeout | Processing timed out; retry later |
| `ErrProcessorClosed` | 500 Internal Server Error | Programming error (lifecycle) |
| `ErrInvalidConfig` | 500 Internal Server Error | Programming error (validate config at startup) |
| `ErrInternalPanic` | 500 Internal Server Error | Internal bug; report it |
| `ErrMultipleConfigs` | 500 Internal Server Error | Programming error (more than one Config) |
| `ErrTooManyConcurrentOps` | 503 Service Unavailable | Process-wide concurrency full; retry later |

An `AllowedBaseDir` escape (`path outside allowed directory`) has no sentinel, so the mapping table cannot catch it; after `errors.As` yields a `*FileError`, classify it as 400 by its message.

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/html"
)

// errorToHTTPStatus maps html library errors to HTTP status codes.
func errorToHTTPStatus(err error) int {
	switch {
	case errors.Is(err, html.ErrInputTooLarge):
		return http.StatusRequestEntityTooLarge
	case errors.Is(err, html.ErrInvalidHTML):
		return http.StatusUnprocessableEntity
	case errors.Is(err, html.ErrFileNotFound):
		return http.StatusNotFound
	case errors.Is(err, html.ErrInvalidFilePath), errors.Is(err, html.ErrMaxDepthExceeded):
		return http.StatusBadRequest
	case errors.Is(err, html.ErrProcessingTimeout):
		return http.StatusGatewayTimeout
	case errors.Is(err, html.ErrTooManyConcurrentOps):
		return http.StatusServiceUnavailable
	default:
		// ErrProcessorClosed, ErrInvalidConfig, ErrMultipleConfigs, ErrInternalPanic
		return http.StatusInternalServerError
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 10
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	cases := []struct {
		name string
		err  error
	}{
		{"input too large", func() error { _, e := p.Extract(make([]byte, 100)); return e }()},
		{"file not found", func() error { _, e := p.ExtractFromFile("missing.html"); return e }()},
		{"path traversal", func() error { _, e := p.ExtractFromFile("../../../etc/passwd"); return e }()},
		{"concurrency full", html.ErrTooManyConcurrentOps},
	}

	for _, c := range cases {
		fmt.Printf("%s → HTTP %d\n", c.name, errorToHTTPStatus(c.err))
	}
	// Output:
	// input too large → HTTP 413
	// file not found → HTTP 404
	// path traversal → HTTP 400
	// concurrency full → HTTP 503
}
```

## Structured Logging

Log fields rather than concatenated strings so you can query by `size`, `max_size`, and `path`:

```go
package main

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/cybergodev/html"
)

// logExtractionError extracts structured fields by error type and writes them via slog.
func logExtractionError(err error) {
	var inputErr *html.InputError
	var fileErr *html.FileError

	switch {
	case errors.As(err, &inputErr):
		slog.Warn("extraction failed: input error",
			"op", inputErr.Op, "size", inputErr.Size, "max_size", inputErr.MaxSize)

	case errors.As(err, &fileErr):
		attrs := []any{"op", fileErr.Op, "path", fileErr.SafePath()}
		if fileErr.FileErr != nil {
			attrs = append(attrs, "cause", fileErr.FileErr.Error())
			if strings.Contains(fileErr.FileErr.Error(), "path traversal") {
				attrs = append(attrs, "security_event", "path_traversal")
			}
		}
		slog.Warn("extraction failed: file error", attrs...)

	case errors.Is(err, html.ErrProcessingTimeout):
		slog.Warn("extraction failed: processing timeout")

	case errors.Is(err, html.ErrInternalPanic):
		slog.Error("extraction failed: internal panic, please report",
			"err", err, "issue", "https://github.com/cybergodev/html/issues")

	default:
		slog.Error("extraction failed: other error", "err", err)
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		slog.Error("failed to create processor", "err", err)
		return
	}
	defer p.Close()

	if _, err := p.Extract([]byte(strings.Repeat("x", 200))); err != nil {
		logExtractionError(err) // size=200, max_size=100
	}
	if _, err := p.ExtractFromFile("../../../etc/passwd"); err != nil {
		logExtractionError(err) // security_event=path_traversal
	}
}
```

Always log `FileError` with `SafePath()` rather than `Path`, otherwise the log file itself becomes a path leak. Config errors are caught by `New()` validation at startup, so they need no log branch.

## Next Steps

- [Batch Processing](./batch-processing) - Batch errors and concurrency control
- [Production Checklist](../security/production-checklist) - Pre-deployment security checks
- [API Reference: Constants & Errors](../../api-reference/types/constants) - Complete list of sentinel errors
- [API Reference: Processor](../../api-reference/core/processor) - Processor lifecycle and stats
