---
sidebar_label: "Token Blacklist"
title: "Token Blacklist - CyberGo JWT | Revocation"
description: "CyberGo JWT blacklist guide: entry TTL with a 7-day floor and 30-day cap, cleanup and eviction, Revoke and IsRevoked, plus BlacklistStore for Redis."
sidebar_position: 30
---

# Token Blacklist

A blacklist invalidates tokens before they expire. Typical triggers are user logout, password changes, and permission changes.

## How It Works

```text
Revoke(token) → Extract jti + exp → Write to BlacklistStore
Parse(token) → Verify signature → Check blacklist → Return result
```

`Revoke` does not simply write the input string to the blacklist. It first runs a **security verification chain** so that only genuinely issued tokens can be revoked:

1. **Verify signature** — re-validates the token signature with the processor's configured key, rejecting any tampered or forged token.
2. **Check issuer and audience** — verifies that `iss` and `aud` match the processor configuration, preventing cross-domain mistaken revocation.
3. **Extract jti** — takes the token's unique ID (`jti`) as the blacklist key; if the token has no `jti`, returns `ErrTokenMissingID`.
4. **Compute TTL and write to storage** — calculates the entry's time-to-live from the token's `exp` (see the next section), then writes the jti to `BlacklistStore`.

:::tip Signature Verification Is the Core Security Design
`Revoke` must verify the signature before revoking. If it trusted a caller-supplied `jti`, a malicious caller could forge a `jti` to blacklist **any legitimate user's token**, launching a denial-of-service attack. Mandatory signature verification guarantees that only the holder of the real token can revoke it. It also means `Revoke` takes the full token string, never a bare `jti`.
:::

Neither `Revoke` nor `IsRevoked` **checks `exp`/`nbf`**: an expired token can still be revoked or queried. This design lets auditing and after-the-fact remediation cover historical tokens.

## Blacklist Entry TTL

A blacklist entry does not live forever. Its lifetime follows the token's remaining validity, bounded below by 7 days and above by 30 days. The floor keeps the revocation record of a short-lived token from disappearing too early; the cap keeps an extremely long `exp` from occupying storage indefinitely.

| Remaining token `exp` | Actual entry lifetime |
|-----------------------|-----------------------|
| 1 minute (typical access token) | 7 days |
| 6 days | 7 days |
| 20 days | 20 days |
| 1 year or longer | 30 days |
| No `exp` claim | 7 days |

:::warning Estimate Capacity as Peak Revocations × Entry Lifetime
Because of the 7-day floor, revoking a 15-minute access token still occupies an entry for 7 days. Estimate `MaxSize` from peak revocation volume multiplied by 7 days, not from the token TTL. Ignoring the floor underestimates storage and makes the saturation eviction described below more likely.

When long-TTL refresh tokens dominate revocation, entries outlive the floor (up to the 30-day cap). With `RefreshTokenTTL = 30 days`, revoking a refresh token occupies an entry for 30 days, so size the store as peak revocations × refresh TTL instead.
:::

:::warning The 30-Day Cap Is DoS Protection
Without a cap, an attacker could craft tokens with extremely long `exp` values (or abuse legitimate long-lived tokens) and revoke them in bulk, exhausting blacklist storage and memory. The 30-day cap bounds the lifetime of every single record, keeping the storage footprint controllable.
:::

In addition, **expired tokens can still be revoked**: `Revoke` does not check `exp`/`nbf`, so a token can be revoked after it expires (for example when a later audit reveals a risk). Such entries have a negative remaining lifetime, take the 7-day floor, and are later reclaimed by the background cleanup.

## Built-in Memory Storage

Memory storage is used by default and works out of the box:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Blacklist is enabled automatically with DefaultBlacklistConfig()
```

### Configuration

The defaults below come from [`DefaultBlacklistConfig()`](../api-reference/functions#defaultblacklistconfig); override them as needed.

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // Cleanup interval
cfg.Blacklist.MaxSize = 100000                     // Max entries
cfg.Blacklist.EnableAutoCleanup = true             // Built-in storage: always on; the field only affects a custom Store
```

| Field | Default | Description |
|-------|---------|-------------|
| `CleanupInterval` | `5m` | Expired entry cleanup interval (built-in storage only) |
| `MaxSize` | `100000` | Max entries (built-in storage only) |
| `EnableAutoCleanup` | `true` | Automatic cleanup; only applies to a custom `Store`; built-in storage is always on |

