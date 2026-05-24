---
title: "Config - JWT API 参考"
description: "CyberGo JWT Config API 参考：Config 统一配置项（签名密钥、算法、TTL、Issuer）与 BlacklistConfig 黑名单配置的字段说明、默认值及验证方法。"
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL    time.Duration
    RefreshTokenTTL   time.Duration
    Issuer            string
    ExpectedAudience  string

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
| `Blacklist` | `BlacklistConfig` | — | 黑名单配置 |
| `EnableRateLimit` | `bool` | `false` | 启用限流 |
| `RateLimitRate` | `int` | `100` | 窗口内最大请求数 |
| `RateLimitWindow` | `time.Duration` | `1m` | 限流窗口 |
| `RateLimiter` | `RateLimitProvider` | — | 自定义限流器（可选） |
| `Clock` | `ClockProvider` | `SystemClock{}` | 时钟提供者 |

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

黑名单配置。

<Badge type="info" text="struct" />

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `CleanupInterval` | `time.Duration` | `5m` | 过期清理间隔（仅内置存储时有效） |
| `MaxSize` | `int` | `100000` | 内存存储最大条目数（仅内置存储时有效） |
| `EnableAutoCleanup` | `bool` | `true` | 自动清理过期条目（仅内置存储时有效） |
| `Store` | `BlacklistStore` | — | 自定义存储后端（设置后其他字段被忽略） |
