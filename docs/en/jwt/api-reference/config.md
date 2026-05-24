---
title: "Config - JWT API Reference"
description: "CyberGo JWT Config API reference covering Config unified configuration (signing keys, algorithms, TTL, Issuer) and BlacklistConfig fields, default values, and validation methods."
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL    time.Duration
    RefreshTokenTTL   time.Duration
    Issuer            string
    ExpectedAudience  string

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
| `Blacklist` | `BlacklistConfig` | — | Blacklist configuration |
| `EnableRateLimit` | `bool` | `false` | Enable rate limiting |
| `RateLimitRate` | `int` | `100` | Max requests per window |
| `RateLimitWindow` | `time.Duration` | `1m` | Rate limit window |
| `RateLimiter` | `RateLimitProvider` | — | Custom rate limiter (optional) |
| `Clock` | `ClockProvider` | `SystemClock{}` | Clock provider |

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

Blacklist configuration.

<Badge type="info" text="struct" />

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `CleanupInterval` | `time.Duration` | `5m` | Expired entry cleanup interval (built-in store only) |
| `MaxSize` | `int` | `100000` | Max entries in memory store (built-in store only) |
| `EnableAutoCleanup` | `bool` | `true` | Auto-cleanup of expired entries (built-in store only) |
| `Store` | `BlacklistStore` | — | Custom storage backend (when set, other fields are ignored) |
