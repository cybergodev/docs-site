---
sidebar_label: "FAQ"
title: "FAQ - CyberGo JWT | Common Questions Quick Reference"
description: "CyberGo JWT FAQ: HMAC, RSA, and ECDSA selection, key requirements, clock skew, expiry enforcement, refresh rotation, blacklist TTL and error matching."
sidebar_position: 1
---

# FAQ

## How do I choose among HMAC, RSA, and ECDSA?

**Answer:** Choose by architecture and performance needs. For monolithic apps or microservices inside one trust domain, use HMAC: a symmetric key, the fastest option, with a key of at least 32 bytes. For cross-service verification, where the verifying side does not hold the private key, use RSA, RSA-PSS, or ECDSA.

RSA-PSS is more secure than RSA PKCS#1 v1.5 and **shares the same keys** as RSA, so new projects should prefer it. Choose ECDSA when signature or key length matters (signatures are about 64 bytes). For the comparison table and decision diagram, see [Signing Algorithms](../guides/signing-algorithms#how-to-choose).

## What are the requirements for an HMAC key?

**Answer:** Two checks run at `jwt.New` initialization, and a failure returns `ErrInvalidSecretKey`.

The first is length ≥ 32 bytes. The second is entropy: all-identical characters, repeated short patterns, sequential runs, and common weak passwords with their variants are all rejected. Generate keys from a cryptographically secure random source in production:

```go
raw := make([]byte, 32)
_, _ = rand.Read(raw) // crypto/rand
secret := base64.StdEncoding.EncodeToString(raw)
```

