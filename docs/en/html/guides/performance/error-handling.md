---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo html | Robust Error Guide"
description: "CyberGo html error handling: five categories (input, config, file, processing, system), errors.Is/As, context timeouts, batch partial failures, panic recovery."
sidebar_position: 40
---

# Error Handling

## Error Categories

HTML library errors fall into the following categories:

| Category | Sentinel Errors | Description |
|----------|----------------|-------------|
| Input errors | `ErrInputTooLarge`, `ErrInvalidHTML`, `ErrBatchTooLarge` | Input content issues |
| Config errors | `ErrInvalidConfig`, `ErrMultipleConfigs` | Configuration issues |
| File errors | `ErrFileNotFound`, `ErrInvalidFilePath` | File operation issues |
| Processing errors | `ErrProcessingTimeout`, `ErrMaxDepthExceeded` | Processing issues |
| System errors | `ErrProcessorClosed`, `ErrInternalPanic`, `ErrTooManyConcurrentOps` | Internal state issues |

## errors.Is Pattern

Use `errors.Is` to match error types:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        slog.Warn("Input too large, please reduce document size")
    case errors.Is(err, html.ErrInvalidHTML):
        slog.Warn("Invalid HTML, please check input")
    case errors.Is(err, html.ErrProcessingTimeout):
        slog.Warn("Processing timeout, document may be too complex")
    case errors.Is(err, html.ErrFileNotFound):
        slog.Warn("File not found")
    case errors.Is(err, html.ErrMaxDepthExceeded):
        slog.Warn("DOM depth too deep, possibly maliciously crafted")
    case errors.Is(err, html.ErrInternalPanic):
        slog.Error("Internal panic recovered, please report this issue")
    default:
        slog.Error("Unknown error", "err", err)
    }
}
```

## errors.As Pattern

Extract structured error information:

```go
var inputErr *html.InputError
var configErr *html.ConfigError
var fileErr *html.FileError

if errors.As(err, &inputErr) {
    fmt.Printf("Size %d exceeds limit %d\n", inputErr.Size, inputErr.MaxSize)
}

if errors.As(err, &configErr) {
    fmt.Printf("Field %s value %v invalid: %s\n", configErr.Field, configErr.Value, configErr.Message)
}

if errors.As(err, &fileErr) {
    fmt.Printf("File operation: %s\n", fileErr.SafePath())
}
```

## Context Cancellation

Use `ExtractWithContext` variants for cancellation support:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrProcessingTimeout):
        // Library ProcessingTimeout fired (ctx.Err() may still be nil here)
    case ctx.Err() == context.DeadlineExceeded:
        // User context deadline exceeded
    case ctx.Err() == context.Canceled:
        // Manual cancellation
    default:
        // Other errors (ErrInvalidHTML, ErrInputTooLarge, etc.)
        slog.Error("extraction failed", "err", err)
    }
}
```

## Batch Errors

Batch processing results include partial successes and failures:

```go
batch := p.ExtractBatch(pages)

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("Item %d failed: %v\n", i, err)
    }
}

fmt.Printf("Success: %d, Failed: %d, Cancelled: %d\n",
    batch.Success, batch.Failed, batch.Cancelled)
```

## Error Recovery Strategies

In real-world applications, simply identifying the error type is not enough — you need different recovery strategies based on the error category.

### Encoding Detection Failure

When HTML input lacks a `<meta charset>` declaration and auto-detection cannot determine the encoding, the library returns an error message prefixed with `"encoding detection failed"`. This is a plain `fmt.Errorf` wrapped error (not a sentinel error, not a typed error) and can only be detected by matching the error message string.

Recovery strategy: try auto-detection first (leave `Config.Encoding` empty), then retry with a manually specified known encoding on failure.

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
	"golang.org/x/text/encoding/simplifiedchinese"
)

