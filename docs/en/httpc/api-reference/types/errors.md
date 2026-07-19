---
sidebar_label: "Error Types"
title: "Error Types - CyberGo HTTPC | ClientError Details"
description: "HTTPC error types API reference: ClientError struct fields and methods, twelve ErrorType classifications, sentinel errors, and errors.Is/As matching."
sidebar_position: 3
---

# Error Types

## ClientError

```go
type ClientError = engine.ClientError
```

Classified HTTP client error, extracted via `errors.As`.

### Struct Fields

```go
type ClientError struct {
    Type       ErrorType  // Error classification
    Message    string     // Error description
    Cause      error      // Underlying error
    URL        string     // Request URL (masked)
    Method     string     // HTTP method
    Attempts   int        // Number of attempts made
    StatusCode int        // HTTP status code (if applicable)
    Host       string     // Hostname (for circuit breaker use)
}
```

| Field | Type | Description |
|-------|------|-------------|
| Type | `ErrorType` | Error classification for switch statements |
| Message | `string` | Error description |
| Cause | `error` | Underlying error, accessible via `Unwrap()` |
| `URL` | `string` | Request URL (credentials masked) |
| `Method` | `string` | HTTP method (GET, POST, etc.) |
| `Attempts` | `int` | Number of attempts (including the first request) |
| `StatusCode` | `int` | HTTP status code (0 for non-HTTP errors) |
| Host | `string` | Request hostname |

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `Error()` | `string` | Formatted as `METHOD URL: Message: Cause (attempt N)` |
| `Code()` | `string` | Readable error code, e.g. `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable()` | `bool` | Whether the error is retryable |
| `Unwrap()` | `error` | Unwraps the underlying error |
| `WithType(t ErrorType)` | `*ClientError` | Returns a copy with the error type set (does not modify original) |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("Error type:", clientErr.Code())
    fmt.Println("Request URL:", clientErr.URL)
    fmt.Println("Retry attempts:", clientErr.Attempts)
    fmt.Println("Retryable:", clientErr.IsRetryable())
    fmt.Println("Underlying error:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

Error classification enum.

| Constant | Description | Retryable |
|----------|-------------|-----------|
| `ErrorTypeUnknown` | Unknown/unclassified error | No |
| `ErrorTypeNetwork` | Network error (connection refused, connection reset, etc.) | Conditional |
| `ErrorTypeTimeout` | Request timeout | Conditional¹ |
| `ErrorTypeContextCanceled` | Context canceled | No |
| `ErrorTypeResponseRead` | Response body read error | Conditional |
| `ErrorTypeTransport` | Transport layer error | Yes |
| `ErrorTypeRetryExhausted` | Retries exhausted | No |
| `ErrorTypeTLS` | TLS error | No |
| `ErrorTypeCertificate` | Certificate verification error | No |
| `ErrorTypeDNS` | DNS resolution error | Conditional |
| `ErrorTypeValidation` | Request validation error | No |
| `ErrorTypeHTTP` | HTTP layer error | Conditional |

> ¹ Timeouts triggered by a context deadline (`WithTimeout`, `TimeoutConfig.Request`) are **not** retried; only transport-level timeouts (e.g. `net.OpError` timeout) are retried.

### Type Checking

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("Request timeout")
        case httpc.ErrorTypeNetwork:
            log.Println("Network error")
        case httpc.ErrorTypeTLS:
            log.Println("TLS error")
        case httpc.ErrorTypeCertificate:
            log.Println("Certificate verification failed")
        case httpc.ErrorTypeDNS:
            log.Println("DNS resolution failed")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("Retries exhausted")
        case httpc.ErrorTypeContextCanceled:
            log.Println("Request canceled")
        case httpc.ErrorTypeValidation:
            log.Println("Request validation failed")
        }
    }
}
```

## Error Variables

### Configuration Errors

| Variable | Description |
|----------|-------------|
| `ErrNilConfig` | Configuration is nil |
| `ErrInvalidTimeout` | Invalid timeout value |
| `ErrInvalidRetry` | Invalid retry configuration |
| `ErrInvalidConnection` | Invalid connection configuration |
| `ErrInvalidSecurity` | Invalid security configuration |
| `ErrInvalidMiddleware` | Invalid middleware configuration |

### Request Errors

| Variable | Description |
|----------|-------------|
| `ErrInvalidHeader` | Header validation failed |

### Response Errors

| Variable | Description |
|----------|-------------|
| `ErrResponseBodyEmpty` | Response body is empty |
| `ErrResponseBodyTooLarge` | Response body exceeds size limit |

### File Errors

| Variable | Description |
|----------|-------------|
| `ErrEmptyFilePath` | File path is empty |
| `ErrFileExists` | File already exists |

### Client Errors

| Variable | Description |
|----------|-------------|
| `ErrClientClosed` | Client is closed |

### Variable Matching

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Client is closed
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Response body is empty
}
```

## See Also

- [Error Handling](../../advanced/error-handling) - Complete error handling guide
- [Constants and Types](./constants) - BodyKind and other constants reference
- [Retry and Fault Tolerance](../../guides/retry-fault-tolerance) - Retry strategy guide
