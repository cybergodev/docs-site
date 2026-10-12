---
sidebar_label: "FAQ"
title: "FAQ - CyberGo JWT | Common Questions Quick Reference"
description: "CyberGo JWT FAQ: HMAC/RSA/ECDSA choice, key requirements, clock skew, refresh rotation, blacklist storage, multi-instance sharing, and errors.Is matching."
sidebar_position: 1
---

# FAQ

## How do I choose among HMAC, RSA, and ECDSA?

**Answer:** Choose by architecture and performance needs: for monolithic apps or microservices within the same trust domain, use HMAC (symmetric key, fastest, key ≥ 32 bytes); for cross-service verification (verifiers do not hold the private key), use RSA / RSA-PSS / ECDSA (asymmetric). RSA-PSS is more secure than RSA PKCS#1 v1.5 and **shares the same keys** as RSA, so prefer it for new projects; choose ECDSA when signature or key length matters (~64-byte signatures). For the comparison table and decision diagram, see [Signing Algorithms](../guides/signing-algorithms#how-to-choose).

## What are the requirements for an HMAC key?

**Answer:** Two checks run at `jwt.New` initialization and return `ErrInvalidSecretKey` when failed: length ≥ 32 bytes; and it must not be a low-entropy key — all-identical characters, repeated short patterns, sequential runs, and common weak passwords (plus variants) are all rejected. Generate keys from a cryptographically secure random source in production:

```go
raw := make([]byte, 32)
_, _ = rand.Read(raw) // crypto/rand
secret := base64.StdEncoding.EncodeToString(raw)
```

