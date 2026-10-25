---
sidebar_label: "测试与时钟注入"
title: "测试与时钟注入 - CyberGo JWT | 固定时钟可重复测试"
description: "测试与时钟注入指南：通过 ClockProvider 注入 FixedClock 固定时钟，在单元测试中精确控制时间流逝，验证令牌过期、时钟偏移、刷新、自定义 Claims 解析、输入校验、吊销与并发安全，确保测试可重复且相互独立。"
sidebar_position: 60
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

以下用例使用 [`testify`](https://github.com/stretchr/testify) 的 `require` / `assert` 简化断言；换成标准库的 `if err != nil { t.Fatal(err) }` 同样成立。

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
    _, err = processor.Parse(token)
    require.NoError(t, err)

    // 模拟时间流逝到过期后 → 使用新的 Processor
    expiredCfg := cfg
    expiredCfg.Clock = jwt.FixedClock{T: now.Add(16 * time.Minute)}
    expiredProcessor, err := jwt.New(expiredCfg)
    require.NoError(t, err)
    defer expiredProcessor.Close()

    _, err = expiredProcessor.Parse(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenExpired))
}
```

## 测试时钟偏移（ClockSkew）

[`ClockSkew`](./configuration#时钟偏移-clockskew) 为过期（`exp`）和生效前（`nbf`）校验提供宽容窗口。通过设置偏移量，可以验证令牌在严格过期时间之后的一小段时间内是否仍被接受：

```go
func TestClockSkew(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    // 签发令牌：exp = now + 1h
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

    // exp + 10s 仍在 30s 偏移窗口内 → 有效
    withinCfg := jwt.DefaultConfig()
    withinCfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    withinCfg.ClockSkew = skew
    withinCfg.Clock = jwt.FixedClock{T: now.Add(time.Hour + 10*time.Second)}
    withinProc, err := jwt.New(withinCfg)
    require.NoError(t, err)
    defer withinProc.Close()

    _, err = withinProc.Parse(token)
    require.NoError(t, err)

    // exp + 40s 超出 30s 偏移窗口 → 过期
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

::: tip FixedClock 与速率限制
启用速率限制时，内置 [`RateLimiter`](../api-reference/types#ratelimiter) 的时钟会从 `Config.Clock` 传播——即使用 `FixedClock` 时速率限制器也使用同一固定时间，不会因真实时间流逝而补充令牌。这使得速率限制测试完全可预测。详见 [测试速率限制](#测试速率限制)。
:::

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
    parsed, err := processor.ParseInto(token, result)
    require.NoError(t, err)

    myResult := parsed.(*MyClaims)
    assert.Equal(t, "user123", myResult.UserID)
    assert.Equal(t, "test@example.com", myResult.Email)
}
```

## 测试输入验证

[`Claims`](../api-reference/claims) 字段在 `Create` 时接受多层校验。测试可验证超长字符串、注入模式和控制字符是否触发 [`ValidationError`](../api-reference/types#validationerror)，并用 `errors.As` 提取字段级信息：

```go
func TestInputValidation(t *testing.T) {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    var ve *jwt.ValidationError

    // 超长字符串触发长度限制（上限 256 字节）
    _, err = processor.Create(&jwt.Claims{
        UserID: strings.Repeat("a", 300),
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Contains(t, ve.Message, "maximum length")

    // XSS 注入模式检测
    _, err = processor.Create(&jwt.Claims{
        UserID: "<script>alert(1)</script>",
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Equal(t, "suspicious pattern detected", ve.Message)

    // 控制字符过滤（null 字节被拒绝）
    _, err = processor.Create(&jwt.Claims{
        UserID: "user\x00inject",
    })
    require.ErrorAs(t, err, &ve)
    assert.Equal(t, "UserID", ve.Field)
    assert.Equal(t, "invalid control character", ve.Message)
}
```

::: warning ValidationError 包装层级
`Create` 路径中，`ValidationError` 会被 `ErrInvalidClaims` 包装。使用 `errors.As(err, &ve)` 可穿透包装提取 `ValidationError`，读取 `Field` 和 `Message` 进行断言。校验规则的完整说明见 [配置详解 → 输入校验与安全加固](./configuration#输入校验与安全加固)。
:::

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
    _, err = processor.Parse(token)
    assert.True(t, errors.Is(err, jwt.ErrTokenRevoked))
}
```

## 测试速率限制

启用速率限制后，超出配额的 `Create` 返回 [`ErrRateLimitExceeded`](../api-reference/errors#哨兵错误)。配合 `FixedClock` 可精确控制令牌桶不补充，使测试完全可预测：

```go
func TestRateLimit(t *testing.T) {
    now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 3               // 每窗口 3 次
    cfg.RateLimitWindow = time.Minute
    cfg.Clock = jwt.FixedClock{T: now}  // 固定时间 → 令牌桶不补充

    processor, err := jwt.New(cfg)
    require.NoError(t, err)
    defer processor.Close()

    // 同一 UserID 共享速率配额（Subject 为空时回退到 UserID）
    claims := &jwt.Claims{UserID: "user123"}

    // 前 3 次创建成功
    for i := 0; i < 3; i++ {
        _, err := processor.Create(claims)
        require.NoError(t, err, "第 %d 次创建应成功", i+1)
    }

    // 第 4 次超出配额
    _, err = processor.Create(claims)
    assert.True(t, errors.Is(err, jwt.ErrRateLimitExceeded))
}
```

::: tip 速率限制键
速率限制基于 `Subject` 声明计算键；`Subject` 为空时回退到 `UserID`。测试中使用同一 `UserID` 确保所有请求共享配额。详见 [速率限制](./rate-limiting)。
:::

## 测试并发安全

`Processor` 所有方法均为 goroutine 安全。使用 `sync.WaitGroup` 并发执行 `Create`/`Parse`，验证无 panic、无 data race：

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
        "并发创建与验证应全部成功")
}
```

::: warning 竞态检测
运行 `go test -race ./...` 启用 Go 的竞态检测器，可捕获并发测试中隐藏的 data race。这是验证 `Processor` 并发安全的标准方式，生产代码的测试套件应始终在 `-race` 下通过。
:::

## 最佳实践

### 表格化测试建议

| 测试场景 | 推荐做法 | 关键断言 |
|----------|----------|----------|
| 令牌过期 | `FixedClock` 固定签发时间，新 Processor 模拟过期 | `errors.Is(err, ErrTokenExpired)` |
| 时钟偏移 | 设置 `ClockSkew`，验证窗口边界 | exp + skew 内有效 / 外过期 |
| 刷新流程 | 创建刷新令牌后立即 `Refresh` | 返回的令牌非空 |
| 自定义 Claims | `ParseInto` 反序列化到目标类型 | 字段值匹配 |
| 输入校验 | 超长字符串 / 注入模式 / 控制字符 | `errors.As` 提取 `ValidationError` |
| 速率限制 | 小窗口 + 低速率 + 固定时钟 | 超额返回 `ErrRateLimitExceeded` |
| 并发安全 | `goroutine` + `WaitGroup` 并发操作 | 无 panic、无 data race |
| 令牌吊销 | `Revoke` 后 `Parse` | `errors.Is(err, ErrTokenRevoked)` |

:::tip 核心原则
- 使用 `FixedClock` 确保测试**可重复**——不依赖系统时间
- 每个测试用例创建**独立的 Processor**，避免状态泄漏
- 使用 `t.Cleanup()` 或 `defer` 确保 `Close()` 被调用
- 验证错误时使用 `errors.Is()` / `errors.As()` 而非字符串匹配
- 并发测试始终配合 `go test -race` 运行
:::

## 下一步

- [API 参考 → ClockProvider](../api-reference/interfaces#clockprovider) — 时钟接口
- [API 参考 → FixedClock](../api-reference/types#fixedclock) — 固定时钟
- [高级示例](../examples/advanced) — 时钟注入示例
