---
sidebar_label: "Error Types"
title: "Error Types - CyberGo HTTPC | ClientError In Detail"
description: "HTTPC error types: the ClientError fields and Code, IsRetryable, and Unwrap methods, 12 ErrorType enums, 17 sentinel errors, and errors.Is/As matching."
sidebar_position: 30
---

# Error Types

HTTPC uses a two-layer error model: the lower layer is the standard `error` interface, and the upper layer is the classified `ClientError` struct. Network-layer request failures are mapped by `classifyError` to a context-carrying `ClientError`, which provides an error type, a retryability check, and structured fields.

HTTP-layer errors (4xx/5xx) are not returned as errors; check them via `Result.StatusCode()`.

## ClientError

```go
type ClientError = engine.ClientError
```

Classified HTTP client error, extracted via `errors.As`. It is a type alias of the internal `engine.ClientError`.

### Struct Fields

```go
type ClientError struct {
    Type       ErrorType  // Error classification
    Message    string     // Error description
    Cause      error      // Underlying error
    URL        string     // Request URL (sanitized)
    Method     string     // HTTP method
    Attempts   int        // Number of attempts made
    StatusCode int        // HTTP status code (if applicable)
    Host       string     // Hostname (for circuit breakers)
    ProxyURL   string     // Redacted URL of the proxy used for the final attempt (empty for direct connections, pre-dispatch errors, and system proxy)
}
```

| Field | Type | Description | Typical value |
|------|------|------|--------|
| `ClientError.Type` | `ErrorType` | Error classification, for switch branching | `ErrorTypeNetwork`, `ErrorTypeTimeout` |
| `ClientError.Message` | `string` | Error description | `"network operation failed"` |
| `ClientError.Cause` | `error` | Underlying error, obtainable via `Unwrap()` | `*net.OpError`, `*net.DNSError` |
| `ClientError.URL` | `string` | Request URL (credentials sanitized) | `"https://example.com/path"` |
| `ClientError.Method` | `string` | HTTP method | `"GET"`, `"POST"` |
| `ClientError.Attempts` | `int` | Number of attempts (including the first request) | `1` (first failure), `4` (after 3 retries) |
| `ClientError.StatusCode` | `int` | HTTP status code (0 for non-HTTP errors) | `0` (network error), `503` (server error) |
| `ClientError.Host` | `string` | Request hostname (for circuit breakers) | `"example.com"` |
| `ClientError.ProxyURL` | `string` | Redacted URL of the proxy used for the final attempt (password masked, safe to log); empty for direct connections, for errors raised before dispatch (validation or callback failures), and under `EnableSystemProxy`; with proxy rotation it reports the last attempt's proxy | `"http://proxy:8080"` |

`Host` lets circuit breakers track failures per hostname, `Message` can be logged directly, and `Cause` preserves the underlying error for `errors.As` inspection. `ProxyURL` is the value the transport records when it selects a proxy, the same source that populates `Result.Meta.ProxyURL` on success, so a dial failure still reports which proxy was about to be used.

### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *ClientError) Error() string` | Formatted as `"METHOD url: message: cause (attempt N)"` |
| `Code` | `func (e *ClientError) Code() string` | Returns a short error code, e.g. `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable` | `func (e *ClientError) IsRetryable() bool` | Returns whether this error is retryable |
| `Unwrap` | `func (e *ClientError) Unwrap() error` | Returns `ClientError.Cause`, supporting `errors.Is`/`errors.As` traversal of the error chain |

All four methods are defined on the `*ClientError` pointer receiver. `ClientError.Error` implements the `error` interface; `ClientError.Code` and `ClientError.IsRetryable` serve log classification and retry decisions; `ClientError.Unwrap` exposes the underlying cause.

### Error() Formatting

`Error()` formats the error into a readable string:

- Both URL and Method present: `"GET https://example.com: network operation failed: dial tcp ... (attempt 1)"`
- `Message` only: outputs `Message` directly
- Has Cause: appends `": " + Cause.Error()`
- Has Attempts (>0): appends `" (attempt N)"`