// extractWithEncodingFallback tries auto-detection first, then retries with a manual encoding on detection failure.
func extractWithEncodingFallback(data []byte, fallbackEncoding string) (*html.Result, error) {
	// First attempt: auto-detect encoding (leave Config.Encoding empty)
	result, err := html.Extract(data)
	if err == nil {
		return result, nil
	}

	// On encoding detection failure, retry with the manually specified encoding
	if strings.Contains(err.Error(), "encoding detection failed") {
		fmt.Printf("Auto-detection failed (%v), retrying with encoding %q...\n", err, fallbackEncoding)
		cfg := html.DefaultConfig()
		cfg.Encoding = fallbackEncoding
		return html.Extract(data, cfg)
	}

	// Other errors (input too large, invalid HTML, etc.) are not retried
	return nil, err
}

func main() {
	// Build GBK-encoded HTML (no charset meta, may trigger auto-detection failure)
	utf8HTML := `<html><head><title>Test</title></head>` +
		`<body><article><h1>Title</h1><p>Hello World</p></article></body></html>`
	gbkBytes, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte(utf8HTML))
	if err != nil {
		log.Fatal(err)
	}

	result, err := extractWithEncodingFallback(gbkBytes, "gbk")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Title: %s\n", result.Title)
	fmt.Printf("Text: %s\n", result.Text)
	// Output:
	// Auto-detection failed (encoding detection failed: ...), retrying with encoding "gbk"...
	// Title: Test
	// Text: Title
	//
	// Hello World
}
```

:::tip
Encoding detection retry is useful for processing HTML documents of unknown origin (e.g., legacy Chinese web pages scraped by a crawler). If your input source is fixed, simply specify the encoding in `Config.Encoding` — no retry logic needed.
:::

### Timeout Recovery

`ErrProcessingTimeout` indicates that processing time exceeded `Config.ProcessingTimeout`. The recovery strategy depends on the document characteristics:

| Strategy | Applicable scenario | Action |
|----------|---------------------|--------|
| Reduce complexity | Complex document structure but simple content | Set `ExtractArticle = false` to skip article recognition |
| Extend timeout | Document is genuinely large and legitimate | Increase `ProcessingTimeout` |
| Simplify output | Only plain text needed | Use `TextOnlyConfig()` to disable all media extraction |

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cybergodev/html"
)

func main() {
	// First attempt: standard config (30s timeout)
	cfg := html.DefaultConfig()
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	largeHTML := []byte(`<html><body><article><h1>Large Document</h1><p>` +
		strings.Repeat("content ", 100000) + `</p></article></body></html>`)

	_, err = p.Extract(largeHTML)
	if err != nil {
		if errors.Is(err, html.ErrProcessingTimeout) {
			fmt.Println("Standard config timed out, switching to simplified mode for retry...")

			// Retry: disable article extraction + plain text mode + longer timeout
			retryCfg := html.TextOnlyConfig()
			retryCfg.ExtractArticle = false
			retryCfg.ProcessingTimeout = 60 * time.Second
			p2, err := html.New(retryCfg)
			if err != nil {
				log.Fatal(err)
			}
			defer p2.Close()

			result, err := p2.Extract(largeHTML)
			if err != nil {
				log.Fatal(err)
			}
			fmt.Printf("Retry succeeded, extracted %d characters\n", len(result.Text))
		} else {
			log.Fatal(err)
		}
	}
}
```

### Input Too Large

`ErrInputTooLarge` indicates the input exceeded `Config.MaxInputSize` (default 50MB, which is also the maximum). Two handling approaches:

- **Reduce input**: If this is a web service, prompt the user to upload a smaller file
- **Increase the limit**: If your business genuinely requires large file processing, increase `MaxInputSize` (maximum 50MB)

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 1024 // 1KB limit (for demonstration)
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Construct input that exceeds the limit
	largeInput := []byte(strings.Repeat("<div>", 500))
	_, err = p.Extract(largeInput)
	if err != nil {
		var inputErr *html.InputError
		if errors.As(err, &inputErr) {
			fmt.Printf("Input %d bytes exceeds limit %d bytes\n", inputErr.Size, inputErr.MaxSize)
			// Output: Input 2500 bytes exceeds limit 1024 bytes
		}
	}
}
```

## Error Wrapping Chain

All three structured error types (`InputError`, `ConfigError`, `FileError`) implement the `Unwrap()` method, supporting standard `errors.Is()` and `errors.As()` patterns. Understanding `Unwrap()` behavior is critical for correct error identification.

### Unwrap Behavior Reference

| Type | `Unwrap()` return value | Description |
|------|-------------------------|-------------|
| `*InputError` | Signature is `Unwrap() []error`: `[InputErr, ErrInputTooLarge]` when `InputErr` is non-nil, otherwise `[ErrInputTooLarge]` | Whether or not an underlying error is carried, `ErrInputTooLarge` is always in the list — `errors.Is(err, ErrInputTooLarge)` is true for any `*InputError` |
| `*ConfigError` | Always `ErrInvalidConfig` | Fixed mapping to the config sentinel |
| `*FileError` | ① If `FileErr` wraps `ErrFileNotFound` → `ErrFileNotFound`; ② otherwise if `FileErr != nil` → `FileErr` (original error); ③ otherwise → `ErrInvalidFilePath` | Three-level fallback: file not found → original error → invalid path |

:::warning Note
The three-level logic of `FileError.Unwrap()` means that errors from path traversal attacks (`FileErr` = `"path traversal detected: ..."`) will not match any sentinel error — because `Unwrap()` returns the original path traversal error, not `ErrFileNotFound` or `ErrInvalidFilePath`. Detecting path traversal requires extracting `FileError` via `errors.As` and then checking the message.
:::

### Comprehensive Diagnosis Example

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/cybergodev/html"
)

// diagnoseError uses errors.Is + errors.As for comprehensive error diagnosis.
func diagnoseError(err error) {
	if err == nil {
		fmt.Println("No error")
		return
	}

	// 1. errors.Is: check sentinel errors (traverses the Unwrap chain)
	fmt.Printf("errors.Is checks:\n")
	fmt.Printf("  ErrInputTooLarge:    %v\n", errors.Is(err, html.ErrInputTooLarge))
	fmt.Printf("  ErrInvalidConfig:    %v\n", errors.Is(err, html.ErrInvalidConfig))
	fmt.Printf("  ErrFileNotFound:     %v\n", errors.Is(err, html.ErrFileNotFound))
	fmt.Printf("  ErrInvalidFilePath:  %v\n", errors.Is(err, html.ErrInvalidFilePath))

	// 2. errors.As: extract structured error types
	var inputErr *html.InputError
	if errors.As(err, &inputErr) {
		fmt.Printf("InputError details: op=%s size=%d max=%d\n",
			inputErr.Op, inputErr.Size, inputErr.MaxSize)
	}

	var configErr *html.ConfigError
	if errors.As(err, &configErr) {
		fmt.Printf("ConfigError details: field=%s value=%v message=%s\n",
			configErr.Field, configErr.Value, configErr.Message)
	}

	var fileErr *html.FileError
	if errors.As(err, &fileErr) {
		fmt.Printf("FileError details: op=%s safePath=%s\n",
			fileErr.Op, fileErr.SafePath())
		// Detect path traversal (doesn't match sentinel, must check message)
		if fileErr.FileErr != nil &&
			strings.Contains(fileErr.FileErr.Error(), "path traversal") {
			fmt.Println("  [Security Warning] Path traversal attack detected")
		}
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer p.Close()

	// Scenario 1: Input too large → InputError → ErrInputTooLarge
	fmt.Println("=== Scenario 1: Input too large ===")
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	diagnoseError(err)

	// Scenario 2: File not found → FileError → ErrFileNotFound
	fmt.Println("\n=== Scenario 2: File not found ===")
	_, err = p.ExtractFromFile("nonexistent.html")
	diagnoseError(err)

	// Scenario 3: Path traversal → FileError → doesn't match sentinel
	fmt.Println("\n=== Scenario 3: Path traversal ===")
	_, err = p.ExtractFromFile("../../etc/passwd")
	diagnoseError(err)
}
```

## FileError Path Sanitization

`FileError` is designed with a built-in **path information sanitization** mechanism to prevent leaking server filesystem structure through error messages. This is especially important when handling file paths from untrusted users.

### Sanitization Layers

