---
title: "Processor - JWT API Reference"
description: "CyberGo JWT Processor core API reference covering Create, Validate, CreateRefresh, Refresh, ValidateInto, RefreshInto, Revoke, IsRevoked, ParseUnverified, Close, and IsClosed methods."
---

# Processor

Processor is the core JWT operation type, implementing the [`TokenManager`](./interfaces#tokenmanager) interface. All methods are concurrency-safe.

Create an instance via [`jwt.New(cfg)`](./functions#new).

## Create

```go
func (p *Processor) Create(claims CustomClaims) (string, error)
```

Creates a new JWT access token. Accepts any type implementing the `CustomClaims` interface.

<Badge type="tip" text="v1.0.0+" />

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

<Badge type="tip" text="v1.0.0+" />

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

<Badge type="tip" text="v1.0.0+" />

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

Refreshes an existing refresh token and returns a new access token.

:::warning Security Note
Refresh only validates standard JWT fields (exp, nbf, iss, aud, blacklist) and basic structural validity (UserID or Username must exist). Deep field constraints (length limits, injection patterns) are not re-checked since they were validated at creation time.
:::

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

Validates a token and populates a custom Claims struct. Returns the same pointer as the input `claims`.

<Badge type="tip" text="v1.0.0+" />

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

:::warning Security Note
Refresh only validates standard JWT fields and basic structural validity. Deep field constraints are not re-checked since they were validated at creation time.
:::

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

Adds a token to the blacklist.

<Badge type="tip" text="v1.0.0+" />

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

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

Checks if a token has been revoked.

<Badge type="tip" text="v1.0.0+" />

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
| `ErrTokenMissingID` | Token missing ID |

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

Parses a token without verifying the signature. Useful for extracting Claims information without needing to trust the token.

:::danger Warning
The returned Claims are **not verified** and must not be trusted. Only use for debugging or logging.
:::

<Badge type="tip" text="v1.0.0+" />

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |
| `claims` | `any` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on parse failure |

---

## Close

```go
func (p *Processor) Close() error
```

Releases resources and securely clears keys. Can be called multiple times; subsequent calls return `ErrProcessorClosed`.

<Badge type="tip" text="v1.0.0+" />

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

<Badge type="tip" text="v1.0.0+" />

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `closed` | `bool` | Whether closed |
