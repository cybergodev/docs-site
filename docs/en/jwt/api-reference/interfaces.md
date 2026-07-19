---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo JWT | Interfaces"
description: "Interfaces: TokenManager core operations, CustomClaims, BlacklistStore backend, RateLimitProvider limiter, ClockProvider, and optional RateLimitKeyer key."
sidebar_position: 50
---

# Interfaces

## TokenManager

```go
type TokenManager interface {
    Create(claims CustomClaims) (string, error)
    Validate(tokenString string) (Claims, bool, error)
    CreateRefresh(claims CustomClaims) (string, error)
    Refresh(refreshTokenString string) (string, error)
    ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
    RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
    Revoke(tokenString string) error
    IsRevoked(tokenString string) (bool, error)
    ParseUnverified(tokenString string, claims any) error
    Close() error
    IsClosed() bool
}
```

Core JWT token operations interface. All implementations must be concurrency-safe. The default implementation is [`*Processor`](./processor).

Methods are grouped by responsibility:
- **Token Creation**: `Create`, `CreateRefresh`
- **Validation & Refresh**: `Validate`, `ValidateInto`, `Refresh`, `RefreshInto`
- **General Operations**: `Revoke`, `IsRevoked`, `ParseUnverified`, `Close`, `IsClosed`

<Badge type="info" text="interface" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Create` | `Create(claims CustomClaims) (string, error)` | Create access token |
| `Validate` | `Validate(tokenString string) (Claims, bool, error)` | Validate token |
| `CreateRefresh` | `CreateRefresh(claims CustomClaims) (string, error)` | Create refresh token |
| `Refresh` | `Refresh(refreshTokenString string) (string, error)` | Refresh token |
| `ValidateInto` | `ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)` | Validate into custom Claims |
| `RefreshInto` | `RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)` | Refresh into custom Claims |
| `Revoke` | `Revoke(tokenString string) error` | Revoke token |
| `IsRevoked` | `IsRevoked(tokenString string) (bool, error)` | Check if revoked |
| `ParseUnverified` | `ParseUnverified(tokenString string, claims any) error` | Parse without verification |
| `Close` | `Close() error` | Release resources |
| `IsClosed` | `IsClosed() bool` | Whether closed |

### Implementations

| Type | Description |
|------|-------------|
| `*Processor` | Default implementation |

---

## CustomClaims

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

Custom Claims interface. Used with [`Create`](./processor#create), [`ValidateInto`](./processor#validateinto), [`RefreshInto`](./processor#refreshinto) and other methods.

<Badge type="info" text="interface" />

### Validation Contract

The Processor applies different validation paths for `*Claims` versus other types:

| Type | Validation Behavior |
|------|---------------------|
| `*Claims` | Deep validation: all fields (length limits, injection patterns, control characters) |
| Other types | Calls `Validate()` + registered claims string sanitization (Issuer, Subject, ID, TokenType, Audience) |

:::warning Note
For non-`*Claims` types, custom struct fields are **not** deep-validated. Implementers must validate all business fields in the `Validate()` method.
:::

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetRegisteredClaims` | `GetRegisteredClaims() *RegisteredClaims` | Returns standard JWT fields |
| `Validate` | `Validate() error` | Custom validation logic |

### Implementations

| Type | Description |
|------|-------------|
| `*Claims` | Built-in Claims implementation |

---

## BlacklistStore

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

Blacklist storage backend interface.

<Badge type="info" text="interface" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Add` | `Add(tokenID string, expiresAt time.Time) error` | Add to blacklist |
| `Contains` | `Contains(tokenID string) (bool, error)` | Check if in blacklist |
| `Close` | `Close() error` | Release resources |

---

## RateLimitProvider

```go
type RateLimitProvider interface {
    Allow(key string) bool
    Reset(key string)
    Close()
}
```

Rate limiting interface. The Processor calls `Allow(key)` for a single check during token creation.

:::tip About AllowN
The interface itself only defines `Allow` for single-request checks. The batch method `AllowN(key string, n int) bool` is an extension method on the concrete type [`*RateLimiter`](./types#ratelimiter) and is not part of this interface.
:::

<Badge type="info" text="interface" />

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Allow` | `Allow(key string) bool` | Check if single request is allowed |
| `Reset` | `Reset(key string)` | Reset rate limit state for key |
| `Close` | `Close()` | Release resources |

### Implementations

| Type | Description |
|------|-------------|
| `*RateLimiter` | Built-in token bucket implementation |

---

## ClockProvider

```go
type ClockProvider interface {
    Now() time.Time
}
```

Clock interface for time injection (testing scenarios).

<Badge type="info" text="interface" />

### Implementations

| Type | Description |
|------|-------------|
| `SystemClock` | System clock |
| `FixedClock` | Fixed time clock |

---

## RateLimitKeyer

```go
type RateLimitKeyer interface {
    RateLimitKey() string
}
```

Optional interface. Custom Claims can implement this to provide a rate limit key. Key lookup priority: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

<Badge type="info" text="interface" />
