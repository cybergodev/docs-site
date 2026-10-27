---
sidebar_label: "Error Handling"
title: "Error Handling - CyberGo JWT | Sentinels"
description: "Categorize all 20 CyberGo JWT sentinel errors across config, validation, rate limiting, and lifecycle, with errors.Is and HTTP status codes."
sidebar_position: 50
---

# Error Handling

CyberGo JWT uses the sentinel errors pattern. All errors are checked with `errors.Is()`.

## Basic Pattern

```go
claims, err := processor.Parse(tokenString)
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
| `ErrInvalidToken` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | Signature mismatch, deny access |
| `ErrAlgorithmMismatch` | Parse, Refresh, ParseInto, RefreshInto | Token algorithm doesn't match config, deny access |
| `ErrExpirationRequired` | Parse, Refresh, ParseInto, RefreshInto | `RequireExpiration` enabled but token lacks `exp` claim |
| `ErrTokenTypeMismatch` | Refresh, RefreshInto; Parse / ParseInto when `RejectRefreshAsAccess` is enabled | Token type mismatch: access token used to refresh, or refresh token used as an access token, deny access |
| `ErrTokenExpired` | Parse, Refresh, ParseInto, RefreshInto | Prompt user to refresh token |
| `ErrTokenNotValidYet` | Parse, Refresh, ParseInto, RefreshInto | Check clock synchronization |
| `ErrTokenInvalidIssuer` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | Issuer mismatch |
| `ErrTokenInvalidAudience` | Parse, Refresh, ParseInto, RefreshInto, Revoke, IsRevoked | Audience mismatch |
| `ErrTokenRevoked` | Parse, Refresh, ParseInto, RefreshInto | Token revoked, deny access |
| `ErrInvalidClaims` | Create, CreateRefresh, Parse, Refresh, ParseInto, RefreshInto | Business validation failed |
| `ErrTokenMissingID` | Revoke, IsRevoked; Refresh / RefreshInto when `RotateRefreshTokens` is enabled | Token missing jti |
| `ErrRefreshRotationFailed` | Refresh, RefreshInto (when `RotateRefreshTokens` is enabled) | Revoking the old refresh token failed; no new token was issued |

### Rate Limiting & Blacklist

| Error | Method | Suggestion |
|-------|--------|------------|
| `ErrRateLimitExceeded` | Create, CreateRefresh, Refresh, RefreshInto | Return 429 |
| `ErrBlacklistNotConfigured` | Revoke; Refresh / RefreshInto when `RotateRefreshTokens` is enabled | Configure blacklist |

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

## Error Wrapping Chain

CyberGo JWT errors fall into sentinel errors (matchable with `errors.Is`) and wrapped errors (structured details require `errors.As`). Understanding the wrapping chain makes failures easier to pinpoint.

### ValidationError and errors.As

Field-level validation failures (length exceeded, injection detected, etc.) return a `*ValidationError` containing the specific field name and error message. No matter how many layers wrap it, `errors.As` can pierce through:

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("Field: %s, Reason: %s\n", ve.Field, ve.Message)
        // Field: UserID, Reason: suspicious pattern detected
        return
    }
    // Non-field-level error, go through the errors.Is branches
}
```

### ErrInvalidClaims Wrapping Claims.Validate()

