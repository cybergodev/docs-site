---
sidebar_label: "SSRF Protection"
title: "SSRF Protection - CyberGo HTTPC | Private IPs & Metadata"
description: "HTTPC SSRF protection: blocking IPv4/IPv6 private IPs and cloud metadata, SSRFExemptCIDRs exemptions, DNS rebinding defense, and RedirectWhitelist control."
sidebar_position: 20
---

# SSRF Protection

SSRF (Server-Side Request Forgery) is an attack in which the attacker tricks the server into making requests against the internal network. The impact includes stealing cloud-instance metadata credentials (IAM role tokens), scanning internal ports and services, reaching unauthenticated internal admin interfaces, and bypassing firewalls to access protected resources. HTTPC enables SSRF protection by default, blocking connections to private/reserved IP ranges.

## Default Behavior

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false (default) -> blocks all private/reserved IPs
```

`AllowPrivateIPs` defaults to `false`, so dialer-level SSRF validation is fully on. This differs from validating only the URL's hostname — HTTPC validates the resolved IP at the moment the TCP connection is actually established, which defends against DNS rebinding (see below).

## Where Validation Runs: Three Lines of Defense

SSRF checks are distributed across three layers; if any layer is bypassed, the next one backs it up:

| Line of defense | When it runs | Behavior | Implementation |
|------|----------|------|----------|
| 1. Pre-flight validation | Before the request is sent | After parsing the URL, a fast **hostname** check: `localhost` and variants, IP literals, legacy decimal/hexadecimal/octal notations (no DNS resolution, zero network cost) | `internal/security/validator.go` → `internal/validation/netutil.go` |
| 2. Redirect layer | Every 30x hop | Repeats the validation on the redirect target's hostname (domain whitelist first, then SSRF validation) | `internal/engine/transport.go` |
| 3. Connection layer (dialer) | Before the TCP connection is established | **Resolve DNS → validate each IP → filter private addresses → dial the validated IP directly**, defending against DNS rebinding | `internal/connection/pool.go` |

Typical pre-flight rejections based on hostname shape (the request never even attempts a connection):

| Target host | Rejection reason |
|----------|----------|
| `localhost`, `LOCALHOST`, `localhost.localdomain` | Localhost hostname check (case-insensitive) |
| `127.0.0.1`, `::1`, `0.0.0.0`, `::` | Localhost hostname check (exact match) |
| `10.0.0.1`, `192.168.1.1`, `169.254.169.254` | Private/reserved IP block |
| `2130706433`, `0x7f000001`, `0177.0.0.1` | Legacy IP literal notation block |

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	client, err := httpc.NewDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = client.Close() }()

	// The loopback address is rejected at the pre-flight layer — no network connection happens at all
	_, err = client.Get("http://127.0.0.1:9/")
	if err != nil {
		fmt.Println("request blocked (no dial attempted)")
	}
	// Output: request blocked (no dial attempted)
}
```

The connection layer is the final line of defense: even with `ValidateURL = false` turning the pre-flight layer off, the dialer still resolves the domain and validates the real IPs — when every resolved address is private, it returns an error like `domain resolves only to blocked addresses`. The DNS resolution timeout is `min(10s, Timeouts.Dial)`.

:::tip
The pre-flight layer has a URL-level cache (1024 entries; when full, the oldest 25% are evicted), so repeated requests to the same URL do not re-run parsing and validation. Per-request overrides via `WithAllowPrivateIPs` bypass the cache automatically (validation results for the same URL are no longer stable and cannot be reused).
:::

## Blocked IP Ranges

HTTPC blocks every IP address unsuitable for public-internet communication, covering IPv4, IPv6, and their bypass variants.

### IPv4 Blocked Ranges

