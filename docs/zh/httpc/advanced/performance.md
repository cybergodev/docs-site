---
title: "性能优化 - HTTPC"
description: "HTTPC 性能优化指南：Default/Secure/Performance/Minimal 四种预设对比与场景选型、基于预设微调连接池与超时参数、内置对象池自动管理减少 GC 压力、高并发请求模式、性能基准测试方法与常见性能反模式分析。"
---

# 性能优化

## 预设配置对比

| 指标 | Default | Secure | Performance | Minimal |
|------|---------|--------|-------------|---------|
| Request 超时 | 180s | 15s | 60s | 180s |
| MaxIdleConns | 50 | 20 | 100 | 10 |
| MaxConnsPerHost | 10 | 5 | 20 | 2 |
| MaxRetries | 3 | 1 | 3 | 0 |
| MaxResponseBodySize | 10MB | 5MB | 50MB | 1MB |
| HTTP/2 | 开启 | 开启 | 开启 | 开启 |
| Cookies | 关闭 | 关闭 | 开启 | 关闭 |
| SSRF 防护 | 开启 | 开启 | 开启 | 开启 |
| FollowRedirects | 开启 | 关闭 | 开启 | 关闭 |

## 场景选型

| 场景 | 推荐预设 | 调整建议 |
|------|----------|----------|
| 通用 Web 服务 | Default | - |
| 处理用户提供的 URL | Secure | - |
| 内部微服务高并发 | Performance | 调大 MaxIdleConns |
| 一次性脚本 | Minimal | - |
| 文件下载服务 | Performance | 增大 MaxResponseBodySize |
| 金融/医疗 API | Secure + 自定义 | 增加审计中间件 |

```go
// 高吞吐场景
client, _ := httpc.New(httpc.PerformanceConfig())

// 在预设基础上微调
cfg := httpc.PerformanceConfig()
cfg.Timeouts.Request = 120 * time.Second
cfg.Connection.MaxIdleConns = 200
client, _ := httpc.New(cfg)
```

## 对象池复用

HTTPC 内置 Result 对象池，自动管理对象生命周期：

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result 对象由内置对象池自动管理，GC 自动回收
```

:::tip
高并发场景中，对象池复用可显著减少 GC 压力。
:::

## 性能反模式

| 反模式 | 原因 | 正确做法 |
|--------|------|----------|
| 每个请求创建客户端 | 连接无法复用 | 全局复用客户端 |
| 过大 MaxResponseBodySize | 内存占用 | 合理设置限制 |
| 热路径中用 result.String() | 字符串构建开销 | 直接用 Body() |

## 下一步

- [连接池与代理](./connection-pool) — 连接池参数选择、代理和 DoH 配置
- [错误处理](./error-handling) — 超时分层策略
- [安全概述](../security/) — 安全与性能的平衡