:::tip Automatic Cleanup
The field only takes effect with a custom `Store`; built-in storage is always on. During normalization, built-in storage forces the field to `true`, so an explicit `false` does not disable cleanup. This prevents unbounded memory growth.
:::

### Eviction Behavior

When the entry count reaches `MaxSize`, writing a new entry triggers **eviction**, which frees space in the following order:

| Step | Behavior | Description |
|------|----------|-------------|
| 1 | Clean expired entries | Deletes every already-expired record first |
| 2 | Evict earliest-expiring entries | If still full, evicts about 10% (at least 1) of the earliest-expiring entries in ascending `exp` order |
| 3 | Write directly (fail-open) | Writes after freeing space; `Add` never fails because the store is full |

:::warning Saturation Is Fail-Open
When the built-in store is full, it cleans expired entries first, then evicts about 10% of the earliest-expiring entries, then writes directly. `Add` never fails because of capacity. The cost is that revoked records dropped by eviction silently lose effect (fail-open), and those tokens become usable again.

Eviction proceeds in ascending `exp` order and can discard records that are still valid. `MaxSize` lowers the probability of this happening; it does not prevent an error. Raise `MaxSize` according to the capacity estimate above, or switch to external storage.
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

// Revoked tokens fail validation
_, err = processor.Parse(accessToken)
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
        return nil // Expired tokens need no entry
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
Using `time.Until(expiresAt)` as the Redis TTL removes entries automatically once the token expires; no extra cleanup is needed.
:::

### Close() Responsibilities

`Processor.Close()` **cascades a call** to `BlacklistStore.Close()` on shutdown, so the blacklist storage does not need to be closed separately. A custom storage's `Close()` implementation should release all underlying resources:

- Close Redis or database connections
- Stop background goroutines and tickers
- Release file handles and similar resources

The `s.client.Close()` call in the Redis example above handles connection pool cleanup. `Close()` should be **idempotent**: repeated calls must not error. The built-in implementation follows this convention and returns `nil` on a second call.

:::tip Custom Storage Is Not Bound by CleanupInterval / MaxSize
`BlacklistConfig`'s `CleanupInterval` and `MaxSize` **apply only to the built-in memory storage**. Once the `Store` field points to a custom backend, both fields are ignored entirely; expiration cleanup and capacity limits become the backend's responsibility (Redis TTL, database scheduled jobs). The scope of `EnableAutoCleanup` is described in "Configuration" above.
:::

## Production Recommendations

:::warning Multi-Instance Deployments Must Share the Blacklist
The built-in memory storage **is not shared across processes**. With multiple instances (Pods, containers, servers), a token revoked on one instance still passes on another, so a logged-out user appears logged in elsewhere. Multi-instance deployments must use **shared storage** such as Redis or a database as the `BlacklistStore`, so every instance reads and writes the same blacklist.
:::

:::tip Monitor Blacklist Size
The blacklist accumulates revocation records until entries expire by TTL. Monitor storage size (entry count for memory storage, key count for Redis) and alert on abnormal growth. A sudden spike usually means a bulk revocation (a security incident) or an underestimated capacity. Setting `MaxSize` slightly above the capacity estimate lowers the chance of saturation-driven fail-open.
:::

:::tip Short-TTL Tokens May Not Need a Blacklist
When the access token itself is very short-lived (for example 15 minutes), a logout lets the token expire naturally within minutes, and maintaining a blacklist is usually **not worth it**. The cost is storage plus an extra lookup on every validation, which can exceed the benefit.

The mechanism suits revoking **long-lived tokens** (long-lived access tokens, refresh tokens). For short-TTL scenarios, consider enabling the blacklist for refresh tokens only.
:::

:::warning Other Considerations
- Custom storage implementations should handle network timeouts and retries so that external storage jitter does not block the validation chain
- After `MaxSize` is reached, newly revoked tokens evict the earliest-expiring entries (see "Eviction Behavior" above); under saturation, older revocation records can be discarded
:::

## Next Steps

- [API Reference → BlacklistStore](../api-reference/interfaces#blackliststore) — Interface definition
- [API Reference → BlacklistConfig](../api-reference/config#blacklistconfig) — Configuration fields
- [API Reference → Revoke](../api-reference/processor#revoke) — Revoke method
- [Advanced Examples](../examples/advanced) — Redis blacklist example
- [API Reference → DefaultBlacklistConfig](../api-reference/functions#defaultblacklistconfig) — Default blacklist configuration
