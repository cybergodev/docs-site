---
sidebar_label: "Error Types"
title: "Error Types - CyberGo HTTPC | ClientError In Detail"
description: "HTTPC error types: eight-field ClientError with Code, IsRetryable, and Unwrap methods, twelve ErrorType enums, sentinel errors, and errors.Is/As matching."
sidebar_position: 30
---

# Error Types

HTTPC uses a two-layer error model: the lower layer is the standard `error` interface, and the upper layer is the classified `ClientError` struct. All request failures (network layer) are mapped by `classifyError` to a context-carrying `ClientError`, providing an error type, a retryability check, and structured fields. HTTP-layer errors (4xx/5xx) are not returned as errors but checked via `Result.StatusCode()`.

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

Among them, `Host` lets circuit breakers track failures per hostname, `Message` is suitable for direct logging, and `Cause` preserves the underlying error for `errors.As` inspection.

### Methods

| Method | Signature | Description |
|------|------|------|
| `Error` | `func (e *ClientError) Error() string` | Formatted as `"METHOD url: message: cause (attempt N)"` |
| `Code` | `func (e *ClientError) Code() string` | Returns a short error code, e.g. `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable` | `func (e *ClientError) IsRetryable() bool` | Whether this error is worth retrying |
| `Unwrap` | `func (e *ClientError) Unwrap() error` | Returns `ClientError.Cause`, supporting `errors.Is`/`errors.As` traversal of the error chain |
| `WithType` | `func (e *ClientError) WithType(t ErrorType) *ClientError` | Returns a **copy** with the error type set (does not modify the original) |

All five methods are defined on the `*ClientError` pointer receiver: `ClientError.Error` implements the `error` interface; `ClientError.Code` and `ClientError.IsRetryable` serve log classification and retry decisions; `ClientError.Unwrap` exposes the underlying cause; `ClientError.WithType` returns a copy with the type rewritten, leaving the original error untouched.

### Error() Formatting

`Error()` formats the error into a readable string:

- Both URL and Method present: `"GET https://example.com: network operation failed: dial tcp ... (attempt 1)"`
- `Message` only: outputs `Message` directly
- Has Cause: appends `": " + Cause.Error()`
- Has Attempts (>0): appends `" (attempt N)"`

The URL is automatically sanitized via `SanitizeURL` (credentials removed) before output. Errors produced by the engine classification path are pre-sanitized (`urlSanitized=true`), skipping the redundant url.Parse call to avoid allocations.

### Code() Error Codes

`Code()` returns a short string identifying the error type, convenient for log classification and monitoring alerts:

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

`IsRetryable()` is the core decision method for HTTPC's retry mechanism. Decision flow:

1. **Check context errors first**: if Cause is `context.Canceled` or `context.DeadlineExceeded`, returns false immediately (never retried)
2. **Dispatch by ErrorType**:

| ErrorType | Retryable | Decision logic |
|-----------|:----------:|----------|
| `ErrorTypeNetwork` | Conditional | Inspect Cause: wrapped ClientError -> recursive check; `*net.OpError` -> timeout or retryable syscall (ECONNREFUSED/ECONNRESET/EPIPE/ETIMEDOUT/ENETUNREACH/EHOSTUNREACH); `net.Error` -> retryable by default; message match ("connection reset"/"eof"/"broken pipe", etc.) |
| `ErrorTypeTimeout` | Yes | All transport-layer timeouts are retryable |
| `ErrorTypeTransport` | Yes | HTTP transport-layer errors |
| `ErrorTypeResponseRead` | Conditional | Only read operations (`Op == "read"` or `"readfrom"`) are retryable; write operations are not |
| `ErrorTypeDNS` | Conditional | When Cause is `*net.DNSError`, retries only if `IsTemporary` or `IsTimeout` is true |
| `ErrorTypeHTTP` | Conditional | Retryable when StatusCode hits `retryableStatusCodes` (408/429/500/502/503/504) |
| `ErrorTypeContextCanceled` | No | User-initiated cancellation |
| `ErrorTypeValidation` | No | The request itself is invalid; retrying is pointless |
| `ErrorTypeTLS` | No | TLS protocol errors usually do not self-heal |
| `ErrorTypeCertificate` | No | Certificate verification failed; retrying is pointless |
| `ErrorTypeRetryExhausted` | No | Retries already exhausted |
| `ErrorTypeUnknown` | No | Unknown error; conservatively not retried |

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

This is the single source of truth for HTTP-status-code-triggered retries, used by both the retry logic and `IsRetryable()`.

:::tip Subtle distinction among timeout types
`ErrorTypeTimeout` is retryable, but **timeouts triggered by a context deadline are not retryable** — because `context.DeadlineExceeded` is intercepted at step 1 (returns false). Only transport-layer timeouts (e.g. `net.OpError.Timeout()`) reach step 2 and are deemed retryable. This ensures the user's `WithTimeout` is not breached by retries.
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
| `ErrorTypeHTTP` | 11 | HTTP-layer error | 4xx/5xx response (produced only in retry scenarios) | Conditional |

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

`ClientError.Error()` automatically calls `validation.SanitizeURL` when formatting to remove credentials from the URL (`user:pass@host` -> `***:***@host`), preventing sensitive information from leaking into logs and error messages.

```go
// Original URL: https://admin:secret@api.example.com/data
// Error() output: GET https://***:***@api.example.com/data: ...
```