The URL is sanitized via `SanitizeURL` (credentials removed) before output. Errors produced by the engine classification path are pre-sanitized (`urlSanitized=true`), so the redundant url.Parse call is skipped and no allocation occurs per log output.

### Code() Error Codes

`Code()` returns a short string identifying the error type, used for log classification and monitoring alerts:

| ErrorType | Code() return value |
|-----------|---------------|
| `ErrorTypeNetwork` | `"NETWORK_ERROR"` |
| `ErrorTypeTimeout` | `"TIMEOUT"` |
| `ErrorTypeContextCanceled` | `"CONTEXT_CANCELED"` |
| `ErrorTypeResponseRead` | `"RESPONSE_READ_ERROR"` |
| `ErrorTypeTransport` | `"TRANSPORT_ERROR"` |
| `ErrorTypeRetryExhausted` | `"RETRY_EXHAUSTED"` |
| `ErrorTypeTLS` | `"TLS_ERROR"` |
| `ErrorTypeCertificate` | `"CERTIFICATE_ERROR"` |
| `ErrorTypeDNS` | `"DNS_ERROR"` |
| `ErrorTypeValidation` | `"VALIDATION_ERROR"` |
| `ErrorTypeHTTP` | `"HTTP_ERROR"` |
| `ErrorTypeUnknown` (and others) | `"UNKNOWN_ERROR"` |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    log.Printf("error code: %s, URL: %s, attempts: %d, retryable: %v",
        clientErr.Code(), clientErr.URL, clientErr.Attempts, clientErr.IsRetryable())
}
```

## IsRetryable Decision Logic

`IsRetryable()` decides whether a single error is retryable: it checks context errors first, then dispatches by `ErrorType`. The table below is the complete rule set; for the retry strategy as a whole, see [Retry and Fault Tolerance](../../guides/retry-fault-tolerance).

1. **Context errors first**: if Cause is `context.Canceled` or `context.DeadlineExceeded`, return false immediately and never retry.
2. **Dispatch by ErrorType**: see the table.

| ErrorType | Retryable | Decision logic |
|-----------|:----------:|----------|
| `ErrorTypeNetwork` | Conditional | Inspect Cause: wrapped ClientError -> recursive check; `*net.OpError` -> timeout or retryable syscall (ECONNREFUSED/ECONNRESET/EPIPE/ETIMEDOUT/ENETUNREACH/EHOSTUNREACH); `net.Error` -> retryable by default; message match ("connection reset"/"eof"/"broken pipe", etc.) |
| `ErrorTypeTimeout` | Yes | All transport-layer timeouts are retryable |
| `ErrorTypeTransport` | Yes | HTTP transport-layer errors |
| `ErrorTypeResponseRead` | Conditional | Only read operations (`Op == "read"` or `"readfrom"`) are retryable; write operations are not |
| `ErrorTypeDNS` | Conditional | When Cause is `*net.DNSError`, retry only if `IsTemporary` or `IsTimeout` is true |
| `ErrorTypeHTTP` | Conditional | Retryable when StatusCode hits `retryableStatusCodes` (408/429/500/502/503/504) |
| `ErrorTypeContextCanceled` | No | Canceled by the caller |
| `ErrorTypeValidation` | No | The request itself is invalid; retrying cannot help |
| `ErrorTypeTLS` | No | TLS protocol error; retrying cannot help |
| `ErrorTypeCertificate` | No | Certificate verification failed; retrying cannot help |
| `ErrorTypeRetryExhausted` | No | Retries already exhausted |
| `ErrorTypeUnknown` | No | Unknown error; not retried by default |

### retryableStatusCodes

```go
var retryableStatusCodes = map[int]bool{
    408: true, // Request Timeout
    429: true, // Too Many Requests
    500: true, // Internal Server Error
    502: true, // Bad Gateway
    503: true, // Service Unavailable
    504: true, // Gateway Timeout
}
```

This is the single source of truth for HTTP-status-code-triggered retries, shared by the retry logic and `IsRetryable()`.

:::tip Subtle distinction among timeout types
`ErrorTypeTimeout` is retryable, but **timeouts triggered by a context deadline are not**: `context.DeadlineExceeded` is intercepted at step 1 and returns false. Only transport-layer timeouts (e.g. `net.OpError.Timeout()`) reach step 2 and count as retryable, so a `WithTimeout` deadline is never exceeded by retries.
:::

## ErrorType

```go
type ErrorType = engine.ErrorType
```

Error classification enum (type `int`).

| Constant | Value | Meaning | Typical trigger scenario | Retryable |
|------|-----|------|-------------|:------:|
| `ErrorTypeUnknown` | 0 | Unknown/unclassified | Matches no known pattern | No |
| `ErrorTypeNetwork` | 1 | Network-layer error | Connection refused, connection reset, network unreachable | Conditional |
| `ErrorTypeTimeout` | 2 | Timeout | `net.OpError` timeout, context deadline | Conditional |
| `ErrorTypeContextCanceled` | 3 | Context canceled | Triggered by `context.Cancel` | No |
| `ErrorTypeResponseRead` | 4 | Response-body read error | EOF/connection drop while reading the body | Conditional |
| `ErrorTypeTransport` | 5 | Transport-layer error | HTTP protocol error, transport failure | Yes |
| `ErrorTypeRetryExhausted` | 6 | Retries exhausted | Still failing after reaching MaxRetries | No |
| `ErrorTypeTLS` | 7 | TLS error | TLS handshake failure, protocol mismatch | No |
| `ErrorTypeCertificate` | 8 | Certificate verification error | x509 certificate expired/untrusted | No |
| `ErrorTypeDNS` | 9 | DNS resolution error | Domain does not exist, DNS timeout | Conditional |
| `ErrorTypeValidation` | 10 | Request validation error | Malformed URL, redirect limit exceeded, CRLF injection | No |
| `ErrorTypeHTTP` | 11 | HTTP-layer error | Assigned only by the classifier's **error-message pattern match** (message contains `HTTP 4xx`/`HTTP 5xx`). A normal 4xx/5xx response is not an error; an error returned by custom middleware never reaches the classifier, so it cannot carry this type | Conditional |

> ¹ Timeouts triggered by a context deadline (`WithTimeout`, `TimeoutConfig.Request`) are **not** retried; only transport-level timeouts (e.g. `net.OpError` timeout) are retried.
> ² See [IsRetryable decision logic](#isretryable-decision-logic) above.

### Type Checking

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("request timed out")
        case httpc.ErrorTypeNetwork:
            log.Println("network error:", clientErr.Message)
        case httpc.ErrorTypeTLS:
            log.Println("TLS error")
        case httpc.ErrorTypeCertificate:
            log.Println("certificate verification failed")
        case httpc.ErrorTypeDNS:
            log.Println("DNS resolution failed")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("retries exhausted, attempted", clientErr.Attempts, "times")
        case httpc.ErrorTypeContextCanceled:
            log.Println("request canceled")
        case httpc.ErrorTypeValidation:
            log.Println("request validation failed")
        }
    }
}
```

