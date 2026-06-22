---
title: "Rate Limiting - CyberGo JWT | Token Bucket"
description: "Configure token-bucket max requests per window for signing endpoints with Subject, UserID, and RateLimitKeyer priority lookup supporting distributed limiting."
---

# Rate Limiting

Rate limiting prevents abuse of token issuance endpoints (e.g., brute-force attacks).

## How It Works

Uses a token bucket algorithm to limit the maximum requests per key within a specified time window.

```text
Create(claims) → Extract rate limit key → Check RateLimitProvider → Allow/Deny
```

## Configuration

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100              // Max requests per window
cfg.RateLimitWindow = time.Minute    // Time window
```

| Field | Default | Description |
|-------|---------|-------------|
| `EnableRateLimit` | `false` | Enable rate limiting |
| `RateLimitRate` | `100` | Max requests per window |
| `RateLimitWindow` | `1m` | Time window |

:::tip Note
Rate limiting applies to all token issuance methods: `Create()`, `CreateRefresh()`, `Refresh()`, and `RefreshInto()`. It does not affect `Validate()` or `ValidateInto()`.
:::

## Rate Limit Key

Rate limiting is isolated by key. Key lookup priority:

1. `RegisteredClaims.Subject` — if non-empty
2. `*Claims.UserID` — for built-in Claims only
3. `RateLimitKey()` — if `RateLimitKeyer` interface is implemented
4. Empty string — rate limiting is skipped

### Custom Rate Limit Key

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// Implement RateLimitKeyer interface
func (c *MyClaims) RateLimitKey() string {
    return c.Email
}
```

## Built-in RateLimiter

Use `NewRateLimiter` to create a standalone rate limiter:

```go
limiter := jwt.NewRateLimiter(100, time.Minute)

if limiter.Allow("user:123") {
    // Allowed
} else {
    // Denied
}

limiter.Reset("user:123") // Reset count
defer limiter.Close()
```

## Custom Rate Limiter

Implement the [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) interface:

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

:::tip About AllowN
The interface itself only defines the single-shot `Allow`. The batch method `AllowN(key string, n int) bool` is an extension method of the concrete type [`*RateLimiter`](../api-reference/types#ratelimiter), not part of this interface.
:::

For example, connect to Redis for distributed rate limiting:

```go
cfg.RateLimiter = &RedisRateLimiter{client: rdb}
```

## Rate Limit Exceeded

When requests exceed the threshold, token issuance methods (`Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()`) return `ErrRateLimitExceeded`:

```go
token, err := processor.Create(claims)
if errors.Is(err, jwt.ErrRateLimitExceeded) {
    // Handle rate limiting: return 429 Too Many Requests
}
```

## Next Steps

- [API Reference → RateLimitProvider](../api-reference/interfaces#ratelimitprovider) — Interface definition
- [API Reference → RateLimiter](../api-reference/types#ratelimiter) — Built-in implementation
- [Basic Examples](../examples/basic) — Rate limiting example
