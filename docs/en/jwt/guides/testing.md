---
sidebar_label: "Testing & Clock Injection"
title: "Testing & Clock - CyberGo JWT | Fixed-Clock"
description: "Inject FixedClock via ClockProvider to control time in tests: token expiry, clock skew, refresh, custom Claims, validation, revocation, concurrency."
sidebar_position: 60
---

# Testing & Clock Injection

Inject a custom clock through the `ClockProvider` interface to control time precisely in tests.

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

The cases below use `require` / `assert` from [`testify`](https://github.com/stretchr/testify) for brevity. The stdlib `if err != nil { t.Fatal(err) }` form works just as well.

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
    _, err = processor.Parse(token)
    require.NoError(t, err)

    // Simulate time past expiration → use new Processor
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, err = expiredProcessor.Parse(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## Testing Clock Skew

[`ClockSkew`](./configuration#clock-skew) provides a tolerance window for expiration (`exp`) and not-before (`nbf`) validation. Setting the skew makes it possible to verify whether a token is still accepted for a short period after its strict expiration time:

```go
func TestClockSkew(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    // Issue token: exp = now + 1h
    issueCfg := jwt.DefaultConfig()
    issueCfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    issueCfg.AccessTokenTTL = time.Hour
    issueCfg.Clock = jwt.FixedClock{T: now}

    issueProc, err := jwt.New(issueCfg)
    require.NoError(t, err)
    defer issueProc.Close()

    token, err := issueProc.Create(&jwt.Claims{UserID: "user123"})
    require.NoError(t, err)

    const skew = 30 * time.Second

    // exp + 10s still within the 30s skew window → valid
    withinCfg := jwt.DefaultConfig()
    withinCfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    withinCfg.ClockSkew = skew
    withinCfg.Clock = jwt.FixedClock{T: now.Add(time.Hour + 10*time.Second)}
    withinProc, err := jwt.New(withinCfg)
    require.NoError(t, err)
    defer withinProc.Close()

    _, err = withinProc.Parse(token)
    require.NoError(t, err)

    // exp + 40s beyond the 30s skew window → expired
    beyondCfg := jwt.DefaultConfig()
    beyondCfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    beyondCfg.ClockSkew = skew
    beyondCfg.Clock = jwt.FixedClock{T: now.Add(time.Hour + 40*time.Second)}
    beyondProc, err := jwt.New(beyondCfg)
    require.NoError(t, err)
    defer beyondProc.Close()

    _, err = beyondProc.Parse(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

::: tip FixedClock and Rate Limiting
When rate limiting is enabled, the built-in [`RateLimiter`](../api-reference/types#ratelimiter)'s clock is propagated from `Config.Clock` — so when using `FixedClock`, the rate limiter also uses the same fixed time and will not refill tokens as real time passes. This makes rate limiting tests fully predictable. See [Testing Rate Limiting](#testing-rate-limiting).
:::

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
    parsed, err := processor.ParseInto(token, result)
    require.NoError(t, err)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## Testing Input Validation

[`Claims`](../api-reference/claims) fields undergo multi-layer validation during `Create`. Tests can verify that overlong strings, injection patterns, and control characters trigger a [`ValidationError`](../api-reference/types#validationerror), and use `errors.As` to extract field-level info:

```go
func TestInputValidation(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    var ve *jwt.ValidationError

    // Overlong string triggers the length limit (cap 256 bytes)
    _, err = processor.Create(&jwt.Claims{
        UserID: strings.Repeat("a", 300),
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Contains(t, ve.Message, "maximum length")

    // XSS injection pattern detection
    _, err = processor.Create(&jwt.Claims{
        UserID: "<script>alert(1)</script>",
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Equal(t, "suspicious pattern detected", ve.Message)

    // Control character filtering (null byte rejected)
    _, err = processor.Create(&jwt.Claims{
        UserID: "user\x00inject",
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Equal(t, "invalid control character", ve.Message)
}
```

::: warning ValidationError Wrapping Level
In the `Create` path, `ValidationError` is wrapped by `ErrInvalidClaims`. `errors.As(err, &ve)` pierces the wrapping to extract the `ValidationError`, so tests can assert on `Field` and `Message`. For the complete validation rules, see [Configuration → Input Validation and Security Hardening](./configuration#input-validation-and-security-hardening).
:::

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
    _, err = processor.Parse(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## Testing Rate Limiting

With rate limiting enabled, a `Create` that exceeds the quota returns [`ErrRateLimitExceeded`](../api-reference/errors#sentinel-errors). Combined with `FixedClock`, the token bucket can be held at a fixed state so tests are fully predictable:

```go
func TestRateLimit(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 3               // 3 per window
    cfg.RateLimitWindow = time.Minute
    cfg.Clock = jwt.FixedClock{T: now}  // Fixed time → bucket does not refill

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // Same UserID shares the rate quota (falls back to UserID when Subject is empty)
    claims := &jwt.Claims{UserID: "user123"}

    // First 3 creations succeed
    for i := 0; i < 3; i++ {
        _, err := processor.Create(claims)
        require.NoError(t, err, "creation %d should succeed", i+1)
    }

    // 4th exceeds the quota
    _, err = processor.Create(claims)
    assert.True(t, errors.Is(err, jwt.ErrRateLimitExceeded))
}
```

::: tip Rate Limit Key
Rate limiting computes the key from the `Subject` claim; when `Subject` is empty, it falls back to `UserID`. Using the same `UserID` in tests ensures all requests share the quota. See [Rate Limiting](./rate-limiting).
:::

## Testing Concurrency Safety

All `Processor` methods are goroutine-safe. Use `sync.WaitGroup` to run `Create`/`Parse` concurrently, verifying no panic and no data race:

```go
func TestConcurrentSafety(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    const goroutines = 50
    const opsPerGoroutine = 20

    var wg sync.WaitGroup
    var success atomic.Int64
    wg.Add(goroutines)

    for i := 0; i < goroutines; i++ {
        go func(id int) {
            defer wg.Done()
            for j := 0; j < opsPerGoroutine; j++ {
                claims := &jwt.Claims{
                    UserID: fmt.Sprintf("user-%d-%d", id, j),
                }
                token, err := processor.Create(claims)
                if err != nil {
                    continue
                }
                if _, err := processor.Parse(token); err == nil {
                    success.Add(1)
                }
            }
        }(i)
    }
    wg.Wait()

    assert.Equal(t, int64(goroutines*opsPerGoroutine), success.Load(),
        "concurrent create and validate should all succeed")
}
```

::: warning Race Detection
Run `go test -race ./...` to enable Go's race detector, which catches hidden data races in concurrent tests. This is the standard way to verify `Processor`'s concurrency safety; a production code test suite should always pass under `-race`.
:::

## Best Practices

### Table-Driven Testing Recommendations

| Test Scenario | Recommended Approach | Key Assertion |
|---------------|----------------------|---------------|
| Token expiration | `FixedClock` to fix issue time, new Processor to simulate expiry | `errors.Is(err, ErrTokenExpired)` |
| Clock skew | Set `ClockSkew`, verify window boundaries | Valid within exp + skew / expired beyond |
| Refresh flow | `Refresh` immediately after creating refresh token | Returned token is non-empty |
| Custom Claims | `ParseInto` deserialize into target type | Field values match |
| Input validation | Overlong string / injection pattern / control character | `errors.As` extracts `ValidationError` |
| Rate limiting | Small window + low rate + fixed clock | Over-quota returns `ErrRateLimitExceeded` |
| Concurrency safety | `goroutine` + `WaitGroup` concurrent operations | No panic, no data race |
| Token revocation | `Revoke` then `Parse` | `errors.Is(err, ErrTokenRevoked)` |

:::tip Core Principles
- Use `FixedClock` to ensure tests are **repeatable** — independent of system time
- Create a **separate Processor** for each test case to avoid state leakage
- Use `t.Cleanup()` or `defer` to ensure `Close()` is called
- Use `errors.Is()` / `errors.As()` for error checking instead of string matching
- Always run concurrency tests with `go test -race`
:::

## Next Steps

- [API Reference → ClockProvider](../api-reference/interfaces#clockprovider) — Clock interface
- [API Reference → FixedClock](../api-reference/types#fixedclock) — Fixed clock
- [Advanced Examples](../examples/advanced) — Clock injection example
