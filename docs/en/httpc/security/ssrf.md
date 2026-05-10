---
title: SSRF Protection - HTTPC
description: Detailed guide to HTTPC SSRF protection, covering private IP blocking mechanisms, exempt CIDR configuration, DNS rebinding prevention, redirect whitelisting, and cloud metadata endpoint protection.
---

# SSRF Protection

SSRF (Server-Side Request Forgery) is an attack where an attacker exploits the server to make requests to internal network resources. HTTPC enables SSRF protection by default.

## Default Behavior

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → blocks all private IPs by default
```

Default blocked IP ranges:

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
CIDR exemptions should be as precise as possible. Avoid using overly broad ranges (e.g., `0.0.0.0/0`), which effectively disables SSRF protection.
:::

## DNS Rebinding Protection

HTTPC uses a "resolve-verify-dial" pattern to prevent DNS rebinding attacks:

1. Resolve the domain name to IP addresses
2. Verify all resolved IPs against the private address list
3. Dial directly to the verified IP (instead of resolving the domain again)

```go
// Attack scenario:
// 1. Attacker controls DNS for evil.com
// 2. First resolution returns a public IP (passes verification)
// 3. Actual connection resolves to 127.0.0.1 (bypasses verification)
//
// HTTPC defense: After verification, dial using the verified IP directly, no re-resolution
```

## Redirect SSRF Checking

Redirect targets also undergo SSRF verification:

```go
// Assume request to public-api.com, server returns 302 redirect to http://169.254.169.254/
// HTTPC verifies the redirect target's IP, blocking access to metadata services
```

### Redirect Domain Whitelist

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",  // Supports wildcards
}

// Redirects to non-whitelisted domains will be blocked
```

## Cloud Environment Metadata Protection

Metadata service addresses for major cloud providers:

| Platform | Address | Description |
|----------|---------|-------------|
| AWS | `169.254.169.254` | Instance metadata |
| GCP | `metadata.google.internal` | Metadata service |
| Azure | `169.254.169.254` | Instance metadata |
| Alibaba Cloud | `100.100.100.200` | Metadata service |

HTTPC blocks AWS/Azure metadata access by default (`169.254.169.254` is in the `169.254.0.0/16` block list). GCP metadata (`metadata.google.internal`) is blocked through DNS resolution verification.

:::warning
Alibaba Cloud metadata (`100.100.100.200`) falls within the CGNAT range (`100.64.0.0/10`), which is **not** in the default block list to support VPNs like Tailscale/WireGuard. If you need to protect against Alibaba Cloud metadata access, use other security measures such as firewall rules.
:::

## Disabling SSRF Protection

Only use in testing environments:

```go
// TestingConfig disables SSRF protection
client, _ := httpc.New(httpc.TestingConfig())

// Or manual configuration
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
```

:::danger
Never set `AllowPrivateIPs = true` in production environments.
:::

## Best Practices

1. Use `SecureConfig()` as the security baseline
2. Only exempt necessary CIDR ranges
3. Configure `RedirectWhitelist` to restrict redirect targets
4. Regularly audit `SSRFExemptCIDRs` configuration
5. Use audit middleware to log all requests

## Next Steps

- [TLS and Certificate Pinning](./tls-certpin) - TLS security configuration
- [Security Overview](./) - Security features overview
- [Production Checklist](./production-checklist) - Pre-launch checklist
