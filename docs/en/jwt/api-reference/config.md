---
sidebar_label: "Config"
title: "Config - CyberGo JWT | Configuration"
description: "Unified CyberGo JWT Config with signing keys, algorithms, access and refresh token TTLs, issuer, audience, clock skew, blacklist, and rate limit settings."
sidebar_position: 30
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL        time.Duration
    RefreshTokenTTL       time.Duration
    Issuer                string
    ExpectedAudience      string
    RequireExpiration     bool
    RejectRefreshAsAccess bool
    RotateRefreshTokens   bool
    ClockSkew             time.Duration

    Blacklist BlacklistConfig

    EnableRateLimit bool
    RateLimitRate   int
    RateLimitWindow time.Duration
    RateLimiter     RateLimitProvider

    Clock ClockProvider
}
```

Unified configuration for the JWT Processor. Zero-value fields are filled with defaults in `New()` (via `normalizeConfig`).

:::tip Auto-fill Rules
- `RateLimitRate` and `RateLimitWindow` are only populated when `EnableRateLimit = true`
- `EnableAutoCleanup` only takes effect with a custom `Store`; the built-in store always has auto-cleanup enabled
- `SecretKey`, `SigningKey`, and `VerificationKey` are not auto-populated; they must be set manually
- An explicitly provided `RateLimiter` always takes effect regardless of `EnableRateLimit` — supplying one is treated as explicit intent
:::

<Badge type="info" text="struct" />

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `SecretKey` | `string` | — | HMAC key (at least 32 bytes) |
| `SigningKey` | `any` | — | Asymmetric algorithm private key (`*rsa.PrivateKey` or `*ecdsa.PrivateKey`) |
| `VerificationKey` | `any` | — | Asymmetric algorithm public key (optional, defaults to SigningKey) |
| `SigningMethod` | `SigningMethod` | `HS256` | Signing algorithm |
| `AccessTokenTTL` | `time.Duration` | `15m` | Access token lifetime; derived only when the claims' `ExpiresAt` is zero |
| `RefreshTokenTTL` | `time.Duration` | `168h` | Refresh token lifetime; derived only when the claims' `ExpiresAt` is zero |
| `Issuer` | `string` | `"jwt-service"` | Issuer; written only when the claims' `Issuer` is zero (an explicit caller value wins) |
| `ExpectedAudience` | `string` | — | Expected audience (optional) |
| `RequireExpiration` | `bool` | `false` | When `true`, rejects tokens lacking an `exp` claim during validation (returns [`ErrExpirationRequired`](./errors#sentinel-errors)) |
| `RejectRefreshAsAccess` | `bool` | `false` | (New in v1.2.3) When `true`, [`Parse`](./processor#parse) / [`ParseInto`](./processor#parseinto) reject `token_type=refresh` tokens being used as access credentials (returns [`ErrTokenTypeMismatch`](./errors#sentinel-errors)); `Refresh` / `RefreshInto` are never affected |
| `RotateRefreshTokens` | `bool` | `false` | (New in v1.2.3) When `true`, `Refresh` / `RefreshInto` revoke the supplied refresh token (by jti) before minting the new token, giving one-time-use semantics. The path is fail-closed: a store error returns [`ErrRefreshRotationFailed`](./errors#sentinel-errors), and a missing jti returns `ErrTokenMissingID`. See [Token Refresh & Rotation](../guides/token-refresh#one-time-rotation) |
| `ClockSkew` | `time.Duration` | `0` | Clock skew leeway applied to exp/nbf during validation (tolerates clock drift between issuer and validator); negative values are rejected by `Validate()` |
| `Blacklist` | `BlacklistConfig` | — | Blacklist configuration |
| `EnableRateLimit` | `bool` | `false` | Enable rate limiting |
| `RateLimitRate` | `int` | `100` | Max requests per window |
| `RateLimitWindow` | `time.Duration` | `1m` | Rate limit window |
| `RateLimiter` | `RateLimitProvider` | — | Custom rate limiter (optional) |
| `Clock` | `ClockProvider` | `SystemClock{}` | Clock provider |

:::warning Registered Claim Override Rules
The library only fills zero values: an explicit `iss`/`exp`/`iat`/`jti` set by the caller is used as-is, overriding the configuration and the TTLs.

When the claims set `Issuer` explicitly, `Parse` still checks the token against `Config.Issuer`. A differing value makes self-signed tokens fail verification with `ErrTokenInvalidIssuer`. The same applies to `ExpiresAt`: an explicit expiration bypasses the `AccessTokenTTL` / `RefreshTokenTTL` policy. Leave `ExpiresAt` unset when the TTL policy must apply, and keep `Issuer` equal to `Config.Issuer` when self-signed tokens must verify.
:::

:::warning Ownership and Cascade Close
`Processor.Close` closes the limiter injected via `Config.RateLimiter` and also closes the custom blacklist store supplied through `BlacklistConfig.Store`.

Do not share one instance across processors that may outlive each other. After one processor closes a shared limiter, its `Allow` always returns `false` and the other processors' token creation fails with `ErrRateLimitExceeded`.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `func (c *Config) Validate() error` | Validates configuration |

`New()` fills zero-value defaults (`normalizeConfig`) and then validates. A direct `Validate()` call leaves zero-value fields untouched, so the same configuration can fail `Validate()` while passing `New()`. To match `New()` behavior, start from `DefaultConfig()`.

`Validate()` checks:

| Check | Description |
|-------|-------------|
| Signing keys | HMAC requires SecretKey ≥32 bytes and non-weak; RSA/ECDSA requires correct SigningKey type; ECDSA requires curve match; VerificationKey must match algorithm public key type |
| TTL validity | `AccessTokenTTL` and `RefreshTokenTTL` must be positive |
| TTL ordering | `AccessTokenTTL` must be less than `RefreshTokenTTL` |
| ClockSkew | `ClockSkew` must not be negative |
| Signing algorithm | Must be one of the 12 built-in algorithms |
| Rate limit parameters | When `EnableRateLimit` is true, a negative `RateLimitRate` or `RateLimitWindow` returns `ErrInvalidConfig` |
| Rate limit ceiling | When `EnableRateLimit` is true, `RateLimitRate > 1000000` returns `ErrInvalidConfig` |
| Rate limit window ceiling | When `EnableRateLimit` is true, `RateLimitWindow > 30 days` returns `ErrInvalidConfig` |
| Blacklist | Built-in store requires positive MaxSize and CleanupInterval |

---

## BlacklistConfig

```go
type BlacklistConfig struct {
    CleanupInterval   time.Duration
    MaxSize           int
    EnableAutoCleanup bool
    Store             BlacklistStore
}
```

Blacklist configuration. `BlacklistConfig.Store` supplies a custom storage backend (e.g. Redis).

When set, `CleanupInterval` and `MaxSize` are ignored, and the backend owns cleanup and capacity. `Processor.Close` cascades a close to that store (see the ownership note above). `EnableAutoCleanup` only takes effect with a custom `Store`; the built-in store always has auto-cleanup enabled.

:::warning Built-in Store Capacity Behavior
When the built-in store is full, expired entries are removed first, roughly the earliest-expiring 10% is then evicted, and the new entry is written directly — `Add` never fails because the store is full.

The cost is fail-open: revocation records dropped by eviction silently stop taking effect, and those tokens become usable again. Raising `MaxSize` lowers the fail-open probability.
:::

<Badge type="info" text="struct" />

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `CleanupInterval` | `time.Duration` | `5m` | Expired entry cleanup interval (built-in store only) |
| `MaxSize` | `int` | `100000` | Max entries in the memory store (built-in store only; when full, the entries closest to expiry are evicted — see the capacity behavior above) |
| `EnableAutoCleanup` | `bool` | `true` | Automatic cleanup of expired entries (only takes effect with a custom `Store`; the built-in store always enables it) |
| `Store` | `BlacklistStore` | — | Custom storage backend (when set, other fields are ignored) |
