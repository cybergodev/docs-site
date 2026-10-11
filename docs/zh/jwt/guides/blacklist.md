---
sidebar_label: "令牌黑名单"
title: "令牌黑名单 - CyberGo JWT | 吊销与外部存储"
description: "令牌黑名单指南：讲解内置内存存储配置与过期清理机制，用 Revoke 与 IsRevoked 吊销令牌，并实现 BlacklistStore 接口对接 Redis 等外部存储，附带多实例部署最佳实践。"
sidebar_position: 30
---

# 令牌黑名单

黑名单用于在令牌过期前主动使其失效，适用于用户登出、密码修改、权限变更等场景。

## 工作原理

```text
Revoke(token) → 提取 jti + exp → 写入 BlacklistStore
Parse(token) → 验证签名 → 检查黑名单 → 返回结果
```

`Revoke` 并非简单地把传入字符串写入黑名单，而是先执行一条**安全验证链**，确保只有真实签发的令牌才会被吊销：

1. **验证签名** —— 用处理器配置的密钥重新校验令牌签名，拒绝任何被篡改或伪造的令牌
2. **校验签发者与受众** —— 检查 `iss`、`aud` 是否与处理器配置匹配，防止跨域误吊销
3. **提取 jti** —— 取出令牌唯一 ID（`jti`）作为黑名单键；若令牌缺少 `jti`，返回 `ErrTokenMissingID`
4. **计算 TTL 并写入存储** —— 根据令牌 `exp` 算出条目存活时间（见下节），将 jti 写入 `BlacklistStore`

:::tip 签名验证是关键安全设计
为什么 `Revoke` 要先验签再吊销？假如直接信任调用者传入的 `jti`，恶意调用者就能用一个伪造的 `jti` 把**任意合法用户的令牌**拉黑，实施拒绝服务攻击。强制签名验证保证了「只有持有真实令牌的人才能吊销它」——这也意味着调用 `Revoke` 时必须传入完整的令牌字符串，而非裸 `jti`。
:::

`Revoke` 与 `IsRevoked` **都不检查 `exp`/`nbf`**：即便令牌已过期，仍可被吊销或查询吊销状态。这样设计是为了让审计、事后补偿吊销等场景能覆盖历史令牌。

## 黑名单条目 TTL

黑名单条目不会永久存在。`Revoke` 在写入时会根据令牌的 `exp` 计算条目的存活时间（TTL），令牌到期后条目随之失效并被清理。三种情况如下：

- **令牌有 `exp` 声明** —— TTL 等于 `exp` 对应的剩余时间，条目与令牌同步失效。这是最常见的情形。
- **令牌无 `exp` 声明** —— TTL 默认为 **7 天**，避免无过期令牌永久占用条目。
- **TTL 上限为 30 天** —— 即便令牌的 `exp` 是 100 年后，黑名单条目最多也只能存活 30 天。

:::warning 30 天上限是 DoS 防护
30 天封顶是一道关键防线。若没有上限，攻击者可以构造超长 `exp` 的令牌（或滥用合法的长效令牌）批量吊销，把黑名单存储撑爆、耗尽内存。有了 30 天上限，任何单条记录的存活时间都有上界，存储规模始终可控。
:::

此外，**已过期的令牌仍可吊销**：因为 `Revoke` 不检查 `exp`/`nbf`，你可以在令牌过期后补吊销它（例如事后审计发现风险）。这类条目的 TTL 取默认 7 天，随后由后台清理机制回收。

## 内置内存存储

默认使用内存存储，开箱即用：

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 黑名单已自动启用，使用 DefaultBlacklistConfig()
```

### 配置项

以下默认值来自 [`DefaultBlacklistConfig()`](../api-reference/functions#defaultblacklistconfig)，可按需覆盖。

```go
cfg.Blacklist.CleanupInterval = 5 * time.Minute  // 清理间隔
cfg.Blacklist.MaxSize = 100000                     // 最大条目数
cfg.Blacklist.EnableAutoCleanup = true             // 自动清理
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `CleanupInterval` | `5m` | 过期条目清理间隔 |
| `MaxSize` | `100000` | 最大条目数 |
| `EnableAutoCleanup` | `true` | 自动清理（强制为 true） |

:::tip 自动清理
内置存储的 `EnableAutoCleanup` 始终强制为 `true`，防止内存无限增长。
:::

### 驱逐行为

当条目数达到 `MaxSize` 时，写入新条目会触发**驱逐**，按以下顺序腾出空间：

