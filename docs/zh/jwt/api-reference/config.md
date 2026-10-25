---
sidebar_label: "Config"
title: "Config - CyberGo JWT | 统一配置说明"
description: "Config 是 CyberGo JWT 的统一配置，覆盖签名密钥与算法、访问与刷新令牌 TTL、签发者与受众、时钟偏移、黑名单与速率限制。本页列出全部字段的默认值、自动填充规则、注册声明覆盖规则，以及 Validate 的检查项与直接调用的差异。"
sidebar_position: 30
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL        time.Duration
    RefreshTokenTTL       time.Duration
    Issuer                string
    ExpectedAudience      string
    RequireExpiration     bool
    RejectRefreshAsAccess bool
    RotateRefreshTokens   bool
    ClockSkew             time.Duration

    Blacklist BlacklistConfig

    EnableRateLimit bool
    RateLimitRate   int
    RateLimitWindow time.Duration
    RateLimiter     RateLimitProvider

    Clock ClockProvider
}
```

JWT Processor 的统一配置。零值字段会在 `New()` 中自动填充默认值（通过 `normalizeConfig`）。

:::tip 自动填充规则
- `RateLimitRate`、`RateLimitWindow` 仅在 `EnableRateLimit = true` 时填充
- `EnableAutoCleanup` 仅在使用自定义 `Store` 时生效；内置存储恒为开启
- `SecretKey`、`SigningKey`、`VerificationKey` 不会自动填充，必须手动设置
- 显式提供 `RateLimiter` 视为明确意图，无视 `EnableRateLimit` 开关始终生效
:::

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `SecretKey` | `string` | — | HMAC 密钥（至少 32 字节） |
| `SigningKey` | `any` | — | 非对称算法私钥 (`*rsa.PrivateKey` 或 `*ecdsa.PrivateKey`) |
| `VerificationKey` | `any` | — | 非对称算法公钥（可选，默认使用 SigningKey） |
| `SigningMethod` | `SigningMethod` | `HS256` | 签名算法 |
| `AccessTokenTTL` | `time.Duration` | `15m` | 访问令牌有效期；Claims 的 `ExpiresAt` 为零值时才由它派生 |
| `RefreshTokenTTL` | `time.Duration` | `168h` | 刷新令牌有效期；Claims 的 `ExpiresAt` 为零值时才由它派生 |
| `Issuer` | `string` | `"jwt-service"` | 签发者；仅当 Claims 的 `Issuer` 为零值时写入（调用方显式赋值优先） |
| `ExpectedAudience` | `string` | — | 期望的受众（可选） |
| `RequireExpiration` | `bool` | `false` | 为 `true` 时拒绝缺少 `exp` 声明的令牌（返回 [`ErrExpirationRequired`](./errors#哨兵错误)） |
| `RejectRefreshAsAccess` | `bool` | `false` | （v1.2.3 新增）为 `true` 时 [`Parse`](./processor#parse) / [`ParseInto`](./processor#parseinto) 拒绝 `token_type=refresh` 的令牌被用作访问令牌（返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)）；`Refresh` / `RefreshInto` 不受影响 |
| `RotateRefreshTokens` | `bool` | `false` | （v1.2.3 新增）为 `true` 时 `Refresh` / `RefreshInto` 在签发新令牌前先按 jti 吊销传入的刷新令牌，实现一次性使用。该路径 fail-closed：底层存储返回错误时返回 [`ErrRefreshRotationFailed`](./errors#哨兵错误)，缺 jti 返回 `ErrTokenMissingID`。详见[令牌刷新与轮换](../guides/token-refresh#一次性轮换) |
| `ClockSkew` | `time.Duration` | `0` | exp/nbf 的时钟偏移容忍度（容忍签发方与验证方的时钟漂移）；负值会被 `Validate()` 拒绝 |
| `Blacklist` | `BlacklistConfig` | — | 黑名单配置 |
| `EnableRateLimit` | `bool` | `false` | 启用限流 |
| `RateLimitRate` | `int` | `100` | 窗口内最大请求数 |
| `RateLimitWindow` | `time.Duration` | `1m` | 限流窗口 |
| `RateLimiter` | `RateLimitProvider` | — | 自定义限流器（可选） |
| `Clock` | `ClockProvider` | `SystemClock{}` | 时钟提供者 |

:::warning 注册声明覆盖规则
库只补零值：调用方显式赋值的 `iss`/`exp`/`iat`/`jti` 会原样使用，覆盖配置与 TTL。

`Issuer` 被 Claims 中显式设置的值覆盖时，`Parse` 仍按 `Config.Issuer` 校验。此时自签自验会失败，返回 `ErrTokenInvalidIssuer`。`ExpiresAt` 同理：显式设置的过期时间会绕过 `AccessTokenTTL` / `RefreshTokenTTL` 策略。需要 TTL 策略生效时，不要预先填充 `ExpiresAt`；需要自签自验通过时，`Issuer` 应与 `Config.Issuer` 保持一致。
:::

:::warning 所有权与级联关闭
`Processor.Close` 会关闭通过 `Config.RateLimiter` 注入的限流器，也会关闭 `BlacklistConfig.Store` 提供的自定义黑名单存储。

不要在生命周期可能互相超越的多个 Processor 之间共享同一实例。其中一个 Processor 关闭共享限流器后，其 `Allow` 恒返回 `false`，其余实例的令牌创建将以 `ErrRateLimitExceeded` 失败。
:::

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Validate` | `func (c *Config) Validate() error` | 验证配置有效性 |

