---
sidebar_label: "Errors"
title: "Errors - CyberGo JWT | Sentinel Errors"
description: "CyberGo JWT defines 20 sentinel errors covering config validation, token verification, expiration, issuer, audience, blacklist, rate limiting, and lifecycle."
sidebar_position: 70
---

# Errors

## Sentinel Errors

Sentinel errors are checked with `errors.Is()`:

```go
var (
    ErrInvalidConfig        = errors.New("invalid configuration")
    ErrInvalidSecretKey     = errors.New("invalid secret key")
    ErrInvalidSigningMethod = errors.New("invalid signing method")

    ErrInvalidToken          = errors.New("invalid token")
    ErrEmptyToken            = errors.New("empty token")
    ErrAlgorithmMismatch     = errors.New("token algorithm does not match configured signing method")
    ErrTokenRevoked          = errors.New("token revoked")
    ErrTokenMissingID        = errors.New("token missing ID")
    ErrTokenTypeMismatch     = errors.New("token type mismatch")
    ErrRefreshRotationFailed = errors.New("refresh rotation failed")
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")
    ErrExpirationRequired    = errors.New("token missing expiration claim")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("blacklist store is closed")
)
```

### Error Overview

| Error | Description | Check with `errors.Is()` |
|-------|-------------|--------------------------|
| `ErrInvalidConfig` | Invalid configuration | `New()`, `Config.Validate()` |
| `ErrInvalidSecretKey` | Invalid secret key | `New()` |
| `ErrInvalidSigningMethod` | Invalid signing method | `New()` |
| `ErrInvalidToken` | Invalid token (signature error, etc.) | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrEmptyToken` | Empty token | All token operation methods |
| `ErrAlgorithmMismatch` | Token algorithm doesn't match configuration | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrTokenRevoked` | Token has been revoked | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrTokenMissingID` | Token is missing ID | `Revoke()`, `IsRevoked()`; `Refresh()` / `RefreshInto()` when `RotateRefreshTokens` is enabled |
| `ErrTokenTypeMismatch` | Token type mismatch (refreshing with an access token, or using a refresh token as an access token) | `Refresh()`, `RefreshInto()`; `Parse()` / `ParseInto()` when `RejectRefreshAsAccess` is enabled |
| `ErrRefreshRotationFailed` | Refresh token rotation failed (wraps the underlying blacklist store error; a full built-in store never triggers it) | `Refresh()`, `RefreshInto()` (when `RotateRefreshTokens` is enabled) |
| `ErrTokenExpired` | Token has expired | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrTokenNotValidYet` | Token is not yet valid | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrTokenInvalidIssuer` | Issuer mismatch | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrTokenInvalidAudience` | Audience mismatch | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks `exp` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrInvalidClaims` | Claims validation failed | `Create()`, `CreateRefresh()`, `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` |
| `ErrRateLimitExceeded` | Rate limit exceeded | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` |
| `ErrBlacklistNotConfigured` | Blacklist not configured; unreachable in practice, since `New()` always builds one | `Revoke()`; `Refresh()` / `RefreshInto()` when `RotateRefreshTokens` is enabled |
| `ErrProcessorClosed` | Processor is closed | All methods |
| `ErrStoreClosed` | Store is closed | `Revoke()`, etc. |

::: info Check Order
`ErrAlgorithmMismatch` also satisfies `errors.Is(err, ErrInvalidToken)`. Match `ErrAlgorithmMismatch` before `ErrInvalidToken` in a branch chain; otherwise an algorithm mismatch falls into the generic invalid-token branch.
:::

When the built-in in-memory store fills up, it does not report an error — it evicts entries (fail-open), so evicted revocation records silently stop taking effect. `ErrRefreshRotationFailed` appears only when the underlying store truly returns an error, such as an unavailable or closed custom store backend.

### By Scenario

#### Configuration Phase

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrInvalidConfig` | `New()` | Multiple configuration items are invalid |
| `ErrInvalidSecretKey` | `New()` | HMAC key is less than 32 bytes or is a weak key |
| `ErrInvalidSigningMethod` | `New()` | Not one of the 12 built-in algorithms |

#### Token Validation

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrEmptyToken` | All token operation methods | Empty string passed |
| `ErrInvalidToken` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | Signature mismatch or format error |
| `ErrAlgorithmMismatch` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | Token header algorithm doesn't match configuration |
| `ErrExpirationRequired` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | Past `exp` time |
| `ErrTokenNotValidYet` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | Not yet at `nbf` time |
| `ErrTokenInvalidIssuer` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | `iss` doesn't match `Config.Issuer` |
| `ErrTokenInvalidAudience` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()`, `Revoke()`, `IsRevoked()` | `aud` doesn't match `Config.ExpectedAudience` |
| `ErrTokenRevoked` | `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | Token is in the blacklist |
| `ErrTokenTypeMismatch` | `Refresh()`, `RefreshInto()`; `Parse()` / `ParseInto()` when `RejectRefreshAsAccess` is enabled | Refreshing with an access token (`token_type=access`), or using a refresh token as an access token |
| `ErrInvalidClaims` | `Create()`, `CreateRefresh()`, `Parse()`, `Refresh()`, `ParseInto()`, `RefreshInto()` | Business validation failed |
| `ErrTokenMissingID` | `Revoke()`, `IsRevoked()`; `Refresh()` / `RefreshInto()` when `RotateRefreshTokens` is enabled | Token is missing `jti` field |

#### Rate Limiting & Blacklist

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrRateLimitExceeded` | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` | Exceeded window request limit |
| `ErrBlacklistNotConfigured` | `Revoke()`; `Refresh()` / `RefreshInto()` when `RotateRefreshTokens` is enabled | Blacklist store not configured. `New()` always builds the built-in store, so this is unreachable in practice |
| `ErrRefreshRotationFailed` | `Refresh()`, `RefreshInto()` (when `RotateRefreshTokens` is enabled) | Revoking the old refresh token failed (wraps the underlying blacklist store error); no new token was issued |
| `ErrTokenMissingID` | `Revoke()`, `IsRevoked()` | Token is missing `jti` field |

#### Lifecycle

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrProcessorClosed` | All methods | Operating after calling `Close()` |
| `ErrStoreClosed` | `Revoke()`, etc. | Blacklist store is closed |

---

## Error Handling Pattern

```go
import "errors"

claims, err := processor.Parse(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Token expired - prompt the client to refresh
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Token revoked - deny access
    case errors.Is(err, jwt.ErrAlgorithmMismatch):
        // Algorithm mismatch - must be checked before ErrInvalidToken
    case errors.Is(err, jwt.ErrInvalidToken):
        // Invalid signature - deny access
    case errors.Is(err, jwt.ErrProcessorClosed):
        // System error - Processor is closed
    default:
        // Unknown error
    }
}
```

---

## Error Types

### ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

Field-level validation failure error, typically wrapped by `ErrInvalidClaims` and extracted with `errors.As`. The `Err` field holds an optional underlying error and the `Unwrap` method returns it, so `errors.Is` / `errors.As` can keep unwrapping to deeper causes. See [Types & Constants → ValidationError](./types#validationerror) for fields and methods.
