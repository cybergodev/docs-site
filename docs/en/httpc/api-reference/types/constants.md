---
sidebar_label: "Constants & Types"
title: "Constants and Types - CyberGo HTTPC | Helper Types"
description: "HTTPC constants and helper types: BodyKind values with auto-detection, ProxyStrategy options, FormData and FileData uploads, AuditEvent, AuditConfig."
sidebar_position: 2
---

# Constants and Types

This page gathers all of HTTPC's public constants and helper types, including request-body type enums, proxy strategies, form/file-upload types, checksum algorithms, audit events, formatting helper functions, the progress callback, and the cookie security configuration.

## BodyKind

```go
type BodyKind int
```

Request body type, used with `WithBody` to specify the body format.

| Constant | Value | Meaning | Input requirement | Content-Type |
|------|-----|------|----------|-------------------|
| `BodyAuto` | 0 | Auto-detect | Any (inferred by type) | See detection-rules table below |
| `BodyJSON` | 1 | Force JSON encoding | Any serializable type | application/json |
| `BodyXML` | 2 | Force XML encoding | Any serializable type | application/xml |
| `BodyForm` | 3 | Form encoding | `map[string]string` or compatible type | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | Binary stream | `[]byte` or `string` | application/octet-stream |
| `BodyMultipart` | 5 | Multipart form | `*FormData` | multipart/form-data |

### BodyAuto Detection Rules

`BodyAuto` (the default) infers the request-body format and Content-Type from the Go type of the input data:

| Input Go type | Inferred format | Content-Type |
|-------------|----------|-------------|
| `string` | Plain text | text/plain; charset=utf-8 |
| `[]byte` | Binary stream | application/octet-stream |
| `map[string]string` | Form | application/x-www-form-urlencoded |
| `*FormData` | Multipart form | multipart/form-data |
| `io.Reader` | Passed through as-is | Not set (caller specifies) |
| Other types | JSON serialization | application/json |

:::tip BodyAuto vs explicit specification
In most scenarios `BodyAuto` is sufficient. When automatic inference does not match your expectation (e.g. you need to send a struct as XML rather than JSON), explicitly pass `BodyJSON`/`BodyXML`/`BodyForm` to force the encoding format.
:::

```go
// Auto-detect (default)
result, _ := client.Post(url, httpc.WithBody(data))

// Force JSON (even if data is a map[string]string, encode as JSON)
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// Force XML
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

## ProxyStrategy

```go
type ProxyStrategy = proxypool.Strategy
```

Proxy pool selection strategy, used by `ConnectionConfig.ProxyPoolStrategy`. It is a type alias of the internal `proxypool.Strategy` to avoid importing the internal package.

| Constant | Description | Retry behavior |
|------|------|----------|
| `ProxyStrategyRoundRobin` | Round-robin (default). Selects proxies in sequential order, advancing to the next each time | Retries naturally land on different IPs with no extra configuration |
| `ProxyStrategyRandom` | Random. Uniformly picks from healthy proxies | Retries select randomly; statistically tends to switch IPs |

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
client, _ := httpc.New(cfg)
```

:::tip Status-code-triggered rotation
Combined with `ProxyRotateOnStatus` (e.g. `[]int{403}`), you can trigger a retry + proxy rotation on specific status codes, useful for bypassing CF/WAF-style IP-level blocking. See [Configuration Reference](../client-config/config).
:::

## FormData / FileData

### FormData

```go
type FormData struct {
    Fields map[string]string    // Plain form fields
    Files  map[string]*FileData // File fields
}
```

Multipart form data for `BodyMultipart` mode. `Fields` stores key-value pairs and `Files` stores files. It is a type alias of the internal `types.FormData`.

### FileData

```go
type FileData struct {
    Filename    string // File name
    Content     []byte // File content
    ContentType string // MIME type, e.g. "image/png", "application/pdf"
}
```

It is a type alias of the internal `types.FileData`.

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	defer func() { _ = client.Close() }()

	form := &httpc.FormData{
		Fields: map[string]string{
			"username": "alice",
			"title":    "profile photo",
		},
		Files: map[string]*httpc.FileData{
			"avatar": {
				Filename:    "photo.png",
				Content:     []byte("\x89PNG..."), // In practice, read via os.ReadFile
				ContentType: "image/png",
			},
		},
	}

	result, err := client.Post("https://httpbin.org/post", httpc.WithFormData(form))
	if err != nil {
		log.Fatalf("upload failed: %v", err)
	}

	fmt.Println("upload complete, status code:", result.StatusCode())
}
```

## ChecksumAlgorithm

```go
type ChecksumAlgorithm string

