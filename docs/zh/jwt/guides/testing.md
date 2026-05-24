---
title: "测试与时钟注入 - JWT"
description: "CyberGo JWT 测试与时钟注入指南：ClockProvider 接口、FixedClock 固定时钟使用，以及单元测试中令牌过期、刷新和自定义 Claims 验证。"
---

# 测试与时钟注入

通过 `ClockProvider` 接口注入自定义时钟，在测试中精确控制时间。

## ClockProvider 接口

```go
type ClockProvider interface {
    Now() time.Time
}
```

库提供两个实现：

| 类型 | 说明 |
|------|------|
| `SystemClock` | 默认，使用系统时间 |
| `FixedClock` | 固定时间，用于测试 |

## FixedClock

`FixedClock` 始终返回构造时指定的时间：

```go
fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.Clock = jwt.FixedClock{T: fixedTime}
```

## 测试令牌过期

```go
func TestTokenExpiry(t *testing.T) {
    // 设置固定时间
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.Clock = jwt.FixedClock{T: now}

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // 在 now 时刻签发令牌
    claims := &jwt.Claims{UserID: "user123"}
    token, err := processor.Create(claims)
    require.NoError(t, err)

    // 当前时刻验证 → 成功
    _, valid, err := processor.Validate(token)
    require.NoError(t, err)
    assert.True(t, valid)

    // 模拟时间流逝到过期后 → 使用新的 Processor
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, _, err = expiredProcessor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## 测试刷新流程

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

    // 刷新令牌获取新的访问令牌
    newToken, err := processor.Refresh(refreshToken)
    require.NoError(t, err)
    assert.NotEmpty(t, newToken)
}
```

## 测试自定义 Claims

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

## 测试错误处理

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

    // 吊销令牌
    err = processor.Revoke(token)
    require.NoError(t, err)

    // 验证应失败
    _, _, err = processor.Validate(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## 最佳实践

:::tip 测试建议
- 使用 `FixedClock` 确保测试可重复
- 每个测试用例创建独立的 Processor
- 使用 `t.Cleanup()` 或 `defer` 确保 `Close()` 被调用
- 验证错误时使用 `errors.Is()` 而非字符串匹配
:::

## 下一步

- [API 参考 → ClockProvider](../api-reference/interfaces#clockprovider) — 时钟接口
- [API 参考 → FixedClock](../api-reference/types#fixedclock) — 固定时钟
- [高级示例](../examples/advanced) — 时钟注入示例
