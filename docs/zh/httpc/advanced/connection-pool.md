---
title: 连接池与代理 - HTTPC
description: HTTPC 连接池与代理配置指南，详解连接池参数调优、HTTP 与 SOCKS5 代理、DoH 自定义解析器与空闲连接管理策略。
---

# 连接池与代理

## 连接池配置

连接池是 HTTP 客户端性能的关键因素。HTTPC 使用 `ConnectionConfig` 管理连接池。

```go
cfg := httpc.DefaultConfig()

// 连接池参数
cfg.Connection.MaxIdleConns = 100         // 全局最大空闲连接
cfg.Connection.MaxConnsPerHost = 20       // 每主机最大连接数
cfg.Timeouts.IdleConn = 120 * time.Second // 空闲连接保持时间
```

### 参数说明

| 参数 | 默认 | 说明 |
|------|------|------|
| `MaxIdleConns` | 50 | 全局最大空闲连接数 |
| `MaxConnsPerHost` | 10 | 每主机最大连接数（含活跃+空闲） |
| `IdleConn` | 90s | 空闲连接超时，超时后关闭 |
| `Dial` | 10s | 建立连接超时 |
| `TLSHandshake` | 10s | TLS 握手超时 |
| `ResponseHeader` | 0 | 禁用（使用 Request 超时） |

### 场景推荐

| 场景 | MaxIdleConns | MaxConnsPerHost | IdleConn |
|------|-------------|-----------------|----------|
| 高并发 API | 100 | 20 | 120s |
| 常规服务 | 50 | 10 | 90s |
| 低频请求 | 10 | 2 | 30s |
| 微服务内部 | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` 包含活跃连接和空闲连接。超过此限制的新请求会排队等待连接释放。
:::

## 代理配置

### 手动代理

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy.example.com:8080"

client, _ := httpc.New(cfg)
```

### 带认证的代理

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip
`Config.String()` 方法会自动脱敏代理 URL 中的用户名和密码。
:::

### SOCKS5 代理

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### 系统代理自动检测

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// 自动检测:
// - Windows: 注册表 Internet Settings
// - macOS: 系统偏好设置网络代理
// - Linux: 环境变量 HTTP_PROXY / HTTPS_PROXY
```

代理优先级：

1. `ProxyURL`（手动指定，最高优先级）
2. `EnableSystemProxy`（系统代理检测）
3. 直连（无代理）

## DNS-over-HTTPS

启用 DoH 减少 DNS 解析延迟和防止 DNS 劫持：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

默认 DoH 提供商（按优先级排列）：

| 提供商 | 地址 | 说明 |
|--------|------|------|
| Cloudflare | `1.1.1.1/dns-query` | 最快，隐私优先 |
| Google | `8.8.8.8/resolve` | 全球覆盖 |
| AliDNS | `223.5.5.5/resolve` | 中国区域优化 |

:::tip
DoH 启用后，DNS 解析结果会缓存 `DoHCacheTTL` 时间。如果所有 DoH 提供商不可用，会回退到系统 DNS。
:::

## HTTP/2

默认启用 HTTP/2（需要 TLS）：

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // 禁用 HTTP/2
```

HTTP/2 特性：
- 多路复用：单连接处理多个并发请求
- 头部压缩：减少重复头传输
- 服务端推送

## 对象池复用

```go
result, err := client.Get(url)
if err != nil {
    return err
}
defer httpc.ReleaseResult(result) // 归还到对象池
```

高并发场景中，`ReleaseResult` 可显著减少 GC 压力。

## 并发请求模式

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## 连接池常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 大量 TIME_WAIT | 空闲连接超时太短 | 增大 `IdleConn` 超时 |
| 连接被拒 | 每主机连接数不够 | 增大 `MaxConnsPerHost` |
| 请求排队等待 | 连接池太小 | 增大 `MaxIdleConns` |

完整的性能反模式和优化建议见 [性能优化](./performance)。

## 下一步

- [性能优化](./performance) - 性能调优指南
- [配置 API](../api-reference/config) - 连接配置参考
- [安全概述](../security/) - SSRF 和 TLS 安全