| Range | CIDR | Description |
|------|------|------|
| Loopback | `127.0.0.0/8` | localhost (includes the entire 127.x.x.x range) |
| Class A private | `10.0.0.0/8` | Internal network (RFC 1918) |
| Class B private | `172.16.0.0/12` | Internal network (RFC 1918) |
| Class C private | `192.168.0.0/16` | Internal network (RFC 1918) |
| Link-local | `169.254.0.0/16` | Auto-configuration (incl. AWS/Azure metadata) |
| CGNAT | `100.64.0.0/10` | Carrier-grade NAT (incl. Alibaba Cloud metadata `100.100.100.200`) |
| Class E reserved | `240.0.0.0/4` | Reserved addresses (`ip4[0] >= 240`) |
| "This network" | `0.0.0.0/8` | This-network identifier (`ip4[0] == 0`) |
| IETF protocol allocation | `192.0.0.0/24` | Special use |
| TEST-NET-1 | `192.0.2.0/24` | Documentation use (RFC 5737) |
| TEST-NET-2 | `198.51.100.0/24` | Documentation use (RFC 5737) |
| TEST-NET-3 | `203.0.113.0/24` | Documentation use (RFC 5737) |
| 6to4 relay | `192.88.99.0/24` | Deprecated anycast |

In addition, IPv6 loopback (`::1`), unique local (`fc00::/7`), link-local (`fe80::/10`), and similar ranges are blocked as well — HTTPC's IP validation covers loopback, private, link-local unicast/multicast, multicast, unspecified, and every other reserved category.

### IPv6 Blocked Ranges

| Range | CIDR | Description |
|------|------|------|
| Loopback | `::1/128` | localhost |
| Unique local | `fc00::/7` | Internal network (IPv4-private equivalent) |
| Link-local | `fe80::/10` | Auto-configuration |
| Documentation prefix | `2001:db8::/32` | Documentation use (RFC 3849) |
| NAT64 | `64:ff9b::/96` | Recursively validates the embedded IPv4 |

### Bypass Defenses

HTTPC additionally blocks these common SSRF bypass techniques:

| Technique | Example | Defense |
|------|------|------|
| IPv4-mapped IPv6 | `::ffff:127.0.0.1` | Normalized to IPv4 then validated |
| Decimal integer | `2130706433` (= 127.0.0.1) | Recognized as a legacy IP literal and blocked |
| Hexadecimal | `0x7f000001`, `0x7f.0.0.1` | `0x` prefix recognized and blocked |
| Octal | `0177.0.0.1` | Leading zero recognized and blocked |
| NAT64 embedded | `64:ff9b::7f00:1` | Recursively validates the embedded IPv4 |

:::tip
These bypass defenses matter especially under cgo builds: `getaddrinfo` may accept legacy IP literals and map them to private IPs. HTTPC intercepts these forms before DNS resolution.
:::

## Cloud Metadata Endpoint Protection

The instance metadata service (IMDS) of each cloud platform is a high-value SSRF target — once reached, temporary credentials can be stolen. HTTPC blocks these addresses by default:

| Platform | Metadata address | Blocking mechanism |
|------|-----------|----------|
| AWS EC2 | `169.254.169.254` | Link-local `169.254.0.0/16` blocked |
| Azure | `169.254.169.254` | Same (link-local blocked) |
| GCP | `metadata.google.internal` | IP validation after DNS resolution |
| Alibaba Cloud | `100.100.100.200` | CGNAT `100.64.0.0/10` blocked |

:::warning
Although AWS IMDSv2 requires a token, an SSRF exploit can still fetch the token first and then access the data. HTTPC's IP-level block sits lower in the stack than IMDSv2 and intercepts the connection outright. Use both: HTTPC blocking + IMDSv2 enabled for defense in depth.
:::

:::warning
Alibaba Cloud metadata (`100.100.100.200`) is inside the CGNAT range (`100.64.0.0/10`), which HTTPC **blocks by default**. If you genuinely need to reach `100.64.0.0/10` for VPNs like Tailscale/WireGuard or internal routing, you must exempt it explicitly via `SSRFExemptCIDRs: []string{"100.64.0.0/10"}` — once exempted, Alibaba Cloud metadata in that range also becomes reachable, so evaluate the risk accordingly.
:::

## DNS Rebinding Defense

DNS rebinding is a classic technique for bypassing SSRF checks. The attacker controls the domain's DNS server so that the first resolution returns a public IP (passing validation) while the resolution at actual connection time returns `127.0.0.1` (bypassing validation).

HTTPC defends against this with a "resolve - validate - dial-directly" pattern:

1. **Resolve**: resolve the domain into a list of IPs
2. **Validate**: check each IP against the private/reserved list
3. **Filter**: remove blocked IPs, keeping only allowed ones
4. **Dial directly**: dial the validated IP directly, never re-resolving the domain

