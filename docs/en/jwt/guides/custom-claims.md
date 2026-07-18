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

:::warning Important
Custom Claims business fields are **not** deep-validated. Please implement all necessary checks in the `Validate()` method.
:::

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
