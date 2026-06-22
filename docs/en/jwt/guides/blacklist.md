---
title: "Token Blacklist - CyberGo JWT | Revocation"
description: "Configure the built-in memory store with cleanup, revoke tokens via Revoke and IsRevoked, and implement BlacklistStore for Redis and external stores."
---

# Token Blacklist

The blacklist is used to invalidate tokens before they expire, suitable for user logout, password changes, permission changes, etc.

## How It Works

```text
Revoke(token) → Extract jti + exp → Write to BlacklistStore
Validate(token) → Verify signature → Check blacklist → Return result
```

## Built-in Memory Storage

Memory storage is used by default and works out of the box:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Blacklist is automatically enabled with DefaultBlacklistConfig()
```

### Configuration

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // Cleanup interval
cfg.Blacklist.MaxSize = 100000                     // Max entries
cfg.Blacklist.EnableAutoCleanup = true             // Auto cleanup
```

| Field | Default | Description |
|-------|---------|-------------|
| `CleanupInterval` | `5m` | Expired entry cleanup interval |
| `MaxSize` | `100000` | Max entries |
| `EnableAutoCleanup` | `true` | Auto cleanup (forced to true) |

:::tip Auto Cleanup
Built-in storage forces `EnableAutoCleanup` to `true`, preventing unbounded memory growth.
:::

## Revoking Tokens

```go
// Revoke
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// Check
revoked, err := processor.IsRevoked(accessToken)
fmt.Println("Revoked:", revoked) // true

// Revoked tokens will fail validation
_, _, err = processor.Validate(accessToken)
// err → jwt.ErrTokenRevoked
```

## Custom Storage Backend

Implement the [`BlacklistStore`](../api-reference/interfaces#blackliststore) interface to connect external storage (Redis, databases, etc.):

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

### Redis Example

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // Already expired, no need to store
    }
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", ttl).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}
```

Use custom storage:

```go
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

:::tip TTL Optimization
Use `time.Until(expiresAt)` as Redis TTL — tokens are automatically removed from the blacklist after expiration without additional cleanup.
:::

## Production Recommendations

:::warning Important
- Built-in memory storage is not shared across processes; use external storage for multi-instance deployments
- When `MaxSize` is reached, newly revoked tokens evict the oldest entries
- Custom storage implementations should handle network timeouts and retries
:::

## Next Steps

- [API Reference → BlacklistStore](../api-reference/interfaces#blackliststore) — Interface definition
- [API Reference → BlacklistConfig](../api-reference/config#blacklistconfig) — Configuration fields
- [API Reference → Revoke](../api-reference/processor#revoke) — Revoke method
- [Advanced Examples](../examples/advanced) — Redis blacklist example
