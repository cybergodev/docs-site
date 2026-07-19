---
sidebar_label: "Retry & Fault Tolerance"
title: "Retry and Fault Tolerance - CyberGo HTTPC | Backoff & Retry"
description: "HTTPC retry and fault tolerance guide: default exponential backoff and RetryConfig, 408/429/5xx auto-retry, custom RetryPolicy, and per-request control."
sidebar_position: 5
---

# Retry and Fault Tolerance

## Default Retry

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 3           // Max 3 retries
cfg.Retry.Delay = 1 * time.Second  // Initial delay 1s
cfg.Retry.BackoffFactor = 2.0      // Exponential backoff 2x
cfg.Retry.EnableJitter = true      // Enable jitter

client, _ := httpc.New(cfg)
```

Default retry delay sequence: `1s -> 2s -> 4s` (with random jitter)

### Retry Conditions

By default, the following errors trigger retries:

| Condition | Retry |
|-----------|-------|
| Network errors (connection refused, temporary/timeout DNS failures) | Yes |
| Timeout errors | Yes |
| 5xx server errors (500/502/503/504) | Yes |
| 408 Request Timeout / 429 Too Many Requests | Yes |
| Other 4xx client errors | No |
| Context canceled | No |
| Configuration validation errors | No |

## Custom Retry Strategy

Implement the `RetryPolicy` interface for full control over retry behavior:

:::warning Internal Type
The `resp` parameter type ResponseReader in RetryPolicy.ShouldRetry is an internal interface (defined in the `internal/types` package) that external packages cannot reference directly. Custom `RetryPolicy` must be implemented in a package within the same module as `httpc`. Most scenarios can be satisfied through `RetryConfig` field configuration.
:::

```go
// Note: ResponseReader is an internal type (internal/types package).
// This code can only compile within the github.com/cybergodev/httpc module.
// Most users should configure retries via RetryConfig and WithMaxRetries.

type MyRetryPolicy struct {
    maxAttempts int
}

// Determine whether to retry
func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxAttempts {
        return false
    }
    // Retry on network errors
    if err != nil {
        return true
    }
    // Only retry 502, 503, 504
    return resp.StatusCode() == 502 || resp.StatusCode() == 503 || resp.StatusCode() == 504
}

// Return retry delay
func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(attempt+1)
}

// Maximum retry count
func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxAttempts
}

// Apply custom strategy
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## Per-Request Control

```go
// Retry single request 5 times
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Disable retries
result, err := client.Get(url, httpc.WithMaxRetries(0))

// With context timeout
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-After Support

HTTPC automatically parses the `Retry-After` response header from the server:

```go
// Server returns: Retry-After: 120
// HTTPC waits at most 60 seconds before retrying (the 120s is capped to a 60s safety limit)

// Server returns: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC waits until the specified time before retrying (capped to 60s if more than 60s away)
```

:::tip
`Retry-After` takes effect for all retryable responses (408, 429, 500, 502, 503, 504) and has higher priority than exponential backoff delay.
:::

## Backoff Strategies

### Exponential Backoff

```go
cfg.Retry.BackoffFactor = 2.0
// Delay sequence: delay, delay*2, delay*4, delay*8...
```

### Fixed Delay

```go
cfg.Retry.BackoffFactor = 1.0
// Delay sequence: delay, delay, delay...
```

### Linear Growth

```go
// Requires custom RetryPolicy implementation:
// delay * (attempt + 1)
// See the custom retry strategy in advanced examples
```

### Random Jitter

Enable jitter to avoid "thundering herd":

```go
cfg.Retry.EnableJitter = true
// Adds random offset to base delay, preventing all clients from retrying simultaneously
```

## Error Handling and Retries

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        if clientErr.Type == httpc.ErrorTypeRetryExhausted {
            log.Printf("Still failed after %d retries", clientErr.Attempts)
        }
    }
    return err
}
```

## Best Practices

| Scenario | Recommendation |
|----------|----------------|
| API calls | MaxRetries=3, Delay=1s, Backoff=2.0 |
| Microservice communication | MaxRetries=2, Delay=500ms |
| File downloads | MaxRetries=5, Delay=2s, Backoff=2.0 |
| Idempotent operations | Safe to retry freely |
| Non-idempotent operations (POST) | Recommend retrying only on network errors (default also retries 5xx/408/429; narrow via a custom RetryPolicy) |

:::warning
Non-idempotent POST requests are retried by default. For precise control, implement a custom `RetryPolicy`.
:::

## Next Steps

- [Error Handling](../advanced/error-handling) - Complete error handling guide
- [Configuration API](../api-reference/client-config/config) - Retry configuration reference
- [Interface Definitions](../api-reference/types/interfaces) - RetryPolicy interface reference
