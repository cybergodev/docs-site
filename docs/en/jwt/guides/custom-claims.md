---
sidebar_label: "Custom Claims"
title: "Custom Claims - CyberGo JWT | Business Claims"
description: "Implement the CustomClaims interface to define business claim fields, contrast built-in Claims with custom validation, and apply ValidateInto and RefreshInto."
sidebar_position: 20
---

# Custom Claims

The built-in [`Claims`](../api-reference/claims#claims) struct covers common scenarios, but business systems often need additional fields. Implement the `CustomClaims` interface to define your own Claims struct.

## CustomClaims Interface

```go
type CustomClaims interface {
    GetRegisteredClaims() *RegisteredClaims
    Validate() error
}
```

Only two methods to implement:

| Method | Description |
|--------|-------------|
| `GetRegisteredClaims()` | Returns standard JWT fields (iss, sub, aud, etc.) |
| `Validate()` | Custom validation logic |

## Extra Field vs Custom Type

There are two ways to store business fields: use the built-in [`Claims.Extra`](../api-reference/claims#claims) field, or define a custom Claims type. Each has trade-offs.

### Comparison

| Dimension | `Claims.Extra` | Custom Claims Type |
|-----------|----------------|--------------------|
| Type safety | No, values are `any`, require type assertion | Yes, compile-time type checking |
| IDE completion | No, map keys have no hints | Yes, fields auto-complete |
| Custom validation | No, only built-in deep validation | Yes, freely implemented in `Validate()` |
| Deep validation | Yes, length/injection/control characters | No, only registered claims sanitization |
| Nested structures | No, nested maps not supported | Yes, arbitrary structs |
| Use case | A few optional extra fields | Core business fields, need custom validation |

### Limitations of the Extra Field

The built-in `Claims.Extra` is a `map[string]any`; the Processor performs deep validation on it during token creation:

| Limit | Constraint |
|-------|------------|
| Max key count | 50 |
| Allowed value types | Only `string` and `[]string` |
| Nested maps | Rejected (returns `ValidationError`) |
| String value length | ≤ 256 characters |
| Injection pattern detection | Same as other string fields |

```go
// ✅ Valid — only string and []string values
claims := &jwt.Claims{
    UserID: "user1",
    Extra: map[string]any{
        "team_id": "team-abc",            // string
        "tags":    []string{"vip", "qa"}, // []string
    },
}

// ❌ Invalid — nested maps are rejected by deep validation
claims = &jwt.Claims{
    Extra: map[string]any{
        "profile": map[string]any{"age": 30}, // ValidationError: nested maps not allowed
    },
}
```

::: tip How to Choose
- **A few, optional, flat** pieces of information (e.g. `team_id`, `tags`) → use `Extra`, enjoying the library's built-in deep validation with no need to write your own checks.
- **Core business fields** or when you need **enum/cross-field constraints/type safety** → define a custom Claims type and implement business rules in `Validate()`. Note: custom struct fields are not deep-validated; you must add your own length and injection checks (see [Security Impact and Validation Template](#security-impact-and-validation-template) below).
:::

## Defining Custom Claims

```go
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
```

:::tip Key Points
- Must embed `jwt.RegisteredClaims`
- `GetRegisteredClaims()` returns a pointer to the embedded field
- `Validate()` is called during both token creation and validation
:::

## Using Custom Claims

### Create Token

```go
claims := &MyClaims{
    UserID: "user123",
    Email:  "alice@example.com",
    Role:   "admin",
}
token, err := processor.Create(claims)
```

### Validate into Custom Struct

Use `ValidateInto` to parse the token into a custom struct:

```go
myClaims := &MyClaims{}
result, valid, err := processor.ValidateInto(token, myClaims)
if err != nil {
    panic(err)
}
if valid {
    parsed := result.(*MyClaims)
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Email:", parsed.Email)
}
```

### Refresh into Custom Struct

Use `RefreshInto` to refresh a token while preserving custom fields:

```go
newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
if err != nil {
    panic(err)
}
```

:::warning Timing Field Protection
`RefreshInto` automatically restores Claims timing fields (`IssuedAt`, `ExpiresAt`, `ID`), even if the operation fails.
:::

## Complex Validation Example

The real value of custom Claims is implementing business rules in `Validate()`. The example below demonstrates required-field checks, enum-value constraints, and cross-field constraints:

```go
package main

import (
	"errors"
	"fmt"

	"github.com/cybergodev/jwt"
)

// AccountClaims carries business claims of account tier and device quota.
type AccountClaims struct {
	UserID    string   `json:"user_id"`
	Tier      string   `json:"tier"`   // free | pro | enterprise
	Region    string   `json:"region"` // cn | us | eu
	DeviceIDs []string `json:"device_ids"`
	jwt.RegisteredClaims
}

// Max devices per tier.
var tierMaxDevices = map[string]int{
	"free":       2,
	"pro":        10,
	"enterprise": 100,
}

var allowedRegions = map[string]bool{"cn": true, "us": true, "eu": true}

func (c *AccountClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
	return &c.RegisteredClaims
}

func (c *AccountClaims) Validate() error {
	// 1. Required-field validation
	if c.UserID == "" {
		return errors.New("user_id is required")
	}

	// 2. Enum-value validation
	if _, ok := tierMaxDevices[c.Tier]; !ok {
		return fmt.Errorf("invalid tier %q: must be free, pro or enterprise", c.Tier)
	}
	if !allowedRegions[c.Region] {
		return fmt.Errorf("invalid region %q: must be cn, us or eu", c.Region)
	}

	// 3. Cross-field constraint: device count must not exceed the tier quota
	if max := tierMaxDevices[c.Tier]; len(c.DeviceIDs) > max {
		return fmt.Errorf("tier %q allows at most %d devices, got %d",
			c.Tier, max, len(c.DeviceIDs))
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

	// Valid claim: pro tier, 3 devices (≤ 10)
	valid := &AccountClaims{
		UserID:    "user123",
		Tier:      "pro",
		Region:    "cn",
		DeviceIDs: []string{"dev-1", "dev-2", "dev-3"},
	}
	_, err = processor.Create(valid)
	if err != nil {
		panic(err)
	}
	fmt.Println("Token created successfully")

	// Invalid claim: free tier with 5 devices (> 2) → Validate() rejects
	_, err = processor.Create(&AccountClaims{
		UserID:    "user456",
		Tier:      "free",
		Region:    "us",
		DeviceIDs: []string{"d1", "d2", "d3", "d4", "d5"},
	})
	fmt.Println("Over-quota error:", err)
	// Output: Over-quota error: invalid claims: tier "free" allows at most 2 devices, got 5
}
```

::: tip Error Wrapping
Descriptive errors returned from `Validate()` are wrapped by `ErrInvalidClaims`. Callers can use `errors.Is(err, jwt.ErrInvalidClaims)` to check the category, or read the error string directly for business details. See [Error Handling](./error-handling#error-wrapping-chain).
:::

## Validation Differences

Built-in `*Claims` and custom types follow different validation paths:

| Validation | `*Claims` | Custom Types |
|-----------|-----------|--------------|
| `Validate()` method | ✅ | ✅ |
| String length limit (256 chars) | ✅ | ❌ |
| Array size limit (100 items) | ✅ | ❌ |
| Injection pattern detection | ✅ | ❌ |
| Control character filtering | ✅ | ❌ |
| `Extra` field restrictions | ✅ | N/A |
| Registered claims sanitization | ✅ | ✅ |

:::warning Security Impact
Business fields in custom Claims are **not** deep-validated. This means: if malicious input passes signature verification and is parsed into a custom struct, dangerous content such as `<script>` tags, SQL fragments, and overlong strings are stored in the token as-is — the built-in `*Claims`'s 46 injection pattern checks, 256-character length limit, and control character filtering do not apply.

Please implement all necessary checks in the `Validate()` method, otherwise your tokens may become a vehicle for XSS/SQL injection.
:::

### Security Impact and Validation Template

The helper function below replicates the core logic of the built-in deep validation (length cap, control characters, injection substrings) and can be called directly from a custom Claims' `Validate()`:

```go
package main

import (
	"errors"
	"fmt"
	"strings"
)

const maxClaimLength = 256

// dangerousSubstrings lists high-risk substrings overlapping with the library's built-in detection; add or remove as needed for your business.
var dangerousSubstrings = []string{
	"<script", "javascript:", "onerror=", "onload=",
	"drop table", "union select", "../", "/etc/passwd",
}

// validateField checks a custom field's length, control characters, and common injection patterns.
func validateField(name, value string) error {
	if len(value) > maxClaimLength {
		return fmt.Errorf("%s exceeds maximum length of %d", name, maxClaimLength)
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if c < 32 && c != '\t' && c != '\n' && c != '\r' {
			return fmt.Errorf("%s contains invalid control character", name)
		}
	}
	lower := strings.ToLower(value)
	for _, pattern := range dangerousSubstrings {
		if strings.Contains(lower, pattern) {
			return fmt.Errorf("%s contains suspicious pattern", name)
		}
	}
	return nil
}

type MyClaims struct {
	UserID     string `json:"user_id"`
	Department string `json:"department"`
}

func (c *MyClaims) Validate() error {
	if c.UserID == "" {
		return errors.New("user_id is required")
	}
	// Custom fields do not enjoy built-in deep validation; manually add length and injection checks
	if err := validateField("user_id", c.UserID); err != nil {
		return err
	}
	if err := validateField("department", c.Department); err != nil {
		return err
	}
	return nil
}

func main() {}
```

## Optional Interface: RateLimitKeyer

Custom Claims can implement the `RateLimitKeyer` interface to provide a rate limit key:

```go
func (c *MyClaims) RateLimitKey() string {
    return c.Email // Use Email as rate limit key
}
```

Rate limit key lookup priority: `Subject` → `*Claims.UserID` → `RateLimitKey()`.

## Next Steps

- [API Reference → Interfaces](../api-reference/interfaces#customclaims) — CustomClaims full definition
- [API Reference → Processor](../api-reference/processor#validateinto) — ValidateInto / RefreshInto methods
- [Advanced Examples](../examples/advanced) — Custom Claims complete example