| Layer | Method | Behavior |
|-------|--------|----------|
| Error message | `Error()` | Calls `SafePath()` to show only the filename; calls `sanitizeErrorMessage()` to remove path details |
| Path truncation | `SafePath()` | Returns the basename of the path (e.g., `/var/data/secret/page.html` → `page.html`) |
| Error cleaning | `sanitizeErrorMessage()` | Preserves the error type (path traversal / not found / permission denied / access denied), removes path strings |
| JSON serialization | `MarshalJSON()` | Automatically sanitizes with `SafePath()`, suitable for HTTP API responses |
| Internal debugging | `Path` field | Retains the full path for logging and auditing (not exposed externally) |

### Web Service Sanitization Example

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/cybergodev/html"
)

// apiResponse is the JSON structure returned to the client.
type apiResponse struct {
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("file")
	if filePath == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(apiResponse{Error: "missing file parameter"})
		return
	}

	cfg := html.DefaultConfig()
	result, err := html.ExtractFromFile(filePath, cfg)
	if err != nil {
		// Error message is already sanitized — the client won't see server paths
		w.WriteHeader(http.StatusUnprocessableEntity)

		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			// MarshalJSON automatically sanitizes with SafePath(), safe to return to the client
			fileErrJSON, _ := json.Marshal(fileErr)
			fmt.Fprintf(w, `{"error":"file_error","detail":%s}`, fileErrJSON)
			// Client sees: {"error":"file_error","detail":{"op":"ReadFile","path":"secret.html","message":"file not found"}}
			// Instead of the full server path /var/www/uploads/secret.html
		} else {
			json.NewEncoder(w).Encode(apiResponse{Error: "extraction_failed"})
		}
		return
	}

	json.NewEncoder(w).Encode(result)
}

