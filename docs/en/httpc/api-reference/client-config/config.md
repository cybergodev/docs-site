---
sidebar_label: "Configuration"
title: "Configuration - CyberGo HTTPC | Config & Presets"
description: "HTTPC configuration API reference: the Config struct with Timeouts, Connection, Security, Retry, and Middleware sub-configs, five presets, and ValidateConfig."
sidebar_position: 1
---

# Configuration

## Config

```go
type Config struct {
    Timeouts   *TimeoutConfig
    Connection *ConnectionConfig
    Security   *SecurityConfig
    Retry      *RetryConfig
    Middleware *MiddlewareConfig
}
```

Main configuration struct. Use `DefaultConfig()` to get secure defaults.

:::tip Sub-configs are pointers
Since v1.5.1, the five sub-configs are all **pointer types**. `DefaultConfig()` and all preset functions (`SecureConfig`, `PerformanceConfig`, etc.) automatically initialize these pointers to non-nil structs, so field accesses like `cfg.Timeouts.Request` and `cfg.Security.AllowPrivateIPs` can be used directly. If you construct a `Config{}` literal manually, assign values using the `&httpc.TimeoutConfig{...}` form, and ensure the pointer is non-nil before use.
:::

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // Total request timeout (including retries), default 180s
    Dial           time.Duration // TCP connection timeout, default 10s
    TLSHandshake   time.Duration // TLS handshake timeout, default 10s
    ResponseHeader time.Duration // Wait for response header timeout, default 0 (disabled, relies on context timeout)
    IdleConn       time.Duration // Idle connection keep-alive time, default 90s
}
```

| Field | Default | Maximum |
|-------|---------|---------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

Setting to 0 means no timeout (not recommended for production).

:::tip ResponseHeader Design
`ResponseHeader` defaults to 0 (disabled). In this case, `TimeoutConfig.Request` or `WithTimeout()` serves as the sole timeout mechanism, ensuring `WithTimeout()` has full control over request duration. This design is suitable for AI APIs and long-polling scenarios that require extended response times. Only set a positive value when you need a transport-layer hard cap (e.g., to defend against Slowloris attacks), but note that this will override `WithTimeout`.
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Global max idle connections, default 50
    MaxConnsPerHost        int           // Max connections per host, default 10
    ProxyURL               string        // Proxy address, e.g. "http://proxy:8080"
    EnableSystemProxy      bool          // Auto-detect system proxy, default false
    EnableHTTP2            bool          // Enable HTTP/2, default true
    EnableCookies          bool          // Enable cookie management, default false
    EnableDoH              bool          // Enable DNS-over-HTTPS, default false
    DoHCacheTTL            time.Duration // DoH cache TTL, default 5min
    MaxResponseHeaderBytes int64         // Max response header bytes, default 0 (uses Go stdlib default 10MB)
}
```

### DNS-over-HTTPS

Enable DoH to reduce DNS resolution latency and prevent DNS hijacking:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Default DoH providers (by priority): Cloudflare -> Google -> AliDNS. See [Connection Pool and Proxy](../../advanced/connection-pool) for details.

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config           // Custom TLS configuration
    MinTLSVersion           uint16                // Minimum TLS version, default TLS 1.2
    MaxTLSVersion           uint16                // Maximum TLS version, default TLS 1.3
    InsecureSkipVerify      bool                  // Skip certificate verification (testing only)
    MaxResponseBodySize     int64                 // Response body size limit, default 10MB
    MaxRequestBodySize      int64                 // Request body size limit, default 0 (no limit on request body size; unlike MaxResponseBodySize, no automatic fallback)
    MaxDecompressedBodySize int64                 // Decompressed body size limit, default 100MB
    AllowPrivateIPs         bool                  // Allow private IPs, default false
    SSRFExemptCIDRs         []string              // SSRF exempt CIDRs
    ValidateURL             bool                  // URL validation, default true
    ValidateHeaders         bool                  // Header validation, default true
    StrictContentLength     bool                  // Strict Content-Length, default true
    CookieSecurity          *CookieSecurityConfig // Cookie security validation
    CertificatePinner       CertificatePinner     // Certificate pinning (SPKI hash/public key), default nil (disabled)
    RedirectWhitelist       []string              // Redirect whitelist domains
}
```

### Certificate Pinning (CertificatePinner)

`CertificatePinner` enables certificate pinning: the TLS handshake is rejected when the server does not present a pinned key/certificate, defending against man-in-the-middle attacks even if a trusted CA is compromised. Defaults to `nil` (disabled). Create one with the following constructors:

| Constructor | Description |
|-------------|-------------|
| `NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)` | Create from one or more base64-encoded SPKI SHA-256 hashes (most common; supports key rotation) |
| `NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)` | Create from DER-encoded PKIX public keys (SHA-256 computed internally) |
| `NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner` | Combine multiple pinners; accepts if any passes |

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // current key
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // backup key (rotation)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::warning Maintenance cost
Certificate pinning requires the pinned value to be updated in sync when the server rotates its certificate (e.g. Let's Encrypt renewal). Pin multiple hashes (current + backup) and establish an update workflow to avoid connection outages caused by key rotation.
:::

:::warning SSRF Protection
`AllowPrivateIPs` defaults to `false`, blocking connections to private/reserved IPs (127.0.0.1, 10.x, 192.168.x, etc.). Only set to `true` when connecting to internal services.
:::

### SSRF Exemption Example

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC internal
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // Max retry count, default 3
    Delay         time.Duration // Initial retry delay, default 1s
    BackoffFactor float64       // Backoff multiplier, default 2.0
    EnableJitter  bool          // Enable jitter, default true
    MaxRetryDelay time.Duration // Max retry delay cap, default 30s
    CustomPolicy  RetryPolicy   // Custom retry policy
}
```