```go
// Attack scenario:
// 1. The attacker controls DNS for evil.com
// 2. Validation-time resolution returns a public IP (passes validation)
// 3. Standard net/http would re-resolve the domain (now returning 127.0.0.1, bypassing validation)
//
// HTTPC defense: at dial time it uses the already-validated IP directly, never re-resolving the domain
```

:::tip
Under "Split-Horizon DNS" (where the same domain resolves to both public and private IPs), HTTPC automatically filters out the private IPs and connects using only public IPs, rather than rejecting the entire domain.
:::

When DoH is enabled (`Connection.EnableDoH = true`), the same line of defense applies: DoH resolution results first pass the same IP filtering — if everything is blocked, it reports `SSRF protection: domain resolves only to blocked addresses` — and only then are the allowed IPs dialed one by one. The DNS resolution timeout is derived from the request context and capped at 10s (`min(10s, Timeouts.Dial)`); canceling the request aborts the resolution immediately.

## SSRFExemptCIDRs Precise Exemption

In microservice environments you often need to reach services inside a VPC, Kubernetes Service, or VPN. `SSRFExemptCIDRs` lets you precisely exempt specific CIDR ranges while keeping all other private IPs blocked — this is the recommended way to access internal services.

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC internal
    "100.64.0.0/10",    // Tailscale VPN
    "172.20.0.0/16",    // Kubernetes Service CIDR
}
client, _ := httpc.New(cfg)
```

### Typical Exemption Use Cases

| Scenario | CIDR | Description |
|------|------|------|
| VPC internal services | `10.0.0.0/8` | AWS/GCP/Azure default VPC |
| Tailscale VPN | `100.64.0.0/10` | Tailscale range (RFC 6598) |
| Kubernetes | `172.20.0.0/16`, etc. | Pod/Service CIDR |
| WireGuard | `10.13.0.0/16`, etc. | Custom VPN range |

An invalid CIDR makes `httpc.New()` return an error (e.g. `SSRFExemptCIDRs: invalid CIDR "10.0.0/8"`), so the configuration fails at startup rather than silently passing at runtime.

:::warning
Keep exempted CIDRs as precise as possible. Avoid overly broad ranges (e.g. `0.0.0.0/0`), which amount to disabling SSRF protection entirely. Even `10.0.0.0/8` deserves a check on whether it can be narrowed to the subnets actually in use.
:::

## AllowPrivateIPs vs SSRFExemptCIDRs Comparison

Both can permit internal services, but their security semantics are very different:

| Dimension | `AllowPrivateIPs = true` | `SSRFExemptCIDRs` |
|------|--------------------------|--------------------|
| Protection state | **Completely bypasses** SSRF validation | Only the listed CIDRs are exempted; everything else stays blocked |
| Coverage | All private/reserved/loopback/link-local IPs | Only the listed CIDRs |
| localhost | Allowed | Always blocked — the hostname check runs before exemption matching, so `SSRFExemptCIDRs` cannot allow loopback addresses (see "Known Boundaries" below) |
| Cloud metadata | **Reachable** (dangerous) | Still blocked by default |
| Risk level | High — attack surface equals disabling SSRF | Low — precise allowance |
| Recommendation | Testing / all-internal clients only | Recommended for production |

:::danger
`AllowPrivateIPs = true` completely bypasses dialer-level SSRF validation (not merely "allowing private IPs") — including the localhost check, the link-local check, and every reserved-address check. Never use it in production when handling any untrusted URL. To reach internal services, prefer `SSRFExemptCIDRs`.
:::

## Per-Request Private-IP Exemption

If the client as a whole uses secure defaults (`AllowPrivateIPs = false`) and only individual requests need internal access (e.g. a `localhost` health-check endpoint), use the `WithAllowPrivateIPs` request option to allow it per request, without globally relaxing security:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	// The default client blocks private IPs; this call allows it per request
	result, err := httpc.Get("http://localhost:8080/health",
		httpc.WithAllowPrivateIPs(true),
	)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("health-check status: %d\n", result.StatusCode())
}
```

:::warning
Enable `WithAllowPrivateIPs(true)` only for **trusted URLs that do not come from user input**. The point of SSRF protection is to stop attackers from tricking your process into reaching internal-network endpoints; disabling it per request reintroduces that risk for that call. If an entire client needs internal access, set `Security.AllowPrivateIPs = true` on `Config`.
:::

