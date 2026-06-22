---
title: "SSRF 防护 - CyberGo HTTPC | 私有 IP 与元数据"
description: "HTTPC SSRF 防护详解：默认阻止 IPv4/IPv6 私有 IP、SSRFExemptCIDRs 精确豁免、DNS 重绑定防护、RedirectWhitelist 重定向白名单、AWS/GCP/Azure 云元数据保护与 AllowPrivateIPs 注意事项。"
---

# SSRF 防护

SSRF（Server-Side Request Forgery，服务端请求伪造）是攻击者利用服务器发起内网请求的攻击方式。HTTPC 默认开启 SSRF 防护。

## 默认行为

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → 默认阻止所有私有 IP
```

默认阻止的 IP 范围：

| 范围 | CIDR | 说明 |
|------|------|------|
| IPv4 回环 | `127.0.0.0/8` | localhost |
| A 类私有 | `10.0.0.0/8` | 内网 |
| B 类私有 | `172.16.0.0/12` | 内网 |
| C 类私有 | `192.168.0.0/16` | 内网 |
| 链路本地 | `169.254.0.0/16` | 自动配置 |
| IPv6 回环 | `::1/128` | localhost |
| IPv6 本地 | `fc00::/7` | 唯一本地地址 |
| IPv6 链路 | `fe80::/10` | 链路本地 |

## CIDR 豁免

在微服务环境中，可能需要访问内部服务：

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC 内部
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning
豁免 CIDR 应尽量精确。避免使用过大的范围（如 `0.0.0.0/0`），否则等于禁用 SSRF 防护。
:::

### 按请求豁免私有 IP

如果仅需对个别请求放行私有 IP（例如调用 `localhost` 健康检查端点），无需全局启用 `AllowPrivateIPs`，可使用 `WithAllowPrivateIPs` 请求选项仅对该次请求放行：

```go
// 默认客户端阻止私有 IP；此调用按请求放行
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

:::warning
仅对**可信且非来自用户输入**的 URL 启用此选项。SSRF 防护的目的是防止攻击者诱导你的进程访问内网端点，按请求禁用会为该次调用重新引入此风险。若整个客户端都需要访问内部服务，请在 Config 上设置 `Security.AllowPrivateIPs = true`。
:::

## DNS 重绑定防护

HTTPC 采用"解析-验证-直连"模式防止 DNS 重绑定攻击：

1. 解析域名为 IP 地址
2. 验证所有解析出的 IP 是否为私有地址
3. 直接拨号到已验证的 IP（而非再次解析域名）

```go
// 攻击场景：
// 1. 攻击者控制 evil.com 的 DNS
// 2. 第一次解析返回公网 IP（通过验证）
// 3. 实际连接时 DNS 返回 127.0.0.1（绕过验证）
//
// HTTPC 防御：验证后直接使用已验证的 IP 拨号，不再重新解析
```

## 重定向 SSRF 检查

重定向目标同样经过 SSRF 验证：

```go
// 假设请求 public-api.com，服务端返回 302 重定向到 http://169.254.169.254/
// HTTPC 会验证重定向目标的 IP，阻止对元数据服务的访问
```

### 重定向域名白名单

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // 支持通配符
}

// 非白名单域名的重定向会被阻止
```

## 云环境元数据防护

各云平台的元数据服务地址：

| 平台 | 地址 | 说明 |
|------|------|------|
| AWS | `169.254.169.254` | 实例元数据 |
| GCP | `metadata.google.internal` | 元数据服务 |
| Azure | `169.254.169.254` | 实例元数据 |
| 阿里云 | `100.100.100.200` | 元数据服务 |

HTTPC 默认阻止 AWS/Azure 元数据访问（`169.254.169.254` 在 `169.254.0.0/16` 阻止列表中）。GCP 元数据（`metadata.google.internal`）通过 DNS 解析验证被阻止。

:::warning
阿里云元数据（`100.100.100.200`）位于 CGNAT 范围（`100.64.0.0/10`），为支持 Tailscale/WireGuard 等 VPN，该范围**未**在默认阻止列表中。如需防护阿里云元数据访问，请通过其他安全策略（如防火墙规则）进行限制。
:::

## 完全禁用 SSRF 防护

仅在测试环境中使用：

```go
// TestingConfig 禁用 SSRF 防护
client, _ := httpc.New(httpc.TestingConfig())

// 或手动配置
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger
生产环境永远不要设置 `AllowPrivateIPs = true`。
:::

## 最佳实践

1. 使用 `SecureConfig()` 作为安全基线
2. 仅豁免必要的 CIDR 范围
3. 配置 `RedirectWhitelist` 限制重定向目标
4. 定期审计 `SSRFExemptCIDRs` 配置
5. 使用审计中间件记录所有请求

## 下一步

- [TLS 与证书固定](./tls-certpin) - TLS 安全配置
- [安全概述](./) - 安全特性总览
- [生产检查清单](./production-checklist) - 上线前必查项
