---
title: "SSRF Protection - CyberGo HTTPC | Private IP & Metadata"
description: "HTTPC SSRF protection: default private-IP blocking, SSRFExemptCIDRs exemptions, DNS rebinding prevention, redirect whitelisting, and metadata protection."
---

# SSRF Protection

SSRF (Server-Side Request Forgery) is an attack where an attacker uses the server to make internal network requests. HTTPC enables SSRF protection by default.

## Default Behavior

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false -> blocks all private IPs by default
```

Blocked IP ranges by default:

| Range | CIDR | Description |
|-------|------|-------------|
| IPv4 loopback | `127.0.0.0/8` | localhost |
| Class A private | `10.0.0.0/8` | Internal network |
| Class B private | `172.16.0.0/12` | Internal network |
| Class C private | `192.168.0.0/16` | Internal network |
| Link-local | `169.254.0.0/16` | Auto-configuration |
| IPv6 loopback | `::1/128` | localhost |
| IPv6 local | `fc00::/7` | Unique local addresses |
| IPv6 link-local | `fe80::/10` | Link-local |

## CIDR Exemptions

In microservice environments, you may need to access internal services:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC internal
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
```

:::warning
CIDR exemptions should be as precise as possible. Avoid using overly broad ranges (e.g. `0.0.0.0/0`) as this effectively disables SSRF protection.
:::

### Per-Request Private-IP Exemption

If you only need to allow private IPs for individual requests (for example, calling a `localhost` health-check endpoint), there is no need to enable `AllowPrivateIPs` globally. Use the `WithAllowPrivateIPs` request option to allow it for that single request only:

```go
// Default client blocks private IPs; this call allows it per request
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

:::warning
Enable this option only for **trusted URLs that do not come from user input**. SSRF protection exists to stop attackers from tricking your process into reaching internal-network endpoints; disabling it per request reintroduces that risk for that call. If an entire client needs to reach internal services, set `Security.AllowPrivateIPs = true` on Config.
:::

## DNS Rebinding Prevention

HTTPC uses a "resolve-validate-dial" pattern to prevent DNS rebinding attacks:

1. Resolve domain to IP addresses
2. Validate all resolved IPs against private address lists
3. Dial directly to the validated IP (instead of re-resolving the domain)

```go
// Attack scenario:
// 1. Attacker controls DNS for evil.com
// 2. First resolution returns a public IP (passes validation)
// 3. Actual connection resolves to 127.0.0.1 (bypasses validation)
//
// HTTPC defense: after validation, dials directly using the validated IP, never re-resolves
```

## Redirect SSRF Checking

Redirect targets also undergo SSRF validation:

```go
// Suppose a request to public-api.com returns 302 redirect to http://169.254.169.254/
// HTTPC validates the redirect target's IP, blocking access to metadata services
```

### Redirect Domain Whitelist

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // Wildcard support
}

// Redirects to non-whitelisted domains are blocked
```

## Cloud Environment Metadata Protection

Metadata service addresses for major cloud platforms:

| Platform | Address | Description |
|----------|---------|-------------|
| AWS | `169.254.169.254` | Instance metadata |
| GCP | `metadata.google.internal` | Metadata service |
| Azure | `169.254.169.254` | Instance metadata |
| Alibaba Cloud | `100.100.100.200` | Metadata service |

HTTPC blocks AWS/Azure metadata access by default (`169.254.169.254` is in the `169.254.0.0/16` block list). GCP metadata (`metadata.google.internal`) is blocked through DNS resolution validation.

:::warning
Alibaba Cloud metadata (`100.100.100.200`) is in the CGNAT range (`100.64.0.0/10`). To support VPNs like Tailscale/WireGuard, this range is **not** in the default block list. If you need to protect against Alibaba Cloud metadata access, use additional security measures such as firewall rules.
:::

## Completely Disabling SSRF Protection

Only use in testing environments:

```go
// TestingConfig disables SSRF protection
client, _ := httpc.New(httpc.TestingConfig())

// Or manual configuration
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger
Never set `AllowPrivateIPs = true` in production.
:::

## Best Practices

1. Use `SecureConfig()` as a security baseline
2. Only exempt necessary CIDR ranges
3. Configure `RedirectWhitelist` to limit redirect destinations
4. Regularly audit `SSRFExemptCIDRs` configuration
5. Use audit middleware to record all requests

## Next Steps

- [TLS and Certificate Pinning](./tls-certpin) - TLS security configuration
- [Security Overview](./) - Security features overview
- [Production Checklist](./production-checklist) - Pre-launch checklist
