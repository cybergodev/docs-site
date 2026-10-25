---
sidebar_label: "常见问题"
title: "常见问题 - CyberGo JWT | 高频疑问速查"
description: "CyberGo JWT 常见问题解答：HMAC 与 RSA/ECDSA 算法选型及密钥要求、时钟偏移与强制过期、刷新令牌轮换模式选择、黑名单条目 TTL 与共享存储、多实例部署失效原因，以及哨兵错误与字段校验失败的定位方式。"
sidebar_position: 1
---

# 常见问题

## HMAC、RSA 和 ECDSA 怎么选？

**答：** 按架构与性能需求选。单体应用或同信任域微服务用 HMAC：对称密钥、速度最快，密钥需 ≥ 32 字节。跨服务验证（验证端不持有私钥）用 RSA、RSA-PSS 或 ECDSA。

其中 RSA-PSS 安全性优于 RSA PKCS#1 v1.5，且与 RSA **共用同一套密钥**，新项目优先选它。对签名长度或密钥长度敏感（签名约 64 字节）时选 ECDSA。对比表与决策图见[签名算法](../guides/signing-algorithms#如何选择)。

## HMAC 密钥有什么要求？

**答：** 两项检查都在 `jwt.New` 初始化时执行，不合法返回 `ErrInvalidSecretKey`。

一是长度 ≥ 32 字节。二是熵值：全部相同字符、重复短模式、连续递增序列、常见弱口令及其变体均被拒绝。生产环境用密码学安全随机源生成：

```go
raw := make([]byte, 32)
_, _ = rand.Read(raw) // crypto/rand
secret := base64.StdEncoding.EncodeToString(raw)
```

