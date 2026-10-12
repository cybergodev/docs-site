---
sidebar_label: "Quick Start"
title: "Getting Started - CyberGo JWT | Quick Start Guide"
description: "Install CyberGo JWT and create a Processor to issue, validate, refresh, and revoke access and refresh tokens, with a guide to advanced features."
sidebar_position: 1
---

# Getting Started

## Installation

```bash
go get github.com/cybergodev/jwt
```

Requires Go 1.25+.

## Basic Usage

### 1. Create Processor

```go
package main

import (
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!" // HMAC requires at least 32 bytes
	cfg.AccessTokenTTL = 15 * time.Minute
	cfg.RefreshTokenTTL = 7 * 24 * time.Hour

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close() // Securely clear keys
}
```

### 2. Issue Token

```go
claims := &jwt.Claims{
    UserID:   "user123",
    Username: "alice",
    Role:     "admin",
    Permissions: []string{"read", "write"},
}

// Access token (short-lived)
accessToken, err := processor.Create(claims)
if err != nil {
    panic(err)
}

// Refresh token (long-lived)
refreshToken, err := processor.CreateRefresh(claims)
if err != nil {
    panic(err)
}
```

### 3. Validate Token

```go
// This step uses fmt; make sure "fmt" is imported
parsed, err := processor.Parse(accessToken)
if err != nil {
    // Handle error: expired, invalid signature, etc.
    panic(err)
}
fmt.Println("UserID:", parsed.UserID)
fmt.Println("Role:", parsed.Role)
fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
```

### 4. Refresh Token

```go
// This step uses fmt; make sure "fmt" is imported
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. Revoke Token

```go
// This step uses fmt; make sure "fmt" is imported

// Add token to blacklist
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// Check if revoked
revoked, err := processor.IsRevoked(accessToken)
if err != nil {
    panic(err)
}
fmt.Println("Revoked:", revoked) // true
```

## More Features

The steps above cover the core token lifecycle. CyberGo JWT also provides the following features — click into each guide for detailed usage:

| Feature | Description | Guide |
|---------|-------------|-------|
| Signing Algorithms | HMAC, RSA, RSA-PSS, ECDSA — 12 algorithms across 4 families | [Signing Algorithms](../guides/signing-algorithms) |
| Custom Claims | Define business-specific fields via the `CustomClaims` interface | [Custom Claims](../guides/custom-claims) |
| Token Refresh & Rotation | Two-tier token TTL design, reuse vs. one-time rotation strategies | [Token Refresh & Rotation](../guides/token-refresh) |
| Token Blacklist | Revocation, built-in memory store, and Redis custom backends | [Token Blacklist](../guides/blacklist) |
| Rate Limiting | Token bucket algorithm to prevent abuse of issuance endpoints | [Rate Limiting](../guides/rate-limiting) |
| Configuration | Issuer/audience validation, clock skew, mandatory expiration, input validation | [Configuration](../guides/configuration) |
| Error Handling | 20 sentinel error categories and `errors.Is` matching | [Error Handling](../guides/error-handling) |
| Testing & Clock Injection | `FixedClock` for deterministic, sleep-free time control in tests | [Testing & Clock Injection](../guides/testing) |

## Next Steps

- [Signing Algorithms](../guides/signing-algorithms) — Algorithm selection and key configuration
- [Token Refresh & Rotation](../guides/token-refresh) — Two-tier tokens and rotation strategies
- [Configuration](../guides/configuration) — Security config and input validation
- [API Reference](../api-reference/) — Complete API reference
- [Basic Examples](../examples/basic) — Runnable complete examples
- [Web Server Integration](../examples/web-server) — Auth middleware and RBAC in practice
