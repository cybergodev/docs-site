---
sidebar_label: "Security Overview"
title: "Security Overview - CyberGo HTTPC | Security Features"
description: "HTTPC security overview: layered defense map, default vs opt-in behavior, SSRF blocking and CIDR exemptions, TLS hardening, and decompression-bomb defense."
sidebar_position: 1
---

# Security Overview

HTTPC follows the "Secure by Default" principle: every critical security feature works out of the box, defending against common attack surfaces with no extra configuration. When handling user-provided URLs, calling external untrusted services, or running in high-security environments (finance, healthcare, government), HTTPC's layered defenses serve as a reliable baseline.

## Security Feature Matrix

The table below summarizes each security feature, the corresponding `Config` field, its default value, and related functions/options, so you can locate configuration entry points quickly.

| Feature | Config field | Default | Related functions / options |
|------|-------------|--------|------------------|
| TLS minimum version | `SecurityConfig.MinTLSVersion` | TLS 1.2 | — |
| TLS maximum version | `SecurityConfig.MaxTLSVersion` | TLS 1.3 | — |
| Custom TLS config | `SecurityConfig.TLSConfig` | `nil` (use defaults) | — |
| Skip certificate verification | `SecurityConfig.InsecureSkipVerify` | `false` | Testing only |
| Certificate pinning | `SecurityConfig.CertificatePinner` | `nil` (disabled) | `NewSPKIHashPinner`, etc. |
| SSRF protection | `SecurityConfig.AllowPrivateIPs` | `false` (on) | `WithAllowPrivateIPs` |
| Precise SSRF exemption | `SecurityConfig.SSRFExemptCIDRs` | `nil` | — |
| URL validation | `SecurityConfig.ValidateURL` | `true` | — |
| Header validation | `SecurityConfig.ValidateHeaders` | `true` | — |
| Strict Content-Length check | `SecurityConfig.StrictContentLength` | `true` | — |
| Cookie security validation | `SecurityConfig.CookieSecurity` | `nil` (no validation) | `StrictCookieSecurityConfig`, `WithSecureCookie` |
| Response body size limit | `SecurityConfig.MaxResponseBodySize` | 10MB | — |
| Request body size limit | `SecurityConfig.MaxRequestBodySize` | 0 (unlimited) | Must be set explicitly |
| Decompression-bomb defense | `SecurityConfig.MaxDecompressedBodySize` | 100MB | — |
| Response header size limit | `ConnectionConfig.MaxResponseHeaderBytes` | 0 (Go default 10MB) | — |
| Redirect whitelist | `SecurityConfig.RedirectWhitelist` | `nil` (allow all) | — |
| Redirect count limit | `RequestDefaults.MaxRedirects` | 10 | `WithMaxRedirects` |
| Follow redirects | `RequestDefaults.FollowRedirects` | `true` | `WithFollowRedirects` |

:::tip
When handling user-provided URLs, just use `httpc.SecureConfig()` for the strictest security baseline: redirects disabled, a 5MB response cap, shorter timeouts, and URL/header validation enabled.
:::

## Defense-in-Depth Map

HTTPC's security capabilities are spread across multiple layers of the request lifecycle; if any single layer is bypassed, the next one backs it up:

| Layer | When | What it covers | Implementation |
|------|------|----------|----------|
| Pre-flight validation | Before the request is sent | URL format/scheme/length checks, fast SSRF hostname lookup (localhost, IP literals, legacy notations), header CRLF/control characters, request-body size | `internal/security/validator.go` |
| Redirect layer | Every 30x hop | Redirect domain whitelist → SSRF target validation → cross-origin sensitive-header stripping → redirect-loop detection → hop-count cap | `internal/engine/transport.go` |
| Connection layer | At actual dial time | DNS resolved once, each resolved IP validated, private addresses filtered out, then dials the validated IP directly (defends against DNS-rebinding TOCTOU) | `internal/connection/pool.go` |
| TLS layer | During the handshake | Version range (1.2-1.3 by default), ECDHE+AEAD cipher-suite whitelist, curve preferences, renegotiation forbidden, certificate pinning | `internal/connection/pool.go` |
| Response layer | While reading the response | Dual response-body/decompression caps, strict Content-Length checking, streaming read limits | `internal/engine/response.go` |
| Output sanitization layer | When logs/errors/audit events are emitted | URL credential masking, sensitive query parameters `[REDACTED]`, sensitive header masking | `internal/validation/sanitize.go` |
| Download layer | When writing files | Five layers of path defense (UNC/control characters/system directories/traversal/symlinks) and SHA-256 integrity verification | `download.go` |

