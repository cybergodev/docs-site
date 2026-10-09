---
sidebar_label: "Advanced Examples"
title: "Advanced Examples - CyberGo JWT | Asymmetric"
description: "Advanced CyberGo JWT examples: RSA and ECDSA signing, cross-service key separation, PEM loading, CustomClaims, Redis blacklists, and FixedClock testing."
sidebar_position: 20
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

## RSA-PSS Signing

RSA-PSS (the modern replacement for RS256/384/512) uses Probabilistic Signature Scheme (PSS) padding, offering better security than PKCS#1 v1.5. The keys are identical to RSA — no additional key generation needed.

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
	// Generate RSA key pair (RSA-PSS shares the same key type as RSA)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}

	cfg := jwt.DefaultConfig()
	cfg.SigningMethod = jwt.SigningMethodPS256
	cfg.SigningKey = privateKey
	cfg.VerificationKey = &privateKey.PublicKey

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	claims := &jwt.Claims{UserID: "user_ps", Username: "diana"}
	token, err := processor.Create(claims)
	if err != nil {
		panic(err)
	}
	fmt.Println("RSA-PSS Token:", token)

	parsed, valid, err := processor.Validate(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("Valid:", valid) // Output: Valid: true
	fmt.Println("UserID:", parsed.UserID)
}
```

:::tip Recommended Replacement for RSA
New projects should prefer RSA-PSS (PS256/384/512). PSS padding offers stronger provable security than PKCS#1 v1.5, and the keys are fully interchangeable with RSA.
:::

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

## Key Separation Mode

Simulates cross-service token verification in a microservice architecture: the auth service holds the private key to issue tokens, and the API service verifies them via the public key.

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
	// Generate RSA key pair
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	publicKey := &privateKey.PublicKey

	// --- Auth service: holds the private key, issues tokens ---
	authCfg := jwt.DefaultConfig()
	authCfg.SigningMethod = jwt.SigningMethodRS256
	authCfg.SigningKey = privateKey
	authCfg.Issuer = "auth-service"

	authProcessor, err := jwt.New(authCfg)
	if err != nil {
		panic(err)
	}
	defer authProcessor.Close()

	claims := &jwt.Claims{UserID: "user_dist", Username: "charlie"}
	token, err := authProcessor.Create(claims)
	if err != nil {
		panic(err)
	}
	fmt.Println("Auth service issued token (private key)")

	// --- API service: verifies tokens via the public key ---
	apiCfg := jwt.DefaultConfig()
	apiCfg.SigningMethod = jwt.SigningMethodRS256
	apiCfg.SigningKey = privateKey     // Current API requires SigningKey to be non-empty
	apiCfg.VerificationKey = publicKey // This public key is actually used for verification
	apiCfg.Issuer = "auth-service"     // Must match the issuer

	apiProcessor, err := jwt.New(apiCfg)
	if err != nil {
		panic(err)
	}
	defer apiProcessor.Close()

	parsed, valid, err := apiProcessor.Validate(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("API service verified (public key):", valid) // Output: API service verified (public key): true
	fmt.Println("UserID:", parsed.UserID)
}
```

:::warning SigningKey Is Required
The current API requires `SigningKey` to be non-empty (enforced during validation), so the API service's config must still include the private key. However, once `VerificationKey` is set, the verification flow uses only the public key. A verify-only Processor must not call `Create` / `CreateRefresh`.
:::

## Loading Keys from PEM Files

In production, asymmetric keys are usually stored as PEM files. The example below shows how to load a private key with `pem.Decode` + `x509.ParsePKCS8PrivateKey` and a public key with `x509.ParsePKIXPublicKey`.

<!-- check-code: skip -->
```go
package main

import (
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "fmt"
    "os"

    "github.com/cybergodev/jwt"
)

func main() {
    // --- Load RSA private key ---
    keyData, err := os.ReadFile("private_key.pem")
    if err != nil {
        fmt.Println("Failed to read private key:", err)
        return
    }

    block, _ := pem.Decode(keyData)
    if block == nil {
        fmt.Println("Private key PEM decode failed")
        return
    }

    parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
    if err != nil {
        fmt.Println("Failed to parse private key:", err)
        return
    }
    privateKey, ok := parsedKey.(*rsa.PrivateKey)
    if !ok {
        fmt.Println("Key type is not RSA")
        return
    }

    // --- Load RSA public key ---
    pubData, err := os.ReadFile("public_key.pem")
    if err != nil {
        fmt.Println("Failed to read public key:", err)
        return
    }

    pubBlock, _ := pem.Decode(pubData)
    if pubBlock == nil {
        fmt.Println("Public key PEM decode failed")
        return
    }

    parsedPub, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
    if err != nil {
        fmt.Println("Failed to parse public key:", err)
        return
    }
    publicKey, ok := parsedPub.(*rsa.PublicKey)
    if !ok {
        fmt.Println("Public key type is not RSA")
        return
    }

    // --- Configure Processor ---
    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodRS256
    cfg.SigningKey = privateKey
    cfg.VerificationKey = publicKey

    processor, err := jwt.New(cfg)
    if err != nil {
        fmt.Println("Initialization failed:", err)
        return
    }
    defer processor.Close()
    fmt.Println("Keys loaded from PEM files") // Output: Keys loaded from PEM files
}
```

:::tip Key Formats
- The private key PEM header is `-----BEGIN PRIVATE KEY-----` (PKCS#8) or `-----BEGIN RSA PRIVATE KEY-----` (PKCS#1). Use `x509.ParsePKCS8PrivateKey` for PKCS#8 and `x509.ParsePKCS1PrivateKey` for PKCS#1.
- The public key PEM header is `-----BEGIN PUBLIC KEY-----`, parsed with `x509.ParsePKIXPublicKey`.
- `ParsePKCS8PrivateKey` / `ParsePKIXPublicKey` return `any` and must be type-asserted to `*rsa.PrivateKey` / `*rsa.PublicKey` (similarly for ECDSA, assert to `*ecdsa.PrivateKey` / `*ecdsa.PublicKey`).
:::

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
	fmt.Println("IssuedAt:", parsed.IssuedAt.Time)   // Output: 2026-01-01 00:00:00 +0000 UTC
	fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time) // Output: 2026-01-01 00:15:00 +0000 UTC
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

## More Examples

- [Web Server Integration](./web-server) — auth middleware, RBAC, refresh, logout, graceful shutdown
- [Basic Examples](./basic) — HMAC, token pairs, revocation, rate limiting
