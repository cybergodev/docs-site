---
title: "Basic Examples - JWT"
description: "CyberGo JWT basic examples covering HMAC symmetric signing, access and refresh token pair creation, token revocation with blacklist, and rate limiting protection."
---

# Basic Examples

## HMAC Signing

The most common approach using symmetric key for signing and verification.

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Issue
    claims := &jwt.Claims{
        UserID:      "user123",
        Username:    "alice",
        Role:        "admin",
        Permissions: []string{"read", "write", "delete"},
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Access Token:", token)

    // Validate
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)          // Output: true
    fmt.Println("UserID:", parsed.UserID) // Output: user123
}
```

## Access Token & Refresh Token

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
    }

    // Create access token (short-lived)
    accessToken, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // Create refresh token (long-lived)
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }

    fmt.Println("Access Token:", accessToken)
    fmt.Println("Refresh Token:", refreshToken)

    // Use refresh token to get new access token
    newAccessToken, err := processor.Refresh(refreshToken)
    if err != nil {
        panic(err)
    }
    fmt.Println("New Access Token:", newAccessToken)
}
```

## Token Revocation (Blacklist)

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // Revoke token
    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked")

    // Validation will fail
    _, _, err = processor.Validate(token)
    fmt.Println("Validate error:", err) // token revoked

    // Check if revoked
    revoked, err := processor.IsRevoked(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Is revoked:", revoked) // Output: true
}
```

## Rate Limiting

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 5              // Max 5 per minute
    cfg.RateLimitWindow = time.Minute

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}

    // Normal requests
    for i := 0; i < 5; i++ {
        _, err := processor.Create(claims)
        if err != nil {
            fmt.Printf("Request %d: %v\n", i+1, err)
        } else {
            fmt.Printf("Request %d: success\n", i+1)
        }
    }

    // 6th request is rate limited
    _, err = processor.Create(claims)
    fmt.Println("Request 6:", err) // rate limit exceeded
}
```

## More Examples

- [Advanced Examples](./advanced) — RSA, ECDSA, custom Claims, Redis blacklist, web service
