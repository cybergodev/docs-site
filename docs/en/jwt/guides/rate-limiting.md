---
sidebar_label: "Rate Limiting"
title: "Rate Limiting - CyberGo JWT | Token Bucket"
description: "Configure token-bucket max requests per window for signing endpoints with Subject, UserID, and RateLimitKeyer priority lookup supporting distributed limiting."
sidebar_position: 40
---

# Rate Limiting

Rate limiting prevents abuse of token issuance endpoints (e.g., brute-force attacks).

## How It Works

Uses a token bucket algorithm to limit the maximum requests per key within a specified time window.

```text
Create(claims) → Extract rate limit key → Check RateLimitProvider → Allow/Deny
```

### Token Bucket Algorithm Details

The built-in [`RateLimiter`](../api-reference/types#ratelimiter) uses a token bucket algorithm, not a simple fixed-window counter. Each rate limit key corresponds to an independent bucket, which records the remaining `tokens` and the last refill time `lastRefill`.

**Proportional Token Refill**: On each request, the number of tokens to add is calculated proportionally based on the time elapsed since the last refill:

```text
tokensToAdd = (maxRate × elapsed) / window
```

Where `elapsed` is the number of nanoseconds since the last refill, and `window` is the rate limit window. After refilling, the token count does not exceed `maxRate` (the cap), ensuring the configured rate is never exceeded.

**Residual Time Retention**: After refilling tokens, `lastRefill` is not reset to the current time. Instead, it advances only by the "consumed" time corresponding to the tokens added:

```text
consumedNano = (tokensToAdd × window) / maxRate
lastRefill += consumedNano
```

This mechanism avoids uneven token refilling — if `lastRefill` were reset to `now` each time, the uncounted residual time would be discarded, causing the actual refill rate to be higher than configured.

:::tip Token Bucket vs Fixed Window
A fixed-window counter allows a burst of `maxRate` requests at window boundaries (e.g., 100 allowed at second 59, then another 100 at second 1 — 200 requests in an instant). The token bucket refills tokens continuously and proportionally, producing a smoother traffic curve better suited for API rate limiting.
:::

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

## AllowN Batch Check

[`Allow`](../api-reference/types#ratelimiter) checks a single request, while the concrete type [`*RateLimiter`](../api-reference/types#ratelimiter) provides an extension method `AllowN` to check whether `n` requests are available at once:

```go
func (rl *RateLimiter) AllowN(key string, n int) bool
```

`AllowN` behaves as follows:

| Condition | Return Value |
|-----------|--------------|
| `n < 0` | `false` |
| `n == 0` | `true` |
| `n > maxRate` | `false` (a single batch cannot exceed the window cap) |
| `key == ""` | `false` |
| Tokens in bucket ≥ `n` | `true` (consumes `n` tokens) |
| Tokens in bucket < `n` | `false` |

Use cases: when a single operation needs to consume multiple quota units (e.g., batch issuance, weighted billing), a single `AllowN` replaces multiple `Allow` calls, reducing lock contention while preserving atomicity.

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	limiter := jwt.NewRateLimiter(100, time.Minute)
	defer limiter.Close()

	// Request 10 quota units at once (e.g., batch issuing 10 tokens)
	if limiter.AllowN("user:123", 10) {
		fmt.Println("Batch operation allowed") // Output: Batch operation allowed
	}

	// 90 tokens remaining, requesting 95 is denied
	fmt.Println(limiter.AllowN("user:123", 95)) // Output: false
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

### Capacity and Eviction

The built-in `RateLimiter` tracks at most 10,000 distinct rate limit keys (`maxBuckets = 10000`), preventing memory exhaustion from maliciously crafted massive key sets. When the bucket count reaches the limit, the following eviction strategy applies:

1. **Expiry eviction**: first cleans up buckets whose `lastRefill` is more than 2× the window time ago (considered expired and no longer active).
2. **Batch eviction of oldest 10%**: if still full, scans all buckets and evicts the approximately oldest 10% by `lastRefill` (at least 1), freeing space for new keys.

:::tip Why Batch Eviction
Evicting only 1 bucket at a time requires a full scan on every insert (O(n)), whereas evicting about 10% at once means the next ~1,000 inserts need no scan. This reduces the amortized cost of a single eviction at full capacity from O(n) to approximately O(n/1000), significantly cutting lock hold time.
:::

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

### Redis Distributed Rate Limiter Example

The built-in `RateLimiter` is in-process; in multi-instance deployments, each instance counts independently and cannot share state. Below is a Redis-based distributed rate limiter using a fixed-window + atomic INCR counting scheme, suitable for multi-instance scenarios:

<!-- check-code: skip -->
```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
    "github.com/redis/go-redis/v9"
)

// RedisRateLimiter is a Redis-based distributed rate limiter (fixed window + atomic INCR).
type RedisRateLimiter struct {
    client *redis.Client
    rate   int
    window time.Duration
}

func NewRedisRateLimiter(client *redis.Client, rate int, window time.Duration) *RedisRateLimiter {
    return &RedisRateLimiter{client: client, rate: rate, window: window}
}

// Allow uses Redis INCR for atomic increment; sets the expiration as the window on first increment.
func (r *RedisRateLimiter) Allow(key string) bool {
    ctx := context.Background()
    fullKey := "ratelimit:" + key

    count, err := r.client.Incr(ctx, fullKey).Result()
    if err != nil {
        return false // Deny on Redis failure to protect the backend
    }
    if count == 1 {
        // First request, set window expiration
        r.client.Expire(ctx, fullKey, r.window)
    }
    return count <= int64(r.rate)
}

// Reset clears the count for the specified key.
func (r *RedisRateLimiter) Reset(key string) {
    r.client.Del(context.Background(), "ratelimit:"+key)
}

// Close releases resources (the Redis connection is managed by the caller; empty here).
func (r *RedisRateLimiter) Close() {}

func main() {
    rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})

    limiter := NewRedisRateLimiter(rdb, 100, time.Minute)
    if limiter.Allow("user:123") {
        fmt.Println("Allowed") // Output: Allowed
    }

    // Inject into JWT config, replacing the built-in in-process rate limiter
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimiter = limiter

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()
    fmt.Println("Processor created successfully") // Output: Processor created successfully
}
```

:::warning
This example uses a fixed-window algorithm (Redis INCR + EXPIRE), which behaves slightly differently from the built-in `RateLimiter`'s token bucket: a fixed window may allow bursts at boundaries, but is practical enough for distributed scenarios. For strict token bucket semantics, implement the refill logic with a Lua script.
:::

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