Three layers working together, using SSRF as the example: the pre-flight layer first rejects `localhost` and private-IP literals by hostname (no DNS resolution, zero network cost); the redirect layer repeats the validation for every hop target; the connection layer resolves DNS and validates the real IP before dialing, so even DNS rebinding by an attacker is hard to slip through. See [SSRF Protection](./ssrf) for details.

## Default Behavior: On by Default vs Manual Opt-In

Each item below follows the source-code defaults (`DefaultConfig()` in `types.go`).

### On by Default (No Configuration Needed)

| Capability | Default | Notes |
|------|--------|------|
| SSRF protection | `AllowPrivateIPs = false` | Blocks private/reserved/loopback/link-local IPs, including IPv6 and mixed-notation bypasses |
| URL validation | `ValidateURL = true` | Allows only http/https; requires non-empty scheme and host |
| Header validation | `ValidateHeaders = true` | Rejects CRLF injection and control characters; validates Connection/Transfer-Encoding tokens |
| TLS version range | TLS 1.2 – 1.3 | Rejects TLS 1.0/1.1; fields set to 0 fall back to 1.2/1.3 |
| TLS cipher suites | ECDHE+AEAD whitelist | 6 suites enforcing forward secrecy; `RenegotiateNever` forbids renegotiation |
| Redirect SSRF validation | Runs on every hop | Redirect targets pass the same SSRF validation |
| Cross-origin header stripping on redirects | Automatic | Removes Authorization/Cookie/Proxy-Authorization when hopping to a different host |
| Redirect-loop detection | Automatic | Detects A→B→A cycles (consecutive identical URLs excepted) |
| Redirect cap | 10 | Configuration hard cap 50; there is no "unlimited" mode |
| Response body cap | 10MB | Exceeding it returns an error |
| Decompression-bomb defense | 100MB | Caps the actual decompressed size |
| Strict Content-Length checking | `StrictContentLength = true` | Errors when the response byte count differs from Content-Length (HEAD excepted) |
| Log/error redaction | Automatic | URL credentials replaced with `***:***`; parameters like token/password replaced with `[REDACTED]` |
| Download path defense | Automatic | Five-layer check + automatic deletion of downloaded files on verification failure |
| HTTP/2 | `EnableHTTP2 = true` | Negotiated via ALPN under TLS |

### Off by Default (Explicit Opt-In)

| Capability | Default | How to enable |
|------|--------|----------|
| Certificate pinning | `CertificatePinner = nil` | Build with `NewSPKIHashPinner`, etc. and assign; see [TLS and Certificate Pinning](./tls-certpin) |
| Cookie security validation | `CookieSecurity = nil` (no validation) | `StrictCookieSecurityConfig()` |
| Redirect domain whitelist | `RedirectWhitelist = nil` (allow all) | Configure a domain/wildcard list |
| Request body cap | `MaxRequestBodySize = 0` (unlimited, no fallback) | Set an explicit byte count |
| Transport-level response-header timeout | `ResponseHeader = 0` (disabled) | Set when you need defense in depth against Slowloris |
| Cookie jar | `EnableCookies = false` | Set to true or use a DomainClient |
| DoH | `EnableDoH = false` | Set to true |

:::tip
The "off by default" items are not flaws — they are options whose business requirements cannot be predicted: certificate pinning needs the real fingerprint of the target service, and a request-body cap depends on your message sizes. When handling untrusted URLs, `SecureConfig()` tightens several of them at once (no redirects, 5MB response cap, shorter timeouts).
:::

## TLS Security

HTTPC requires TLS 1.2+ by default, rejecting the proven-insecure TLS 1.0/1.1:

