---
sidebar_label: "Configuration"
title: "Configuration - CyberGo JWT | Config & Security Hardening"
description: "CyberGo JWT configuration: issuer/audience validation, clock skew tolerance, mandatory expiration, TTL, and input validation with injection detection."
sidebar_position: 15
check_code: false
---

# Configuration

[`Config`](../api-reference/config) is the unified configuration entry point for CyberGo JWT. This page focuses on security and behavior configuration fields beyond signing algorithms; for signing keys and algorithm selection, see [Signing Algorithms](./signing-algorithms).

## Configuration Overview

[`DefaultConfig()`](../api-reference/functions#defaultconfig) provides sensible defaults — you only need to set the secret key to get started:

| Field | Default | Description |
|-------|---------|-------------|
| `AccessTokenTTL` | 15 minutes | Access token lifetime |
| `RefreshTokenTTL` | 7 days | Refresh token lifetime |
| `Issuer` | `"jwt-service"` | Written to `iss` claim and validated |
| `SigningMethod` | `HS256` | Signing algorithm |
| `ClockSkew` | 0 | Clock skew tolerance |
| `RequireExpiration` | `false` | Whether `exp` claim is required |
| `ExpectedAudience` | `""` (no check) | Expected audience |

### normalizeConfig Auto-fill Rules

[`New()`](../api-reference/functions#new) calls `normalizeConfig` before validation, filling zero-value fields with defaults. The table below lists each rule:

| Zero-Value Condition | Filled Default | Trigger |
|----------------------|----------------|---------|
| `AccessTokenTTL == 0` | 15 minutes | Always |
| `RefreshTokenTTL == 0` | 7 days | Always |
| `Issuer == ""` | `"jwt-service"` | Always |
| `SigningMethod == ""` | `HS256` | Always |
| `RateLimitRate == 0` | 100 | Only when `EnableRateLimit == true` |
| `RateLimitWindow == 0` | 1 minute | Only when `EnableRateLimit == true` |
| `Blacklist.MaxSize == 0` | 100000 | Only for built-in storage (`Store == nil`) |
| `Blacklist.CleanupInterval == 0` | 5 minutes | Only for built-in storage |
| `Blacklist.EnableAutoCleanup` | Forced `true` | Only for built-in storage |

::: tip When Rate Limit Defaults Apply
The defaults for `RateLimitRate` and `RateLimitWindow` **are filled only when `EnableRateLimit` is `true`**. If `EnableRateLimit` is `false` (the default), rate limiting is not enabled and these two fields are ignored. See [Rate Limiting](./rate-limiting).
:::

::: warning Custom BlacklistStore Skips Auto-fill
When `Blacklist.Store` is not `nil` (using a custom storage backend), `MaxSize`, `CleanupInterval`, and `EnableAutoCleanup` are all ignored — storage management is the backend's responsibility. The built-in storage's `EnableAutoCleanup` is forced to `true` to prevent unbounded memory growth.
:::

## Issuer and Audience Validation

### Issuer

When `Issuer` is set, it is written to the `iss` claim during token creation and validated for consistency during verification:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Issuer = "my-app-v1" // Token will carry iss: "my-app-v1"
```

During validation, if the token's `iss` does not match the configured value, `ErrTokenInvalidIssuer` is returned.

### ExpectedAudience

When `ExpectedAudience` is set, validation checks that the token's `aud` claim contains this value:

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.ExpectedAudience = "billing-api"

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Token with matching audience
    claims := &jwt.Claims{
        UserID: "user1",
        RegisteredClaims: jwt.RegisteredClaims{
            Audience: jwt.StringOrSlice{"billing-api"},
        },
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    _, valid, _ := processor.Validate(token)
    fmt.Println("Valid:", valid)
    // Output: Valid: true

    // Token with wrong audience is rejected
    wrongClaims := &jwt.Claims{
        UserID: "user2",
        RegisteredClaims: jwt.RegisteredClaims{
            Audience: jwt.StringOrSlice{"admin-api"},
        },
    }
    wrongToken, _ := processor.Create(wrongClaims)
    _, valid, _ = processor.Validate(wrongToken)
    fmt.Println("Wrong audience valid:", valid)
    // Output: Wrong audience valid: false
}
```

::: tip Multi-Service Scenarios
In microservice architectures, set different `ExpectedAudience` values for different services so that tokens issued by one service cannot be accepted by another, achieving inter-service token isolation.
:::

## Clock Skew

`ClockSkew` provides a tolerance window for `exp` (expiration) and `nbf` (not-before) validation, accommodating clock drift between the issuer and validator. The skew applies symmetrically to both time claims:

- **`exp` direction**: a token is considered expired only after `exp + ClockSkew` — relaxing expiration validation
- **`nbf` direction**: a token is considered valid from `nbf - ClockSkew` — relaxing not-before validation

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.ClockSkew = 30 * time.Second // Tolerate 30 seconds of clock drift
```

::: warning Recommendation
In distributed systems, clock skew between servers can be several seconds. Setting `ClockSkew = 30s ~ 60s` is recommended. A zero value (default) means strict validation with no tolerance.
:::

### ClockSkew Impact on Token Validity

The table below shows the validity of a token with `exp = 12:00:00` and `nbf = 12:00:00` at various validation times when `ClockSkew = 30s`:

| Validation Time | Relation to exp | Relation to nbf | Result |
|-----------------|-----------------|-----------------|--------|
| `11:59:20` | Not expired | `nbf - 40s` (beyond skew) | Invalid: `ErrTokenNotValidYet` |
| `11:59:40` | Not expired | `nbf - 20s` (within skew window) | Valid |
| `12:00:00` | Not expired | At `nbf` moment | Valid |
| `12:00:10` | `exp + 10s` (within skew window) | Already valid | Valid |
| `12:00:40` | `exp + 40s` (beyond skew) | Already valid | Invalid: `ErrTokenExpired` |

::: tip Skew Only Relaxes, Never Tightens
`ClockSkew` only widens the acceptance window of a token; it never narrows the window of strict validation. A zero value is equivalent to RFC 7519's strict semantics: the token takes effect exactly at `nbf` and expires exactly at `exp`.
:::

`ClockSkew` must not be negative — `Config.Validate()` returns `ErrInvalidConfig`.

## Mandatory Expiration (RequireExpiration)

By default (`RequireExpiration = false`), tokens without an `exp` claim never expire. This is valid per RFC 7519 but can be a security concern in sensitive scenarios.

Setting `RequireExpiration = true` rejects tokens that lack an `exp` claim during validation:

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.RequireExpiration = true // Reject tokens without exp
```

::: tip Security Hardening
Tokens issued by this library always carry `exp` (derived from TTL), so `RequireExpiration` primarily affects tokens from other issuers or legacy tokens missing `exp`. Enabling it in production is recommended.
:::

## Token TTL Design

Access and refresh token TTLs should balance security and user experience based on your use case:

| Scenario | AccessTokenTTL | RefreshTokenTTL | Notes |
|----------|----------------|-----------------|-------|
| High-security (finance, healthcare) | 5 minutes | 1 hour | Short TTL limits exposure window |
| Web application | 15 minutes | 7 days | Default, balances security and UX |
| Mobile app | 30 minutes | 30 days | Longer TTL reduces re-login |
| Internal service | 1 hour | 24 hours | Higher trust on internal networks |

::: warning Constraint
`Config.Validate()` requires `AccessTokenTTL < RefreshTokenTTL`, and both must be positive.
:::

## Configuration Validation Matrix

`Config.Validate()` runs inside `New()` after `normalizeConfig` and returns three categories of errors: `ErrInvalidConfig`, `ErrInvalidSecretKey`, and `ErrInvalidSigningMethod`.

### Signing Key Validation (by Algorithm)

| Algorithm Family | `SigningKey` Requirement | `VerificationKey` (optional) |
|------------------|--------------------------|------------------------------|
| HMAC (HS256/384/512) | `SecretKey` string ≥ 32 bytes + non-weak key | N/A (HMAC is symmetric) |
| RSA (RS/PS 256/384/512) | `*rsa.PrivateKey` ≥ 2048 bits | `*rsa.PublicKey` ≥ 2048 bits |
| ECDSA (ES256/384/512) | `*ecdsa.PrivateKey`, curve matches algorithm | `*ecdsa.PublicKey` |

::: tip Purpose of VerificationKey
When `VerificationKey` is set, the public key is used for token verification instead of the private key — suitable for verify-only services (e.g., resource servers). When omitted, verification uses the private key from `SigningKey`. See [Signing Algorithms](./signing-algorithms).
:::

### Config.Validate() Complete Checks

| Check | Condition | Returned Error |
|-------|-----------|----------------|
| Config pointer | `nil` | `ErrInvalidConfig` |
| HMAC key length | `SecretKey < 32` bytes | `ErrInvalidSecretKey` |
| HMAC key strength | Weak key (low entropy / low complexity) | `ErrInvalidSecretKey` |
| RSA signing key type | Not `*rsa.PrivateKey` | `ErrInvalidSecretKey` |
| RSA signing key strength | `< 2048` bits | `ErrInvalidSecretKey` |
| RSA verification key type | Not `*rsa.PublicKey` (when set) | `ErrInvalidSecretKey` |
| RSA verification key strength | `< 2048` bits (when set) | `ErrInvalidSecretKey` |
| ECDSA signing key type | Not `*ecdsa.PrivateKey` | `ErrInvalidSecretKey` |
| ECDSA curve match | Curve does not match algorithm (e.g., ES256 requires P-256) | `ErrInvalidSecretKey` |
| ECDSA verification key type | Not `*ecdsa.PublicKey` (when set) | `ErrInvalidSecretKey` |
| Signing algorithm | Not one of the 12 built-in algorithms | `ErrInvalidSigningMethod` |
| AccessTokenTTL | `<= 0` | `ErrInvalidConfig` |
| RefreshTokenTTL | `<= 0` | `ErrInvalidConfig` |
| TTL relationship | `AccessTokenTTL >= RefreshTokenTTL` | `ErrInvalidConfig` |
| ClockSkew | `< 0` | `ErrInvalidConfig` |
| Blacklist MaxSize | `<= 0` (built-in storage only) | `ErrInvalidConfig` |
| Blacklist CleanupInterval | `<= 0` (built-in storage only) | `ErrInvalidConfig` |

::: tip Validation Order
`Validate()` first checks the signing key (returning `ErrInvalidSecretKey` or `ErrInvalidSigningMethod`), then checks TTL, ClockSkew, and Blacklist configuration (returning `ErrInvalidConfig`). If the key is invalid, subsequent checks are not performed — fix the first error and re-test.
:::

## Input Validation and Security Hardening

CyberGo JWT applies multi-layer input validation to [`Claims`](../api-reference/claims) fields, preventing injection attacks and abnormal data.

### Field Constraints

| Validation | Limit | Triggered Error |
|------------|-------|-----------------|
| String field length | ≤ 256 characters | `ValidationError` |
| Array size (permissions, scopes, audience) | ≤ 100 items | `ValidationError` |
| Extra field count | ≤ 50 fields | `ValidationError` |
| Extra value types | `string`, `[]string` | `ValidationError` (nested maps rejected) |

Validated string fields include `UserID`, `Username`, `Role`, `SessionID`, `ClientID`, and the `RegisteredClaims` fields `Issuer`, `Subject`, `ID`, `TokenType`.

### Injection Pattern Detection

The library includes 46 built-in dangerous pattern detections covering XSS, SQL injection, path traversal, and other attack vectors:

- **XSS**: `<script>`, `javascript:`, `onerror=`, `<iframe>`, and other HTML/JS injection tags
- **SQL injection**: `drop table`, `union select`, etc.
- **Path traversal**: `../`, `/etc/passwd`, `file://`
- **Control characters**: ASCII < 32 except Tab (9), newline (10), carriage return (13)

When a dangerous pattern is detected, a `ValidationError` is returned with `Field` set to the field name and `Message` set to `"suspicious pattern detected"`.

### Handling Validation Errors

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("Field: %s, Reason: %s\n", ve.Field, ve.Message)
        // Field: user_id, Reason: suspicious pattern detected
    }
}
```

`ValidationError` implements `Unwrap()`, enabling `errors.Is` and `errors.As` to traverse the underlying error. In the `Create` and `Validate` paths, validation errors are wrapped with `ErrInvalidClaims`.

::: tip Custom Claims Validation
Types implementing the `CustomClaims` interface are not deeply validated for custom fields — implementers must handle this in the `Validate()` method. Standard JWT fields (`iss`, `sub`, `jti`, etc.) are always validated for length and injection. See [Custom Claims](./custom-claims).
:::

## Next Steps

- [Signing Algorithms](./signing-algorithms) — Algorithm selection and key configuration
- [Custom Claims](./custom-claims) — CustomClaims interface implementation
- [Token Refresh & Rotation](./token-refresh) — Two-tier token TTL and rotation strategies
- [Config API](../api-reference/config) — Complete Config field reference
