---
title: "签名算法 - CyberGo JWT | 算法对比与选型"
description: "签名算法指南：对比 HMAC、RSA、RSA-PSS 与 ECDSA 四类 12 种算法的密钥类型、生成方式、签名验证性能、签名长度与架构耦合度，给出选型决策与密钥管理安全实践。"
---

# 签名算法

CyberGo JWT 支持 4 类共 12 种签名算法，覆盖从单体应用到微服务架构的各种场景。

## 算法一览

| 类型 | 算法 | 密钥类型 | 适用场景 |
|------|------|----------|----------|
| HMAC | HS256 / HS384 / HS512 | 对称密钥 | 单体应用、简单服务 |
| RSA | RS256 / RS384 / RS512 | 公钥/私钥 | 微服务、多服务验证 |
| RSA-PSS | PS256 / PS384 / PS512 | 公钥/私钥 | 微服务（推荐替代 RSA） |
| ECDSA | ES256 / ES384 / ES512 | 公钥/私钥 | 高性能微服务 |

## HMAC（对称密钥）

HMAC 使用同一密钥签名和验证，是最简单的方案。

### 密钥要求

- 最少 32 字节
- 库会自动检测弱密钥（如纯重复字符、简单递增序列等）

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // 默认值，可省略
```

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodHS256` | HMAC-SHA256 | 推荐，性能与安全均衡 |
| `SigningMethodHS384` | HMAC-SHA384 | 更高安全性 |
| `SigningMethodHS512` | HMAC-SHA512 | 最高安全性 |

:::tip 推荐
大多数场景使用 `HS256` 即可。密钥建议使用密码学安全随机生成，长度至少 32 字节。
:::

## RSA（非对称密钥）

RSA 使用私钥签名、公钥验证。适用于验证端不需要持有私钥的场景。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选）
```

:::tip 验证密钥
`VerificationKey` 可选。不设置时，库会从 `SigningKey` 提取公钥进行验证。
:::

### 密钥生成

```go
// 生成 2048 位 RSA 密钥对
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodRS256` | RSA-SHA256 | 推荐 |
| `SigningMethodRS384` | RSA-SHA384 | 更高安全性 |
| `SigningMethodRS512` | RSA-SHA512 | 最高安全性 |

## RSA-PSS（非对称密钥，推荐替代 RSA）

RSA-PSS 是 RSA 的改进签名方案，使用概率签名方案（PSS）填充，安全性优于 PKCS#1 v1.5。密钥与 RSA 相同。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey（与 RSA 共用密钥）
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey（可选）
```

:::tip 推荐替代
RSA-PSS 比 RSA PKCS#1 v1.5 更安全，建议新项目优先使用 RSA-PSS 算法。密钥与 RSA 完全相同，无需额外生成。
:::

### 算法选择

| 常量 | 算法 | 说明 |
|------|------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 | 推荐 |
| `SigningMethodPS384` | RSA-PSS-SHA384 | 更高安全性 |
| `SigningMethodPS512` | RSA-PSS-SHA512 | 最高安全性 |

## ECDSA（椭圆曲线）

ECDSA 同样是非对称算法，但密钥更短、性能更好。

### 使用方法

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey（可选）
```

### 密钥生成

```go
// 生成 P-256 曲线密钥对
privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 算法选择

| 常量 | 算法 | 曲线 | 说明 |
|------|------|------|------|
| `SigningMethodES256` | ECDSA-SHA256 | P-256 | 推荐 |
| `SigningMethodES384` | ECDSA-SHA384 | P-384 | 更高安全性 |
| `SigningMethodES512` | ECDSA-SHA512 | P-521 | 最高安全性 |

## 如何选择

```text
单体应用 ──────────→ HMAC
微服务（同信任域） ──→ HMAC
微服务（跨服务验证）→ RSA、RSA-PSS 或 ECDSA
安全性优先 ────────→ RSA-PSS（替代 RSA）
高性能要求 ────────→ ECDSA
密钥长度敏感 ──────→ ECDSA
```

| 考量因素 | HMAC | RSA | RSA-PSS | ECDSA |
|----------|------|-----|---------|-------|
| 签名速度 | 快 | 较慢 | 较慢 | 快 |
| 验证速度 | 快 | 快 | 快 | 快 |
| 密钥长度 | 32+ 字节 | 2048+ 位 | 2048+ 位 | 256+ 位 |
| 签名长度 | 固定 | 长（~256 字节） | 长（~256 字节） | 短（~64 字节） |
| 架构耦合 | 紧耦合 | 松耦合 | 松耦合 | 松耦合 |
| 安全性 | 高 | 高 | 更高 | 高 |

## 安全注意事项

:::danger 禁止事项
- 不要在代码中硬编码密钥
- 不要使用弱密钥（纯数字、重复字符等）
- 不要使用 `none` 算法（本库自动拒绝）
- HMAC 密钥不要短于 32 字节
:::

:::tip 最佳实践
- 使用环境变量或密钥管理服务存储密钥
- 定期轮换签名密钥
- 生产环境建议使用 RSA 或 ECDSA
- RSA 密钥建议 2048 位以上
:::

## 下一步

- [自定义 Claims](./custom-claims) — 定义业务字段
- [API 参考 → 包函数](../api-reference/functions) — 完整 API 签名
- [基础示例](../examples/basic) — HMAC 完整示例