```go
cfg := httpc.DefaultConfig()
// TLS 1.2-1.3 is the default; no manual setup needed
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

To force TLS 1.3 (higher security requirements, with both client and server supporting it), just set `MinTLSVersion = tls.VersionTLS13`. Once `TLSConfig` is set, `MinTLSVersion`/`MaxTLSVersion` are ignored — `TLSConfig` takes precedence.

The default TLS configuration (when `TLSConfig` is not set) also includes these hardening measures:

- **Cipher-suite whitelist**: only 6 ECDHE + AEAD suites that enforce forward secrecy (ECDSA/RSA × AES-128-GCM/AES-256-GCM/ChaCha20-Poly1305); CBC and static RSA key exchange are excluded
- **Curve preferences**: X25519, P-256, P-384
- **No renegotiation**: `RenegotiateNever`, defending against renegotiation attacks
- **Session resumption**: an LRU cache of client session tickets (256 entries), speeding up handshakes for repeated connections

These hardening measures are injected uniformly when HTTPC builds the transport (`createTLSConfig` in `internal/connection/pool.go`); if you set a custom `TLSConfig`, your configuration wins — certificate pinning is still injected on top, but the remaining suite/curve settings no longer apply.

:::warning
`InsecureSkipVerify` is for testing only. Never set it to `true` in production, or TLS encryption becomes pointless and a man-in-the-middle can eavesdrop and tamper at will. When set, HTTPC prints a security warning to `stderr` in non-test environments (see "Security Warning Mechanism" below).
:::

For more TLS details (cipher suites, certificate pinning, mTLS, custom CAs), see [TLS and Certificate Pinning](./tls-certpin).

## SSRF Protection

SSRF (Server-Side Request Forgery) is an attack in which the attacker tricks the server into making requests against the internal network — stealing cloud-metadata credentials, scanning internal ports, or reaching unauthenticated internal admin interfaces. HTTPC enables SSRF protection by default, blocking connections to private/reserved IP ranges.

```go
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false (default) -> blocks 127.0.0.1, 10.x, 192.168.x, 169.254.x, etc.

// Precisely exempt specific CIDRs (e.g. VPN, internal VPC services)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",    // VPC internal
    "100.64.0.0/10", // Tailscale VPN
}

// Strongest SSRF protection preset
client, _ := httpc.New(httpc.SecureConfig())
```

### Blocked IP Ranges

| Range | CIDR | Description |
|------|------|------|
| IPv4 loopback | `127.0.0.0/8` | localhost |
| Class A private | `10.0.0.0/8` | Internal network |
| Class B private | `172.16.0.0/12` | Internal network |
| Class C private | `192.168.0.0/16` | Internal network |
| Link-local | `169.254.0.0/16` | Auto-configuration (incl. AWS/Azure metadata) |
| CGNAT | `100.64.0.0/10` | Carrier-grade NAT (incl. Alibaba Cloud metadata) |
| Class E reserved | `240.0.0.0/4` | Reserved addresses |
| "This network" | `0.0.0.0/8` | This-network identifier |
| TEST-NET | `192.0.2.0/24`, etc. | Documentation use |
| IPv6 loopback | `::1/128` | localhost |
| IPv6 unique local | `fc00::/7` | Internal network |
| IPv6 link-local | `fe80::/10` | Auto-configuration |

> The table above lists the main ranges; the full list (including IPv4-mapped IPv6, NAT64 `64:ff9b::/96`, the IPv6 documentation prefix `2001:db8::/32`, etc.) is in the source `isPrivateOrReservedIP`. HTTPC also blocks legacy IP literals in decimal/hexadecimal/octal notation (such as `2130706433`, `0x7f000001`) to prevent bypass. See [SSRF Protection](./ssrf).

## Header Validation

`ValidateHeaders` (on by default) automatically prevents CRLF injection and request smuggling — it rejects header values containing carriage returns, line feeds, null bytes, and other control characters:

```go
// These headers are rejected
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF injection
httpc.WithHeader("X-Bad", "value\x00null")                // Control characters
```

Validation uses an O(1) lookup table, so the overhead is negligible; `PerformanceConfig()` keeps this validation on as well.

Beyond CRLF and control characters, multi-token headers (RFC 9110 syntax) also undergo **token-whitelist validation**: `Connection` allows only `keep-alive`/`close`/`upgrade`, and `Transfer-Encoding` allows only `chunked`/`compress`/`deflate`/`gzip`/`identity`, preventing request smuggling.

## Input Sanitization and Log Redaction

HTTPC also protects the **output side**: every URL that reaches logs, error messages, or audit events passes through `SanitizeURL` (`internal/validation/sanitize.go`), preventing secondary leakage of credentials and sensitive parameters:

```go
// Before sanitization: https://user:pass@example.com/api?token=abc123&file=1
// After sanitization:  https://***:***@example.com/api?token=[REDACTED]&file=1
```

| Sanitization rule | Description |
|----------|------|
| URL credential masking | `user:pass@host` → `***:***@host` |
| Sensitive query-parameter redaction | 20+ parameter names such as `token`, `access_token`, `api_key`, `password`, `signature` (case-insensitive) → `[REDACTED]` |
| Fragment removal | Keeps OAuth implicit-grant fragments out of logs |

This sanitization is applied automatically to: URLs during error classification (raw credentials never appear in `ClientError`), request logs from `LoggingMiddleware`, audit events from `AuditMiddleware`, and proxy-credential masking in `Config.String()`.

:::tip
This layer defends against **secondary leakage** — even when an attack has already been stopped by other layers, log and error aggregation systems (ELK, Sentry) can still become gathering points for credentials. HTTPC redacts at the source by default, with no extra configuration.
:::

## Cookie Security

HTTPC provides three levels of cookie security control: config-level (global), session-level (`SessionManager`), and request-level (`WithSecureCookie`).

### CookieSecurityConfig

`CookieSecurityConfig` defines the security attributes a cookie must satisfy, defending against CSRF, XSS, and session hijacking:

| Field | Description | Default | Strict |
|------|------|---------|--------|
| RequireSecure | HTTPS transport only | `false` | `true` |
| RequireHttpOnly | Forbid JS access | `false` | `true` |
| RequireSameSite | SameSite attribute | `""` (any) | `"Strict"` |
| AllowSameSiteNone | Allow SameSite=None | `true` | `false` |
| RequireSecureForSameSiteNone | None must carry Secure | `true` | `true` |

### Config-Level Validation (Global)

```go
cfg := httpc.DefaultConfig()
// Strict mode: require Secure + HttpOnly + SameSite=Strict
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()

