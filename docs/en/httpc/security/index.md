---
title: "Security Overview - CyberGo HTTPC | Security Features"
description: "HTTPC security overview: TLS 1.2+ version control, SSRF private-IP blocking, CRLF prevention, cookie security, and redirect whitelisting."
---

# Security Overview

HTTPC is secure by default -- all security features work out of the box.

## Security Feature Overview

| Feature | Default | Description |
|---------|---------|-------------|
| TLS minimum version | TLS 1.2 | Rejects TLS 1.0/1.1 |
| SSRF protection | On | Blocks private IP connections |
| URL validation | On | Validates URL format and protocol |
| Header validation | On | Prevents CRLF injection |
| Content-Length strict checking | On | Prevents response smuggling |
| Cookie security validation | Optional | Validates cookie security attributes |
| Response body size limit | 10MB | Prevents memory exhaustion |
| Decompressed body size limit | 100MB | Prevents decompression bombs |
| Redirect limit | 10 times | Prevents infinite redirects |

## TLS Security

```go
cfg := httpc.DefaultConfig()
// Default TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger
`InsecureSkipVerify` is for testing only. Never set to `true` in production.
:::

## SSRF Protection

SSRF (Server-Side Request Forgery) is an attack where an attacker uses the server to make internal network requests.

```go
// Default: blocks private IPs
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false -> blocks 127.0.0.1, 10.x, 192.168.x, etc.

// Exempt specific CIDRs (e.g. VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC internal
    "100.64.0.0/10",    // Tailscale
}

// Secure preset: strongest SSRF protection
client, _ := httpc.New(httpc.SecureConfig())
```

### Blocked IP Ranges

| Range | Description |
|-------|-------------|
| 127.0.0.0/8 | Loopback address |
| 10.0.0.0/8 | Class A private |
| 172.16.0.0/12 | Class B private |
| 192.168.0.0/16 | Class C private |
| 169.254.0.0/16 | Link-local |
| ::1/128 | IPv6 loopback |
| fc00::/7 | IPv6 unique local |
| fe80::/10 | IPv6 link-local |

## Header Validation

Automatically prevents CRLF injection and header smuggling:

```go
// The following headers are rejected
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF injection
httpc.WithHeader("X-Bad", "value\x00null")                // Control characters
```

## Cookie Security

```go
// Strict cookie security
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// Requires: Secure, HttpOnly, SameSite=Strict
```

## Redirect Security

```go
// Disable redirects (security-sensitive scenarios)
cfg := httpc.SecureConfig() // FollowRedirects = false

// Limit redirect domains
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## Audit Middleware

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL is masked (credentials removed)
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### Configurable Audit

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

## Next Steps

- [SSRF Protection](./ssrf) - SSRF protection in depth and configuration
- [TLS and Certificate Pinning](./tls-certpin) - TLS configuration and certificate pinning
- [Production Checklist](./production-checklist) - Pre-launch checklist
