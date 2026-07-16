---
sidebar_label: "Overview"
title: "JWT Auth - CyberGo JWT | Token Sign & Verify"
description: "Production-grade Go JWT library with 12 HMAC, RSA, RSA-PSS, and ECDSA algorithms plus token validation, refresh, revocation, blacklist, and rate limiting."
---

# JWT - Production-Grade JWT Authentication Library

CyberGo JWT is a high-performance JWT authentication library for Go, providing a complete solution for token generation, validation, refresh, and revocation.

## Features

- **Multi-Algorithm Support** — HMAC (HS256/384/512), RSA (RS256/384/512), RSA-PSS (PS256/384/512), ECDSA (ES256/384/512)
- **Token Lifecycle** — Create, validate, refresh, and revoke in one place
- **Custom Claims** — Support arbitrary business fields via `CustomClaims` interface
- **Blacklist Management** — Built-in memory store, supports custom backends like Redis
- **Rate Limiting** — Token bucket algorithm to prevent brute-force attacks
- **Input Validation** — Field length limits, injection pattern detection, control character filtering
- **Clock Injection** — `ClockProvider` interface for testing scenarios
- **Concurrency Safe** — All exported methods can be called concurrently
- **Zero Sensitive Data Leakage** — `Close()` securely clears keys

## Installation

```bash
go get github.com/cybergodev/jwt
```

## Quick Start

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    // 1. Create config
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    // 2. Create Processor
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 3. Issue token
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 4. Validate token
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## Architecture Overview

```text
┌────────────────────────────────────────────────┐
│                  Processor                      │
│  (implements TokenManager interface)            │
├────────────────────────────────────────────────┤
│  Create / Validate / Refresh / Revoke          │
│  CreateRefresh / ValidateInto / RefreshInto    │
│  ParseUnverified / IsRevoked / IsClosed / Close│
├──────────────────┬─────────────────────────────┤
│  BlacklistManager│     RateLimiter              │
│  (optional)      │     (optional)               │
├──────────────────┴─────────────────────────────┤
│                Config                           │
│  SigningMethod / TTL / Blacklist / Limit       │
└────────────────────────────────────────────────┘
```

## Next Steps

- [Getting Started](./getting-started/) — Detailed installation and configuration guide
- [Signing Algorithms](./guides/signing-algorithms) — HMAC, RSA, ECDSA selection guide
- [Custom Claims](./guides/custom-claims) — Define business fields
- [API Reference](./api-reference/) — Complete API reference
- [Basic Examples](./examples/basic) — HMAC, token pair, validation examples