详见[密钥要求](../guides/signing-algorithms#密钥要求)。

## ES512 为什么初始化时报曲线错误？

**答：** `ES512` 对应的曲线是 **P-521**，不是 P-512。Go 标准库不存在 `P512`，最高位曲线就是 `elliptic.P521()`。曲线与算法不匹配时返回 `ErrInvalidSecretKey`。对应关系：ES256 → P-256、ES384 → P-384、ES512 → P-521。详见[曲线匹配](../guides/signing-algorithms#曲线匹配)。

## 服务器之间有时钟偏差怎么办？

**答：** 设置 `ClockSkew`（建议 30s–60s）为 `exp` 与 `nbf` 校验提供对称的宽容窗口。令牌要晚于 `exp + ClockSkew` 才被视为过期，早于 `nbf - ClockSkew` 才被视为生效。偏移只放宽、不收紧。

零值等价于 RFC 7519 严格语义，且不允许为负数（返回 `ErrInvalidConfig`）。遇到 `ErrTokenNotValidYet` 时优先检查这一项。详见[时钟偏移](../guides/configuration#时钟偏移-clockskew)。

## 如何拒绝没有 exp 声明的令牌？

**答：** 默认情况下没有 `exp` 的令牌不会过期（RFC 7519 中合法）。设置 `RequireExpiration = true` 后，验证时拒绝缺少 `exp` 的令牌（返回 `ErrExpirationRequired`）。

本库签发的令牌总是携带 `exp`（零值时由 TTL 派生），因此该开关主要影响外部签发方或旧令牌，生产环境建议启用。另需注意库只补零值：调用方显式赋值的 `exp` 会原样使用，详见[强制过期](../guides/configuration#强制过期-requireexpiration)。

## Refresh 之后原刷新令牌还有效吗？

**答：** 默认**有效**：`Refresh` 不会自动吊销原刷新令牌，它在过期或被显式 `Revoke` 前可反复使用。需要一次性使用语义时启用 `Config.RotateRefreshTokens`（v1.2.3+），详见[令牌刷新与轮换](../guides/token-refresh#轮换策略)。

## 重用模式和一次性轮换怎么选？

**答：** 按安全要求选。重用模式零额外代码、用户体验好（无需频繁重登），但泄露的刷新令牌可反复使用。一次性轮换只需打开 `RotateRefreshTokens`，每次刷新后旧令牌立即失效，泄露检测也更直接。

攻击者使用已吊销令牌时 `Refresh` 返回 `ErrTokenRevoked`，可据此强制重新认证。轮换收窄但不消除并发重放窗口，严格单次使用需自定义 `BlacklistStore` 实现原子 check-and-add。对比表见[策略对比](../guides/token-refresh#策略对比)。

## 用访问令牌去刷新为什么被拒绝？

**答：** `Refresh` 与 `RefreshInto` 会拒绝 access 类型的令牌（返回 `ErrTokenTypeMismatch`），防止访问令牌被用于获取新令牌。

反过来，刷新令牌被用作访问令牌时默认**不**报错，以兼容旧版签发的令牌。需要拒绝时启用 `Config.RejectRefreshAsAccess`（v1.2.3+），此后 `Parse` 与 `ParseInto` 对 refresh 类型令牌同样返回 `ErrTokenTypeMismatch`。详见[类型安全](../guides/token-refresh#类型安全)。

## 内置黑名单和 Redis 等外部存储怎么选？

**答：** 单实例部署用内置内存存储，默认启用、零配置，`MaxSize` 为 100000 且自动清理。多实例部署**必须**改用共享存储：实现 `BlacklistStore` 接口（`Add`/`Contains`/`Close`）并注入 `cfg.Blacklist.Store`。

以 Redis 为例，用 `time.Until(expiresAt)` 作 TTL，令牌过期后自动移除。注意 `CleanupInterval` 与 `MaxSize` 只在内置存储生效，`EnableAutoCleanup` 只在自定义存储时生效。清理与容量由后端自行负责，详见[自定义存储后端](../guides/blacklist#自定义存储后端)。

## Revoke 为什么必须传完整的令牌字符串？

**答：** `Revoke` 并非直接写入传入字符串，而是先执行安全验证链：验签 → 校验 `iss`/`aud` → 提取 `jti` → 按 `exp` 计算 TTL 写入存储。

若直接信任调用者传入的 `jti`，恶意调用者就能伪造 `jti`，把**任意合法用户的令牌**拉黑（拒绝服务攻击）。强制验签保证只有持有真实令牌的人才能吊销它。

`Revoke` 与 `IsRevoked` 都不检查 `exp`/`nbf`，因此已过期的令牌仍可补吊销（事后审计）。详见[工作原理](../guides/blacklist#工作原理)。

## 黑名单条目会无限累积吗？

**答：** 不会。条目存活时间取令牌的剩余有效期，但下限 7 天、上限 30 天。下限保证短有效期令牌的吊销记录不会过早消失；上限防止超长 `exp` 长期占用存储。容量按「峰值吊销量 × 条目存活时间」估算：普通访问令牌按下限 7 天，长 TTL 刷新令牌按剩余有效期（上限 30 天）。

内置存储满时先清理已过期条目，再驱逐最早过期的约 10%，然后直接写入，`Add` 不会因容量满而失败。代价是被驱逐丢弃的吊销记录会静默失效（fail-open），被吊销的令牌恢复可用。详见[黑名单条目 TTL](../guides/blacklist#黑名单条目-ttl)。

## 多实例部署时黑名单和限流为什么不生效？

**答：** 内置黑名单与内置 `RateLimiter` 都是**进程内**的。多实例各自独立存储与计数，在某实例上吊销的令牌换个实例仍会放行。解决方案都是注入共享后端。

黑名单实现 `BlacklistStore` 对接 Redis/数据库；限流实现 `RateLimitProvider`（`Allow`/`Reset`/`Close`）对接 Redis 分布式计数。详见[生产环境建议](../guides/blacklist#生产环境建议)与[自定义限流器](../guides/rate-limiting#自定义限流器)。

## 20 个哨兵错误怎么用 errors.Is 匹配？

**答：** 全部错误支持 `errors.Is()` 判断（能穿透包装），不要用 `err ==` 或字符串匹配：

```go
claims, err := processor.Parse(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 引导客户端刷新令牌
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 已吊销，拒绝访问
    default:
        // 其他错误
    }
}
```

按阶段记忆：配置（3 个，`New()` 返回）、令牌操作（13 个）、限流与黑名单（2 个）、生命周期（2 个）。完整清单与 HTTP 状态码映射见[错误分类](../guides/error-handling#错误分类)。

## Claims 具体哪个字段校验失败怎么看？

**答：** 字段级校验失败（长度超限、注入检测等）仅出现在**创建**路径，返回 `*ValidationError`，用 `errors.As` 提取 `Field` 与 `Message`：

```go
token, err := processor.Create(claims)
if err != nil {
    var ve *jwt.ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("字段: %s, 原因: %s\n", ve.Field, ve.Message)
        // 字段：UserID, 原因：suspicious pattern detected
    }
}
```

先用 `errors.Is(err, jwt.ErrInvalidClaims)` 定位类别（`Create` 路径会包装它），再用 `errors.As` 提取细节。验证路径只调用 `Validate()`，不重复深度校验。详见[错误包装链](../guides/error-handling#错误包装链)。

## 更多资源

- [快速开始](../getting-started/) — 5 分钟完成签发/验证/刷新/吊销
- [核心概念](../getting-started/concepts) — 双层令牌与 Claims 结构
- [配置详解](../guides/configuration) — 时钟偏移、强制过期与校验矩阵
- [错误参考](../api-reference/errors) — 全部哨兵错误清单
- [高级示例](../examples/advanced) — 密钥分离与 Redis 黑名单
