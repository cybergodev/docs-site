---
sidebar_label: "Basic Examples"
title: "Basic Examples - CyberGo JWT | HMAC & Revoke"
description: "Generate and verify HMAC access tokens, exchange refresh tokens, revoke through the built-in blacklist, and configure token bucket rate limiting."
sidebar_position: 10
---

# Basic Examples

## HMAC Signing

The most common approach: one symmetric key signs and verifies.

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
	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
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
	_, err = processor.Parse(token)
	fmt.Println("Parse error:", err) // token revoked

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
	cfg.RateLimitRate = 5 // Max 5 per minute
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

## Audience Isolation

When `ExpectedAudience` is set, only tokens whose `aud` claim contains that value pass validation. In a microservice architecture this isolates services: a token issued by one service cannot be accepted by another.

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/jwt"
)

func main() {
	cfg := jwt.DefaultConfig()
	cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
	cfg.ExpectedAudience = "billing-api" // Only accept tokens for billing-api

	processor, err := jwt.New(cfg)
	if err != nil {
		panic(err)
	}
	defer processor.Close()

	// Token with matching audience
	validClaims := &jwt.Claims{
		UserID: "user1",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.StringOrSlice{"billing-api"},
		},
	}
	validToken, err := processor.Create(validClaims)
	if err != nil {
		panic(err)
	}

	_, err = processor.Parse(validToken)
	if err != nil {
		panic(err)
	}
	fmt.Println("Matching audience valid:", err == nil) // Output: true

	// Token with wrong audience is rejected
	wrongClaims := &jwt.Claims{
		UserID: "user2",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience: jwt.StringOrSlice{"admin-api"},
		},
	}
	wrongToken, err := processor.Create(wrongClaims)
	if err != nil {
		panic(err)
	}

	_, err = processor.Parse(wrongToken)
	fmt.Println("Wrong audience valid:", err == nil) // Output: false
	fmt.Println("Wrong audience error:", err)        // Output: token invalid audience
	fmt.Println("Is audience error:",
		errors.Is(err, jwt.ErrTokenInvalidAudience)) // Output: true
}
```

::: tip Microservice Scenarios
In a microservice architecture, give each service a different `ExpectedAudience` (for example `billing-api` and `user-api`) so each service accepts only tokens addressed to it, preventing cross-service token abuse.
:::

## Extra Extension Fields

The built-in `Claims.Extra` is a `map[string]any` for a small amount of optional additional information. The Processor deeply validates Extra **when a token is created** (length, injection detection), so it requires less work than custom Claims fields.

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

	// Store additional business fields in Extra (only string and []string values allowed)
	claims := &jwt.Claims{
		UserID:   "user123",
		Username: "alice",
		Role:     "engineer",
		Extra: map[string]any{
			"team_id": "team-backend",
			"level":   "senior",
			"tags":    []string{"onboarding", "mentor"},
		},
	}
	token, err := processor.Create(claims)
	if err != nil {
		panic(err)
	}

	// Read Extra fields after validation
	parsed, err := processor.Parse(token)
	if err != nil {
		panic(err)
	}
	fmt.Println("UserID:", parsed.UserID) // Output: user123

	// Type-assert to read Extra values
	if teamID, ok := parsed.Extra["team_id"].(string); ok {
		fmt.Println("TeamID:", teamID) // Output: team-backend
	}
	if level, ok := parsed.Extra["level"].(string); ok {
		fmt.Println("Level:", level) // Output: senior
	}
	// After a JSON round trip, array values read back as []any, so each item needs its own assertion
	if raw, ok := parsed.Extra["tags"].([]any); ok {
		tags := make([]string, 0, len(raw))
		for _, v := range raw {
			if s, ok := v.(string); ok {
				tags = append(tags, s)
			}
		}
		fmt.Println("Tags:", tags) // Output: [onboarding mentor]
	}
}
```

::: warning Extra Limitations
`Extra` allows at most 50 keys, accepts only `string` and `[]string` values (strings ≤ 256 bytes), and rejects nested maps. After `Parse`, an array value reads back as `[]any`, not `[]string`, so each item must be asserted separately. For more complex structures or custom validation, use a [custom Claims type](../guides/custom-claims#extra-field-vs-custom-type) instead.
:::

## More Examples

- [Web Server Integration](./web-server) — auth middleware, RBAC, refresh, logout, graceful shutdown
- [Advanced Examples](./advanced) — RSA, ECDSA, custom Claims, Redis blacklist, clock injection