`Claims.Validate()` (or a custom Claims' `Validate()`) returns a **descriptive error** (e.g. `errors.New("user_id is required")`), not a sentinel error. The Processor wraps it as `ErrInvalidClaims`:

```text
invalid claims: user_id is required
└── ErrInvalidClaims (sentinel, outer layer)
    └── user_id is required (descriptive, inner layer)
```

So the matching is two-layered:

```go
if errors.Is(err, jwt.ErrInvalidClaims) {
    // It's the Claims validation failure category
    fmt.Println("Details:", err) // invalid claims: user_id is required
}
```

### ParseUnverified Parse Errors

When [`ParseUnverified`](../api-reference/processor#parseunverified) encounters a malformed token (e.g., base64 decode failure, JSON parse failure), the returned parse error is a **wrapped error**, not a sentinel error:

```go
err := processor.ParseUnverified(malformedToken, &claims)
if err != nil {
    // ❌ Cannot match the specific cause with errors.Is
    // ✅ Can only determine "parsing failed"
    fmt.Println("Parse failed:", err) // failed to parse token: ...
}
```

The only two sentinel errors from `ParseUnverified` are `ErrProcessorClosed` (Processor is closed) and `ErrEmptyToken` (empty string passed in); all other format errors cannot be precisely matched with `errors.Is`.

::: tip When to Use errors.Is vs errors.As
- **`errors.Is`**: matches sentinel errors (`ErrTokenExpired`, `ErrInvalidClaims`, etc.), used to determine "which category of failure".
- **`errors.As`**: extracts structured errors (`*ValidationError`), used to find out "exactly which field had what problem".
- The two can be combined: first use `errors.Is` to locate the category, then `errors.As` to extract details.
:::

## HTTP Status Code Mapping

In a RESTful API, mapping JWT errors to suitable HTTP status codes lets clients distinguish credential problems (401), request format problems (400), and server problems (500).

### Mapping Table

| JWT Error | HTTP Status Code | Client Action |
|-----------|------------------|---------------|
| `ErrEmptyToken` | 401 Unauthorized | Provide an auth token |
| `ErrInvalidToken` | 401 Unauthorized | Re-authenticate |
| `ErrAlgorithmMismatch` | 401 Unauthorized | Token source untrusted, re-authenticate |
| `ErrTokenExpired` | 401 Unauthorized | Exchange refresh token for a new one |
| `ErrTokenRevoked` | 401 Unauthorized | Token revoked, re-authenticate |
| `ErrTokenInvalidIssuer` | 401 Unauthorized | Token issuer mismatch |
| `ErrTokenInvalidAudience` | 401 Unauthorized | Token audience mismatch |
| `ErrTokenNotValidYet` | 401 Unauthorized | Check client clock synchronization |
| `ErrTokenTypeMismatch` | 401 Unauthorized | Use the correct refresh token |
| `ErrExpirationRequired` | 401 Unauthorized | Token missing expiration claim |
| `ErrInvalidClaims` | 400 Bad Request | Fix Claims content (creation scenario) |
| `ErrRateLimitExceeded` | 429 Too Many Requests | Reduce request rate, retry later |
| `ErrProcessorClosed` | 500 Internal Server Error | Server needs to restart Processor |

The trade-offs behind the four status codes:

- **401**: covers every token validity problem (expired, revoked, bad signature, issuer or audience mismatch). The client should re-authenticate or refresh the token.
- **400**: used only when Claims validation fails while creating a token. This is a caller programming error, not an authentication failure.
- **429**: returned when rate limiting trips, together with a `Retry-After` header stating the wait time.
- **500**: `ErrProcessorClosed` is a server-side state anomaly; the response must not expose internal details.

## Error Handling in Web Services

The handler below covers all common errors that `Parse` may return, and returns appropriate responses per the [HTTP Status Code Mapping](#http-status-code-mapping):

<!-- check-code: skip -->
```go
package main

import (
    "encoding/json"
    "errors"
    "net/http"

    "github.com/cybergodev/jwt"
)

// authError maps a JWT error to an HTTP status code and message
// (the mapping follows the table above).
func authError(w http.ResponseWriter, err error) {
    w.Header().Set("Content-Type", "application/json")

    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_expired",
            "message": "Token has expired, please refresh",
        })

    case errors.Is(err, jwt.ErrTokenRevoked):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_revoked",
            "message": "Token has been revoked",
        })

    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_issuer",
            "message": "Issuer mismatch",
        })

    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_audience",
            "message": "Audience mismatch",
        })

    case errors.Is(err, jwt.ErrTokenNotValidYet):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "token_not_valid_yet",
            "message": "Token is not yet valid",
        })

    case errors.Is(err, jwt.ErrAlgorithmMismatch):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "algorithm_mismatch",
            "message": "Signing algorithm mismatch",
        })

    case errors.Is(err, jwt.ErrInvalidToken),
        errors.Is(err, jwt.ErrEmptyToken),
        errors.Is(err, jwt.ErrExpirationRequired):
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "invalid_token",
            "message": "Invalid token",
        })

    case errors.Is(err, jwt.ErrInvalidClaims):
        var ve *jwt.ValidationError
        if errors.As(err, &ve) {
            w.WriteHeader(http.StatusBadRequest)
            json.NewEncoder(w).Encode(map[string]string{
                "error":   "validation_failed",
                "field":   ve.Field,
                "message": ve.Message,
            })
        } else {
            w.WriteHeader(http.StatusBadRequest)
            json.NewEncoder(w).Encode(map[string]string{
                "error":   "validation_failed",
                "message": "Claims validation failed",
            })
        }

    case errors.Is(err, jwt.ErrRateLimitExceeded):
        w.Header().Set("Retry-After", "60")
        w.WriteHeader(http.StatusTooManyRequests)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "rate_limited",
            "message": "Too many requests, please retry later",
        })

    case errors.Is(err, jwt.ErrProcessorClosed):
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "internal_error",
            "message": "Service temporarily unavailable",
        })

    default:
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "error":   "auth_failed",
            "message": "Authentication failed",
        })
    }
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
    claims, err := processor.Parse(extractToken(r))
    if err != nil {
        authError(w, err)
        return
    }
    _ = claims
}
```

::: tip Reusing authError
`authError` is an error-mapping function independent of any route and can be reused by every handler that requires authentication. It can also be called when handling `ErrTokenTypeMismatch` in the [refresh endpoint](../examples/web-server#_5-refresh-endpoint-refresh).
:::

## Next Steps

- [API Reference → Errors](../api-reference/errors) — Complete error list
- [API Reference → Types](../api-reference/types#validationerror) — Error type definitions