The reverse usage works too: if the client is configured with `AllowPrivateIPs = true` (e.g. an all-internal client) but a single request needs SSRF checking forced on, use `WithAllowPrivateIPs(false)`.

## SSRF Checks During Redirects

Redirects are a major SSRF vector: a public service may 302 to `http://169.254.169.254/` (cloud metadata) or an internal address. HTTPC performs SSRF IP validation on redirect targets as well.

| Client configuration | Behavior when redirecting to a private IP |
|-----------|----------------------|
| `AllowPrivateIPs = false` (default) | Blocked — redirect-target IP validation fails |
| `AllowPrivateIPs = true` | Allowed — SSRF bypassed (including redirects) |
| `WithAllowPrivateIPs(true)` per request | That request may redirect to private IPs |
| `SSRFExemptCIDRs` match | Redirect to the exempted CIDR is allowed |

```go
// Scenario: the request goes to public-api.com, and the server 302s to http://169.254.169.254/
// HTTPC validates the redirect target's IP, blocking access to the cloud-metadata service
```

Every redirect hop is checked in the following order (any failed step rejects that hop; see `checkRedirect` in `internal/engine/transport.go`):

1. **Domain whitelist** (if `RedirectWhitelist` is configured)
2. **Scheme check**: only http/https allowed (`file://`, `gopher://`, etc. rejected)
3. **SSRF host validation**: the target hostname is validated against private/loopback/reserved rules
4. **Cross-origin sensitive-header stripping**: when the target host differs from the original host, `Authorization`, `Cookie`, and `Proxy-Authorization` are removed — even if the redirect is allowed, credentials are never carried to a third-party domain
5. **Redirect-loop detection**: A→B→A cycles error out (consecutive identical URLs A→A excepted)
6. **Hop-count cap**: 10 by default, configuration hard cap 50

The redirect layer performs only the fast hostname check (no DNS resolution, avoiding a new TOCTOU window from re-resolving in parallel with the dialer layer); the target domain's real IPs are validated again by the dialer layer at connection time — the two layers combined mean redirects cannot bypass the DNS-rebinding defense.

The per-request override of `WithAllowPrivateIPs` also applies to redirect validation: the override value is propagated via context to the redirect validator and the dialer (`internal/connection/ssrf_context.go`), so that request's redirect targets are judged by the overridden policy too.

### Redirect Domain Whitelist

`RedirectWhitelist` adds domain-level control on top of IP validation, preventing open-redirect vulnerabilities:

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com", // Wildcard: matches strict subdomains
}
// Redirects to non-whitelisted domains are blocked
```

The wildcard `*.example.com` matches strict subdomains such as `api.example.com` and `static.cdn.example.com` but **does not match** the bare domain `example.com` (list it separately). When the whitelist is `nil`, everything is allowed (the default).

## Configuration Examples

### Secure Configuration (Handling User URLs)

When handling user-provided URLs, use `SecureConfig()` for the strictest SSRF protection:

```go
cfg := httpc.SecureConfig()
// AllowPrivateIPs = false (strict SSRF)
// FollowRedirects = false (blocks redirect-based SSRF)
// MaxResponseBodySize = 5MB
client, _ := httpc.New(cfg)
```

### Internal Service Configuration (Accessing a VPC)

To reach VPC/Kubernetes internal services, allow them precisely with `SSRFExemptCIDRs`:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",     // VPC
    "172.20.0.0/16",  // Kubernetes Service
}
client, _ := httpc.New(cfg)
```

### Hybrid Configuration (Public + Internal)

The same client needs to reach both public APIs and internal services, and the internal service subnet is known:

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.50.0.0/16",   // Dedicated internal-service subnet (precise)
}
cfg.Security.RedirectWhitelist = []string{
    "api.public.com",
    "*.internal.corp", // Only allow redirects to trusted internal domains
}
client, _ := httpc.New(cfg)
```

## Completely Disabling SSRF Protection

Test environments only. Two ways:

```go
// Method 1: TestingConfig (also disables TLS verification and several other security features)
client, _ := httpc.New(httpc.TestingConfig())

