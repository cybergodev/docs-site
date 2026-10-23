---
sidebar_label: "Config"
title: "Config - CyberGo JWT | 统一配置说明"
description: "Config 是 CyberGo JWT 统一配置：签名密钥与算法、访问与刷新令牌 TTL、签发者、期望受众、时钟偏移、黑名单与速率限制等全部字段、默认值、自动填充规则与 Validate 校验逻辑。"
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
- 内置黑名单存储的 `EnableAutoCleanup` 始终强制为 `true`（防止无限增长）
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
| `AccessTokenTTL` | `time.Duration` | `15m` | 访问令牌有效期 |
| `RefreshTokenTTL` | `time.Duration` | `168h` | 刷新令牌有效期 |
| `Issuer` | `string` | `"jwt-service"` | 签发者 |
| `ExpectedAudience` | `string` | — | 期望的受众（可选） |
| `RequireExpiration` | `bool` | `false` | 为 `true` 时拒绝缺少 `exp` 声明的令牌（返回 [`ErrExpirationRequired`](./errors#哨兵错误)） |
| `RejectRefreshAsAccess` | `bool` | `false` | （v1.2.3 新增）为 `true` 时 [`Parse`](./processor#parse) / [`ParseInto`](./processor#parseinto) 拒绝 `token_type=refresh` 的令牌被用作访问令牌（返回 [`ErrTokenTypeMismatch`](./errors#哨兵错误)）；`Refresh` / `RefreshInto` 不受影响 |
| `RotateRefreshTokens` | `bool` | `false` | （v1.2.3 新增）为 `true` 时 `Refresh` / `RefreshInto` 在签发新令牌前先按 jti 吊销传入的刷新令牌，实现一次性使用（fail-closed：吊销失败返回 [`ErrRefreshRotationFailed`](./errors#哨兵错误)，缺 jti 返回 `ErrTokenMissingID`）。详见[令牌刷新与轮换](../guides/token-refresh#一次性轮换) |
| `ClockSkew` | `time.Duration` | `0` | exp/nbf 的时钟偏移容忍度（容忍签发方与验证方的时钟漂移）；负值会被 `Validate()` 拒绝 |
| `Blacklist` | `BlacklistConfig` | — | 黑名单配置 |
| `EnableRateLimit` | `bool` | `false` | 启用限流 |
| `RateLimitRate` | `int` | `100` | 窗口内最大请求数 |
| `RateLimitWindow` | `time.Duration` | `1m` | 限流窗口 |
| `RateLimiter` | `RateLimitProvider` | — | 自定义限流器（可选） |
| `Clock` | `ClockProvider` | `SystemClock{}` | 时钟提供者 |

:::warning 所有权与级联关闭
`Processor.Close` 会关闭通过 `Config.RateLimiter` 注入的限流器，也会关闭 `BlacklistConfig.Store` 提供的自定义黑名单存储。不要在生命周期可能互相超越的多个 Processor 之间共享同一实例——其中一个 Processor 关闭共享限流器后，其 `Allow` 恒返回 `false`，其余实例的令牌创建将以 `ErrRateLimitExceeded` 失败。
:::

### 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `Validate` | `func (c *Config) Validate() error` | 验证配置有效性 |

`Validate()` 检查项：

| 检查项 | 说明 |
|--------|------|
| 签名密钥 | HMAC 需 SecretKey ≥32 字节且非弱密钥；RSA/ECDSA 需正确类型的 SigningKey；ECDSA 需曲线匹配；VerificationKey 需匹配算法公钥类型 |
| TTL 有效性 | `AccessTokenTTL` 和 `RefreshTokenTTL` 必须为正数 |
| TTL 顺序 | `AccessTokenTTL` 必须小于 `RefreshTokenTTL` |
| ClockSkew | `ClockSkew` 不可为负值 |
| 签名算法 | 必须为内置支持的 12 种算法之一 |
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

黑名单配置。`BlacklistConfig.Store` 提供自定义存储后端（如 Redis），设置后 `CleanupInterval`、`MaxSize`、`EnableAutoCleanup` 均被忽略；`Processor.Close` 会级联关闭该存储（见上方所有权说明）。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `CleanupInterval` | `time.Duration` | `5m` | 过期清理间隔（仅内置存储时有效） |
| `MaxSize` | `int` | `100000` | 内存存储最大条目数（仅内置存储时有效） |
| `EnableAutoCleanup` | `bool` | `true` | 自动清理过期条目（仅内置存储时有效） |
| `Store` | `BlacklistStore` | — | 自定义存储后端（设置后其他字段被忽略） |