See [Key Requirements](../guides/signing-algorithms#key-requirements).

## Why does ES512 report a curve error at initialization?

**Answer:** The curve for `ES512` is **P-521** (not P-512) — the Go standard library has no `P512`; the highest curve is `elliptic.P521()`. A curve that does not match the algorithm returns `ErrInvalidSecretKey`. The mapping: ES256 → P-256, ES384 → P-384, ES512 → P-521. See [Curve Matching](../guides/signing-algorithms#curve-matching).

## What about clock skew between servers?

**Answer:** Set `ClockSkew` (30s–60s recommended) to provide a symmetric tolerance window for `exp` and `nbf` validation: a token is considered expired only after `exp + ClockSkew`, and is considered effective from `nbf - ClockSkew`. The skew only widens, never tightens; zero is equivalent to the strict RFC 7519 semantics, and negative values are rejected (`ErrInvalidConfig`). When you see `ErrTokenNotValidYet`, check this first. See [Clock Skew](../guides/configuration#clock-skew).

## How do I reject tokens without an exp claim?

**Answer:** By default, tokens without `exp` never expire (legal under RFC 7519). Set `RequireExpiration = true` to reject tokens missing `exp` during validation (returning `ErrExpirationRequired`). Tokens issued by this library always carry `exp`, so this switch mainly affects external issuers or legacy tokens — enabling it in production is recommended. See [Mandatory Expiration](../guides/configuration#mandatory-expiration-requireexpiration).

## Is the original refresh token still valid after Refresh?

**Answer:** Yes by default — `Refresh` does not automatically revoke the original refresh token (reuse mode); it stays usable until it expires or is explicitly `Revoke`d, which suits mobile apps and single-device logins. For one-time-use semantics, enable `Config.RotateRefreshTokens` (v1.2.3+): the old token's jti is blacklisted **before** the new token is minted (fail-closed), so an accepted refresh token cannot be replayed afterwards. See [Rotation Strategies](../guides/token-refresh#rotation-strategies).

## How do I choose between reuse mode and one-time rotation?

**Answer:** By security requirements: reuse mode needs zero extra code and offers better UX (no frequent re-logins), but a leaked refresh token can be used repeatedly; one-time rotation is a single config switch (`RotateRefreshTokens`) — every refresh invalidates the old token immediately, and leak detection is more direct: when an attacker uses a revoked token, `Refresh` returns `ErrTokenRevoked`, which you can use to force re-authentication. Note that rotation narrows but does not eliminate the concurrent replay window; strict single use requires a custom `BlacklistStore` with atomic check-and-add. For the comparison table, see [Strategy Comparison](../guides/token-refresh#strategy-comparison).

## Why is refreshing with an access token rejected?

**Answer:** `Refresh` / `RefreshInto` reject access-type tokens (returning `ErrTokenTypeMismatch`), preventing access tokens from being used to obtain new tokens. Conversely, a refresh token used as an access token does **not** error by default (backward compatibility with older tokens) — to reject those too, enable `Config.RejectRefreshAsAccess` (v1.2.3+), after which `Parse` / `ParseInto` also return `ErrTokenTypeMismatch` for refresh-type tokens. See [Type Safety](../guides/token-refresh#type-safety).

## How do I choose between the built-in blacklist and external storage like Redis?

**Answer:** For single-instance deployment, use the built-in memory store (enabled by default, zero config; `MaxSize` 100000, automatic cleanup). Multi-instance deployments **must** switch to shared storage: implement the `BlacklistStore` interface (`Add`/`Contains`/`Close`) and inject it into `cfg.Blacklist.Store`, e.g. Redis (use `time.Until(expiresAt)` as the TTL so entries are removed automatically when the token expires). Note that after switching to a custom store, the `CleanupInterval`/`MaxSize`/`EnableAutoCleanup` fields are ignored — cleanup and capacity become the backend's responsibility. See [Custom Storage Backend](../guides/blacklist#custom-storage-backend).

## Why must Revoke take the full token string?

**Answer:** `Revoke` does not simply write the input string; it runs a security validation chain first: verify signature → check `iss`/`aud` → extract `jti` → compute the TTL from `exp` and write to the store. If the caller-supplied `jti` were trusted directly, a malicious caller could forge a `jti` to blacklist **any legitimate user's token** (a denial-of-service attack). Mandatory signature verification guarantees "only someone holding the real token can revoke it". Neither `Revoke` nor `IsRevoked` checks `exp`/`nbf` — expired tokens can still be revoked after the fact (for audits). See [How It Works](../guides/blacklist#how-it-works).

## Do blacklist entries accumulate indefinitely?

**Answer:** No. When `Revoke` writes an entry, its TTL is computed from the token's `exp`, so the entry expires with the token and is cleaned up; tokens without `exp` default to 7 days; and there is a **30-day cap** (even if `exp` is 100 years away) — a DoS protection preventing bulk revocations of ultra-long-`exp` tokens from bloating the store. When the entry count reaches `MaxSize`, expired entries are cleaned first, then about 10% of the earliest-expiring entries are evicted; only in extreme cases is the write rejected (revocation fails). See [Blacklist Entry TTL](../guides/blacklist#blacklist-entry-ttl).

## Why do the blacklist and rate limiting not work in a multi-instance deployment?

**Answer:** The built-in blacklist and the built-in `RateLimiter` are both **in-process**: each instance keeps its own store and counters, so a token revoked on one instance still passes on another. The fix for both is injecting a shared backend: for the blacklist, implement `BlacklistStore` against Redis/a database; for rate limiting, implement `RateLimitProvider` (`Allow`/`Reset`/`Close`) against distributed Redis counting. See [Production Recommendations](../guides/blacklist#production-recommendations) and [Custom Rate Limiter](../guides/rate-limiting#custom-rate-limiter).

## How do I match the 20 sentinel errors with errors.Is?

**Answer:** All errors support `errors.Is()` (which sees through wrapping); do not use `err ==` or string matching:

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

Memorize them by phase: configuration (3, returned by `New()`), token operations (13), rate limiting & blacklist (2), lifecycle (2). For the complete list and HTTP status code mapping, see [Error Categories](../guides/error-handling#error-categories).

## How can I tell which Claims field failed validation?

**Answer:** Field-level validation failures (length limits, injection detection, etc.) return `*ValidationError`; extract `Field` and `Message` with `errors.As`:

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("field: %s, reason: %s\n", ve.Field, ve.Message)
        // field: user_id, reason: suspicious pattern detected
    }
}
```

First locate the category with `errors.Is(err, jwt.ErrInvalidClaims)` (the `Create`/`Parse` paths wrap it), then extract the details with `errors.As`. See [Error Wrapping Chain](../guides/error-handling#error-wrapping-chain).

## More Resources

- [Quick Start](../getting-started/) — issue/verify/refresh/revoke in 5 minutes
- [Core Concepts](../getting-started/concepts) — the two-tier token model and Claims structure
- [Configuration](../guides/configuration) — clock skew, mandatory expiration, and the validation matrix
- [Errors Reference](../api-reference/errors) — the full sentinel error list
- [Advanced Examples](../examples/advanced) — key separation and the Redis blacklist