// Method 2: manual configuration
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true
client, _ := httpc.New(cfg)
```

`TestingConfig()` prints a security warning to `stderr` in non-test environments (see [Security Overview](./)).

:::danger
Never set `AllowPrivateIPs = true` in production. This amounts to abandoning SSRF protection entirely — an attacker can use it to reach cloud metadata, internal services, and admin interfaces.
:::

## Known Boundaries and Bypass Surfaces

Per the source code, SSRF protection has the following known boundaries — know them before configuring:

### localhost Cannot Be Exempted via CIDR

The pre-flight `isLocalhost` hostname check runs **before** CIDR exemption matching (`ValidateSSRFHost` in `internal/validation/netutil.go`: localhost first, then IP exemptions). So adding `127.0.0.0/8` to `SSRFExemptCIDRs` does not allow `localhost` or `127.x.x.x` — the request is still rejected at the pre-flight layer. If you truly need loopback access, use `WithAllowPrivateIPs(true)` (request level) or `AllowPrivateIPs = true` (client level).

### Explicitly Configured Proxies Skip SSRF Validation

Proxy host addresses in `ProxyURL` and `ProxyPool` are treated as **developer-configured infrastructure**: at dial time they skip SSRF validation and DoH resolution (`internal/connection/pool.go`). This is deliberate — a developer who can configure a proxy could connect to any address directly anyway, so intercepting the proxy host adds no real security. But system proxies have one limitation: `EnableSystemProxy` probes the proxy address only once, when the client is built (for the SSRF exemption); if a localhost proxy is resolved from environment variables only later (e.g. `127.0.0.1:7890`), that proxy may be blocked by SSRF protection. For dynamic local proxies, set `ProxyURL` explicitly.

### Arbitrary localhost.* Subdomains Are Treated as Regular Domains

Subdomains like `localhost.example.com` are **not** treated as localhost — they may be legitimate public domains. But if their DNS resolves to a loopback IP, the connection layer still intercepts them; they just no longer get the pre-flight layer's resolution-free fast check.

### With ValidateURL Off, the Redirect and Connection Layers Backstop

With URL validation off (not recommended; outside `TestingConfig` there is almost never a legitimate reason), the pre-flight layer no longer runs; the redirect and connection layers remain effective. In that state, a `localhost` literal in the URL is only intercepted at the dialer layer once DNS resolves it to a loopback IP, the error message differs (`domain resolves only to blocked addresses`), and the legacy IP-literal fast check is gone too.

### Legacy IP Literals Are Intercepted Before DNS Resolution

Notations like `2130706433`, `0x7f000001`, and `0177.0.0.1` are rejected by `net.ParseIP`, yet may be accepted by the `getaddrinfo` resolver in cgo builds and mapped to private IPs. HTTPC recognizes and intercepts these forms at the pre-flight layer with `looksLikeLegacyIPLiteral` (detection rules: `0x` prefix, dot-free all-digits, and leading-zero octal or hexadecimal segments in multi-dot forms), independent of platform resolver behavior.

### 198.18.0.0/15 Is Deliberately Allowed

The RFC 2544 benchmarking range `198.18.0.0/15` is reserved address space, yet it is **deliberately allowed** rather than blocked: Clash/Surge-style proxy tools allocate their fake-IP pool in this range, and blocking it would break normal requests in such proxy environments (see the comment on `isPrivateOrReservedIP` in `internal/validation/netutil.go` and the corresponding cases in `netutil_test`). If your environment does not use fake-IP proxies and needs this range restricted, you must validate destination IPs yourself at the caller or in a custom middleware layer.

## Best Practices

1. Use `SecureConfig()` as the security baseline for handling untrusted URLs
2. Use `SSRFExemptCIDRs` to exempt only the CIDR ranges you actually need; avoid `AllowPrivateIPs`
3. Configure `RedirectWhitelist` to limit redirect destination domains
4. Disable redirects (`FollowRedirects = false`) when handling user URLs
5. Audit the `SSRFExemptCIDRs` configuration regularly and remove subnets no longer in use
6. Use `AuditMiddleware` to record all requests, enabling after-the-fact tracing of SSRF attempts

## Next Steps

- [TLS and Certificate Pinning](./tls-certpin) - TLS security configuration and certificate pinning
- [Security Overview](./) - Security features overview
- [Production Checklist](./production-checklist) - Pre-launch SSRF checks
