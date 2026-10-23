---
sidebar_label: "Config"
title: "Config - CyberGo JWT | Configuration"
description: "Unified CyberGo JWT Config spanning signing keys, algorithms, token TTL, issuer, audiences, clock skew, blacklist, and rate limiting with Validate logic."
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

Unified configuration for the JWT Processor. Zero-value fields are automatically populated with defaults in `New()` (via `normalizeConfig`).

:::tip Auto-fill Rules
- `RateLimitRate` and `RateLimitWindow` are only populated when `EnableRateLimit = true`
- Built-in blacklist store's `EnableAutoCleanup` is always forced to `true` (to prevent unbounded growth)
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
| `AccessTokenTTL` | `time.Duration` | `15m` | Access token time-to-live |
| `RefreshTokenTTL` | `time.Duration` | `168h` | Refresh token time-to-live |
| `Issuer` | `string` | `"jwt-service"` | Issuer |
| `ExpectedAudience` | `string` | — | Expected audience (optional) |
| `RequireExpiration` | `bool` | `false` | When `true`, rejects tokens lacking an `exp` claim during validation (returns [`ErrExpirationRequired`](./errors#sentinel-errors)) |
| `RejectRefreshAsAccess` | `bool` | `false` | (New in v1.2.3) When `true`, [`Parse`](./processor#parse) / [`ParseInto`](./processor#parseinto) reject `token_type=refresh` tokens being used as access credentials (returns [`ErrTokenTypeMismatch`](./errors#sentinel-errors)); `Refresh` / `RefreshInto` are never affected |
| `RotateRefreshTokens` | `bool` | `false` | (New in v1.2.3) When `true`, `Refresh` / `RefreshInto` revoke the supplied refresh token (by jti) before minting the new token, giving one-time-use semantics (fail-closed: revocation failure returns [`ErrRefreshRotationFailed`](./errors#sentinel-errors); a missing jti returns `ErrTokenMissingID`). See [Token Refresh & Rotation](../guides/token-refresh#one-time-rotation) |
| `ClockSkew` | `time.Duration` | `0` | Clock skew leeway applied to exp/nbf during validation (tolerates clock drift between issuer and validator); negative values are rejected by `Validate()` |
| `Blacklist` | `BlacklistConfig` | — | Blacklist configuration |
| `EnableRateLimit` | `bool` | `false` | Enable rate limiting |
| `RateLimitRate` | `int` | `100` | Max requests per window |
| `RateLimitWindow` | `time.Duration` | `1m` | Rate limit window |
| `RateLimiter` | `RateLimitProvider` | — | Custom rate limiter (optional) |
| `Clock` | `ClockProvider` | `SystemClock{}` | Clock provider |

:::warning Ownership and Cascade Close
`Processor.Close` closes the limiter injected via `Config.RateLimiter` and also closes the custom blacklist store supplied through `BlacklistConfig.Store`. Do not share one instance across processors that may outlive each other — after one processor closes a shared limiter, its `Allow` always returns `false` and the other processors' token creation fails with `ErrRateLimitExceeded`.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validate` | `func (c *Config) Validate() error` | Validates configuration |

`Validate()` checks:

| Check | Description |
|-------|-------------|
| Signing keys | HMAC requires SecretKey ≥32 bytes and non-weak; RSA/ECDSA requires correct SigningKey type; ECDSA requires curve match; VerificationKey must match algorithm public key type |
| TTL validity | `AccessTokenTTL` and `RefreshTokenTTL` must be positive |
| TTL ordering | `AccessTokenTTL` must be less than `RefreshTokenTTL` |
| ClockSkew | `ClockSkew` must not be negative |
| Signing algorithm | Must be one of the 12 built-in algorithms |
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

Blacklist configuration. `BlacklistConfig.Store` supplies a custom storage backend (e.g. Redis) — once set, `CleanupInterval`, `MaxSize`, and `EnableAutoCleanup` are all ignored, and `Processor.Close` cascades a close to that store (see the ownership note above).

<Badge type="info" text="struct" />

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `CleanupInterval` | `time.Duration` | `5m` | Expired entry cleanup interval (built-in store only) |
| `MaxSize` | `int` | `100000` | Max entries in memory store (built-in store only) |
| `EnableAutoCleanup` | `bool` | `true` | Auto-cleanup of expired entries (built-in store only) |
| `Store` | `BlacklistStore` | — | Custom storage backend (when set, other fields are ignored) |