## URL Sanitization Mechanism

`ClientError.Error()` calls `validation.SanitizeURL` when formatting to remove credentials from the URL (`user:pass@host` -> `***:***@host`), keeping sensitive data out of logs and error messages.

```go
// Original URL: https://admin:secret@api.example.com/data
// Error() output: GET https://***:***@api.example.com/data: ...
```

The engine classification path (`classifyErrorWithSanitizedURL`) sanitizes at first classification and sets `urlSanitized=true`, so later `Error()` calls skip the redundant url.Parse and allocate nothing per log output.

:::tip Error sanitization in callbacks
In callbacks of middleware such as `MetricsMiddleware` and `LoggingMiddleware`, HTTPC additionally inspects the messages of non-`ClientError` errors and replaces any original URL with a sanitized version, so callbacks do not leak credentials.
:::

## Error Classification Flow

`classifyError` maps an underlying `error` to a `*ClientError`, checking layer by layer in this order:

1. **Context errors**: `context.Canceled` -> `ErrorTypeContextCanceled`; `context.DeadlineExceeded` -> `ErrorTypeTimeout`
2. **Connection-pool exhaustion**: `connection.ErrPoolExhausted` -> `ErrorTypeNetwork`
3. **`*url.Error` unwrap**: invalid HTTP/2 header, URL parse failure -> `ErrorTypeValidation`; otherwise unwrap the inner error and continue
4. **`*net.DNSError`**: `ErrorTypeDNS`, distinguishing timeout from failure
5. **`*net.OpError`**: `ErrorTypeNetwork`, distinguishing timeout from operation failure
6. **`net.Error`**: timeout -> `ErrorTypeTimeout`; other -> `ErrorTypeNetwork`
7. **Message-pattern matching** (fallback): matches 20+ patterns by keywords in the error message (TLS/certificate/timeout/connection refused, etc.)
8. **Fallback**: when the inner of a `url.Error` matches no pattern -> `ErrorTypeNetwork`; otherwise -> `ErrorTypeUnknown`

