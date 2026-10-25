---
sidebar_label: "Custom Claims"
title: "Custom Claims - CyberGo JWT | Business Claims"
description: "Implement CustomClaims for business fields, compare built-in and custom Claims on type safety and validation, and use ParseInto and RefreshInto."
sidebar_position: 20
---

# Custom Claims

The built-in [`Claims`](../api-reference/claims#claims) struct covers common scenarios, but business systems usually need additional fields. Implement the `CustomClaims` interface to define a custom Claims structure.

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

There are two ways to store business fields: the built-in [`Claims.Extra`](../api-reference/claims#claims) field, or a custom Claims type. Each has trade-offs, and the table below also covers their validation differences.

### Comparison

| Dimension | Built-in `*Claims` (including `Extra`) | Custom Claims Type |
|-----------|----------------------------------------|--------------------|
| Type safety | No: `Extra` values are `any` and need type assertions | Yes: compile-time type checking |
| IDE completion | No: map keys in `Extra` get no hints | Yes: fields auto-complete |
| Validation path | Only `Validate()` and standard-claim string sanitization | Same |
| Creation-time deep validation | Yes: length ≤ 256 bytes, ≤ 100 array items, injection patterns, control characters | No: only `Validate()` and standard-claim sanitization |
| `Extra` field limits | Yes: ≤ 50 keys, only `string`/`[]string` | Not applicable |
| Custom validation | No: only the library's built-in rules | Yes: implement freely in `Validate()` |
| Nested structures | No: `Extra` rejects nested maps | Yes: arbitrary structs |
| Use case | A few optional additional fields | Core business fields, custom validation needed |

Deep field validation runs only when a token is created. The verification path only calls `Validate()` for required fields and sanitizes standard-claim strings.

### Limitations of the Extra Field

The built-in `Claims.Extra` is a `map[string]any`, and the Processor deeply validates it **when a token is created**:

| Limit | Constraint |
|-------|------------|
| Max key count | 50 |
| Allowed value types | Only `string` and `[]string` |
| Nested maps | Rejected (returns `ValidationError`) |
| String value length | ≤ 256 bytes after UTF-8 encoding |
| Injection pattern detection | Same as other string fields |

An array value read back through `Parse` has type `[]any`, not `[]string`; each element needs its own assertion when read.

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
- **A few, optional, flat** pieces of information (e.g. `team_id`, `tags`): use `Extra`. The library validates it deeply, so no custom checks are needed.
- **Core business fields**, or cases needing **enums, cross-field constraints, or type safety**: define a custom Claims type and implement business rules in `Validate()`.

Custom struct fields are not deeply validated; add length and injection checks manually. See [Security Impact and Validation Template](#security-impact-and-validation-template) below.
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

Use `ParseInto` to parse the token into a custom struct:

```go
myClaims := &MyClaims{}
result, err := processor.ParseInto(token, myClaims)
if err != nil {
    panic(err)
}
parsed := result.(*MyClaims)
fmt.Println("UserID:", parsed.UserID)
fmt.Println("Email:", parsed.Email)
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

Built-in `*Claims` and custom types follow two different validation paths; the full comparison is in the [Comparison](#comparison) table above. Two points matter.

**At creation**: built-in `*Claims` undergoes deep validation (length, array size, injection patterns, control characters); a custom type only runs `Validate()` and standard-claim string sanitization.

**At verification**: both only call `Validate()` and sanitize standard-claim strings, without repeating deep validation.

:::warning Security Impact
Business fields of custom Claims are **not** deeply validated. Malicious input that passes signature verification is parsed into a custom struct unchanged, including `<script>` tags, SQL fragments, and overlong strings. The built-in `*Claims` injection detection, 256-byte length limit, and control character filtering do not apply. Implement the necessary checks in `Validate()`, otherwise a token can become a vehicle for XSS or SQL injection.
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

const maxClaimLength = 256 // Bytes (UTF-8), matching the library's built-in limit

// dangerousSubstrings lists high-risk substrings that overlap the library's built-in detection; adjust per business needs.
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
- [API Reference → Processor](../api-reference/processor#parseinto) — ParseInto / RefreshInto methods
- [Advanced Examples](../examples/advanced) — Custom Claims complete example