func main() {
	// Demonstrate sanitization: simulate processing a nonexistent file path
	cfg := html.DefaultConfig()
	_, err := html.ExtractFromFile("/var/www/private/secret.html", cfg)
	if err != nil {
		var fileErr *html.FileError
		if errors.As(err, &fileErr) {
			fmt.Printf("Error() output (sanitized): %v\n", fileErr)
			// Output: Error() output (sanitized): html: ReadFile "secret.html": file not found

			fmt.Printf("SafePath(): %s\n", fileErr.SafePath())
			// Output: SafePath(): secret.html

			jsonBytes, _ := json.Marshal(fileErr)
			fmt.Printf("MarshalJSON(): %s\n", jsonBytes)
			// Output: MarshalJSON(): {"op":"ReadFile","path":"secret.html","message":"file not found"}

			fmt.Printf("Path field (internal debugging): %s\n", fileErr.Path)
			// Output: Path field (internal debugging): /var/www/private/secret.html
		}
	}

	// Register the HTTP handler (register only, don't start the server)
	http.HandleFunc("/extract", extractHandler)
	fmt.Println("\nHandler registered, error messages auto-sanitized")
}
```

:::tip
`MarshalJSON()` allows `FileError` to be `json.Marshal()`'d and returned directly to HTTP clients without extra processing — path information is automatically sanitized during serialization. However, the `Path` field still retains the full path for internal logging and debugging only. Never return it directly to clients.
:::

## Web Service Error Mapping

In web services, you need to map library errors to appropriate HTTP status codes so clients can handle them correctly.

### HTTP Status Code Mapping Table

| Sentinel Error | Suggested HTTP Status Code | Description |
|----------------|---------------------------|-------------|
| `ErrInputTooLarge` | 413 Payload Too Large | Input exceeds limit; client should reduce input |
| `ErrInvalidHTML` | 422 Unprocessable Entity | Unparseable HTML format |
| `ErrFileNotFound` | 404 Not Found | File does not exist |
| `ErrInvalidFilePath` | 400 Bad Request | Invalid path format |
| `ErrMaxDepthExceeded` | 400 Bad Request | Possibly maliciously crafted deep nesting |
| `ErrProcessingTimeout` | 504 Gateway Timeout | Processing timeout; client may retry later |
| `ErrProcessorClosed` | 500 Internal Server Error | Programming error (incorrect lifecycle management) |
| `ErrInvalidConfig` | 500 Internal Server Error | Programming error (config validation should be done at startup) |
| `ErrInternalPanic` | 500 Internal Server Error | Internal bug; should be reported |
| `ErrMultipleConfigs` | 500 Internal Server Error | Programming error (multiple Configs passed) |

### Status Code Mapping Implementation

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/cybergodev/html"
)

// errorToHTTPStatus maps html library errors to appropriate HTTP status codes.
func errorToHTTPStatus(err error) int {
	switch {
	case errors.Is(err, html.ErrInputTooLarge):
		return http.StatusRequestEntityTooLarge // 413
	case errors.Is(err, html.ErrInvalidHTML):
		return http.StatusUnprocessableEntity // 422
	case errors.Is(err, html.ErrFileNotFound):
		return http.StatusNotFound // 404
	case errors.Is(err, html.ErrInvalidFilePath):
		return http.StatusBadRequest // 400
	case errors.Is(err, html.ErrMaxDepthExceeded):
		return http.StatusBadRequest // 400
	case errors.Is(err, html.ErrProcessingTimeout):
		return http.StatusGatewayTimeout // 504
	case errors.Is(err, html.ErrProcessorClosed):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrInvalidConfig):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrInternalPanic):
		return http.StatusInternalServerError // 500
	case errors.Is(err, html.ErrMultipleConfigs):
		return http.StatusInternalServerError // 500
	default:
		return http.StatusInternalServerError // 500
	}
}

func main() {
	// Demonstrate HTTP status code mapping for various errors

	// ErrInputTooLarge → 413
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 10
	p, err := html.New(cfg)
	if err != nil {
		log.Fatal(err)
	}

	testCases := []struct {
		name string
		err  error
	}{
		{"Input too large", func() error {
			_, e := p.Extract(make([]byte, 100))
			return e
		}()},
		{"File not found", func() error {
			_, e := p.ExtractFromFile("missing.html")
			return e
		}()},
		{"Processor closed", html.ErrProcessorClosed},
		{"Internal panic", html.ErrInternalPanic},
	}

	for _, tc := range testCases {
		if tc.err != nil {
			fmt.Printf("%-16s → HTTP %d\n", tc.name, errorToHTTPStatus(tc.err))
		}
	}
	// Output:
	// Input too large  → HTTP 413
	// File not found   → HTTP 404
	// Processor closed → HTTP 500
	// Internal panic   → HTTP 500

	p.Close()
}
```

## Error Decision Flowchart

When you encounter an error, determine its type in the following priority order (from most severe to least severe):

```text
error != nil ?
│
├── errors.Is(err, ErrProcessorClosed)
│   → Programming error: check the timing of Close() calls, confirm the processor wasn't closed while in use
│
├── errors.Is(err, ErrInternalPanic)
│   → Internal bug: log the full stack trace and report; the input may have triggered an uncovered edge case
│
├── errors.As(err, &fileErr)
│   → File error: log the sanitized path with SafePath(), check FileErr for the specific cause
│   ├── errors.Is(err, ErrFileNotFound)    → File does not exist
│   ├── Message contains "path traversal"   → Security incident, audit log + reject
│   └── errors.Is(err, ErrInvalidFilePath) → Path format issue
│
├── errors.As(err, &inputErr)
│   → Input error: check Size/MaxSize, prompt user to reduce input or adjust limits
│
├── errors.Is(err, ErrProcessingTimeout)
│   → Timeout: consider simplifying processing (ExtractArticle=false) or retry with increased timeout
│
├── errors.Is(err, ErrMaxDepthExceeded)
│   → Possibly malicious: reject and record audit log
│
├── errors.Is(err, ErrInvalidHTML)
│   → Input format issue: prompt user to check the HTML source
│
├── errors.Is(err, ErrInvalidConfig)
│   → Config error: should be caught by Validate() at service startup; appearing at runtime indicates a logic error
│
└── Other
    → Unknown error: log the full error chain, propagate upward or return 500
```

