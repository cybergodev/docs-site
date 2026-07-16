---
sidebar_label: "Quick Start"
title: "Getting Started - CyberGo JWT | Quick Start"
description: "Install CyberGo JWT and create a Processor to issue, validate, refresh, and revoke tokens with algorithm choice, custom Claims, and rate limiting."
sidebar_position: 2
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
parsed, valid, err := processor.Validate(accessToken)
if err != nil {
    // Handle error: expired, invalid signature, etc.
    panic(err)
}
if valid {
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Role:", parsed.Role)
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
}
```

### 4. Refresh Token

```go
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. Revoke Token

```go
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

## Signing Algorithms

### HMAC (Symmetric Key)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // Default
```

| Method | Algorithm |
|--------|-----------|
| `SigningMethodHS256` | HMAC-SHA256 |
| `SigningMethodHS384` | HMAC-SHA384 |
| `SigningMethodHS512` | HMAC-SHA512 |

### RSA (Asymmetric Key)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (optional, defaults to SigningKey)
```

| Method | Algorithm |
|--------|-----------|
| `SigningMethodRS256` | RSA-SHA256 |
| `SigningMethodRS384` | RSA-SHA384 |
| `SigningMethodRS512` | RSA-SHA512 |

### RSA-PSS (Asymmetric Key, Recommended)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (optional)
```

| Method | Algorithm |
|--------|-----------|
| `SigningMethodPS256` | RSA-PSS-SHA256 |
| `SigningMethodPS384` | RSA-PSS-SHA384 |
| `SigningMethodPS512` | RSA-PSS-SHA512 |

### ECDSA (Asymmetric Key)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey (optional)
```

| Method | Algorithm |
|--------|-----------|
| `SigningMethodES256` | ECDSA-SHA256 |
| `SigningMethodES384` | ECDSA-SHA384 |
| `SigningMethodES512` | ECDSA-SHA512 |

## Custom Claims

Implement the `CustomClaims` interface to define your own Claims structure:

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

Using custom Claims:

```go
claims := &MyClaims{UserID: "123", Role: "admin"}

// Create token
token, err := processor.Create(claims)

// Validate into custom structure
result := &MyClaims{}
parsed, valid, err := processor.ValidateInto(token, result)

// Refresh into custom structure
newToken, err := processor.RefreshInto(refreshToken, claims)
```

## Blacklist Configuration

### Using Built-in Memory Store (Default)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Built-in blacklist is automatically enabled
```

### Custom Storage Backend

Implement the `BlacklistStore` interface (e.g., Redis):

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", time.Until(expiresAt)).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}

// Usage
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

## Rate Limiting Configuration

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100          // Max requests per window
cfg.RateLimitWindow = time.Minute // Window duration
```

## Error Handling

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // Token expired
    case errors.Is(err, jwt.ErrTokenRevoked):
        // Token revoked
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // Issuer mismatch
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // Audience mismatch
    case errors.Is(err, jwt.ErrInvalidToken):
        // Invalid signature or format
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor closed
    default:
        // Other error
    }
}
```

## Next Steps

- [Signing Algorithms](../guides/signing-algorithms) — Algorithm selection and key configuration
- [Custom Claims](../guides/custom-claims) — Define business fields
- [Token Blacklist](../guides/blacklist) — Revocation and custom storage
- [Rate Limiting](../guides/rate-limiting) — Rate limiting configuration
- [Error Handling](../guides/error-handling) — Error classification and handling patterns
- [API Reference](../api-reference/) — Complete API reference