const ChecksumSHA256 ChecksumAlgorithm = "sha256"
```

Download checksum algorithm. Currently only `"sha256"` is supported. Used by `DownloadConfig.ChecksumAlgorithm`; defaults to `ChecksumSHA256` in `DefaultDownloadConfig()`. Passing an unsupported algorithm returns `"unsupported checksum algorithm"` before the download starts.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/archive.zip"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb924..." // Expected SHA-256 hex value
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256
```

## AuditEvent

```go
type AuditEvent struct {
    Timestamp     time.Time           `json:"timestamp"`
    Method        string              `json:"method"`
    URL           string              `json:"url"`           // Sanitized (credentials removed)
    StatusCode    int                 `json:"statusCode"`
    Duration      time.Duration       `json:"duration"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

Security audit event, generated by `AuditMiddleware` after each request/response cycle. Designed for high-compliance scenarios such as finance, healthcare, and government, capturing the full request/response context.

| Field | Type | Description |
|------|------|------|
| `Timestamp` | `time.Time` | Request start time |
| `Method` | `string` | HTTP method |
| `URL` | `string` | Request URL (sanitized, credentials removed) |
| `StatusCode` | `int` | Response status code (0 when no response) |
| `Duration` | `time.Duration` | Total request duration |
| `Attempts` | `int` | Attempt count (including retries) |
| `Error` | `error` | Error object (sanitized with SanitizeError) |
| `SourceIP` | `string` | Source IP (extracted from context) |
| `UserID` | `string` | User ID (extracted from context) |
| `RedirectChain` | `[]string` | Redirect chain |
| `ReqHeaders` | `map[string][]string` | Request headers (requires IncludeHeaders=true) |
| `RespHeaders` | `map[string][]string` | Response headers (requires IncludeHeaders=true) |

### MarshalJSON Custom Serialization

`AuditEvent` implements custom JSON serialization, providing two JSON-friendly derived fields:

| JSON field | Source | Description |
|-----------|------|------|
| `durationMs` | `Duration.Milliseconds()` | Integer milliseconds, easy for log-aggregation tools to parse |
| `error` | `Error.Error()` | Error string (replacing the default serialization of the error interface) |

This way the JSON output contains both the original `duration` (nanoseconds) and the readable `durationMs` (milliseconds), and the `error` field outputs as a string rather than an empty object.

### AuditConfig

```go
type AuditConfig struct {
    OnAudit        func(event AuditEvent) // Audit callback; nil means middleware is a no-op
    Format         string                 // "text" or "json"
    IncludeHeaders bool                   // Include request/response headers
    MaskHeaders    []string               // Header names to mask (e.g. "Authorization", "Cookie")
    SanitizeError  bool                   // Sanitize error messages (replace with "[sanitized]")
}
```

`DefaultAuditConfig()` provides defaults: `Format="text"`, `IncludeHeaders=false`, `MaskHeaders=` list of sensitive headers (Authorization/Cookie, etc.), `SanitizeError=true`.

## Context Keys

| Constant | Value | Description |
|------|-----|------|
| `SourceIPKey` | `"source_ip"` | Source IP address in audit events |
| `UserIDKey` | `"user_id"` | User identifier in audit events |

The type of these keys is `auditContextKey` (an unexported string type), used with `context.WithValue` to pass audit information. `AuditMiddleware` extracts these values via `ctx.Value(httpc.SourceIPKey)` and `ctx.Value(httpc.UserIDKey)` and fills them into `AuditEvent`.

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// Pass audit information via context
	ctx := context.WithValue(context.Background(), httpc.SourceIPKey, "192.168.1.100")
	ctx = context.WithValue(ctx, httpc.UserIDKey, "user-789")

	// Configure the audit middleware
	auditCfg := httpc.DefaultAuditConfig()
	auditCfg.Format = "json"
	auditCfg.IncludeHeaders = true
	auditCfg.OnAudit = func(event httpc.AuditEvent) {
		fmt.Printf("[AUDIT] %s %s -> %d (%v) src=%s user=%s\n",
			event.Method, event.URL, event.StatusCode,
			event.Duration, event.SourceIP, event.UserID)
	}

	cfg := httpc.DefaultConfig()
	cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
		httpc.AuditMiddleware(auditCfg),
	}
	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatalf("failed to create client: %v", err)
	}
	defer func() { _ = client.Close() }()

	// The SourceIP/UserID in the context are extracted into the audit event by the middleware
	result, err := client.Request(ctx, "GET", "https://httpbin.org/get")
	if err != nil {
		log.Fatalf("request failed: %v", err)
	}
	fmt.Println("status code:", result.StatusCode())
}
```

## FormatBytes / FormatSpeed

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

Formats a byte count as a human-readable string. Uses binary units (1024-based); shows an integer below 1024, otherwise two decimal places.

| Input | Output |
|------|------|
| `512` | `"512 B"` |
| `1536` | `"1.50 KB"` |
| `1572864` | `"1.50 MB"` |
| `1073741824` | `"1.00 GB"` |

Unit chain: B -> KB -> MB -> GB -> TB -> PB -> EB.

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

Formats a byte rate as a human-readable string. Same units as FormatBytes, but with a `/s` suffix.

| Input | Output |
|------|------|
| `512.0` | `"512 B/s"` |
| `1572864.0` | `"1.50 MB/s"` |

Commonly used for speed display in download progress callbacks.

```go
speed := httpc.FormatSpeed(1572864.0) // "1.50 MB/s"
size := httpc.FormatBytes(1572864)    // "1.50 MB"
```

## DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

Download progress callback signature, used by `DownloadConfig.ProgressCallback`.

| Parameter | Type | Description |
|------|------|------|
| `downloaded` | `int64` | Bytes downloaded (includes the resumed portion during a resumable download) |
| `total` | `int64` | Total bytes (-1 when the server did not return Content-Length) |
| `speed` | `float64` | Current download speed (bytes/second); can be passed directly to `FormatSpeed` |

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large.zip"
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
	if total > 0 {
		pct := float64(downloaded) / float64(total) * 100
		fmt.Printf("\r%.1f%%  %s / %s  %s",
			pct,
			httpc.FormatBytes(downloaded),
			httpc.FormatBytes(total),
			httpc.FormatSpeed(speed),
		)
	}
}
```