## Error Variables

### Configuration Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrNilConfig` | `"config cannot be nil"` | nil Config passed to `New`/`ValidateConfig` |
| `ErrInvalidTimeout` | `"invalid timeout"` | Timeout value is 0, negative, or above the 30-minute cap (`WithTimeout`); for no timeout use `WithNoTimeout` |
| `ErrInvalidRetry` | `"invalid retry configuration"` | MaxRetries outside 0-10, BackoffFactor outside 1.0-10.0 |
| `ErrInvalidConnection` | `"invalid connection configuration"` | MaxIdleConns/MaxConnsPerHost out of range, malformed ProxyURL |
| `ErrInvalidSecurity` | `"invalid security configuration"` | A body-size cap is out of range, a TLS version is invalid or min exceeds max, `SSRFExemptCIDRs` holds an invalid CIDR, a `SensitiveHeaders` key is invalid, or `TLSFingerprint` is unknown or combined with `TLSConfig` |
| `ErrInvalidMiddleware` | `"invalid middleware configuration"` | `Defaults.UserAgent` exceeds 512 characters or contains control characters |
| `ErrInvalidHeader` | `"invalid header"` | Header key-value contains control characters or exceeds the size limit |

### Request and Response Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrEmptyFilePath` | `"file path cannot be empty"` | DownloadConfig.FilePath is empty |
| `ErrFileExists` | `"file already exists"` | File exists and Overwrite=false and ResumeDownload=false |
| `ErrResponseBodyEmpty` | `"response body is empty"` | Calling Unmarshal or similar parsing methods on an empty body |
| `ErrResponseBodyTooLarge` | `"response body too large"` | The body parsed by `Result.Unmarshal` exceeds the 50 MB JSON cap. The engine-side size cap (`Security.MaxResponseBodySize`) reports `response body exceeds limit of N bytes` instead, which is **not** this sentinel |
| `ErrInvalidMaxRedirects` | `"invalid max redirects"` | [`WithMaxRedirects`](../core/options#withmaxredirects) passed a negative value or one exceeding 50, or `Security.MaxRedirects` outside 0-50 |
| `ErrInvalidCredentials` | `"invalid credentials"` | [`WithBasicAuth`](../core/options#withbasicauth)/[`WithBearerToken`](../core/options#withbearertoken) credentials empty, oversized, or containing invalid characters |
| `ErrStreamBodyRequiresDownload` | `"WithStreamBody requires Download; standard request methods buffer the response body"` | [`WithStreamBody`](../core/options#withstreambody)(true) combined with the standard request methods (Get/Post/.../Request); streaming works only on the `Download` path |

### Download and Proxy Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrDownloadInProgress` | `"download already in progress for this file path"` | A download to the same file path is already running in this process; the second caller fails immediately instead of blocking, and can retry once the first download finishes. The mutex is in-process only; cross-process coordination is the caller's responsibility |
| `ErrProxyConnectionFailed` | `"proxy connection failed"` | A configured proxy could not be dialed (dial failure, invalid address, refused connection, etc.); wrapped with the underlying cause in the error chain and detectable via `errors.Is`. The retry engine uses it to move to the next proxy |

### Client Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrClientClosed` | `"client is closed"` | Using the client after Close() |

## Security Warning API

### SetSecurityWarnOutput

<!-- check-code: skip -->
```go
func SetSecurityWarnOutput(w io.Writer)
```

Sets the output target of security warnings (default `os.Stderr`); defined in `warnings.go`. Passing `io.Discard` suppresses all warnings. A test environment is detected from the executable name (`.test` suffix) and the `GO_TEST`/`GOTEST` environment variables.

Three configurations trigger warnings in **non-test environments**, each printed at most once per process (`sync.Once`):

| Trigger condition | Warning summary |
|---------|---------|
| A client created with `TestingConfig()` is used outside a test environment | Points out that TLS certificate verification, SSRF protection, and URL/Header validation are all disabled, and recommends `SecureConfig()` or `DefaultConfig()` instead |
| `Security.InsecureSkipVerify=true` in a non-test environment | Points out that TLS certificate verification is disabled, that it should only be used in tests, and that production should use `SecureConfig()` |
| A hand-built `Config` hits the all-off signature (`ValidateURL`/`ValidateHeaders`/`StrictContentLength`/`FollowRedirects`/`EnableHTTP2` all false and `Security.MaxResponseBodySize == 0`) | Prints `[CONFIG WARNING]`: those `Default: true` fields are true only in `DefaultConfig()`/presets, and a struct literal zeroes them; start from `DefaultConfig()` instead |

```go
// Suppress security warnings (only use after confirming the configuration is safe)
httpc.SetSecurityWarnOutput(io.Discard)

// Change the output to a custom log
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning Don't overuse suppression
`SetSecurityWarnOutput(io.Discard)` silently swallows security warnings. Use it only after fully auditing the configuration (e.g. confirming that `TestingConfig` is used only in test binaries); do not use it to mask warnings in a production deployment. For the complete list of security practices, see the [Security Overview](../../security/).
:::

## Practical Matching Patterns

### errors.As to Extract ClientError

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        // Access structured fields
        fmt.Printf("error code: %s\n", clientErr.Code())
        fmt.Printf("error type: %d\n", clientErr.Type)
        fmt.Printf("request: %s %s\n", clientErr.Method, clientErr.URL)
        fmt.Printf("attempts: %d\n", clientErr.Attempts)
        if clientErr.StatusCode != 0 {
            fmt.Printf("status code: %d\n", clientErr.StatusCode)
        }
    }
}
```

### errors.Is to Match Sentinel Errors

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Client is closed; recreate it
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Response body is empty; skip parsing
}
if errors.Is(err, httpc.ErrFileExists) {
    // File already exists; prompt the user or set Overwrite=true
}
```

### errors.Unwrap to Traverse the Error Chain

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    // Cause is the underlying error (e.g. *net.OpError)
    cause := clientErr.Unwrap()
    if cause != nil {
        var opErr *net.OpError
        if errors.As(cause, &opErr) {
            fmt.Println("operation:", opErr.Op)
            fmt.Println("network:", opErr.Net)
            fmt.Println("address:", opErr.Addr)
        }
    }
}
```

:::tip Choosing among the three matching styles
- `errors.As`: to access structured `ClientError` fields (Type/Code/URL/Attempts, etc.).
- `errors.Is`: to match sentinel errors (config and file errors such as `ErrClientClosed`).
- `errors.Unwrap`: to reach the bottom-level net/error for system-level diagnostics.
:::

## See Also

- [Error Handling](../../guides/error-handling) - Complete error handling guide
- [Constants and Types](./constants) - BodyKind and other constants reference
- [Retry and Fault Tolerance](../../guides/retry-fault-tolerance) - Retry strategy guide
- [Security Overview](../../security/) - SetSecurityWarnOutput and security configuration practices
