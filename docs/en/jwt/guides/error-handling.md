---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo JWT | Sentinels"
description: "Categorize all 19 CyberGo JWT sentinel errors across config, token validation, rate limiting, and lifecycle with errors.Is matching and response practices."
sidebar_position: 50
---

# Error Handling

CyberGo JWT uses the sentinel errors pattern. All errors are checked with `errors.Is()`.

## Basic Pattern

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Token expired
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Token revoked
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // Issuer mismatch
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // Audience mismatch
    case errors.Is(err, jwt.ErrInvalidToken):
        // Invalid signature or format
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor is closed
    default:
        // Other errors
    }
}
```

:::tip Use errors.Is()
Don't use `err == jwt.ErrTokenExpired` or string matching. `errors.Is()` correctly handles wrapped errors.
:::

## Error Categories

### Configuration Phase

`jwt.New()` may return these errors:

| Error | Cause | Solution |
|-------|-------|----------|
| `ErrInvalidConfig` | Multiple invalid config fields | Check Config fields |
| `ErrInvalidSecretKey` | HMAC key under 32 bytes or weak key | Use a stronger key |
| `ErrInvalidSigningMethod` | Unsupported signing algorithm | Use one of 12 built-in algorithms |

### Token Operations

| Error | Method | Suggestion |
|-------|--------|------------|
| `ErrEmptyToken` | All token operation methods | Check request header |
| `ErrInvalidToken` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | Signature mismatch, deny access |
| `ErrAlgorithmMismatch` | Validate, Refresh, ValidateInto, RefreshInto | Token algorithm doesn't match config, deny access |
| `ErrExpirationRequired` | Validate, Refresh, ValidateInto, RefreshInto | `RequireExpiration` enabled but token lacks `exp` claim |
| `ErrTokenTypeMismatch` | Refresh, RefreshInto | Access token (`token_type=access`) used to refresh, deny access |
| `ErrTokenExpired` | Validate, Refresh, ValidateInto, RefreshInto | Prompt user to refresh token |
| `ErrTokenNotValidYet` | Validate, Refresh, ValidateInto, RefreshInto | Check clock synchronization |
| `ErrTokenInvalidIssuer` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | Issuer mismatch |
| `ErrTokenInvalidAudience` | Validate, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked | Audience mismatch |
| `ErrTokenRevoked` | Validate, Refresh, ValidateInto, RefreshInto | Token revoked, deny access |
| `ErrInvalidClaims` | Create, CreateRefresh, Validate, Refresh, ValidateInto, RefreshInto | Business validation failed |
| `ErrTokenMissingID` | Revoke, IsRevoked | Token missing jti |

### Rate Limiting & Blacklist

| Error | Method | Suggestion |
|-------|--------|------------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | Return 429 |
| `ErrBlacklistNotConfigured` | Revoke | Configure blacklist |

### Lifecycle

| Error | Method | Suggestion |
|-------|--------|------------|
| `ErrProcessorClosed` | All methods | Recreate Processor |
| `ErrStoreClosed` | Revoke, etc. | Storage closed |

## Error Types

### ValidationError

Returned on field-level validation failure, containing specific field and error info:

```go
type ValidationError struct {
    Field   string  // Field name that failed
    Message string  // Error description
    Err     error   // Inner error
}
```

## Error Handling in Web Services

```go
func handleProtected(w http.ResponseWriter, r *http.Request) {
    tokenString := extractToken(r)
    claims, valid, err := processor.Validate(tokenString)
    if err != nil {
        switch {
        case errors.Is(err, jwt.ErrTokenExpired):
            http.Error(w, "token expired", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrTokenRevoked):
            http.Error(w, "token revoked", http.StatusUnauthorized)
        case errors.Is(err, jwt.ErrInvalidToken):
            http.Error(w, "invalid token", http.StatusUnauthorized)
        default:
            http.Error(w, "auth failed", http.StatusUnauthorized)
        }
        return
    }
    if !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }
    // Process request
}
```

## Next Steps

- [API Reference → Errors](../api-reference/errors) — Complete error list
- [API Reference → Types](../api-reference/types#validationerror) — Error type definitions
