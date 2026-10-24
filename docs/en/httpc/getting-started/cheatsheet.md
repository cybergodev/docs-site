---
sidebar_label: "Cheat Sheet"
title: "Cheat Sheet - CyberGo HTTPC | Common Code Reference"
description: "HTTPC cheat sheet: client creation and presets, request methods, WithXxx options, Result handling, and middleware examples."
sidebar_position: 30
---

# Cheat Sheet

The cheat sheet groups common HTTPC code snippets by topic; each section links to the corresponding detailed page.

## Creating a Client

See [Core Concepts](../getting-started/concepts).

```go
// Default configuration
client, _ := httpc.NewDefault()
defer client.Close()

// Custom configuration
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

```go
// Presets in one step
client, _ := httpc.New(httpc.SecureConfig())     // Security first: strict timeouts, no redirects, 5MB cap
client, _ = httpc.New(httpc.PerformanceConfig()) // High throughput: large pool, cookies enabled
client, _ = httpc.New(httpc.TestingConfig())     // Testing only: skips certificate checks and SSRF (not for production)
client, _ = httpc.New(httpc.MinimalConfig())     // Lightweight: no retries, no redirects

// Request-level defaults (User-Agent / default headers / redirect policy)
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers["Authorization"] = "Bearer " + token
cfg.Security.FollowRedirects = false
cfg.Security.MaxRedirects = 5
client, _ := httpc.New(cfg)

// Manage the package-level default client
_ = httpc.SetDefaultClient(client) // Replace the default client (the old one is closed automatically)
_ = httpc.CloseDefaultClient()     // Close and reset (the next package-level call rebuilds it)
```

## HTTP Methods

See the [Hands-On Tutorial](../guides/tutorial).

```go
// Package-level functions (using the default client)
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// Instance methods
result, _ := client.Get(url)

// With context
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## Request Options

For the full list, see the [Request Options API](../api-reference/core/options).

### Headers

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### Request Body

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // File upload
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // With an explicit content type
httpc.WithBody(data)                    // Auto-detect type
httpc.WithBody(data, httpc.BodyJSON)    // Explicit: BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

`WithBody` auto-detects the type by default (`BodyAuto`):

- `string` -> text/plain
- `[]byte` -> octet-stream
- `map[string]string` -> form
- `*FormData` -> multipart
- `io.Reader` -> passed through as-is (no Content-Type set)
- other types -> JSON

### Query Parameters

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
// Note: a nil value keeps the parameter out of the URL
```

### Authentication

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookies

```go
httpc.WithCookies([]http.Cookie{{Name: "session", Value: "abc"}}) // Single cookie: one-element slice
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()) // Must come after all cookie-adding options
```

### Control

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithNoTimeout()            // Lift the client-level default timeout (explicit WithTimeout and ctx deadlines still apply)
httpc.WithMaxRetries(3)          // 0 disables retries; max 10
httpc.WithRetryNonIdempotent(true) // Allow retrying non-idempotent POST/PATCH (per-request override, both directions; beware replay side effects such as duplicate payments)
httpc.WithFollowRedirects(false) // Disable redirect following
httpc.WithMaxRedirects(5)        // Note: 0 counts as unset (falls back to the default 10); use the line above to disable following
httpc.WithStreamBody(true)       // Only affects Download (normal requests still read the body fully into Result)
httpc.WithAllowPrivateIPs(true)  // Per-request SSRF exemption (intranet/localhost access)
```

### Callbacks

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("Sending %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("Received response: %d", resp.StatusCode())
    return nil
})
```

## Response Handling

See the [Result API](../api-reference/core/result).

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // JSON parsing
result.GetCookie("name")               // Get a response cookie
result.HasCookie("name")               // Check a response cookie
result.ResponseCookies()               // All response cookies
result.RequestCookies()                // All request cookies
result.GetRequestCookie("name")        // Get a request cookie
result.HasRequestCookie("name")        // Check a request cookie
result.SaveToFile("/path/to/file")     // Save to a file
result.String()                        // Human-readable representation (sensitive headers redacted)
```

```go
// Metadata (result.Meta)
result.Meta.Duration       // Total duration (including retry waits)
result.Meta.Attempts       // Attempts made (including the first)
result.Meta.RedirectChain  // Chain of redirect URLs followed
result.Meta.RedirectCount  // Number of redirects
result.Meta.ProxyURL       // Proxy used for the final request (empty for direct or system proxy)

// Struct fields (prefer the nil-safe methods above)
result.Request.URL            // Request URL
result.Request.Method         // Request method
result.Request.Headers        // Request headers
result.Response.Status        // "200 OK"
result.Response.Headers       // Response headers (http.Header)
result.Response.ContentLength // Content-Length
```

## Configuration

For all fields, see the [Configuration API](../api-reference/client-config/config).

