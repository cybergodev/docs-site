---
sidebar_label: "Token Blacklist"
title: "Token Blacklist - CyberGo JWT | Revocation"
description: "Configure the built-in memory store with cleanup, revoke tokens via Revoke and IsRevoked, and implement BlacklistStore for Redis and external stores."
sidebar_position: 30
---

# Token Blacklist

The blacklist is used to invalidate tokens before they expire, suitable for user logout, password changes, permission changes, etc.

## How It Works

```text
Revoke(token) → Extract jti + exp → Write to BlacklistStore
Parse(token) → Verify signature → Check blacklist → Return result
```

`Revoke` does not simply write the input string to the blacklist. It first runs a **security verification chain** to ensure only genuinely issued tokens are revoked:

1. **Verify signature** — re-validates the token signature with the processor's configured key, rejecting any tampered or forged tokens.
2. **Check issuer and audience** — verifies that `iss` and `aud` match the processor configuration, preventing cross-domain mistaken revocation.
3. **Extract jti** — takes the token's unique ID (`jti`) as the blacklist key; if the token has no `jti`, returns `ErrTokenMissingID`.
4. **Compute TTL and write to storage** — calculates the entry's time-to-live based on the token's `exp` (see the next section), then writes the jti to `BlacklistStore`.

:::tip Signature Verification Is a Key Security Design
Why does `Revoke` verify the signature before revoking? If it blindly trusted the caller-supplied `jti`, a malicious caller could use a forged `jti` to blacklist **any legitimate user's token**, launching a denial-of-service attack. Mandatory signature verification guarantees that "only someone holding the real token can revoke it" — which also means that `Revoke` must be called with the full token string, not a bare `jti`.
:::

Neither `Revoke` nor `IsRevoked` **checks `exp`/`nbf`**: even an expired token can still be revoked or queried for revocation status. This design allows scenarios like auditing and after-the-fact remediation revocation to cover historical tokens.

## Blacklist Entry TTL

Blacklist entries do not persist forever. On write, `Revoke` calculates the entry's time-to-live (TTL) from the token's `exp`; once the token expires, the entry becomes invalid and is cleaned up. The three cases are:

- **Token has an `exp` claim** — the TTL equals the remaining time until `exp`; the entry expires in sync with the token. This is the most common case.
- **Token has no `exp` claim** — the TTL defaults to **7 days**, preventing non-expiring tokens from occupying entries indefinitely.
- **TTL is capped at 30 days** — even if the token's `exp` is 100 years out, the blacklist entry can live for at most 30 days.

:::warning The 30-Day Cap Is DoS Protection
The 30-day ceiling is a critical safeguard. Without it, an attacker could craft tokens with extremely long `exp` (or abuse legitimate long-lived tokens) and revoke them in bulk, blowing up the blacklist storage and exhausting memory. With the 30-day cap, every single record has an upper bound on its lifetime, keeping storage scale always controllable.
:::

Additionally, **expired tokens can still be revoked**: since `Revoke` does not check `exp`/`nbf`, you can retroactively revoke a token after it expires (e.g., when a post-incident audit reveals a risk). Such entries get the default 7-day TTL and are later reclaimed by the background cleanup mechanism.

## Built-in Memory Storage

Memory storage is used by default and works out of the box:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Blacklist is automatically enabled with DefaultBlacklistConfig()
```

### Configuration

The defaults below come from [`DefaultBlacklistConfig()`](../api-reference/functions#defaultblacklistconfig); override as needed.

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

### Eviction Behavior

When the entry count reaches `MaxSize`, writing a new entry triggers **eviction**, making room in the following order:

| Step | Behavior | Description |
|------|----------|-------------|
| 1 | Clean expired entries | First deletes all already-expired records |
| 2 | Evict earliest-expiring entries | If still full, evicts approximately 10% (at least 1) of the earliest-expiring entries by ascending `exp` |
| 3 | Reject the write | If still full, `Add` returns an error and `Revoke` accordingly fails |

So `MaxSize` is not "stop when full"; under pressure it prioritizes evicting the entries that should disappear first (already expired, soonest to expire). In extreme cases revocation may still fail — therefore, in production, consider raising `MaxSize` based on peak revocation volume, or switching to external storage.

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

### Close() Responsibilities

`Processor.Close()` **cascades a call** to `BlacklistStore.Close()` on shutdown — you do not need to close the blacklist storage manually; closing the processor is enough. A custom storage's `Close()` implementation should release all underlying resources:

- Close Redis / database connections
- Stop background goroutines and tickers
- Release file handles, etc.

The `s.client.Close()` in the Redis example above handles connection pool cleanup. `Close()` should be **idempotent** — repeated calls must not error (the built-in storage implementation already follows this convention; a second call simply returns `nil`).

:::tip Custom Storage Is Not Bound by CleanupInterval / MaxSize
`BlacklistConfig`'s `CleanupInterval`, `MaxSize`, and `EnableAutoCleanup` **apply only to the built-in memory storage**. Once you set the `Store` field to use a custom backend, these three fields are ignored entirely — expiration cleanup, capacity limits, and so on are the responsibility of your storage backend (e.g., Redis TTL, database scheduled jobs).
:::

## Production Recommendations

:::warning Multi-Instance Deployments Must Share the Blacklist
The built-in memory storage **is not shared across processes**. If your service runs multiple instances (Pods / containers / servers), a token revoked on one instance will still be accepted on others — a user who logs out is still treated as logged in on a different instance. In multi-instance scenarios, you must use **shared storage** such as Redis or a database as the `BlacklistStore`, ensuring all instances read and write the same blacklist.
:::

:::tip Monitor Blacklist Size
The blacklist accumulates revocation records until entries expire by TTL. Monitor the storage size (entry count for in-memory storage, key count for Redis) and alert on abnormal growth — a sudden spike usually signals a bulk revocation (e.g., a security incident) or overly long TTLs. Setting `MaxSize` slightly above peak revocation volume avoids triggering eviction and revocation failures.
:::

:::tip Short-TTL Tokens May Not Need a Blacklist
If the access token itself has a very short validity period (e.g., 15 minutes), a "logout" lets the token expire naturally within minutes, so maintaining a blacklist is usually **not worth it** — the cost of the blacklist (storage + an extra query on every validation) may exceed the benefit. Blacklists are better suited for revoking **long-lived tokens** (long-lived access tokens, refresh tokens). For short-TTL scenarios, consider enabling the blacklist only for refresh tokens.
:::

:::warning Other Considerations
- Custom storage implementations should handle network timeouts and retries to prevent external storage jitter from blocking the validation chain
- Once `MaxSize` is reached, newly revoked tokens evict the oldest entries (see "Built-in Memory Storage" above)
:::

## Next Steps

- [API Reference → BlacklistStore](../api-reference/interfaces#blackliststore) — Interface definition
- [API Reference → BlacklistConfig](../api-reference/config#blacklistconfig) — Configuration fields
- [API Reference → Revoke](../api-reference/processor#revoke) — Revoke method
- [Advanced Examples](../examples/advanced) — Redis blacklist example
- [API Reference → DefaultBlacklistConfig](../api-reference/functions#defaultblacklistconfig) — Default blacklist configuration
