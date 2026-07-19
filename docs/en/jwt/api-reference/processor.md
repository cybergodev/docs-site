---
sidebar_label: "Processor"
title: "Processor - CyberGo JWT | Core Type"
description: "The core CyberGo JWT Processor type exposes Create, Validate, Refresh, Revoke, IsRevoked, ParseUnverified, and Close methods with their signatures and examples."
sidebar_position: 20
---

# Processor

Processor is the core JWT operation type, implementing the [`TokenManager`](./interfaces#tokenmanager) interface. All methods are concurrency-safe.

Create an instance via [`jwt.New(cfg)`](./functions#new).

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

Creates a new JWT access token. Accepts any type implementing the `CustomClaims` interface.



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `claims` | `CustomClaims` | Token claims |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `token` | `string` | Signed JWT string |
| `err` | `error` | Error on validation or signing failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

### Example

```go
// Built-in Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// Custom Claims
myClaims := &MyClaims{UserID: "123"}
token, err := processor.Create(myClaims)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

Validates a JWT access token and returns the parsed Claims.



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `Claims` | Parsed claims (value copy) |
| `valid` | `bool` | Whether valid |
| `err` | `error` | Error on validation failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature |
| `ErrAlgorithmMismatch` | Token algorithm does not match config |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |

### Example

```go
claims, valid, err := processor.Validate(tokenString)
if err != nil {
    // Handle error
    return
}
if valid {
    fmt.Println(claims.UserID)
}
```

---

## CreateRefresh

```go
func (p *Processor) CreateRefresh(claims CustomClaims) (string, error)
```

Creates a refresh token using `RefreshTokenTTL` instead of `AccessTokenTTL`.



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `claims` | `CustomClaims` | Token claims |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `token` | `string` | Signed refresh token |
| `err` | `error` | Error on validation or signing failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

Refreshes an existing refresh token and returns a new access token. The refresh token is fully validated (signature, expiration, blacklist) before a new access token is issued; the original token's `IssuedAt`, `ExpiresAt`, and `ID` are reset and regenerated.

:::info Token Type & Rotation
- **Token type check**: Tokens with `token_type=access` are rejected (returns [`ErrTokenTypeMismatch`](./errors#sentinel-errors)) to prevent access tokens from being used to obtain new tokens; older tokens without a `token_type` are still accepted for backward compatibility.
- **Does not auto-revoke the original token**: `Refresh` does not revoke the supplied refresh token. The original token remains valid until it expires or is explicitly [`Revoke()`](#revoke)d. For one-time-use semantics, call `Revoke(refreshTokenString)` after a successful `Refresh`.
:::

:::warning Security Note
Refresh only validates standard JWT fields (exp, nbf, iss, aud, blacklist) and basic structural validity (UserID or Username must exist). Deep field constraints (length limits, injection patterns) are not re-checked since they were validated at creation time.
:::



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `refreshTokenString` | `string` | Refresh token |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `token` | `string` | New access token |
| `err` | `error` | Error on validation failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature |
| `ErrAlgorithmMismatch` | Token algorithm does not match config |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrTokenTypeMismatch` | Refreshing with an access token (`token_type=access`) |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

Validates a token and populates a custom Claims struct. Returns the same pointer as the input `claims`.



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |
| `claims` | `CustomClaims` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `CustomClaims` | Populated Claims |
| `valid` | `bool` | Whether valid |
| `err` | `error` | Error on validation failure |

### Example

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}
```

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature |
| `ErrAlgorithmMismatch` | Token algorithm does not match config |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

Refreshes a token using custom Claims. Timing fields (`IssuedAt`, `ExpiresAt`, `ID`) are automatically restored after the operation, even if an error or panic occurs.

:::info Token Type Check
Tokens with `token_type=access` are rejected (returns [`ErrTokenTypeMismatch`](./errors#sentinel-errors)) to prevent access tokens from being used to obtain new tokens; older tokens without a `token_type` are still accepted for backward compatibility.
:::

:::warning Security Note
Refresh only validates standard JWT fields and basic structural validity. Deep field constraints are not re-checked since they were validated at creation time.
:::



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `refreshTokenString` | `string` | Refresh token |
| `claims` | `CustomClaims` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `token` | `string` | New access token |
| `err` | `error` | Error on validation failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature |
| `ErrAlgorithmMismatch` | Token algorithm does not match config |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrTokenTypeMismatch` | Refreshing with an access token (`token_type=access`) |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

Adds the token to the blacklist by verifying the signature and extracting the token ID (jti). Only tokens with a valid signature can be revoked, preventing malicious callers from adding arbitrary token IDs to the blacklist.

:::info TTL Behavior
- The token's `exp` determines the TTL of the blacklist entry
- Tokens without an `exp` default to a 7-day TTL
- TTL is capped at 30 days to prevent forged excessive `exp` values from locking memory (DoS protection)
- Expired tokens can still be revoked; the entry is automatically cleaned up by the blacklist
:::



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | Token to revoke |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on revocation failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrBlacklistNotConfigured` | Blacklist not configured |
| `ErrInvalidToken` | Invalid signature or malformed token |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenMissingID` | Token missing `jti` field |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

Checks whether a token has been revoked. After verifying the signature, it looks up the token's jti status in the blacklist. When the blacklist is not configured, returns `false` and a `nil` error.



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `revoked` | `bool` | Whether revoked |
| `err` | `error` | Error on query failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature or malformed token |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenMissingID` | Token missing `jti` field |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

Parses a token without verifying the signature. Useful for extracting Claims information without needing to trust the token.

:::danger Warning
The returned Claims are **not verified** and must not be trusted. Only use for debugging or logging.
:::



### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |
| `claims` | `any` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on parse failure |

### Errors

| Error | Condition |
|-------|-----------|
| `ErrProcessorClosed` | Processor has been closed |
| `ErrEmptyToken` | Token is empty |
| Wrapped error | Returns a wrapped parse error on malformed tokens (not a sentinel error; cannot be matched with `errors.Is`) |

---

## Close

```go
func (p *Processor) Close() error
```

Releases resources and securely clears keys. Can be called multiple times; subsequent calls return `ErrProcessorClosed`.



### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on close failure |

---

## IsClosed

```go
func (p *Processor) IsClosed() bool
```

Checks if the Processor is closed.



### Returns

| Return | Type | Description |
|--------|------|-------------|
| `closed` | `bool` | Whether closed |