```go
cfg := httpc.DefaultConfig()

// Timeouts
cfg.Timeouts.Request = 30 * time.Second        // Overall budget (includes retries), default 180s
cfg.Timeouts.Dial = 10 * time.Second           // TCP connection, default 10s
cfg.Timeouts.TLSHandshake = 10 * time.Second   // TLS handshake, default 10s
cfg.Timeouts.ResponseHeader = 30 * time.Second // Default 0 (off); once set it is a transport-layer hard cap that WithTimeout cannot override
cfg.Timeouts.IdleConn = 90 * time.Second       // Idle connections, default 90s

// Connection
cfg.Connection.MaxIdleConns = 50        // Global idle-connection cap (default 50, max 1000)
cfg.Connection.MaxConnsPerHost = 10     // Per-host connection cap (default 10, max 1000)
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// Proxy pool (rotation + passive circuit breaking)
cfg.Connection.ProxyPool = []string{"http://p1:8080", "http://p2:8080"}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin // or ProxyStrategyRandom
cfg.Connection.ProxyFailureThreshold = 3   // N consecutive failures temporarily removes a proxy (default 3)
cfg.Connection.ProxyCooldown = 30 * time.Second // Half-open probe cooldown after removal (default 30s)
cfg.Connection.ProxyRotatePerRequest = true     // New IP per request (sacrifices connection reuse)
cfg.Connection.ProxyRotateOnStatus = []int{403} // Rotate proxy and retry on these status codes (requires MaxRetries > 0)

// DNS-over-HTTPS
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // Default 5 minutes

// Security
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // Default 10MB
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024 // Default 100MB (decompression-bomb guard)
cfg.Security.MaxRequestBodySize = 50 * 1024 * 1024       // Default 0 (no upload limit)
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
cfg.Security.RedirectWhitelist = []string{"api.example.com"} // Redirect-target whitelist

// Certificate pinning (MITM defense, even if a trusted CA is compromised)
pinner, _ := httpc.NewSPKIHashPinner("base64-spki-sha256-hash", "backup-hash") // Multiple hashes support rotation
cfg.Security.CertificatePinner = pinner

// Retry
cfg.Retry.MaxRetries = 3                   // Default 3; 0 disables; max 10
cfg.Retry.Delay = 1 * time.Second          // Initial delay, default 1s
cfg.Retry.BackoffFactor = 2.0              // Backoff multiplier, default 2.0 (range 1.0-10.0)
cfg.Retry.MaxRetryDelay = 30 * time.Second // Per-wait cap, default 30s
cfg.Retry.EnableJitter = true              // Jitter, on by default
cfg.Retry.CustomPolicy = myPolicy          // Custom policy (implement ShouldRetry/GetDelay/MaxRetries)
```

## Middleware

See the [Middleware Chain guide](../guides/middleware-chain).

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(&httpc.LoggingConfig{LogFunc: log.Printf}),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware(httpc.DefaultRequestIDConfig()),
    httpc.TimeoutMiddleware(&httpc.TimeoutMiddlewareConfig{Duration: 30 * time.Second}),
    httpc.MetricsMiddleware(&httpc.MetricsConfig{
        OnMetrics: func(method, url string, statusCode int, duration time.Duration, err error) {
            metrics.Record(method, statusCode, duration)
        },
    }),
    httpc.AuditMiddleware(&httpc.AuditConfig{
        OnAudit: func(event httpc.AuditEvent) {
            log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
        },
    }),
    httpc.HeaderMiddleware(&httpc.HeaderConfig{ // Static headers (CRLF validated at creation)
        Headers: map[string]string{"X-Service": "api"},
    }),
}
```

```go
// Custom middleware: request phase before next (registration order), response phase after next (reverse order)
func traceMiddleware(next httpc.Handler) httpc.Handler {
    return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
        req.SetHeader("X-Trace", "on") // Request phase
        resp, err := next(ctx, req)    // Hand off to the inner layer
        if resp != nil {
            log.Printf("-> %d", resp.StatusCode()) // Response phase
        }
        return resp, err
    }
}
// Register: cfg.Middleware.Middlewares = append(cfg.Middleware.Middlewares, traceMiddleware)
// Compose: httpc.Chain(mw1, mw2)(finalHandler)
```

:::warning Do not use for Download or streaming requests
`TimeoutMiddleware` is not suitable for `Download` or `WithStreamBody(true)` requests: the middleware rejects streaming requests on entry, returning `TimeoutMiddleware is incompatible with streaming responses`. Use `WithTimeout` for such cases instead.
:::

## Error Handling

See the [Error Handling guide](../guides/error-handling).

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // Timeout
        case httpc.ErrorTypeNetwork:
            // Network error
        case httpc.ErrorTypeTLS:
            // TLS error
        case httpc.ErrorTypeDNS:
            // DNS resolution error
        case httpc.ErrorTypeContextCanceled:
            // Context canceled
        case httpc.ErrorTypeRetryExhausted:
            // Retries exhausted
        case httpc.ErrorTypeValidation:
            // Request validation error
        case httpc.ErrorTypeHTTP:
            // HTTP-layer error
        // Others: ErrorTypeUnknown, ErrorTypeResponseRead,
        //         ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // Retryable
        }
    }
}
```

