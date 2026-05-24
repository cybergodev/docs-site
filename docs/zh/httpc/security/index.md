---
title: "安全概述 - HTTPC"
description: "HTTPC 安全特性概述：TLS 1.2+ 版本控制、SSRF 私有 IP 阻止与 CIDR 豁免、CRLF 注入防护、StrictCookieSecurityConfig Cookie 安全、RedirectWhitelist 重定向白名单与响应体大小限制。"
---

# 安全概述

HTTPC 默认安全（Secure by Default），所有安全特性开箱即用。

## 安全特性总览

| 特性 | 默认 | 说明 |
|------|------|------|
| TLS 最低版本 | TLS 1.2 | 拒绝 TLS 1.0/1.1 |
| SSRF 防护 | 开启 | 阻止私有 IP 连接 |
| URL 验证 | 开启 | 验证 URL 格式和协议 |
| 请求头验证 | 开启 | 防止 CRLF 注入 |
| Content-Length 严格检查 | 开启 | 防止响应走私 |
| Cookie 安全验证 | 可选 | 验证 Cookie 安全属性 |
| 响应体大小限制 | 10MB | 防止内存耗尽 |
| 解压体大小限制 | 100MB | 防止解压炸弹 |
| 重定向限制 | 10 次 | 防止无限重定向 |

## TLS 安全

```go
cfg := httpc.DefaultConfig()
// 默认 TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger
`InsecureSkipVerify` 仅用于测试。生产环境永远不要设为 `true`。
:::

## SSRF 防护

SSRF（服务端请求伪造）是攻击者利用服务器发起内网请求的攻击方式。

```go
// 默认：阻止私有 IP
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 阻止 127.0.0.1, 10.x, 192.168.x 等

// 豁免特定 CIDR（如 VPN、VPC）
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale
}

// 安全预设：最强 SSRF 防护
client, _ := httpc.New(httpc.SecureConfig())
```

### 被阻止的 IP 范围

| 范围 | 说明 |
|------|------|
| 127.0.0.0/8 | 回环地址 |
| 10.0.0.0/8 | A 类私有 |
| 172.16.0.0/12 | B 类私有 |
| 192.168.0.0/16 | C 类私有 |
| 169.254.0.0/16 | 链路本地 |
| ::1/128 | IPv6 回环 |
| fc00::/7 | IPv6 唯一本地 |
| fe80::/10 | IPv6 链路本地 |

## 请求头验证

自动防止 CRLF 注入和请求头走私：

```go
// 以下请求头会被拒绝
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF 注入
httpc.WithHeader("X-Bad", "value\x00null")                // 控制字符
```

## Cookie 安全

```go
// 严格 Cookie 安全
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// 要求: Secure, HttpOnly, SameSite=Strict
```

## 重定向安全

```go
// 禁止重定向（安全敏感场景）
cfg := httpc.SecureConfig() // FollowRedirects = false

// 限制重定向域名
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## 审计中间件

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL 已脱敏（凭据已移除）
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### 带配置的审计

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}
auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

## 下一步

- [SSRF 防护](./ssrf) - SSRF 防护详解和配置
- [TLS 与证书固定](./tls-certpin) - TLS 配置和证书固定
- [生产检查清单](./production-checklist) - 上线前必查项
