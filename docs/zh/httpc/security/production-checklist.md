---
sidebar_label: "生产检查清单"
title: "生产检查清单 - CyberGo HTTPC | 上线前核查"
description: "HTTPC 生产环境安全检查清单：TLS 核查、SSRF AllowPrivateIPs 确认与 CIDR 审计、Timeouts 超时配置、MaxResponseBodySize 大小限制、MaxRetries 重试策略、资源释放与 AuditMiddleware 监控审计。"
sidebar_position: 4
---

# 生产检查清单

## 必查项

### TLS 配置

- [ ] `InsecureSkipVerify` 设为 `false`（默认值）
- [ ] `MinTLSVersion` 至少为 `tls.VersionTLS12`
- [ ] 不使用 `TestingConfig()`

### SSRF 防护

- [ ] `AllowPrivateIPs` 为 `false`（默认值）
- [ ] 如需访问内部服务，使用 `SSRFExemptCIDRs` 精确指定
- [ ] 处理用户提供的 URL 时使用 `SecureConfig()`

### 超时配置

- [ ] 所有超时值已设置且合理
- [ ] `TimeoutConfig.Request` 不为 0（防止无限等待）
- [ ] 考虑使用 `WithContext` 为每个请求设置超时

### 响应限制

- [ ] `MaxResponseBodySize` 设置合理上限
- [ ] `MaxDecompressedBodySize` 设置合理上限
- [ ] 处理大响应时使用流式下载

### 重试配置

- [ ] `MaxRetries` 不超过 5
- [ ] 非幂等请求（POST/PUT/PATCH）谨慎使用重试
- [ ] 启用 `EnableJitter` 防止惊群

### 资源管理

- [ ] 客户端使用后调用 `Close()`
- [ ] 使用 `defer` 确保资源释放

## 推荐项

### 中间件

- [ ] 使用 `RecoveryMiddleware()` 防止 panic 崩溃
- [ ] 使用 `LoggingMiddleware()` 记录请求日志
- [ ] 使用 `MetricsMiddleware()` 收集指标
- [ ] 安全敏感场景使用 `AuditMiddleware()`

### 请求头

- [ ] 设置有意义的 `User-Agent`
- [ ] 不在默认请求头中存储敏感信息
- [ ] 使用 `WithBearerToken` 而非手动设置 Authorization

### Cookie

- [ ] 安全敏感场景启用 `CookieSecurity` 验证
- [ ] 使用 `StrictCookieSecurityConfig()` 强制安全属性

### 重定向

- [ ] 用户输入 URL 场景禁用重定向
- [ ] 使用 `RedirectWhitelist` 限制重定向目标

## 代码示例

### 生产级客户端创建

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // 超时
    cfg.Timeouts.Request = 30 * time.Second
    cfg.Timeouts.Dial = 10 * time.Second
    cfg.Timeouts.TLSHandshake = 10 * time.Second
    cfg.Timeouts.ResponseHeader = 30 * time.Second // transport 级硬上限：作用于该 client 所有请求，无法按请求用 WithTimeout 覆盖；AI API/长响应场景应设为 0 依赖 Request 超时

    // 连接池
    cfg.Connection.MaxIdleConns = 50
    cfg.Connection.MaxConnsPerHost = 10

    // 安全
    cfg.Security.AllowPrivateIPs = false
    cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024

    // 重试
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Retry.EnableJitter = true

    // 中间件
    cfg.Middleware.UserAgent = "my-service/1.0"
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
        httpc.RequestIDMiddleware("X-Request-ID", nil),
    }

    return httpc.New(cfg)
}
```

### 安全级客户端

```go
func createSecureClient() (httpc.Client, error) {
    cfg := httpc.SecureConfig()
    cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
    cfg.Security.RedirectWhitelist = []string{"api.example.com"}
    return httpc.New(cfg)
}
```

## 检查命令

```bash
# 检查是否误用 TestingConfig
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# 检查 InsecureSkipVerify
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# 检查 AllowPrivateIPs
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## 下一步

- [安全概述](./) - 安全特性总览
- [SSRF 防护](./ssrf) - SSRF 防护详解
- [配置 API](../api-reference/client-config/config) - 完整配置参考
