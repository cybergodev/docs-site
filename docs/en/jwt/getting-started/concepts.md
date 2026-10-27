---
title: "Core Concepts - CyberGo JWT | Architecture & Token Model"
description: "CyberGo JWT core concepts: the Processor type, token lifecycle, dual-layer token model, Claims and RegisteredClaims, CustomClaims, and Config."
sidebar_label: "Core Concepts"
sidebar_position: 2
---

# Core Concepts

This page explains the core abstractions and design model behind CyberGo JWT, establishing the overall picture before diving into code. To start coding right away, jump to [Quick Start](./index).

## Processor — The Central Type

[Processor](../api-reference/processor) is the central type of the library, created via [`jwt.New(cfg)`](../api-reference/functions#new). It encapsulates the full logic for token creation, validation, refresh, and revocation. All methods are **goroutine-safe** — a single instance can be shared across goroutines.

Call [`Close()`](../api-reference/processor#close) when done to release resources and clear key material:

<!-- check-code: skip -->
```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "your-32-byte-secret-key-here-minimum"

processor, err := jwt.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer processor.Close()
```

Processor implements the [`TokenManager`](../api-reference/interfaces#tokenmanager) interface, enabling dependency injection and test substitution.

## Token Lifecycle

A token moves through the following stages from issuance to invalidation:

```text
Issue    Create(claims)           → Access token (short-lived)
         CreateRefresh(claims)     → Refresh token (long-lived)

Verify   Parse(token)             → Claims (checks signature, expiry, issuer, blacklist)

Refresh  Refresh(refreshToken)    → New access token

Revoke   Revoke(token)            → Added to blacklist
Check    IsRevoked(token)         → bool
```

Each stage returns **sentinel errors** (e.g. `ErrTokenExpired`, `ErrTokenRevoked`) that can be matched precisely with `errors.Is()`. See [Error Handling](../guides/error-handling).

## Why a Two-Tier Token Model?

CyberGo JWT uses an access token + refresh token design:

| | Access Token | Refresh Token |
|---|---------|---------|
| **Purpose** | API authentication | Obtain new access tokens |
| **Default TTL** | 15 minutes | 7 days |
| **Issue method** | `Create` | `CreateRefresh` |
| **Refresh method** | — | `Refresh` |

**Why two layers?** Access tokens are short-lived, so the risk window after a leak stays small. Refresh tokens are long-lived but only exchange for new access tokens; they never authenticate API calls directly. The design balances security and user experience: no frequent logins, and an expired access token can be refreshed silently.

::: tip Rotation semantics
`Refresh` does not revoke the refresh token automatically by default. The original token stays valid until it expires or is explicitly `Revoke`d. One-time-use semantics and rotation details are covered in [Token Refresh & Rotation](../guides/token-refresh#rotation-strategies).
:::

## Claims Structure

Claims carry the user identity data inside a token. CyberGo JWT provides a two-layer structure:

**RegisteredClaims** (RFC 7519 standard claims; auto-filled at creation time. Verification checks `exp`, `nbf`, `iss`, and `aud`):

| Field | claim | Description |
|-------|-------|-------------|
| Issuer | `iss` | Issuer identifier; compared with the configuration at verification |
| Subject | `sub` | Subject identifier (also used as rate-limit key) |
| Audience | `aud` | Intended audience; compared with the configuration at verification |
| ExpiresAt | `exp` | Expiration time, validated at verification |
| NotBefore | `nbf` | Not-before time, validated at verification |
| IssuedAt | `iat` | Issuance time, written only, not validated |
| ID | `jti` | Unique ID (blacklist key) |
| TokenType | `token_type` | `access` or `refresh` |

> The library fills zero values only. An `iss`/`exp`/`iat`/`jti` value set explicitly by the caller is used as-is, overriding the configuration and TTL.

**Claims** (built-in business claims, embeds RegisteredClaims):

<!-- check-code: skip -->
```go
type Claims struct {
    UserID      string         // User ID
    Username    string         // Username
    Role        string         // Role
    Permissions []string       // Permission list
    Scopes      []string       // OAuth scopes
    SessionID   string         // Session ID
    ClientID    string         // Client ID
    Extra       map[string]any // Extra fields
    RegisteredClaims           // Standard claims (embedded)
}
```

Fields of the built-in `Claims` undergo deep validation **when a token is created**, covering string length (≤ 256 bytes of UTF-8, roughly 85 Chinese characters), array size (≤ 100 items), and XSS/SQLi injection pattern detection. The verification path runs only `Validate()` for required fields plus standard-claim string sanitization.

## CustomClaims Interface

When the built-in Claims do not meet business needs, implement the [`CustomClaims`](../api-reference/interfaces#customclaims) interface to define a custom claim structure:

<!-- check-code: skip -->
```go
type AppClaims struct {
    UserID string   `json:"user_id"`
    TeamID string   `json:"team_id"`
    Roles  []string `json:"roles,omitempty"`
    jwt.RegisteredClaims
}

func (c *AppClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *AppClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

Custom types are validated with `ParseInto` and refreshed with `RefreshInto`: the Processor parses the token and populates the target struct. See [Custom Claims](../guides/custom-claims).

## Config Overview

[`Config`](../api-reference/config) is the unified configuration entry point for Processor. Start with `DefaultConfig()` for sensible defaults, then set the secret key:

| Group | Fields | Description |
|-------|--------|-------------|
| **Signing** | `SecretKey` / `SigningKey` / `VerificationKey` / `SigningMethod` | HMAC uses SecretKey; RSA/ECDSA uses SigningKey |
| **Token** | `AccessTokenTTL` / `RefreshTokenTTL` | Access and refresh token lifetimes |
| **Validation** | `Issuer` / `ExpectedAudience` / `RequireExpiration` / `ClockSkew` | Issuer, audience, mandatory expiry, clock tolerance |
| **Security** | `Blacklist` / `EnableRateLimit` / `RejectRefreshAsAccess` / `RotateRefreshTokens` | Revocation store, rate limiting, and refresh-token security switches |
| **Extension** | `Clock` | Clock injection (for testing) |

For algorithm selection see [Signing Algorithms](../guides/signing-algorithms); for full field documentation see [Configuration](../guides/configuration).

## Extension Interfaces

CyberGo JWT is extensible through interfaces:

| Interface | Purpose |
|-----------|---------|
| [`TokenManager`](../api-reference/interfaces#tokenmanager) | Core interface implemented by Processor. A narrower subset (for example only `Create` + `Parse`) can be defined for dependency injection and decoupling |
| [`BlacklistStore`](../api-reference/interfaces#blackliststore) | Custom blacklist backend (e.g. Redis). Implement `Add` / `Contains` / `Close` to connect external storage |
| [`RateLimitProvider`](../api-reference/interfaces#ratelimitprovider) | Custom rate limiter. Implement `Allow` / `Reset` / `Close` to replace the built-in token bucket |
| [`ClockProvider`](../api-reference/interfaces#clockprovider) | Clock injection. `FixedClock` returns a fixed time for deterministic control over expiry and refresh logic in tests |

## Next Steps

- [Signing Algorithms](../guides/signing-algorithms) — HMAC, RSA, ECDSA selection guide
- [Configuration](../guides/configuration) — Full field reference and security hardening
- [Web Server Integration](../examples/web-server) — Auth middleware and RBAC in practice
