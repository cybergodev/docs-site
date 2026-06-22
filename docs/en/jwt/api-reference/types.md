---
title: "Types - CyberGo JWT | Types & Constants"
description: "Types and constants: NumericDate, StringOrSlice serialization, SigningMethod, ValidationError, RateLimiter, SystemClock, FixedClock, and 12 algorithm constants."
---

# Types & Constants

## NumericDate

```go
type NumericDate struct {
    time.Time
}
```

JWT numeric date value (Unix timestamp). Valid range: 0 to 253402300799 (9999-12-31 23:59:59 UTC).

<Badge type="info" text="struct" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `MarshalJSON` | `func (date *NumericDate) MarshalJSON() ([]byte, error)` | Serialize to Unix timestamp JSON number; returns `null` for zero time or out-of-range values |
| `UnmarshalJSON` | `func (date *NumericDate) UnmarshalJSON(b []byte) error` | Parse Unix timestamp from JSON number or string; rejects negative and out-of-range values |

---

## StringOrSlice

```go
type StringOrSlice []string
```

Holds a `[]string` that unmarshals from either a JSON string or a JSON array; a single-element slice marshals as a JSON string and a multi-element slice as an array, conforming to RFC 7519 §4.1.3.

<Badge type="info" text="type" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `MarshalJSON` | `func (s StringOrSlice) MarshalJSON() ([]byte, error)` | Single-element slice marshals as a JSON string, multi-element as an array (RFC 7519 §4.1.3) |
| `UnmarshalJSON` | `func (s *StringOrSlice) UnmarshalJSON(b []byte) error` | Parse from a JSON string or array |

---

## SigningMethod

```go
type SigningMethod string
```

Signing algorithm type.

<Badge type="info" text="type" />

---

## ValidationError

```go
type ValidationError struct {
    Field   string
    Message string
    Err     error
}
```

Field-level validation failure error.

<Badge type="info" text="struct" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Error` | `func (e *ValidationError) Error() string` | Error message |
| `Unwrap` | `func (e *ValidationError) Unwrap() error` | Unwrap inner error |

---

## RateLimiter

```go
type RateLimiter struct { ... }
```

Token bucket rate limiter, implements [`RateLimitProvider`](./interfaces#ratelimitprovider).

<Badge type="info" text="struct" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Allow` | `func (rl *RateLimiter) Allow(key string) bool` | Check single request |
| `AllowN` | `func (rl *RateLimiter) AllowN(key string, n int) bool` | Check n requests |
| `Reset` | `func (rl *RateLimiter) Reset(key string)` | Reset specified key |
| `Close` | `func (rl *RateLimiter) Close()` | Release resources |

---

## SystemClock

```go
type SystemClock struct{}
```

System clock, default implementation of [`ClockProvider`](./interfaces#clockprovider).

<Badge type="info" text="struct" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Now` | `func (SystemClock) Now() time.Time` | Returns current system time |

---

## FixedClock

```go
type FixedClock struct {
    T time.Time
}
```

Fixed time clock for testing.

<Badge type="info" text="struct" />

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `T` | `time.Time` | Fixed time value |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Now` | `func (c FixedClock) Now() time.Time` | Returns fixed time |

---

## Signing Algorithm Constants

```go
const (
    SigningMethodHS256 SigningMethod = "HS256"
    SigningMethodHS384 SigningMethod = "HS384"
    SigningMethodHS512 SigningMethod = "HS512"

    SigningMethodRS256 SigningMethod = "RS256"
    SigningMethodRS384 SigningMethod = "RS384"
    SigningMethodRS512 SigningMethod = "RS512"

    SigningMethodPS256 SigningMethod = "PS256"
    SigningMethodPS384 SigningMethod = "PS384"
    SigningMethodPS512 SigningMethod = "PS512"

    SigningMethodES256 SigningMethod = "ES256"
    SigningMethodES384 SigningMethod = "ES384"
    SigningMethodES512 SigningMethod = "ES512"
)
```

| Constant | Value | Algorithm | Type |
|----------|-------|-----------|------|
| `SigningMethodHS256` | `"HS256"` | HMAC-SHA256 | Symmetric |
| `SigningMethodHS384` | `"HS384"` | HMAC-SHA384 | Symmetric |
| `SigningMethodHS512` | `"HS512"` | HMAC-SHA512 | Symmetric |
| `SigningMethodRS256` | `"RS256"` | RSA-SHA256 | Asymmetric |
| `SigningMethodRS384` | `"RS384"` | RSA-SHA384 | Asymmetric |
| `SigningMethodRS512` | `"RS512"` | RSA-SHA512 | Asymmetric |
| `SigningMethodPS256` | `"PS256"` | RSA-PSS-SHA256 | Asymmetric |
| `SigningMethodPS384` | `"PS384"` | RSA-PSS-SHA384 | Asymmetric |
| `SigningMethodPS512` | `"PS512"` | RSA-PSS-SHA512 | Asymmetric |
| `SigningMethodES256` | `"ES256"` | ECDSA-SHA256 | Asymmetric |
| `SigningMethodES384` | `"ES384"` | ECDSA-SHA384 | Asymmetric |
| `SigningMethodES512` | `"ES512"` | ECDSA-SHA512 | Asymmetric |

---

## Token Type Constants

```go
const (
    TokenTypeAccess  = "access"
    TokenTypeRefresh = "refresh"
)
```

Token type constants written to the [`RegisteredClaims.TokenType`](./claims#registeredclaims) field.

- Access tokens are created by [`Processor.Create`](./processor#create)
- Refresh tokens are created by [`Processor.CreateRefresh`](./processor#createrefresh)
- [`Processor.Refresh`](./processor#refresh) and [`Processor.RefreshInto`](./processor#refreshinto) reject tokens with `TokenTypeAccess`

| Constant | Value | Description |
|----------|-------|-------------|
| `TokenTypeAccess` | `"access"` | Access token |
| `TokenTypeRefresh` | `"refresh"` | Refresh token |
