---
sidebar_label: "Token Refresh & Rotation"
title: "Token Refresh & Rotation - CyberGo JWT | Rotation Strategy"
description: "CyberGo JWT token refresh and rotation: two-tier TTL design, CreateRefresh/Refresh flow, RefreshInto claims, and reuse vs. one-time rotation via RotateRefreshTokens."
sidebar_position: 25
check_code: false
---

# Token Refresh & Rotation

CyberGo JWT uses a two-tier token design: short-lived **access tokens** for API authentication, and long-lived **refresh tokens** for obtaining new access tokens after they expire. This design balances security with user experience.

## Two-Tier Token Model

| Token Type | Issuance Method | Default TTL | Purpose |
|------------|-----------------|-------------|---------|
| Access token | [`Create`](../api-reference/processor#create) | 15 minutes | API authentication, frequent validation |
| Refresh token | [`CreateRefresh`](../api-reference/processor#createrefresh) | 7 days | Exchange for new access tokens, infrequent use |

Token type is marked via the `token_type` claim (`access` / `refresh`). The [`Refresh`](../api-reference/processor#refresh) method rejects access tokens, preventing them from being used to obtain new tokens.

### TTL Configuration

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.AccessTokenTTL = 15 * time.Minute    // Access token lifetime
cfg.RefreshTokenTTL = 7 * 24 * time.Hour // Refresh token lifetime (must be > AccessTokenTTL)
```

::: tip Constraint
`Config.Validate()` requires `RefreshTokenTTL > AccessTokenTTL`, otherwise it returns `ErrInvalidConfig`.
:::

## Basic Refresh Flow

### 1. Issue Token Pair

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
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}

    // Access token (short-lived)
    accessToken, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // Refresh token (long-lived)
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }

    fmt.Println("Access Token:", accessToken)
    fmt.Println("Refresh Token:", refreshToken)
}
```

### 2. Refresh to Get a New Access Token

When the access token expires, use the refresh token to obtain a new one:

```go
// refreshToken was previously issued via CreateRefresh
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Refresh token expired, user needs to re-authenticate
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Refresh token has been revoked
    case errors.Is(err, jwt.ErrTokenTypeMismatch):
        // An access token was passed instead of a refresh token
    default:
        // Other error
    }
    return
}
fmt.Println("New Access Token:", newAccessToken)
```

`Refresh` fully validates the refresh token: signature, expiration, issuer, audience, and blacklist status.

## Custom Claims Refresh

When using custom Claims types, use [`RefreshInto`](../api-reference/processor#refreshinto) to populate the parsed result into a custom struct:

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

```go
// Issue a refresh token with custom Claims
refreshToken, err := processor.CreateRefresh(&MyClaims{UserID: "123", Role: "admin"})

// Refresh into custom struct
result := &MyClaims{}
newToken, err := processor.RefreshInto(refreshToken, result)
```

## Rotation Strategies

### Reuse Mode (Default)

By default, `Refresh` does **not** revoke the original refresh token. The original token remains valid until it expires or is explicitly revoked, and can be used multiple times:

```go
// First refresh
token1, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}

// The same refreshToken is still valid and can be used again
token2, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
```

**Use cases**: Mobile apps, single-device login. Users don't need to re-authenticate frequently; the refresh token can be reused within its TTL.

### One-Time Rotation

For higher-security scenarios, make each refresh token usable only once. Since v1.2.3, the recommended way is the built-in rotation switch `Config.RotateRefreshTokens` <Badge type="tip" text="v1.2.3+" />:

```go
cfg := jwt.DefaultConfig()
// ...required config such as keys and TTLs
cfg.RotateRefreshTokens = true // one-time use: Refresh revokes the old token before minting the new one

processor, err := jwt.New(cfg)
if err != nil {
    panic(err)
}

// Refresh / RefreshInto automatically revoke the old refresh token
// (blacklist its jti) before minting the new access token
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
```

::: warning Fail-Closed Semantics and Concurrency
- **Revocation precedes minting**: the old token's jti is blacklisted **before** the new token is minted. If minting subsequently fails (e.g. the rate limit trips), the old token is already revoked and the subject must re-authenticate — a deliberate fail-closed design guaranteeing an accepted refresh token cannot be replayed after the fact.
- **Errors**: if revoking the old token fails, `ErrRefreshRotationFailed` is returned (wrapping the underlying blacklist store error) and no new token is issued; a refresh token without a jti cannot be revoked and is rejected with `ErrTokenMissingID`; a processor without a configured blacklist returns `ErrBlacklistNotConfigured` (as does `Revoke()`). Processors built via `jwt.New()` always carry a blacklist — `DefaultConfig()` enables one by default and zero-valued fields are normalized in `New()` — so this error does not arise in normal use.
- **Concurrency**: rotation narrows but does not eliminate the replay window — two concurrent `Refresh` calls can both pass validation before either revocation lands. A strict single-use guarantee requires an atomic check-and-add in a custom `BlacklistStore`.
:::

When you cannot change the configuration, manual `Refresh` + `Revoke` is an equivalent alternative:

```go
// Refresh and immediately revoke the old token
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}

// Revoke the old refresh token so it cannot be used again
if err := processor.Revoke(refreshToken); err != nil {
    panic(err)
}
```

Note the manual approach leaves a window — the old token remains usable between a successful `Refresh` and the `Revoke` taking effect — and you must handle the case where the first step succeeds but the second fails.

**Use cases**: Web applications, high-security systems. The old token becomes invalid immediately after each refresh, reducing the risk of token leakage.

### Strategy Comparison

| Dimension | Reuse Mode | One-Time Rotation |
|-----------|------------|-------------------|
| Security | Lower (leaked tokens can be reused) | Higher (leaked tokens are single-use only) |
| User experience | Better (no frequent re-authentication) | Average (refresh failure requires re-login) |
| Implementation | No extra code | One config switch (`RotateRefreshTokens`), or calling `Revoke` manually |
| Blacklist pressure | Low | Higher (each refresh adds an entry) |

::: warning Refresh Token Leak Detection
In one-time rotation mode, if an attacker uses a revoked refresh token, `Refresh` returns `ErrTokenRevoked`. The application layer can use this to detect token leakage and force re-authentication.
:::

## Type Safety

CyberGo JWT distinguishes token types via the `token_type` claim. `Refresh` and `RefreshInto` reject access tokens:

```go
// Attempting to refresh with an access token is rejected
_, err := processor.Refresh(accessToken)
// err wraps ErrTokenTypeMismatch: expected refresh token, got access token
```

This prevents access tokens from being used to obtain new tokens, ensuring type isolation in the two-tier model.

Tokens without a `token_type` claim (issued by older versions) are accepted for backward compatibility.

## Security Notes

- **Refresh does not auto-revoke by default**: The original refresh token remains valid after `Refresh`. For one-time-use semantics, enable `Config.RotateRefreshTokens` (recommended, see [One-Time Rotation](#one-time-rotation)) or call `Revoke` manually.
- **Claims are not deeply validated**: `Refresh` validates standard JWT fields (signature, expiration, issuer, audience, blacklist) and basic structure (UserID or Username must be present), but does not re-check field length limits or injection patterns, trusting they were validated at creation.
- **Signature consistency**: New access tokens use the same signing algorithm and key as the refresh token. Cross-algorithm refresh is not supported.

## Next Steps

- [Token Blacklist](./blacklist) — Revocation mechanism and custom storage backends
- [Error Handling](./error-handling) — All sentinel error categories and handling
- [Configuration](./configuration) — TTL, issuer, audience, and clock skew configuration
- [Processor API](../api-reference/processor) — Full signatures for `Refresh`, `RefreshInto`, `CreateRefresh`