:::tip
The checking order matters: `ErrProcessorClosed` and `ErrInternalPanic` should be checked first, as they represent programming errors or internal failures that need to be handled differently from input errors. The `errors.As` check for `FileError` should come after or alongside the `errors.Is` sentinel checks — because path traversal errors don't match any sentinel.
:::

## Structured Logging Practices

When logging errors with `slog`, you should extract fields from structured error types (rather than just logging the `err.Error()` string) for easier downstream log querying and alerting.

```go
package main

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/cybergodev/html"
)

// logExtractionError extracts structured fields based on error type and logs them via slog.
func logExtractionError(err error) {
	var inputErr *html.InputError
	var configErr *html.ConfigError
	var fileErr *html.FileError

	switch {
	case errors.As(err, &inputErr):
		// Input error: log Op/Size/MaxSize for troubleshooting capacity issues
		slog.Warn("Extraction failed: input error",
			"op", inputErr.Op,
			"size", inputErr.Size,
			"max_size", inputErr.MaxSize,
			"sentinel", "ErrInputTooLarge",
		)

	case errors.As(err, &configErr):
		// Config error: log Field/Value/Message for locating config issues
		slog.Error("Extraction failed: config error",
			"field", configErr.Field,
			"value", configErr.Value,
			"message", configErr.Message,
			"sentinel", "ErrInvalidConfig",
		)

	case errors.As(err, &fileErr):
		// File error: log sanitized path with SafePath(), check for path traversal
		attrs := []any{
			"op", fileErr.Op,
			"path", fileErr.SafePath(), // Sanitized path to avoid leaking full paths in logs
		}
		if fileErr.FileErr != nil {
			attrs = append(attrs, "cause", fileErr.FileErr.Error())
			if strings.Contains(fileErr.FileErr.Error(), "path traversal") {
				attrs = append(attrs, "security_event", "path_traversal")
			}
		}
		slog.Warn("Extraction failed: file error", attrs...)

	case errors.Is(err, html.ErrProcessingTimeout):
		slog.Warn("Extraction failed: processing timeout", "err", err)

	case errors.Is(err, html.ErrMaxDepthExceeded):
		slog.Warn("Extraction failed: depth exceeded, possibly malicious", "err", err)

	case errors.Is(err, html.ErrProcessorClosed):
		slog.Error("Extraction failed: processor closed (programming error)", "err", err)

	case errors.Is(err, html.ErrInternalPanic):
		slog.Error("Extraction failed: internal panic, please report",
			"err", err,
			"issue", "https://github.com/cybergodev/html/issues",
		)

	default:
		slog.Error("Extraction failed: unknown error", "err", err, "err_type", fmt.Sprintf("%T", err))
	}
}

func main() {
	cfg := html.DefaultConfig()
	cfg.MaxInputSize = 100
	p, err := html.New(cfg)
	if err != nil {
		slog.Error("Failed to create processor", "err", err)
		return
	}
	defer p.Close()

	// Scenario 1: Input too large → structured logging of Size/MaxSize
	_, err = p.Extract([]byte(strings.Repeat("x", 200)))
	if err != nil {
		logExtractionError(err)
	}

	// Scenario 2: File not found → structured logging of SafePath
	_, err = p.ExtractFromFile("/data/secret/missing.html")
	if err != nil {
		logExtractionError(err)
	}

	// Scenario 3: Path traversal → flag as security event
	_, err = p.ExtractFromFile("../../../etc/passwd")
	if err != nil {
		logExtractionError(err)
	}
}
```

:::tip
The key to structured logging is extracting **fields** rather than concatenating strings. For example, after logging `inputErr.Size` and `inputErr.MaxSize`, you can query your logging system for `size > max_size * 0.9` to find requests approaching the limit and spot capacity issues early. For `FileError`, always use `SafePath()` instead of the `Path` field for logging — to prevent log files themselves from becoming an information leakage source.
:::

## Next Steps

- [Production Checklist](../security/production-checklist) - Pre-deployment security checks
- [Performance](./performance) - Throughput improvements and timeout settings
- [API Reference: Constants & Errors](../../api-reference/types/constants) - Complete list of sentinel errors
- [API Reference: Processor](../../api-reference/core/processor) - Processor lifecycle and stats