| 步骤 | 行为 | 说明 |
|------|------|------|
| 1 | 清理过期条目 | 先删除所有已过期的记录 |
| 2 | 驱逐最早过期的条目 | 若仍满，按 `exp` 升序驱逐约 10%（至少 1 个）最早过期的条目 |
| 3 | 拒绝写入 | 若仍满，`Add` 返回错误，`Revoke` 据此返回失败 |

可见 `MaxSize` 不是「写满即停」，而会在压力下优先淘汰最该消失的条目（已过期的、最快过期的）。但极端情况下仍可能吊销失败——因此生产环境建议根据峰值吊销量调大 `MaxSize`，或改用外部存储。

## 吊销令牌

```go
// 吊销
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 检查
revoked, err := processor.IsRevoked(accessToken)
fmt.Println("Revoked:", revoked) // true

// 已吊销的令牌验证会失败
_, err = processor.Parse(accessToken)
// err → jwt.ErrTokenRevoked
```

## 自定义存储后端

实现 [`BlacklistStore`](../api-reference/interfaces#blackliststore) 接口对接外部存储（Redis、数据库等）：

```go
type BlacklistStore interface {
    Add(tokenID string, expiresAt time.Time) error
    Contains(tokenID string) (bool, error)
    Close() error
}
```

### Redis 示例

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil // 已过期的令牌无需存储
    }
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", ttl).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}
```

使用自定义存储：

```go
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

:::tip TTL 优化
使用 `time.Until(expiresAt)` 作为 Redis TTL，令牌过期后自动从黑名单中移除，无需额外清理。
:::

### Close() 的职责

`Processor.Close()` 在关闭时会**级联调用** `BlacklistStore.Close()`——你无需手动关闭黑名单存储，关闭处理器即可。自定义存储的 `Close()` 实现应释放所有底层资源：

- 关闭 Redis / 数据库连接
- 停止后台 goroutine 与 ticker
- 释放文件句柄等

上方 Redis 示例中的 `s.client.Close()` 就完成了连接池的清理。`Close()` 应当**幂等**——重复调用不应报错（内置存储实现已遵循此约定，二次调用直接返回 `nil`）。

:::tip 自定义存储不受 CleanupInterval / MaxSize 约束
`BlacklistConfig` 的 `CleanupInterval`、`MaxSize`、`EnableAutoCleanup` **仅对内置内存存储有效**。一旦设置了 `Store` 字段改用自定义后端，这三个字段会被完全忽略——过期清理、容量上限等应由你的存储后端自行负责（如 Redis 的 TTL、数据库的定时任务）。
:::

## 生产环境建议

:::warning 多实例必须共享黑名单
内置内存存储**不跨进程**。若服务部署多个实例（Pod / 容器 / 服务器），在某实例上吊销的令牌在其他实例上仍会放行——用户登出后换个实例又被当作已登录。多实例场景必须使用 Redis、数据库等**共享存储**作为 `BlacklistStore`，保证所有实例读写同一份黑名单。
:::

:::tip 监控黑名单规模
黑名单会持续累积吊销记录，直到条目按 TTL 过期。建议监控存储大小（内存存储的条目数、Redis 的键数量）并对异常增长告警——突增往往意味着批量吊销（如安全事件）或 TTL 过长。把 `MaxSize` 设为略高于峰值吊销量，可避免触发驱逐导致吊销失败。
:::

:::tip 短 TTL 令牌可能不需要黑名单
若访问令牌本身有效期很短（例如 15 分钟），用户「登出」时令牌几分钟后自然过期，通常**不值得**为它维护黑名单——黑名单的成本（存储 + 每次验证多一次查询）可能超过收益。黑名单更适合吊销**长效令牌**（长效 access token、refresh token）。短 TTL 场景可考虑仅对 refresh token 启用黑名单。
:::

:::warning 其他注意事项
- 自定义存储实现应处理网络超时和重试，避免外部存储抖动阻塞验证链路
- `MaxSize` 达到上限后，新吊销的令牌会驱逐最早的条目（见上文「内置内存存储」）
:::

## 下一步

- [API 参考 → BlacklistStore](../api-reference/interfaces#blackliststore) — 接口定义
- [API 参考 → BlacklistConfig](../api-reference/config#blacklistconfig) — 配置字段
- [API 参考 → Revoke](../api-reference/processor#revoke) — 吊销方法
- [高级示例](../examples/advanced) — Redis 黑名单示例
- [API 参考 → DefaultBlacklistConfig](../api-reference/functions#defaultblacklistconfig) — 黑名单默认配置