| Field | Default | Range |
|-------|---------|-------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

Retry delay formula: `min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // Middleware list
    UserAgent       string           // User-Agent, default "httpc/1.0"
    Headers         map[string]string // Default request headers
    FollowRedirects bool             // Follow redirects, default true
    MaxRedirects    int              // Max redirect count, default 10
}
```

## Configuration Presets

### DefaultConfig

```go
func DefaultConfig() *Config
```

Secure default configuration. SSRF protection enabled by default.

### SecureConfig

```go
func SecureConfig() *Config
```

Security-first configuration. Shorter timeouts, auto-redirect disabled, strict SSRF protection.

| Setting | Value |
|---------|-------|
| Request timeout | 15s |
| Dial timeout | 5s |
| TLSHandshake timeout | 5s |
| ResponseHeader timeout | 10s (Slowloris defense) |
| IdleConn timeout | 30s |
| MaxIdleConns | 20 |
| MaxConnsPerHost | 5 |
| MaxResponseBodySize | 5MB |
| MaxRetries | 1 |
| Delay | 2s |
| EnableJitter | true |
| FollowRedirects | false |

### PerformanceConfig

```go
func PerformanceConfig() *Config
```

High throughput configuration. Larger connection pool, longer timeouts, security validation preserved.

:::tip
PerformanceConfig keeps `ValidateURL` and `ValidateHeaders` enabled for security. For maximum performance in trusted environments, you can manually disable them: `cfg.Security.ValidateURL = false`, but be aware of security risks (injection attacks, SSRF).
:::

| Setting | Value |
|---------|-------|
| Request timeout | 60s |
| Dial timeout | 15s |
| TLSHandshake timeout | 15s |
| ResponseHeader timeout | 0 (disabled, uses Request timeout) |
| IdleConn timeout | 120s |
| MaxIdleConns | 100 |
| MaxConnsPerHost | 20 |
| EnableCookies | true |
| MaxResponseBodySize | 50MB |
| StrictContentLength | false |
| ValidateURL | true |
| ValidateHeaders | true |
| Delay | 500ms |
| BackoffFactor | 1.5 |
| EnableJitter | true |

### TestingConfig

```go
func TestingConfig() *Config
```

Testing environment configuration. Security checks disabled, short timeouts.

| Setting | Value |
|---------|-------|
| Dial timeout | 5s |
| TLSHandshake timeout | 5s |
| ResponseHeader timeout | 0 (disabled, uses Request timeout) |
| IdleConn timeout | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 5 |
| EnableHTTP2 | false |
| EnableCookies | true |
| InsecureSkipVerify | true |
| AllowPrivateIPs | true |
| ValidateURL | false |
| ValidateHeaders | false |
| MaxRetries | 1 |
| Delay | 100ms |
| EnableJitter | false |
| UserAgent | httpc-test/1.0 |

:::danger
This configuration disables TLS verification and SSRF protection. **For testing only**. Using it outside test environments will print a security warning (see [Security Warning Output](#setsecuritywarnoutput)).
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Lightweight configuration. Retries and redirects disabled, minimal connection pool.

| Setting | Value |
|---------|-------|
| Dial timeout | 5s |
| TLSHandshake timeout | 5s |
| ResponseHeader timeout | 0 (disabled, uses Request timeout) |
| IdleConn timeout | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1MB |
| MaxRetries | 0 |
| Delay | 0 |
| BackoffFactor | 1.0 |
| EnableJitter | false |
| FollowRedirects | false |

## Security Warning Output

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

Redirects the destination of security warning output. When you use `TestingConfig()` or set `SecurityConfig.InsecureSkipVerify` (`Config.Security`) to `true`, httpc prints a `[SECURITY WARNING]`-level alert to this writer (each type of warning is printed at most once per process). The default output is `os.Stderr`; pass `io.Discard` to fully suppress warnings, useful for silencing them in tests or known-safe internal scenarios.

```go
// Suppress security warnings in tests
httpc.SetSecurityWarnOutput(io.Discard)
cfg := httpc.TestingConfig()
```

:::tip Scope
This setting is process-level global state that affects all subsequently created clients. The `TestingConfig` and `InsecureSkipVerify` warnings are each counted independently (neither affects the other's triggering), but they share the same output writer.
:::

## Validation

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

Validates configuration. Called automatically by `New()`, but can also be called explicitly.

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // Out of range

if err := httpc.ValidateConfig(cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

### Config.String

```go
func (c *Config) String() string
```

Returns a safe string representation. ProxyURL credentials are masked, TLSConfig displays as `<configured>` or `<default>`, Headers are not output.

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Cookie Security

### CookieSecurityConfig

```go
type CookieSecurityConfig struct {
    RequireSecure                bool
    RequireHttpOnly              bool
    RequireSameSite              string
    AllowSameSiteNone            bool
    RequireSecureForSameSiteNone bool
}
```

Cookie security attribute validation configuration.

| Field | Type | Description |
|-------|------|-------------|
| RequireSecure | `bool` | Require Cookie to have Secure attribute |
| RequireHttpOnly | `bool` | Require Cookie to have HttpOnly attribute |
| RequireSameSite | `string` | Required SameSite value, e.g. `"Strict"`, `"Lax"`; empty string means no check |
| AllowSameSiteNone | `bool` | Whether to allow SameSite=None |
| RequireSecureForSameSiteNone | `bool` | Require Secure attribute when SameSite=None (default `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

Default cookie security configuration. Does not require Secure/HttpOnly/SameSite attributes, but enforces that cookies with SameSite=None must have Secure.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

Strict cookie security configuration. Requires Secure, HttpOnly, and SameSite=Strict.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
