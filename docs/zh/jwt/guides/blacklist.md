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
Validate(token) → 验证签名 → 检查黑名单 → 返回结果
```

## 内置内存存储

默认使用内存存储，开箱即用：

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 黑名单已自动启用，使用 DefaultBlacklistConfig()
```

### 配置项

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
_, _, err = processor.Validate(accessToken)
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

## 生产环境建议

:::warning 注意事项
- 内置内存存储不跨进程共享，多实例部署时需使用外部存储
- `MaxSize` 达到上限后，新吊销的令牌会挤掉最早的条目
- 自定义存储实现应处理网络超时和重试
:::

## 下一步

- [API 参考 → BlacklistStore](../api-reference/interfaces#blackliststore) — 接口定义
- [API 参考 → BlacklistConfig](../api-reference/config#blacklistconfig) — 配置字段
- [API 参考 → Revoke](../api-reference/processor#revoke) — 吊销方法
- [高级示例](../examples/advanced) — Redis 黑名单示例