// Or customize
cfg.Security.CookieSecurity = &httpc.CookieSecurityConfig{
    RequireSecure:   true,
    RequireHttpOnly: true,
    RequireSameSite: "Lax",
}
```

### Session-Level Validation

```go
sm, _ := httpc.NewSessionManagerDefault()
// Affects all subsequent SetCookie calls regardless of insertion order
sm.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
```

### Request-Level Validation

```go
security := &httpc.CookieSecurityConfig{
    RequireSecure:   true,
    RequireHttpOnly: true,
}
// Note: WithSecureCookie must come after WithCookies; it only validates cookies present at apply time
result, err := client.Get("https://api.example.com",
    httpc.WithCookies(sessionCookies),
    httpc.WithSecureCookie(security),
)
```

:::warning
`WithSecureCookie` is a request-level "after-the-fact" check: it validates only the cookies that exist when it is applied. Always place it after all cookie-adding options (`WithCookies` etc.). For order-independent global validation, use config-level `CookieSecurity` or session-level `SetCookieSecurity`.
:::

## Decompression-Bomb Defense

An attacker can exhaust memory with a highly compressed gzip/deflate response (e.g. 10MB of compressed data decompressing into gigabytes). `MaxDecompressedBodySize` (default 100MB) caps the actual decompressed size, stopping decompression bombs at the source.

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxDecompressedBodySize = 50 * 1024 * 1024 // 50MB decompressed cap
```

### Priority Relationship

| Configuration | Effective limit |
|----------|----------|
| Only `MaxResponseBodySize` set | It applies (stricter) |
| Only `MaxDecompressedBodySize` set | Limits the decompressed size |
| Both set | The smaller (stricter) one wins |

:::tip
`MaxResponseBodySize` limits pre-decompression transfer bytes, while `MaxDecompressedBodySize` limits post-decompression actual bytes. Together they provide dual-layer protection.
:::

## Request Body Size Limit

`MaxRequestBodySize` caps upload request-body size, preventing the client from being coerced into sending oversized requests that drain bandwidth or memory.

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxRequestBodySize = 5 * 1024 * 1024 // 5MB upload cap
```

:::warning
Unlike `MaxResponseBodySize` (default 10MB), `MaxRequestBodySize` defaults to **0 (unlimited)** and has **no automatic fallback**. When handling user uploads or proxying forwarded requests, always set an explicit cap.
:::

## Redirect Security

Redirects are a common vector for SSRF and open-redirect attacks. HTTPC provides multiple layers of control:

```go
// Security-sensitive scenario: disable redirects entirely
cfg := httpc.SecureConfig() // FollowRedirects = false

// Or restrict redirect destination domains (wildcards like *.example.com supported)
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
    "*.cdn.example.com",
}
```

`RedirectWhitelist` supports exact matching and wildcards: `*.example.com` matches strict subdomains such as `api.example.com` but not the bare domain `example.com` (list both separately if needed). Redirects to non-whitelisted domains are blocked. Redirect targets also pass SSRF IP validation.

Beyond the whitelist, every redirect hop is checked in order (any failure rejects that hop; see `checkRedirect` in `internal/engine/transport.go`):

1. **Scheme check**: only http/https allowed; other schemes such as `file://` are rejected
2. **SSRF target validation**: the redirect host is validated against SSRF rules — targets like `http://169.254.169.254/` are rejected outright
3. **Cross-origin sensitive-header stripping**: when the target host differs from the original host, `Authorization`, `Cookie`, and `Proxy-Authorization` are removed automatically — even if the redirect is allowed, credentials are never carried to a third-party domain
4. **Redirect-loop detection**: detects A→B→A cycles and errors out (A→A with consecutive identical URLs does not count as a loop, since the server may return different responses each time)
5. **Hop-count cap**: 10 by default, with a configuration hard cap of 50 (`MaxRedirects`); no "unlimited" mode exists