```go
// Error short codes (ClientError.Code())
switch clientErr.Code() {
case "TIMEOUT":           // Timeout
case "NETWORK_ERROR":     // Network error
case "TLS_ERROR":         // TLS handshake/protocol error
case "CERTIFICATE_ERROR": // Certificate validation error
case "DNS_ERROR":         // DNS resolution error
case "CONTEXT_CANCELED":  // Context canceled
case "RETRY_EXHAUSTED":   // Retries exhausted
case "VALIDATION_ERROR":  // Request validation error (CRLF/illegal headers, etc.)
case "HTTP_ERROR":        // HTTP-layer error
case "TRANSPORT_ERROR", "RESPONSE_READ_ERROR", "UNKNOWN_ERROR":
}

// Sentinel errors (errors.Is)
errors.Is(err, httpc.ErrClientClosed)         // Using a closed client
errors.Is(err, httpc.ErrResponseBodyEmpty)    // Unmarshal on an empty body
errors.Is(err, httpc.ErrResponseBodyTooLarge) // Parse body over 50MB
errors.Is(err, httpc.ErrFileExists)           // Download target exists without Overwrite/Resume
errors.Is(err, httpc.ErrEmptyFilePath)        // DownloadConfig.FilePath not set

// Retryability quick reference
// Always retryable: timeouts, transport errors
// Depends on cause: network errors, DNS (temporary/timeout), HTTP 408/429/500/502/503/504
// Never retryable: context cancellation, validation errors, TLS, certificate errors
```

## File Download

See the [File Upload & Download guide](../guides/file-transfer).

```go
// Basic download (ctx is a context.Context, e.g. context.Background())
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlResult, err := client.Download(ctx, url, dlCfg)

// With options (overwrite, resume, progress)
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%.2f MB/s)", float64(downloaded)/float64(total)*100, float64(speed)/1024/1024)
}
dlResult, err := client.Download(ctx, url, dlCfg)

// Checksum verification (checked after the download; a mismatch fails and deletes the file)
dlCfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
dlCfg.ChecksumAlgorithm = httpc.ChecksumSHA256 // Currently only sha256 is supported

// Package-level download (uses the default client)
dlResult, err := httpc.Download(ctx, url, dlCfg)

// dlResult is of type *DownloadResult (not *Result)
// Fields: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## Domain Client

See the [Domain Client & Sessions guide](../guides/domain-session).

```go
dc, _ := httpc.NewDomainDefault("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```

```go
// Session headers / cookie management
dc.SetHeaders(map[string]string{"Authorization": "Bearer " + token, "Accept": "application/json"})
dc.DeleteHeader("Authorization")
dc.ClearHeaders()
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc"}) // Set-Cookie from responses also enters the session automatically
dc.GetCookie("session")
dc.ClearCookies()
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"
dc.Session() // *SessionManager (thread safe)

// URL joining: relative paths resolve against the base; full URLs are used as-is; escaping the base path is an error
result, _ = dc.Get("/repos/golang/go")       // https://api.example.com/repos/golang/go
result, _ = dc.Get("https://other.host/api") // Pass-through

// The session manager can also be used standalone
sm, _ := httpc.NewSessionManagerDefault()
sm.SetHeader("X-App", "demo")
sm.UpdateFromResult(result) // Extracts Set-Cookie from the response
```

:::warning Request options are applied twice
Request options passed to a `DomainClient` are applied twice internally (session capture + the real request). Options should not contain side-effecting logic (counters, one-time nonces).
:::

## Scenario Recipes

For more combined scenarios, see the [Hands-On Tutorial](../guides/tutorial).

```go
// Per-request timeout (overrides instance configuration)
result, err := client.Get(url, httpc.WithTimeout(30*time.Second))

// Long-response APIs (AI/LLM endpoints): the overall timeout defaults to 180s and can be relaxed
result, err := httpc.Post(url,
    httpc.WithJSON(payload),
    httpc.WithTimeout(900*time.Second),
)

// Disable retries for this request / raise the retry cap
httpc.WithMaxRetries(0)
httpc.WithMaxRetries(5)

// Disable redirects / limit the hop count
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(3)

// Access intranet services (per-request SSRF exemption)
result, err := httpc.Get("http://10.0.0.5:8080/health",
    httpc.WithAllowPrivateIPs(true),
)

// Cancellation and deadline control
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// Upload JSON + auth + timeout in one shot
result, err := httpc.Post("https://api.example.com/orders",
    httpc.WithJSON(order),
    httpc.WithBearerToken(token),
    httpc.WithTimeout(15*time.Second),
)
```
