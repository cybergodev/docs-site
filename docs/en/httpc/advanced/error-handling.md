---
title: Error Handling - HTTPC
description: Guide to HTTPC error handling, covering twelve ErrorType classifications, ClientError struct fields, sentinel error matching, and best practices for various network errors.
---

# Error Handling

## Error Classification

HTTPC uses `ClientError` to classify errors, supporting `errors.As` and `errors.Is`.

### Error Type Detection

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Printf("Request timeout: %v", err)
        case httpc.ErrorTypeNetwork:
            log.Printf("Network error: %v", err)
        case httpc.ErrorTypeDNS:
            log.Printf("DNS resolution failed: %v", err)
        case httpc.ErrorTypeTLS:
            log.Printf("TLS error: %v", err)
        case httpc.ErrorTypeCertificate:
            log.Printf("Certificate verification failed: %v", err)
        case httpc.ErrorTypeRetryExhausted:
            log.Printf("Retry exhausted: %v", err)
        case httpc.ErrorTypeValidation:
            log.Printf("Request validation failed: %v", err)
        case httpc.ErrorTypeContextCanceled:
            log.Printf("Request canceled: %v", err)
        }
    }
}
```

### Retryable Check

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) && clientErr.IsRetryable() {
    // Error is retryable
    log.Println("Retryable error, will retry later")
}
```

## Sentinel Errors

### Error Variable Matching

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // Client is closed
}

if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // Response body is empty
}

if errors.Is(err, httpc.ErrInvalidURL) {
    // Invalid URL format
}

if errors.Is(err, httpc.ErrInvalidHeader) {
    // Invalid request header
}
```

## Retry and Errors

For retry configuration details, see [Retry and Fault Tolerance](../guides/retry-fault-tolerance). Here we focus on error handling after retries are exhausted:

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Failed after %d retries", clientErr.Attempts)
        }
    }
    return err
}
```

## Context Cancellation

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := client.Request(ctx, "GET", url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeContextCanceled {
            log.Println("Request canceled (timeout or manual cancellation)")
        }
    }
}
```

## Error Handling Best Practices

### 1. Distinguish Client Errors from Server Errors

```go
result, err := client.Get(url)
if err != nil {
    // Network-level error
    handleNetworkError(err)
    return
}

if result.IsClientError() {
    // 4xx - Client request error
    log.Printf("Client error: %d", result.StatusCode())
} else if result.IsServerError() {
    // 5xx - Server failure
    log.Printf("Server error: %d", result.StatusCode())
}
```

### 2. Use Middleware for Unified Handling

```go
recoveryMiddleware := httpc.RecoveryMiddleware()
loggingMiddleware := httpc.LoggingMiddleware(func(format string, args ...any) {
    log.Printf("[HTTP] "+format, args...)
})
metricsMiddleware := httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
    if err != nil {
        metrics.Increment("http.errors")
    } else {
        metrics.RecordDuration("http.duration", duration)
    }
})
```

### 3. Layered Timeouts

```go
// Client default timeout
cfg.Timeouts.Request = 30 * time.Second

// Middleware enforced timeout
timeoutMiddleware := httpc.TimeoutMiddleware(30 * time.Second)

// Per-request override
result, err := client.Get(url, httpc.WithTimeout(10 * time.Second))

// Context timeout (most precise)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, err := client.Request(ctx, "GET", url)
```

## Next Steps

- [Error Types API](../api-reference/errors) - Error types and variables reference
- [Retry and Fault Tolerance](../guides/retry-fault-tolerance) - Retry strategy configuration
- [Middleware Chain](../guides/middleware-chain) - Unified error handling with middleware
