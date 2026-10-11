---
sidebar_label: "Package Functions"
title: "Functions - CyberGo JWT | Factories"
description: "Package functions: New creates and validates a Processor, DefaultConfig and DefaultBlacklistConfig return defaults, and NewRateLimiter builds a limiter."
sidebar_position: 10
---

# Package Functions

## New

```go
func New(cfg Config) (*Processor, error)
```

Creates a new JWT Processor. Use `DefaultConfig()` to get default configuration, modify required fields, and pass it in.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `cfg` | `Config` | Configuration |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `processor` | `*Processor` | JWT processor |
| `err` | `error` | Error when configuration validation fails |

### Example

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

	fmt.Println("Processor created successfully")
}
```

### Errors

| Error | Trigger Condition |
|-------|-------------------|
| `ErrInvalidConfig` | Invalid configuration |
| `ErrInvalidSecretKey` | Key missing, under 32 bytes, weak, wrong type, or ECDSA curve mismatch |
| `ErrInvalidSigningMethod` | Unsupported signing algorithm |

---

## DefaultConfig

```go
func DefaultConfig() Config
```

Returns a configuration with sensible defaults.

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `config` | `Config` | Default configuration |

### Defaults

| Field | Default |
|-------|---------|
| `AccessTokenTTL` | `15 * time.Minute` |
| `RefreshTokenTTL` | `7 * 24 * time.Hour` |
| `Issuer` | `"jwt-service"` |
| `SigningMethod` | `SigningMethodHS256` |
| `RateLimitRate` | `100` |
| `RateLimitWindow` | `time.Minute` |
| `Blacklist` | `DefaultBlacklistConfig()` |

### Example

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// Modify other fields as needed
```

---

## DefaultBlacklistConfig

```go
func DefaultBlacklistConfig() BlacklistConfig
```

Returns a blacklist configuration with sensible defaults. `DefaultBlacklistConfig` is the recommended starting point for customizing blacklist behavior: take the defaults, override the fields you need, and assign the result to [`Config.Blacklist`](./config#blacklistconfig).

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `config` | `BlacklistConfig` | Default blacklist configuration |

### Defaults

| Field | Default |
|-------|---------|
| `CleanupInterval` | `5 * time.Minute` |
| `MaxSize` | `100000` |
| `EnableAutoCleanup` | `true` |

### Example

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	blacklist := jwt.DefaultBlacklistConfig()
	blacklist.CleanupInterval = time.Minute // Override the field you need; keep the rest

	fmt.Println(blacklist.CleanupInterval)   // Output: 1m0s
	fmt.Println(blacklist.MaxSize)           // Output: 100000
	fmt.Println(blacklist.EnableAutoCleanup) // Output: true
}
```

---

## NewNumericDate

```go
func NewNumericDate(t time.Time) NumericDate
```

Creates a `NumericDate` from `time.Time`. `NewNumericDate` is typically used to construct timestamp claims explicitly (such as `ExpiresAt`, `NotBefore`) on [`RegisteredClaims`](./claims#registeredclaims).

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `t` | `time.Time` | Time value |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `date` | `NumericDate` | JWT numeric date |

### Example

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	date := jwt.NewNumericDate(time.Unix(1700000000, 0))

	b, err := date.MarshalJSON()
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b)) // Output: 1700000000
}
```

---

## NewRateLimiter

```go
func NewRateLimiter(maxRate int, window time.Duration) *RateLimiter
```

Creates a token bucket rate limiter.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxRate` | `int` | Max requests per window (defaults to 100 when ≤0) |
| `window` | `time.Duration` | Time window (defaults to 1 minute when ≤0) |

### Returns

| Return | Type | Description |
|--------|------|-------------|
| `limiter` | `*RateLimiter` | Rate limiter instance |
