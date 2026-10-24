---
sidebar_label: "Constants & Types"
title: "Constants and Types - CyberGo HTTPC | Helper Types"
description: "HTTPC constants and types: BodyKind and auto-detection, ProxyStrategy, FormData/FileData upload types, AuditEvent, and context keys."
sidebar_position: 20
---

# Constants and Types

This page gathers HTTPC's public constants and helper types: request-body type enums, proxy strategies, form and file upload types, checksum algorithms, audit events, formatting helpers, the progress callback, and the cookie security configuration.

## BodyKind

```go
type BodyKind int
```

Request body type, used with `WithBody` to specify the body format.

| Constant | Value | Meaning | Input requirement | Content-Type |
|------|-----|------|----------|-------------------|
| `BodyAuto` | 0 | Auto-detect the format | Any (inferred by type) | See the detection-rules table below |
| `BodyJSON` | 1 | Force JSON | Any serializable type | application/json |
| `BodyXML` | 2 | Force XML | Any serializable type | application/xml |
| `BodyForm` | 3 | Force form encoding | `map[string]string` or a compatible type | application/x-www-form-urlencoded |
| `BodyBinary` | 4 | Force binary encoding | `[]byte` or `string` | application/octet-stream |
| `BodyMultipart` | 5 | Force multipart encoding | `*FormData` | multipart/form-data |

### BodyAuto Detection Rules

`BodyAuto` (the default) infers the request-body format and Content-Type from the Go type of the input data:

| Input Go type | Inferred format | Content-Type |
|-------------|----------|-------------|
| `string` | Plain text | text/plain; charset=utf-8 |
| `[]byte` | Binary | application/octet-stream |
| `map[string]string` | Form | application/x-www-form-urlencoded |
| `*FormData` | Multipart | multipart/form-data |
| `io.Reader` | Passed through as-is | Not set (caller specifies) |
| Other types | JSON | application/json |

:::tip BodyAuto vs explicit specification
`BodyAuto` covers most cases. When the inferred format is not what you need (e.g. a struct must be sent as XML rather than JSON), pass `BodyJSON`/`BodyXML`/`BodyForm` explicitly to force the encoding.
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

Proxy pool selection strategy, used by `ConnectionConfig.ProxyPoolStrategy`. It is a type alias of the internal `proxypool.Strategy`, so callers do not import the internal package.

| Constant | Description | Retry behavior |
|------|------|----------|
| `ProxyStrategyRoundRobin` | Round-robin (default): selects proxies in sequence, advancing each time | Retries land on different IPs with no extra configuration |
| `ProxyStrategyRandom` | Random: uniformly picks from healthy proxies | Retries select randomly, which tends to switch IPs |

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
With `ProxyRotateOnStatus` (e.g. `[]int{403}`), a specific status code triggers a retry with proxy rotation, which helps around IP-level blocking. See [Configuration Reference](../client-config/config).
:::

## FormData / FileData

### FormData

```go
type FormData struct {
    Fields map[string]string    // Plain form fields
    Files  map[string]*FileData // File fields
}
```

Multipart form data for `BodyMultipart` mode: text fields go in `Fields` (key-value pairs), files in `Files` (indexed by field name to `FileData`, whose `Filename`/`Content` carry the file name and raw bytes). It is a type alias of the internal `types.FormData`.

| Field | Type | Description |
|-------|------|-------------|
| `FormData.Fields` | `map[string]string` | Plain form fields (key-value pairs) |
| `FormData.Files` | `map[string]*FileData` | File fields (indexed by field name) |

### FileData

```go
type FileData struct {
    Filename    string // File name
    Content     []byte // File content
    ContentType string // MIME type, e.g. "image/png", "application/pdf"
}
```

It is a type alias of the internal `types.FileData`.

