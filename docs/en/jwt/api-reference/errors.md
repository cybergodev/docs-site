---
title: "Errors - JWT API Reference"
description: "CyberGo JWT Errors API reference covering 17 sentinel errors (ErrTokenExpired, ErrTokenRevoked, etc.), ValidationError type, and errors.Is() matching patterns."
---

# Errors

## Sentinel Errors

All errors are checked using `errors.Is()`:

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
    ErrTokenExpired          = errors.New("token expired")
    ErrTokenNotValidYet      = errors.New("token not valid yet")
    ErrTokenInvalidIssuer    = errors.New("token invalid issuer")
    ErrTokenInvalidAudience  = errors.New("token invalid audience")

    ErrInvalidClaims = errors.New("invalid claims")

    ErrRateLimitExceeded = errors.New("rate limit exceeded")

    ErrBlacklistNotConfigured = errors.New("blacklist not configured")

    ErrProcessorClosed = errors.New("processor closed")
    ErrStoreClosed     = errors.New("store closed")
)
```

### Error Overview

| Error | Description | Check with `errors.Is()` |
|-------|-------------|--------------------------|
| `ErrInvalidConfig` | Invalid configuration | `Config.Validate()` |
| `ErrInvalidSecretKey` | Invalid secret key | `New()` |
| `ErrInvalidSigningMethod` | Invalid signing method | `New()` |
| `ErrInvalidToken` | Invalid token (signature error, etc.) | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrEmptyToken` | Empty token | All token operation methods |
| `ErrAlgorithmMismatch` | Token algorithm doesn't match configuration | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenRevoked` | Token has been revoked | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenMissingID` | Token is missing ID | `IsRevoked()` |
| `ErrTokenExpired` | Token has expired | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenNotValidYet` | Token is not yet valid | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenInvalidIssuer` | Issuer mismatch | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrTokenInvalidAudience` | Audience mismatch | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrInvalidClaims` | Claims validation failed | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` |
| `ErrRateLimitExceeded` | Rate limit exceeded | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` |
| `ErrBlacklistNotConfigured` | Blacklist not configured | `Revoke()` |
| `ErrProcessorClosed` | Processor is closed | All methods |
| `ErrStoreClosed` | Store is closed | `Revoke()`, etc. |

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
| `ErrInvalidToken` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Signature mismatch or format error |
| `ErrAlgorithmMismatch` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Token header algorithm doesn't match configuration |
| `ErrTokenExpired` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Past `exp` time |
| `ErrTokenNotValidYet` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Not yet at `nbf` time |
| `ErrTokenInvalidIssuer` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `iss` doesn't match `Config.Issuer` |
| `ErrTokenInvalidAudience` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | `aud` doesn't match `Config.ExpectedAudience` |
| `ErrTokenRevoked` | `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Token is in the blacklist |
| `ErrInvalidClaims` | `Create()`, `CreateRefresh()`, `Validate()`, `Refresh()`, `ValidateInto()`, `RefreshInto()` | Business validation failed |
| `ErrTokenMissingID` | `IsRevoked()` | Token is missing `jti` field |

#### Rate Limiting & Blacklist

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrRateLimitExceeded` | `Create()`, `CreateRefresh()`, `Refresh()`, `RefreshInto()` | Exceeded window request limit |
| `ErrBlacklistNotConfigured` | `Revoke()` | Blacklist store not configured |
| `ErrTokenMissingID` | `IsRevoked()` | Token is missing `jti` field |

#### Lifecycle

| Error | Trigger Method | Typical Cause |
|-------|----------------|---------------|
| `ErrProcessorClosed` | All methods | Operating after calling `Close()` |
| `ErrStoreClosed` | `Revoke()`, etc. | Blacklist store is closed |

---

## Error Handling Pattern

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Token expired - prompt user to refresh
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Token revoked - deny access
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

Field-level validation failure error. See [Types & Constants → ValidationError](./types#validationerror) for details.
