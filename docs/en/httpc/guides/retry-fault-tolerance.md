---
title: "Retry and Fault Tolerance - HTTPC"
description: "HTTPC retry and fault tolerance: exponential backoff, retry conditions, custom RetryPolicy, Retry-After parsing, and per-request control."
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

Default retry delay sequence: `1s → 2s → 4s` (with random jitter)

### Retry Conditions

By default, the following errors trigger a retry:

| Condition | Retry |
|-----------|-------|
| Network errors (connection refused, DNS failure) | Yes |
| Timeout errors | Yes |
| 5xx server errors (500/502/503/504) | Yes |
| 408 Request Timeout / 429 Too Many Requests | Yes |
| Other 4xx client errors | No |
| Context cancellation | No |
| Configuration validation errors | No |

## Custom Retry Policy

Implement the `RetryPolicy` interface to fully control retry behavior:

:::warning Internal Type
The `resp` parameter type `ResponseReader` in `RetryPolicy.ShouldRetry` is an internal interface (defined in the `internal/types` package) and cannot be directly referenced from external packages. Custom `RetryPolicy` must be implemented in a package within the same module as `httpc`. Most scenarios can be satisfied through `RetryConfig` field configuration.
:::

```go
// NOTE: ResponseReader is an internal type (internal/types package).
// This code can only compile within the github.com/cybergodev/httpc module.
// Most users should configure retry via RetryConfig and WithMaxRetries.

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
    // Only retry on 502, 503, 504
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

// Apply custom policy
cfg := httpc.DefaultConfig()
cfg.Retry.CustomPolicy = &MyRetryPolicy{maxAttempts: 5}
```

## Per-Request Control

```go
// Retry a single request 5 times
result, err := client.Get(url, httpc.WithMaxRetries(5))

// Disable retries
result, err := client.Get(url, httpc.WithMaxRetries(0))

// With context timeout
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := client.Request(ctx, "GET", url, httpc.WithMaxRetries(3))
```

## Retry-After Support

HTTPC automatically parses the `Retry-After` response header returned by the server:

```go
// Server returns: Retry-After: 120
// HTTPC will wait 120 seconds before retrying, instead of using exponential backoff delay

// Server returns: Retry-After: Fri, 25 Apr 2026 12:00:00 GMT
// HTTPC will wait until the specified time before retrying
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
// Requires a custom RetryPolicy implementation:
// delay * (attempt + 1)
// See the custom retry strategy example in advanced usage
```

### Random Jitter

Enable jitter to avoid the "thundering herd" effect:

```go
cfg.Retry.EnableJitter = true
// Adds random offset to the base delay, preventing all clients from retrying simultaneously
```

## Error Handling and Retries

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

## Best Practices

| Scenario | Recommendation |
|----------|---------------|
| API calls | MaxRetries=3, Delay=1s, Backoff=2.0 |
| Microservice communication | MaxRetries=2, Delay=500ms |
| File downloads | MaxRetries=5, Delay=2s, Backoff=2.0 |
| Idempotent operations | Safe to retry freely |
| Non-idempotent operations (POST) | Only retry on network errors |

:::warning
Non-idempotent POST requests are also retried by default. For precise control, implement a custom `RetryPolicy`.
:::

## Next Steps

- [Error Handling](../advanced/error-handling) - Complete error handling guide
- [Config API](../api-reference/config) - Retry configuration reference
- [Interface Definitions](../api-reference/interfaces) - RetryPolicy interface reference