## CookieSecurityConfig

```go
type CookieSecurityConfig = validation.CookieSecurityConfig
```

Cookie security attribute validation config. It is a type alias of the internal `validation.CookieSecurityConfig`, used by SessionManager and the `WithSecureCookie` request option.

```go
type CookieSecurityConfig struct {
    RequireSecure                bool    // Require the Secure attribute (HTTPS transport only)
    RequireHttpOnly              bool    // Require the HttpOnly attribute (XSS theft defense)
    RequireSameSite              string  // Required SameSite value: "Strict"/"Lax"/"None"/""
    AllowSameSiteNone            bool    // Whether SameSite=None is allowed
    RequireSecureForSameSiteNone bool    // Force Secure when SameSite=None
}
```

| Field | Type | Description |
|------|------|------|
| `RequireSecure` | `bool` | Require the Secure attribute; transport over HTTPS only. Recommended true in production |
| `RequireHttpOnly` | `bool` | Require the HttpOnly attribute; forbid JS access, XSS defense. Recommended true for session cookies |
| `RequireSameSite` | `string` | Required SameSite value. `"Strict"` (first-party only), `"Lax"` (first-party + top-level navigation), `"None"` (all contexts, requires Secure), `""` (no requirement) |
| `AllowSameSiteNone` | `bool` | Whether SameSite=None is allowed. When false and RequireSameSite is empty, cookies with SameSite=None are rejected |
| `RequireSecureForSameSiteNone` | `bool` | Force Secure when SameSite=None (per RFC 6265bis). Defaults to true |

Available factory functions:

| Factory function | Policy | Applicable scenario |
|----------|------|----------|
| `DefaultCookieSecurityConfig()` | Lenient: allows non-HTTPS, allows JS access, allows SameSite=None | Development, compatibility-first |
| `StrictCookieSecurityConfig()` | Strict: requires Secure + HttpOnly + SameSite=Strict | Production, high-security scenarios (finance/healthcare/government) |

```go
// Strict policy: requires Secure + HttpOnly + SameSite=Strict
strict := httpc.StrictCookieSecurityConfig()

// Custom policy: requires HttpOnly, allows SameSite=Lax
custom := &httpc.CookieSecurityConfig{
    RequireHttpOnly: true,
    RequireSameSite: "Lax",
    AllowSameSiteNone: false,
}

// Apply to SessionManager
sm.SetCookieSecurity(strict)

// Or apply to single-request cookie validation
result, err := client.Get(url, httpc.WithSecureCookie(strict))
```

:::warning WithSecureCookie is order-sensitive
`WithSecureCookie` validates only cookies that **exist at apply time**. It must be placed after all `WithCookies`/`WithCookieMap`/`WithCookieString` calls. For order-independent session-level validation, use `SessionManager.SetCookieSecurity`.
:::

## See Also

- [Error Types](./errors) - Complete reference for ClientError, ErrorType, and error variables
- [Request Options](../core/options) - BodyKind usage in WithBody
- [Built-in Middleware](../client-config/middleware) - AuditMiddleware and audit configuration
- [Session Management](../client-config/session) - SessionManager and session-level use of CookieSecurityConfig