| Field | Type | Description |
|-------|------|-------------|
| `FileData.Filename` | `string` | File name as sent to the server |
| `FileData.Content` | `[]byte` | Raw file content |
| `FileData.ContentType` | `string` | MIME type (e.g. `"image/png"`, `"application/pdf"`); falls back to `application/octet-stream` when zero |

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
    Duration      time.Duration       `json:"-"`
    Attempts      int                 `json:"attempts"`
    Error         error               `json:"error,omitempty"`
    SourceIP      string              `json:"sourceIP,omitempty"`
    UserID        string              `json:"userID,omitempty"`
    RedirectChain []string            `json:"redirectChain,omitempty"`
    ReqHeaders    map[string][]string `json:"reqHeaders,omitempty"`
    RespHeaders   map[string][]string `json:"respHeaders,omitempty"`
}
```

Security audit event, generated by `AuditMiddleware` after each request/response cycle. `AuditEvent` captures the full request/response context for high-compliance scenarios such as finance, healthcare, and government.

The timeline is reconstructed from `Timestamp` (request start time) plus `Duration`. With `AuditConfig.IncludeHeaders` enabled, the sanitized request and response headers are filled into `ReqHeaders` and `RespHeaders`.

| Field | Type | Description |
|------|------|------|
| `AuditEvent.Timestamp` | `time.Time` | Request start time; add `AuditEvent.Duration` for the end time |
| `AuditEvent.Method` | `string` | HTTP method |
| `AuditEvent.URL` | `string` | Request URL (sanitized, credentials removed) |
| `AuditEvent.StatusCode` | `int` | Final response status code (0 when the request errored) |
| `AuditEvent.Duration` | `time.Duration` | Total duration covering all attempts (including retry delays) |
| `AuditEvent.Attempts` | `int` | Number of requests sent (1 when no retry occurred) |
| `AuditEvent.Error` | `error` | Request error; serialized as a string in JSON (sanitizable via `AuditConfig.SanitizeError`) |
| `AuditEvent.SourceIP` | `string` | Source IP (injected into context by the application via `SourceIPKey`) |
| `AuditEvent.UserID` | `string` | User ID (injected into context by the application via `UserIDKey`) |
| `AuditEvent.RedirectChain` | `[]string` | Chain of URLs followed before the final response |
| `AuditEvent.ReqHeaders` | `map[string][]string` | Final request headers (may be nil on early failures; requires `AuditConfig.IncludeHeaders=true`) |
| `AuditEvent.RespHeaders` | `map[string][]string` | Final response headers (nil when the request errored; requires `AuditConfig.IncludeHeaders=true`) |

### MarshalJSON Custom Serialization

`AuditEvent.MarshalJSON` (signature `func (e AuditEvent) MarshalJSON() ([]byte, error)`) implements custom JSON serialization with two JSON-friendly derived fields:

| JSON field | Source | Description |
|-----------|------|------|
| `durationMs` | `Duration.Milliseconds()` | Integer milliseconds, easy for log-aggregation tools to parse |
| `error` | `Error.Error()` | Error string, replacing the default serialization of the error interface |

The JSON output therefore carries a single, readable duration field, `durationMs`: the `Duration` field itself has the `json:"-"` tag and is never serialized in nanosecond form, and `error` is output as a string rather than an empty object.

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

`DefaultAuditConfig()` provides defaults:

| Field | Default | Description |
|-------|---------|-------------|
| `AuditConfig.OnAudit` | `nil` | Audit callback; when nil, the middleware is a no-op |
| `AuditConfig.Format` | `"text"` | Output-format hint (`"text"` / `"json"`), consumed by the callback; the middleware does not branch on it |
| `AuditConfig.IncludeHeaders` | `false` | Whether to include request/response headers in the audit log |
| `AuditConfig.MaskHeaders` | Six standard sensitive headers | `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-Auth-Token`, `Proxy-Authorization`; matches are replaced with `[REDACTED]` |
| `AuditConfig.SanitizeError` | `true` | Error messages replaced with `[sanitized]` |

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

Format a byte count or byte rate as a human-readable string (binary 1024-based units, e.g. `"1.50 MB"` / `"1.50 MB/s"`), commonly used for download progress display and result logging. For signatures, input/output tables, and usage with `DownloadProgressCallback`, see [FormatBytes](../core/functions#formatbytes) and [FormatSpeed](../core/functions#formatspeed).

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
| `CookieSecurityConfig.RequireSecure` | `bool` | Require the Secure attribute so the cookie travels only over HTTPS. Recommended true in production |
| `CookieSecurityConfig.RequireHttpOnly` | `bool` | Require the HttpOnly attribute to block JS access and XSS theft. Recommended true for session cookies |
| `CookieSecurityConfig.RequireSameSite` | `string` | Required SameSite value: `"Strict"` (first-party only), `"Lax"` (first-party plus top-level navigation), `"None"` (all contexts, requires Secure), `""` (no requirement) |
| `CookieSecurityConfig.AllowSameSiteNone` | `bool` | Whether SameSite=None is allowed. When false and `RequireSameSite` is empty, cookies with SameSite=None are rejected |
| `CookieSecurityConfig.RequireSecureForSameSiteNone` | `bool` | Force Secure when SameSite=None (per RFC 6265bis); defaults to true |

Available factory functions:

| Factory function | Policy | Applicable scenario |
|----------|------|----------|
| `DefaultCookieSecurityConfig()` | Lenient: allows non-HTTPS, allows JS access, allows SameSite=None | Development, compatibility-first |
| `StrictCookieSecurityConfig()` | Strict: requires Secure + HttpOnly + SameSite=Strict | Production, high-security scenarios |

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
`WithSecureCookie` validates only cookies that **exist when it is applied**, so it must follow all `WithCookies`/`WithCookieMap`/`WithCookieString` calls. For order-independent session-level validation, use `SessionManager.SetCookieSecurity`.
:::

## Error Classification Constants (ErrorType)

The root package also exports 12 `ErrorType` error classification constants: `ErrorTypeUnknown`, `ErrorTypeNetwork`, `ErrorTypeTimeout`, `ErrorTypeContextCanceled`, `ErrorTypeResponseRead`, `ErrorTypeTransport`, `ErrorTypeRetryExhausted`, `ErrorTypeTLS`, `ErrorTypeCertificate`, `ErrorTypeDNS`, `ErrorTypeValidation`, `ErrorTypeHTTP`.

For the full reference covering these constants together with the `ClientError` struct, the `Code()`/`IsRetryable()` methods, and sentinel error variables such as `ErrClientClosed`, see [Error Types](./errors).

With this, the page set covers every exported constant of the root package: 6 BodyKind values, 2 proxy strategies, 1 checksum algorithm, and 2 context keys on this page, plus 12 error classifications in [Error Types](./errors).

## See Also

- [Error Types](./errors) - Complete reference for ClientError, ErrorType, and error variables
- [Request Options](../core/options) - BodyKind usage in WithBody
- [Built-in Middleware](../client-config/middleware) - AuditMiddleware and audit configuration
- [Session Management](../client-config/session) - SessionManager and session-level use of CookieSecurityConfig
