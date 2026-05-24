---
title: "Advanced Examples - JWT"
description: "CyberGo JWT advanced examples covering RSA/ECDSA asymmetric signing, custom Claims, Redis blacklist backend, clock injection testing, unverified parsing, and web service integration."
---

# Advanced Examples

## RSA Asymmetric Signing

Sign with RSA private key, verify with public key. Suitable for microservice architectures where the verifying party doesn't need the private key.

```go
package main

import (
    "crypto/rand"
    "crypto/rsa"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // Generate RSA key pair (load from file in production)
    privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodRS256
    cfg.SigningKey = privateKey
    cfg.VerificationKey = &privateKey.PublicKey // Optional, defaults to SigningKey

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user456", Username: "bob"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("RSA Token:", token)

    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## ECDSA Asymmetric Signing

Sign with ECDSA elliptic curve — shorter keys, better performance.

```go
package main

import (
    "crypto/ecdsa"
    "crypto/elliptic"
    "crypto/rand"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // Generate ECDSA key pair
    privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodES256
    cfg.SigningKey = privateKey

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user789", Username: "charlie"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("ECDSA Token:", token)
}
```

## Custom Claims

Define your own Claims struct with business fields.

```go
package main

import (
    "errors"
    "fmt"

    "github.com/cybergodev/jwt"
)

// Custom Claims struct
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
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
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "alice@example.com",
        Role:   "admin",
    }

    // Create token
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // Validate into custom Claims
    myClaims := &MyClaims{}
    result, valid, err := processor.ValidateInto(token, myClaims)
    if err != nil {
        panic(err)
    }
    if valid {
        parsed := result.(*MyClaims)
        fmt.Println("UserID:", parsed.UserID) // Output: user123
        fmt.Println("Email:", parsed.Email)   // Output: alice@example.com
    }

    // Refresh into custom Claims
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }
    newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
    if err != nil {
        panic(err)
    }
    fmt.Println("New Token:", newToken)
}
```

## Custom Blacklist Backend (Redis)

```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

// RedisBlacklistStore implements BlacklistStore interface.
// Note: Requires a Redis client (e.g., github.com/redis/go-redis) in production.
type RedisBlacklistStore struct {
    // client *redis.Client
}

func (s *RedisBlacklistStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil
    }
    // return s.client.Set(context.Background(), "blacklist:"+tokenID, "1", ttl).Err()
    fmt.Printf("Redis ADD: %s, TTL: %v\n", tokenID, ttl)
    return nil
}

func (s *RedisBlacklistStore) Contains(tokenID string) (bool, error) {
    // return s.client.Exists(context.Background(), "blacklist:"+tokenID).Result()
    return false, nil
}

func (s *RedisBlacklistStore) Close() error {
    // return s.client.Close()
    return nil
}

func main() {
    _ = context.Background() // Keeps context import available (uncomment Redis calls in production)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Blacklist.Store = &RedisBlacklistStore{}

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

    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked via Redis backend")
}
```

## Clock Injection (Testing)

Use `FixedClock` to control time in tests.

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: fixedTime}

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

    parsed, _, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("IssuedAt:", parsed.IssuedAt.Time)   // Output: 2026-01-01 00:00:00
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time) // Output: 2026-01-01 00:15:00
}
```

## Parse Unverified Token

Extract Claims information without verifying the signature, for debugging or logging.

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

    // Parse without signature verification
    parsed := &jwt.Claims{}
    err = processor.ParseUnverified(token, parsed)
    if err != nil {
        panic(err)
    }
    fmt.Println("UserID (unverified):", parsed.UserID)
}
```

## Complete Web Service Example

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "strings"

    "github.com/cybergodev/jwt"
)

var processor *jwt.Processor

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Issuer = "my-web-service"
    cfg.ExpectedAudience = "my-app"

    var err error
    processor, err = jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    http.HandleFunc("/login", handleLogin)
    http.HandleFunc("/protected", handleProtected)

    fmt.Println("Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
    // In production, validate username and password
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }

    accessToken, err := processor.Create(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    fmt.Fprintf(w, `{"access_token":"%s","refresh_token":"%s"}`, accessToken, refreshToken)
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
    auth := r.Header.Get("Authorization")
    if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
        http.Error(w, "missing token", http.StatusUnauthorized)
        return
    }

    tokenString := strings.TrimPrefix(auth, "Bearer ")
    claims, valid, err := processor.Validate(tokenString)
    if err != nil || !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }

    fmt.Fprintf(w, "Hello, %s (ID: %s, Role: %s)",
        claims.Username, claims.UserID, claims.Role)
}
```