`New()` 先补零值默认（`normalizeConfig`）再校验。直接调用 `Validate()` 时零值字段不会被补全，同一配置可能 `Validate()` 失败而 `New()` 通过。需要与 `New()` 一致的行为时，从 `DefaultConfig()` 出发。

`Validate()` 检查项：

| 检查项 | 说明 |
|--------|------|
| 签名密钥 | HMAC 需 SecretKey ≥32 字节且非弱密钥；RSA/ECDSA 需正确类型的 SigningKey；ECDSA 需曲线匹配；VerificationKey 需匹配算法公钥类型 |
| TTL 有效性 | `AccessTokenTTL` 和 `RefreshTokenTTL` 必须为正数 |
| TTL 顺序 | `AccessTokenTTL` 必须小于 `RefreshTokenTTL` |
| ClockSkew | `ClockSkew` 不可为负值 |
| 签名算法 | 必须为内置支持的 12 种算法之一 |
| 限流参数 | `EnableRateLimit` 为真时，`RateLimitRate` 与 `RateLimitWindow` 为负数返回 `ErrInvalidConfig` |
| 限流上限 | `EnableRateLimit` 为真时，`RateLimitRate > 1000000` 返回 `ErrInvalidConfig` |
| 限流窗口上限 | `EnableRateLimit` 为真时，`RateLimitWindow > 30 天` 返回 `ErrInvalidConfig` |
| 黑名单 | 内置存储时 MaxSize 和 CleanupInterval 必须为正数 |

---

## BlacklistConfig

```go
type BlacklistConfig struct {
    CleanupInterval   time.Duration
    MaxSize           int
    EnableAutoCleanup bool
    Store             BlacklistStore
}
```

黑名单配置。`BlacklistConfig.Store` 提供自定义存储后端（如 Redis）。

设置后 `CleanupInterval` 与 `MaxSize` 被忽略，清理与容量由后端自行负责。`Processor.Close` 会级联关闭该存储（见上方所有权说明）。`EnableAutoCleanup` 仅在使用自定义 `Store` 时生效，内置存储恒为开启。

:::warning 内置存储的容量行为
内置存储满时先清理已过期条目，再驱逐最早过期的约 10%，然后直接写入——`Add` 不会因容量满而失败。

代价是随驱逐丢弃的吊销记录会静默失效（fail-open），被吊销的令牌恢复可用。调大 `MaxSize` 可压低 fail-open 概率。
:::

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `CleanupInterval` | `time.Duration` | `5m` | 过期清理间隔（仅内置存储时有效） |
| `MaxSize` | `int` | `100000` | 内存存储最大条目数（仅内置存储时有效；满时驱逐最早过期的条目，见上方容量行为） |
| `EnableAutoCleanup` | `bool` | `true` | 自动清理过期条目（仅在使用自定义 `Store` 时生效；内置存储恒为开启） |
| `Store` | `BlacklistStore` | — | 自定义存储后端（设置后其他字段被忽略） |
