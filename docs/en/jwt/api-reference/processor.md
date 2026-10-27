---
sidebar_label: "Processor"
title: "Processor - CyberGo JWT | Core Type"
description: "Core CyberGo JWT Processor type: Create, Parse, ParseInto, Refresh, Revoke, IsRevoked, ParseUnverified, and Close, with signatures, errors, and examples."
sidebar_position: 20
---

# Processor

Processor is the core JWT operation type, implementing the [`TokenManager`](./interfaces#tokenmanager) interface. All methods are concurrency-safe.

Create an instance via [`jwt.New(cfg)`](./functions#new).

## Method Index

| Method | Description |
|--------|-------------|
| [`Processor.Create`](#create) | Create an access token |
| [`Processor.CreateRefresh`](#createrefresh) | Create a refresh token |
| [`Processor.Parse`](#parse) | Verify and parse an access token (v1.2.3+) |
| [`Processor.ParseInto`](#parseinto) | Verify and populate custom Claims in place (v1.2.3+) |
| [`Processor.Refresh`](#refresh) | Exchange a refresh token for a new access token |
| [`Processor.RefreshInto`](#refreshinto) | Refresh with custom Claims |
| [`Processor.Revoke`](#revoke) | Revoke a token (blacklist it) |
| [`Processor.IsRevoked`](#isrevoked) | Check whether a token has been revoked |
| [`Processor.ParseUnverified`](#parseunverified) | Parse without signature verification (debug/logging only) |
| [`Processor.Close`](#close) | Release resources and clear key material |
| [`Processor.IsClosed`](#isclosed) | Check whether the processor is closed |

The deprecated `Validate` / `ValidateInto` methods remain available; migrate to `Parse` / `ParseInto` respectively (see [Migrating from Validate to Parse](#migrating-from-validate-to-parse)).

::: info Nil Receiver Behavior
Every `*Processor` method returns `ErrProcessorClosed` on a nil receiver, and `IsClosed` returns `true`. A nil pointer never panics, but callers cannot distinguish "never initialized" from "already closed".
:::

## Common Errors

`Parse`, `ParseInto`, `Refresh`, and `RefreshInto` share one parsing and validation pipeline. The table below lists every error of that pipeline; each method section adds only its own specific errors and otherwise refers to this table.

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed or nil |
| `ErrEmptyToken` | Token is empty |
| `ErrInvalidToken` | Invalid signature or malformed token |
| `ErrAlgorithmMismatch` | Token algorithm does not match configuration |
| `ErrExpirationRequired` | `RequireExpiration` is enabled but the token lacks an `exp` claim |
| `ErrTokenExpired` | Token expired |
| `ErrTokenNotValidYet` | Token not yet valid |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenRevoked` | Token revoked |
| `ErrInvalidClaims` | Claims validation failed |
| `ErrTokenTypeMismatch` | Token type does not fit the call site (see each method) |
| `ErrStoreClosed` | Blacklist store is closed (returned while querying the blacklist) |

The common errors of `Create` and `CreateRefresh` are only `ErrProcessorClosed`, `ErrInvalidClaims`, and `ErrRateLimitExceeded`.

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

The error set is `ErrProcessorClosed`, `ErrInvalidClaims`, and `ErrRateLimitExceeded`.

### Example

```go
// Built-in Claims
claims := &jwt.Claims{UserID: "user123", Username: "alice"}
token, err := processor.Create(claims)

// Custom Claims
myClaims := &MyClaims{UserID: "123"}
token, err = processor.Create(myClaims)
```

---

## Parse <Badge type="tip" text="v1.2.3+" />

```go
func (p *Processor) Parse(tokenString string) (Claims, error)
```

Verifies a JWT access token and returns the parsed Claims (a value copy). **A nil `err` means the token is valid** — there is no separate boolean to check. Replaces the deprecated [`Validate`](#validate).

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `Claims` | Parsed claims (value copy) |
| `err` | `error` | Error on validation failure; nil means valid |

### Errors

The error set is the same as [Common Errors](#common-errors).

### Example

```go
claims, err := processor.Parse(tokenString)
if err != nil {
    // Handle error
    return
}
fmt.Println(claims.UserID)
```

---

## Validate

```go
func (p *Processor) Validate(tokenString string) (Claims, bool, error)
```

::: warning Deprecated
`Validate` is deprecated since v1.2.3; use [`Parse`](#parse) instead. The boolean result `valid` is always equivalent to `err == nil` and carries no extra information.
:::

Validates a JWT access token and returns the parsed Claims. Internally delegates directly to [`Parse`](#parse).

The only difference from [`Parse`](#parse) is the return values: one extra `bool`, always equal to `err == nil`. Parameters and the error set are identical.

### Migrating from Validate to Parse

Drop the boolean check and test `err` directly.

```go
// Old style (deprecated)
parsed, valid, err := processor.Validate(token)
if valid {
    // ...
}

// New style: nil err means valid
parsed, err := processor.Parse(token)
if err != nil {
    // Handle error
}
```

### Parameters

Same as [`Parse`](#parse): `tokenString string`.

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `Claims` | Parsed claims (value copy) |
| `valid` | `bool` | Whether valid (always equal to `err == nil`) |
| `err` | `error` | Error on validation failure |

### Errors

The error set is the same as [Common Errors](#common-errors).

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

Creates a refresh token using `RefreshTokenTTL` instead of `AccessTokenTTL`. Claims validation follows the same rules as [`Create`](#create).

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

The error set matches [`Create`](#create): `ErrProcessorClosed`, `ErrInvalidClaims`, `ErrRateLimitExceeded`.

---

## Refresh

```go
func (p *Processor) Refresh(refreshTokenString string) (string, error)
```

Exchanges a refresh token for a new access token. The refresh token is fully validated first (signature, expiration, blacklist); once it passes, a new access token is issued. The original token's `IssuedAt`, `ExpiresAt`, and `ID` are reset and regenerated.

:::warning Two Constraints for Custom Claims
- `Refresh` rebuilds the token from the built-in `Claims` type. When the supplied refresh token carries a custom type, every custom field is discarded and the new token keeps only the registered claims. To preserve business fields, use [`RefreshInto`](#refreshinto).
- Validation against the built-in `Claims` requires the refresh token to carry `UserID` or `Username`. A refresh token with only `Subject` returns `invalid claims: user_id or username is required`.
:::

:::info Token Type & Rotation
- **Token type check**: tokens with `token_type=access` are rejected with [`ErrTokenTypeMismatch`](./errors#sentinel-errors). Older tokens without `token_type` are still accepted for backward compatibility.
- **The original token is not revoked by default**: `Refresh` does not revoke the supplied refresh token. It stays valid until it expires or is explicitly [`Revoke()`](#revoke)d. For one-time-use semantics, enable `Config.RotateRefreshTokens`. See [Token Refresh & Rotation](../guides/token-refresh#one-time-rotation) for the authoritative description.
:::

:::warning Security Note
Refresh validates only the standard JWT fields (exp, nbf, iss, aud, blacklist) and basic structural validity. Deep field constraints (length limits, injection patterns) are not re-checked because they were validated at creation time.
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

Beyond [Common Errors](#common-errors), `Refresh` has these specific errors:

| Error | Trigger Condition |
|-------|-------------------|
| `ErrTokenTypeMismatch` | Refreshing with an access token (`token_type=access`) |
| `ErrTokenMissingID` | `RotateRefreshTokens` is enabled but the refresh token lacks a `jti` claim |
| `ErrBlacklistNotConfigured` | `RotateRefreshTokens` is enabled but the blacklist is not configured |
| `ErrRefreshRotationFailed` | The underlying blacklist store returned an error while `RotateRefreshTokens` is enabled |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## ParseInto <Badge type="tip" text="v1.2.3+" />

```go
func (p *Processor) ParseInto(tokenString string, claims CustomClaims) (CustomClaims, error)
```

Verifies a token and populates the provided custom Claims struct **in place**; on success it returns the same pointer that was passed in. **A nil `err` means the token is valid.** Unlike [`Parse`](#parse), which returns a value copy, this fills the caller-supplied struct directly.

::: warning Claims state on error
On validation failure the supplied claims may be **partially populated** and must not be used.
:::

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenString` | `string` | JWT string |
| `claims` | `CustomClaims` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `CustomClaims` | Populated Claims (same pointer as the input) |
| `err` | `error` | Error on validation failure; nil means valid |

### Errors

The error set is the same as [Common Errors](#common-errors).

### Example

```go
myClaims := &MyClaims{}
result, err := processor.ParseInto(tokenString, myClaims)
if err != nil {
    // Handle error
    return
}
fmt.Println(result.(*MyClaims).UserID)
```

---

## ValidateInto

```go
func (p *Processor) ValidateInto(tokenString string, claims CustomClaims) (CustomClaims, bool, error)
```

::: warning Deprecated
`ValidateInto` is deprecated since v1.2.3; use [`ParseInto`](#parseinto) instead. The boolean result is as redundant as in [`Validate`](#validate), and the migration is the same.
:::

Validates a token and populates a custom Claims struct. Internally delegates directly to [`ParseInto`](#parseinto).

The only difference from [`ParseInto`](#parseinto) is the return values: one extra `bool`, always equal to `err == nil`. Parameters and the error set are identical.

### Parameters

Same as [`ParseInto`](#parseinto): `tokenString string` and `claims CustomClaims`.

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `claims` | `CustomClaims` | Populated Claims |
| `valid` | `bool` | Whether valid (always equal to `err == nil`) |
| `err` | `error` | Error on validation failure |

### Migrating from ValidateInto to ParseInto

```go
// Old style (deprecated)
result, valid, err := processor.ValidateInto(tokenString, myClaims)
if valid {
    fmt.Println(result.(*MyClaims).UserID)
}

// New style: nil err means valid
result, err := processor.ParseInto(tokenString, myClaims)
if err != nil {
    // Handle error
    return
}
fmt.Println(result.(*MyClaims).UserID)
```

### Errors

The error set is the same as [Common Errors](#common-errors).

---

## RefreshInto

```go
func (p *Processor) RefreshInto(refreshTokenString string, claims CustomClaims) (string, error)
```

Refreshes a token using custom Claims. The Claims object's timing fields (`IssuedAt`, `ExpiresAt`, `ID`) are restored after the operation, even on error or panic. Custom fields are preserved in the new token.

Custom Claims types must use this method rather than [`Refresh`](#refresh), which rebuilds the token from the built-in `Claims` and drops custom fields.

:::info Token Type Check
Tokens with `token_type=access` are rejected (returns [`ErrTokenTypeMismatch`](./errors#sentinel-errors)) to prevent access tokens from being exchanged for new tokens; older tokens without a `token_type` are still accepted for backward compatibility.
:::

:::warning Security Note
Refresh validates only the standard JWT fields (exp, nbf, iss, aud, blacklist) and basic structural validity. Deep field constraints (length limits, injection patterns) are not re-checked because they were validated at creation time.
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

Beyond [Common Errors](#common-errors), `RefreshInto` has these specific errors:

| Error | Trigger Condition |
|-------|-------------------|
| `ErrTokenTypeMismatch` | Refreshing with an access token (`token_type=access`) |
| `ErrTokenMissingID` | `RotateRefreshTokens` is enabled but the refresh token lacks a `jti` claim |
| `ErrBlacklistNotConfigured` | `RotateRefreshTokens` is enabled but the blacklist is not configured |
| `ErrRefreshRotationFailed` | The underlying blacklist store returned an error while `RotateRefreshTokens` is enabled |
| `ErrRateLimitExceeded` | Rate limit threshold exceeded |

---

## Revoke

```go
func (p *Processor) Revoke(tokenString string) error
```

Adds the token to the blacklist by verifying the signature and extracting the token ID (jti). Only tokens with a valid signature can be revoked, preventing malicious callers from adding arbitrary token IDs to the blacklist.

:::info Blacklist Entry TTL
An entry lives for the token's remaining lifetime, clamped to a 7-day floor and a 30-day cap. The floor keeps revocations of short-lived tokens from disappearing too early; the cap stops an oversized `exp` from occupying storage long-term.

Estimate capacity as peak revocation volume × entry lifetime: ordinary access tokens take the 7-day floor, while long-TTL refresh tokens take their remaining lifetime (up to the 30-day cap). Tokens without an `exp` or already expired are treated as the 7-day floor. Expired tokens can still be revoked; the entry is removed by blacklist cleanup.
:::

:::warning Built-in Store Saturation
When the built-in store is full, expired entries are removed first, roughly the earliest-expiring 10% is then evicted, and the new entry is written directly — `Add` never fails because the store is full.

The cost is fail-open: revocation records dropped by eviction silently stop taking effect, and those tokens become usable again. Raising `MaxSize` lowers the fail-open probability.
:::

### Parameters

| Parameter | Type | Description |
|--------|------|-------------|
| `tokenString` | `string` | Token to revoke |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on validation failure or when the blacklist store is closed |

### Errors

`Revoke` verifies only the signature, issuer, audience, and jti; it does not check `exp`/`nbf`, so it never returns expiration errors.

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| `ErrBlacklistNotConfigured` | Blacklist not configured |
| `ErrInvalidToken` | Invalid signature or malformed token |
| `ErrTokenInvalidIssuer` | Issuer mismatch |
| `ErrTokenInvalidAudience` | Audience mismatch |
| `ErrTokenMissingID` | Token missing `jti` field |
| `ErrStoreClosed` | Blacklist store is closed |

---

## IsRevoked

```go
func (p *Processor) IsRevoked(tokenString string) (bool, error)
```

Checks whether a token has been revoked. After verifying the signature it looks up the token's jti in the blacklist. When the blacklist is not configured it returns `false` and `nil`.

As with `Revoke`, this method does not check `exp`/`nbf`.

### Parameters

| Parameter | Type | Description |
|--------|------|-------------|
| `tokenString` | `string` | JWT string |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `revoked` | `bool` | Whether revoked |
| `err` | `error` | Error on query failure |

### Errors

The error set matches [`Revoke`](#revoke), except that an unconfigured blacklist returns `false` and `nil` instead of `ErrBlacklistNotConfigured`.

---

## ParseUnverified

```go
func (p *Processor) ParseUnverified(tokenString string, claims any) error
```

Parses a token without verifying the signature. Useful for extracting Claims information in scenarios that do not require trust.

:::warning
The returned Claims are not verified and **must not be trusted**. Use only for debugging or logging.
:::

### Parameters

| Parameter | Type | Description |
|--------|------|-------------|
| `tokenString` | `string` | JWT string |
| `claims` | `any` | Target Claims pointer |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `err` | `error` | Error on parse failure |

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrProcessorClosed` | Processor is closed |
| `ErrEmptyToken` | Token is empty |
| Wrapped error | Returns a wrapped parse error on malformed tokens (not a sentinel error; cannot be matched with `errors.Is`) |

---

## Close

```go
func (p *Processor) Close() error
```

Releases resources and clears key material, and closes the internal rate limiter and blacklist store. Can be called multiple times; the second and later calls return `ErrProcessorClosed`.

What gets cleared depends on the algorithm:

- **HMAC**: the copied key bytes are zeroed and the process-wide HMAC hasher pool is drained. The pool is package-global, so this also invalidates cached hashers of other live processors — they rebuild transparently on next use, with no correctness impact and only a one-time performance cost.
- **Asymmetric**: only the references to `SigningKey` / `VerificationKey` are dropped; the caller-owned `*rsa.PrivateKey` / `*ecdsa.PrivateKey` is not overwritten. Destroying that key object remains the caller's responsibility.

Close waits for in-flight operations to finish by acquiring the write lock.

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
