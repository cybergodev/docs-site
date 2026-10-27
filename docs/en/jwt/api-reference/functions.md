---
sidebar_label: "Package Functions"
title: "Functions - CyberGo JWT | Factories"
description: "Package functions: New creates a Processor, DefaultConfig and DefaultBlacklistConfig return defaults, and NewRateLimiter builds a token bucket limiter."
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

Returns a blacklist configuration with sensible defaults. The common way to customize blacklist parameters is to take the defaults, override the fields that need changing, and assign the result to [`Config.Blacklist`](./config#blacklistconfig).

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
	blacklist.CleanupInterval = time.Minute // Override the field that needs changing; keep the rest

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

### Example

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/jwt"
)

func main() {
	limiter := jwt.NewRateLimiter(5, time.Minute)
	defer limiter.Close()

	for i := 1; i <= 6; i++ {
		fmt.Printf("request %d: %v\n", i, limiter.Allow("tenant-a"))
	}

	// Output:
	// request 1: true
	// request 2: true
	// request 3: true
	// request 4: true
	// request 5: true
	// request 6: false
}
```

### Usage Notes

Most scenarios only need [`Config.EnableRateLimit`](./config#config); `New()` then builds a built-in limiter from `RateLimitRate` and `RateLimitWindow`. Call `NewRateLimiter` directly in only two cases:

- A limiter is needed independently of a Processor;
- A limiter must be injected through [`Config.RateLimiter`](./config#config) to replace the default implementation.

::: warning Ownership
`Processor.Close` closes the limiter injected via `Config.RateLimiter`. Do not share one instance across processors that may outlive each other — after one closes it, the others' `Allow` always returns `false`.
:::

`AllowN(key, n)` is an extension method on `*RateLimiter` that checks n requests at once. It returns `false` when `n` is negative or exceeds the maximum requests allowed per window, and `true` when `n` is 0.