See [Key Requirements](../guides/signing-algorithms#key-requirements).

## Why does ES512 report a curve error at initialization?

**Answer:** The curve for `ES512` is **P-521**, not P-512. The Go standard library has no `P512`; the highest curve available is `elliptic.P521()`. A curve that does not match the algorithm returns `ErrInvalidSecretKey`. The mapping is ES256 → P-256, ES384 → P-384, ES512 → P-521. See [Curve Matching](../guides/signing-algorithms#curve-matching).

## What about clock skew between servers?

**Answer:** Set `ClockSkew` (30s–60s recommended) to give `exp` and `nbf` validation a symmetric tolerance window. A token is treated as expired only after `exp + ClockSkew`, and as effective from `nbf - ClockSkew`. The skew only widens the window, never tightens it.

A zero value equals the strict RFC 7519 semantics, and negative values are rejected with `ErrInvalidConfig`. When `ErrTokenNotValidYet` appears, check this setting first. See [Clock Skew](../guides/configuration#clock-skew).

## How do I reject tokens without an exp claim?

**Answer:** By default, a token without `exp` never expires, which RFC 7519 permits. Setting `RequireExpiration = true` rejects tokens missing `exp` during validation, returning `ErrExpirationRequired`.

Tokens issued by this library always carry `exp`, derived from the TTL when the value is zero. The switch therefore mainly affects tokens from external issuers or legacy tokens, and enabling it in production is recommended. The library also fills zero values only: an `exp` set explicitly by the caller is used as-is. See [Mandatory Expiration](../guides/configuration#mandatory-expiration-requireexpiration).

## Is the original refresh token still valid after Refresh?

**Answer:** Yes by default. `Refresh` does not revoke the original refresh token, which stays usable until it expires or is explicitly `Revoke`d. For one-time-use semantics, enable `Config.RotateRefreshTokens` (v1.2.3+). See [Token Refresh & Rotation](../guides/token-refresh#rotation-strategies).

## How do I choose between reuse mode and one-time rotation?

**Answer:** Choose by security requirements. Reuse mode needs no extra code and offers a better experience, since users rarely re-authenticate, but a leaked refresh token can be reused. One-time rotation is a single switch, `RotateRefreshTokens`: every refresh invalidates the old token immediately, and leak detection is more direct.

When an attacker uses a revoked token, `Refresh` returns `ErrTokenRevoked`, which the application can use to force re-authentication. Rotation narrows but does not eliminate the concurrent replay window; strict single use requires a custom `BlacklistStore` implementing atomic check-and-add. For the comparison table, see [Strategy Comparison](../guides/token-refresh#strategy-comparison).

## Why is refreshing with an access token rejected?

**Answer:** `Refresh` and `RefreshInto` reject access-type tokens with `ErrTokenTypeMismatch`, preventing an access token from obtaining a new one.

Conversely, a refresh token used as an access token does **not** error by default, for backward compatibility with older tokens. To reject those too, enable `Config.RejectRefreshAsAccess` (v1.2.3+); `Parse` and `ParseInto` then also return `ErrTokenTypeMismatch` for refresh-type tokens. See [Type Safety](../guides/token-refresh#type-safety).

## How do I choose between the built-in blacklist and external storage like Redis?

**Answer:** For single-instance deployment, use the built-in memory store: enabled by default, zero configuration, `MaxSize` 100000, automatic cleanup. Multi-instance deployments **must** switch to shared storage by implementing the `BlacklistStore` interface (`Add`/`Contains`/`Close`) and injecting it into `cfg.Blacklist.Store`.

With Redis, for example, use `time.Until(expiresAt)` as the TTL so entries disappear when the token expires. Note that `CleanupInterval` and `MaxSize` only apply to the built-in store, while `EnableAutoCleanup` only applies to a custom store. Cleanup and capacity become the backend's responsibility. See [Custom Storage Backend](../guides/blacklist#custom-storage-backend).

## Why must Revoke take the full token string?

**Answer:** `Revoke` does not write the input string directly. It first runs a security validation chain: verify the signature, check `iss`/`aud`, extract `jti`, then compute the TTL from `exp` and write to the store.

If the caller-supplied `jti` were trusted, a malicious caller could forge a `jti` and blacklist **any legitimate user's token**, a denial-of-service attack. Mandatory signature verification guarantees that only the holder of the real token can revoke it.

Neither `Revoke` nor `IsRevoked` checks `exp`/`nbf`, so expired tokens can still be revoked after the fact, for example during an audit. See [How It Works](../guides/blacklist#how-it-works).

## Do blacklist entries accumulate indefinitely?

**Answer:** No. An entry's lifetime follows the token's remaining validity, with a 7-day floor and a 30-day cap. The floor keeps the revocation record of a short-lived token from disappearing too early; the cap keeps an extremely long `exp` from occupying storage for years. Capacity is therefore peak revocations × entry lifetime: the 7-day floor for ordinary access tokens, and the remaining lifetime (up to 30 days) for long-TTL refresh tokens.

When the built-in store is full, it cleans expired entries first, then evicts about 10% of the earliest-expiring entries, then writes directly. `Add` never fails because of capacity. The cost is that revoked records dropped by eviction silently lose effect (fail-open), and those tokens become usable again. See [Blacklist Entry TTL](../guides/blacklist#blacklist-entry-ttl).

## Why do the blacklist and rate limiting not work in a multi-instance deployment?

**Answer:** The built-in blacklist and the built-in `RateLimiter` are both **in-process**. Each instance keeps its own store and counters, so a token revoked on one instance still passes on another. Both problems are solved by injecting a shared backend.

For the blacklist, implement `BlacklistStore` against Redis or a database. For rate limiting, implement `RateLimitProvider` (`Allow`/`Reset`/`Close`) against distributed Redis counting. See [Production Recommendations](../guides/blacklist#production-recommendations) and [Custom Rate Limiter](../guides/rate-limiting#custom-rate-limiter).

## How do I match the 20 sentinel errors with errors.Is?

**Answer:** Every error supports `errors.Is()`, which sees through wrapping. Do not use `err ==` or string matching:

```go
claims, err := processor.Parse(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Guide the client to refresh its token
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Revoked — deny access
    default:
        // Other errors
    }
}
```

Memorize them by phase: configuration (3, returned by `New()`), token operations (13), rate limiting and blacklist (2), lifecycle (2). For the complete list and HTTP status mapping, see [Error Categories](../guides/error-handling#error-categories).

## How can I tell which Claims field failed validation?

**Answer:** Field-level validation failures (length limits, injection detection) occur only on the **creation** path and return `*ValidationError`. Extract `Field` and `Message` with `errors.As`:

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("field: %s, reason: %s\n", ve.Field, ve.Message)
        // field: UserID, reason: suspicious pattern detected
    }
}
```

First locate the category with `errors.Is(err, jwt.ErrInvalidClaims)`, since the `Create` path wraps it, then extract details with `errors.As`. The verification path only calls `Validate()` and does not repeat deep validation. See [Error Wrapping Chain](../guides/error-handling#error-wrapping-chain).

## More Resources

- [Quick Start](../getting-started/) — issue, verify, refresh, and revoke in 5 minutes
- [Core Concepts](../getting-started/concepts) — the two-tier token model and Claims structure
- [Configuration](../guides/configuration) — clock skew, mandatory expiration, and the validation matrix
- [Errors Reference](../api-reference/errors) — the full sentinel error list
- [Advanced Examples](../examples/advanced) — key separation and the Redis blacklist