The engine classification path (`classifyErrorWithSanitizedURL`) performs sanitization at first classification and sets `urlSanitized=true`; subsequent `Error()` calls skip the redundant url.Parse to avoid allocations on every log output.

:::tip Error sanitization in callbacks
In callbacks for middleware such as `MetricsMiddleware` and `LoggingMiddleware`, HTTPC additionally checks error messages of non-ClientError errors, replacing the original URL with a sanitized version to ensure callbacks never leak credentials.
:::

## Error Classification Flow

`classifyError` is the core function that maps an underlying `error` to a `*ClientError`, checking layer by layer in this order:

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
| `ErrInvalidTimeout` | `"invalid timeout"` | Timeout value is negative or exceeds the 30-minute cap |
| `ErrInvalidRetry` | `"invalid retry configuration"` | MaxRetries outside 0-10, BackoffFactor outside 1.0-10.0 |
| `ErrInvalidConnection` | `"invalid connection configuration"` | MaxIdleConns/MaxConnsPerHost out of range, malformed ProxyURL |
| `ErrInvalidSecurity` | `"invalid security configuration"` | MaxResponseBodySize outside the 0-1GB range |
| `ErrInvalidMiddleware` | `"invalid middleware configuration"` | MaxRedirects outside 0-50, UserAgent too long or contains control characters |
| `ErrInvalidHeader` | `"invalid header"` | Header key-value contains control characters or exceeds the size limit |

### Request and Response Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrEmptyFilePath` | `"file path cannot be empty"` | DownloadConfig.FilePath is empty |
| `ErrFileExists` | `"file already exists"` | File exists and Overwrite=false and ResumeDownload=false |
| `ErrResponseBodyEmpty` | `"response body is empty"` | Calling Unmarshal or similar parsing methods on an empty body |
| `ErrResponseBodyTooLarge` | `"response body too large"` | Response body exceeds MaxResponseBodySize |
| `ErrInvalidMaxRedirects` | `"invalid max redirects"` | [`WithMaxRedirects`](../core/options#withmaxredirects) passed a negative value or one exceeding 50 |
| `ErrInvalidCredentials` | `"invalid credentials"` | [`WithBasicAuth`](../core/options#withbasicauth)/[`WithBearerToken`](../core/options#withbearertoken) credentials empty, oversized, or containing invalid characters |
| `ErrStreamBodyRequiresDownload` | `"WithStreamBody requires Download; standard request methods buffer the response body"` | [`WithStreamBody`](../core/options#withstreambody)(true) combined with the standard request methods (Get/Post/.../Request) — streaming only takes effect on the `Download` path; every other path rejects the request instead of silently returning an empty body |

### Download and Proxy Errors

| Variable | Error message | Trigger condition |
|------|----------|----------|
| `ErrDownloadInProgress` | `"download already in progress for this file path"` | A download targeting the same file path is already running in this process — two concurrent downloads to one destination would corrupt each other's writes, so the second caller fails fast instead of blocking; retry once the first download finishes. The mutex is in-process only; coordinating downloads across separate processes is the caller's responsibility |
| `ErrProxyConnectionFailed` | `"proxy connection failed"` | A configured proxy could not be dialed (dial failure, invalid address, refused connection, etc.). Wrapped alongside the underlying cause in the error chain and detectable with `errors.Is(err, httpc.ErrProxyConnectionFailed)`; the retry engine also uses it to decide whether to retry with the next proxy in the pool |

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

Redirects the output target of security warnings (default `os.Stderr`); defined in `warnings.go`. Passing `io.Discard` suppresses the warnings entirely. Test environments are detected by the executable file name (`.test` suffix) and the `GO_TEST`/`GOTEST` environment variables.

Two categories of dangerous configuration trigger warnings in **non-test environments**, each printed at most once per process (`sync.Once`):

| Trigger condition | Warning summary |
|---------|---------|
| A client created with `TestingConfig()` is used outside a test environment | Points out that TLS certificate verification, SSRF protection, and URL/Header validation are all disabled, and recommends `SecureConfig()` or `DefaultConfig()` instead |
| `Security.InsecureSkipVerify=true` in a non-test environment | Points out that TLS certificate verification is disabled, that it should only be used in tests, and that production should use `SecureConfig()` |

```go
// Suppress security warnings (only use after confirming the configuration is safe)
httpc.SetSecurityWarnOutput(io.Discard)

// Redirect to a custom log output
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning Don't overuse suppression
`SetSecurityWarnOutput(io.Discard)` silently swallows security warnings. Use it only after fully auditing your configuration (e.g. confirming that `TestingConfig` is only used in test binaries), and never to mask warnings in a production deployment. For the complete list of security practices, see the [Security Overview](../../security/).
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
- `errors.As`: when you need to access ClientError's structured fields (Type/Code/URL/Attempts, etc.)
- `errors.Is`: to match sentinel errors (config/file errors like ErrClientClosed)
- `errors.Unwrap`: when you need to reach the bottom-level net/error for system-level diagnostics
:::

## See Also

- [Error Handling](../../guides/error-handling) - Complete error handling guide
- [Constants and Types](./constants) - BodyKind and other constants reference
- [Retry and Fault Tolerance](../../guides/retry-fault-tolerance) - Retry strategy guide
- [Security Overview](../../security/) - SetSecurityWarnOutput and security configuration practices