For redirect-following control, chain tracking, and manual handling, see the [Redirects guide](../guides/redirects).

## Response Header Size Limit

`MaxResponseHeaderBytes` caps the server response header size, preventing a malicious server from exhausting memory with oversized headers:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.MaxResponseHeaderBytes = 1 * 1024 * 1024 // 1MB response header cap
```

The default 0 means the Go standard library default (10MB) is used. High-security deployments should tighten this to 1MB.

## Security Warning Mechanism

HTTPC emits `stderr` warnings for high-risk configurations in non-test environments, prompting developers to fix them promptly. Two configuration categories trigger warnings:

| Configuration | Warning trigger | Warning content |
|------|-------------|----------|
| `InsecureSkipVerify = true` | Detected inside `httpc.New()`, non-test environment | TLS certificate verification disabled |
| `TestingConfig()` | Detected at call time, non-test environment | TLS verification, SSRF protection, URL/header validation disabled |

Warnings use `sync.Once` so each fires at most once per process, avoiding log spam. A test environment is identified by an executable suffix of `.test` / `.test.exe`, or the `GO_TEST` / `GOTEST=1` environment variable being set.

### Redirecting or Suppressing Warnings

```go
// Redirect to a custom writer (e.g. structured logging)
httpc.SetSecurityWarnOutput(os.Stdout)

// Suppress entirely (not recommended — warnings are safety guardrails and should not be silenced)
httpc.SetSecurityWarnOutput(io.Discard)
```

:::warning
`SetSecurityWarnOutput(io.Discard)` silently swallows security warnings. Use it only after the configuration has been fully audited (e.g. confirming `TestingConfig` is used only by test binaries); never use it to mask warnings in a production deployment.
:::

## File Download Security

The file path for `Download` passes through five layers of defense in `prepareFilePath`, guarding against path traversal and file-overwrite attacks:

1. **UNC path blocking**: rejects network paths such as `\\server\share`
2. **Control-character filtering**: rejects paths containing control characters (`< 0x20`, `0x7F`, `0x00`)
3. **System-path protection**: refuses to write to system directories such as `/etc`, `/bin`, `C:\Windows` (including parent-directory symlink resolution)
4. **Path-traversal detection**: after `filepath.Clean`, blocks `../` escaping the working directory
5. **Symlink defense**: rejects paths whose target is a symlink and recursively checks parent directories to prevent TOCTOU attacks

After the download completes, you can verify file integrity via the `Checksum` field (SHA-256); on verification failure the downloaded file is automatically deleted.

## Audit Middleware

`AuditMiddleware` produces a structured audit event for each request/response cycle — a good fit for compliance-heavy environments (finance, healthcare, government). The URL is sanitized automatically (credentials removed), and sensitive request headers (Authorization, Cookie, etc.) are masked by default.

```go
auditMiddleware := httpc.AuditMiddleware(&httpc.AuditConfig{
    OnAudit: func(event httpc.AuditEvent) {
        // event.URL is already sanitized; SourceIP/UserID are extracted from context
        log.Printf("[AUDIT] %s %s -> %d (%v)",
            event.Method, event.URL, event.StatusCode, event.Duration)
    },
    Format:         "json",   // text or json
    IncludeHeaders: true,     // Record request/response headers (sensitive ones masked)
    MaskHeaders:    []string{"Authorization", "Cookie", "Set-Cookie"},
    SanitizeError:  true,     // Scrub sensitive information from errors
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

`SourceIP` and `UserID` are injected via context keys: `httpc.SourceIPKey`, `httpc.UserIDKey`. For the full audit fields, configuration options, and production practices, see the [Production Checklist](./production-checklist).

## Next Steps

- [SSRF Protection](./ssrf) - SSRF defense in depth, CIDR exemptions, and cloud-metadata protection
- [TLS and Certificate Pinning](./tls-certpin) - TLS configuration, certificate pinning, and mTLS
- [Production Checklist](./production-checklist) - Categorized pre-launch checks and verification methods
