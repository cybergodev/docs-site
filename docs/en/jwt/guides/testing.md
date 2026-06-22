---
title: "Testing & Clock - CyberGo JWT | Fixed-Clock"
description: "Inject FixedClock via ClockProvider to control time in unit tests, validating token expiration, refresh, custom Claims, and revocation for repeatable runs."
---

# Testing & Clock Injection

Inject custom clocks via the `ClockProvider` interface to precisely control time in tests.

## ClockProvider Interface

```go
type ClockProvider interface {
    Now() time.Time
}
```

The library provides two implementations:

| Type | Description |
|------|-------------|
| `SystemClock` | Default, uses system time |
| `FixedClock` | Fixed time, for testing |

## FixedClock

`FixedClock` always returns the time specified at construction:

```go
fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Clock = jwt.FixedClock{T: fixedTime}
```

## Testing Token Expiration

```go
func TestTokenExpiry(t *testing.T) {
    // Set fixed time
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // Issue token at now
    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // Validate at current time → success
    _, valid, err := processor.Validate(token)
    require.NoError(t, err)
    assert.True(t, valid)

    // Simulate time past expiration → use new Processor
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, _, err = expiredProcessor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## Testing Refresh Flow

```go
func TestRefreshFlow(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    refreshToken, err := processor.CreateRefresh(claims)
    require.NoError(t, err)

    // Refresh token to get new access token
    newToken, err := processor.Refresh(refreshToken)
    require.NoError(t, err)
    assert.NotEmpty(t, newToken)
}
```

## Testing Custom Claims

```go
func TestCustomClaims(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "test@example.com",
    }

    token, err := processor.Create(claims)
    require.NoError(t, err)

    result := &MyClaims{}
    parsed, valid, err := processor.ValidateInto(token, result)
    require.NoError(t, err)
    assert.True(t, valid)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## Testing Error Handling

```go
func TestRevokeToken(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // Revoke token
    err = processor.Revoke(token)
    require.NoError(t, err)

    // Validation should fail
    _, _, err = processor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## Best Practices

:::tip Testing Tips
- Use `FixedClock` to ensure repeatable tests
- Create a separate Processor for each test case
- Use `t.Cleanup()` or `defer` to ensure `Close()` is called
- Use `errors.Is()` for error checking instead of string matching
:::

## Next Steps

- [API Reference → ClockProvider](../api-reference/interfaces#clockprovider) — Clock interface
- [API Reference → FixedClock](../api-reference/types#fixedclock) — Fixed clock
- [Advanced Examples](../examples/advanced) — Clock injection example
