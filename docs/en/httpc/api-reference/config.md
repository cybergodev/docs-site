---
title: "Configuration - HTTPC"
description: "HTTPC configuration API reference covering the Config struct, five sub-config groups, five preset functions, and the Validate method."
---

# Configuration

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
}
```

Main configuration struct. Obtain secure defaults through `DefaultConfig()`.

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
    ResponseHeader time.Duration // Wait for response header timeout, default 0 (disabled, uses context timeout)
    IdleConn       time.Duration // Idle connection keep-alive duration, default 90s
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
`ResponseHeader` defaults to 0 (disabled). In this case, `Timeouts.Request` or `WithTimeout()` serves as the sole timeout mechanism, ensuring `WithTimeout()` has full control over request duration. This design is essential for AI APIs and long-polling endpoints. Only set to a positive value when you need a hard transport-level cap (e.g., defense-in-depth against Slowloris attacks), but be aware this will override `WithTimeout`.
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
    BrowserFingerprint     string        // TLS fingerprint spoofing, default "" (uses standard Go TLS)
    MaxResponseHeaderBytes int64         // Max response header bytes, default 0 (uses Go standard library default 10MB)
}
```

### DNS-over-HTTPS

Enable DoH to reduce DNS resolution latency and prevent DNS hijacking:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Default DoH providers (in priority order): Cloudflare → Google → AliDNS. See [Connection Pool and Proxy](../advanced/connection-pool) for details.

### TLS Fingerprint Spoofing

Enable `BrowserFingerprint` to mimic real browser TLS ClientHello handshakes, bypassing TLS fingerprint-based anti-bot detection. When set, connections use utls instead of Go's standard `crypto/tls`:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.BrowserFingerprint = "chrome" // Options: "chrome", "firefox", "safari", "ios"
```

| Value | Emulated Browser |
|-------|-----------------|
| `"chrome"` | Google Chrome |
| `"firefox"` | Mozilla Firefox |
| `"safari"` | Apple Safari |
| `"ios"` | iOS Safari |
| `""` (default) | Uses standard Go TLS |

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Custom TLS configuration
    MinTLSVersion           uint16         // Minimum TLS version, default TLS 1.2
    MaxTLSVersion           uint16         // Maximum TLS version, default TLS 1.3
    InsecureSkipVerify      bool           // Skip certificate verification (testing only)
    MaxResponseBodySize     int64          // Response body size limit, default 10MB
    MaxRequestBodySize      int64          // Request body size limit, default 0 (uses MaxResponseBodySize value)
    MaxDecompressedBodySize int64          // Decompressed size limit, default 100MB
    AllowPrivateIPs         bool           // Allow private IPs, default false
    SSRFExemptCIDRs         []string       // SSRF exempt CIDRs
    ValidateURL             bool           // URL validation, default true
    ValidateHeaders         bool           // Header validation, default true
    StrictContentLength     bool           // Strict Content-Length, default true
    CookieSecurity          *CookieSecurityConfig // Cookie security validation
    RedirectWhitelist       []string       // Redirect whitelist domains
}
```

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
    MaxRetries    int           // Maximum retry count, default 3
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
    MaxRedirects    int              // Maximum redirect count, default 10
}
```

## Configuration Presets

### DefaultConfig

```go
func DefaultConfig() *Config
```

Secure default configuration. SSRF protection is enabled by default.

### SecureConfig

```go
func SecureConfig() *Config
```

Security-first configuration. Shorter timeouts, auto-redirects disabled, strict SSRF protection.

| Configuration | Value |
|---------------|-------|
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

High throughput configuration. Larger connection pool, longer timeouts, maintains security validation.

:::tip
PerformanceConfig keeps `ValidateURL` and `ValidateHeaders` enabled for security. In trusted environments, you can manually disable them: `cfg.Security.ValidateURL = false`, but be aware of security risks (injection attacks, SSRF).
:::

| Configuration | Value |
|---------------|-------|
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

Test environment configuration. Disables security checks, short timeouts.

| Configuration | Value |
|---------------|-------|
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
This configuration disables TLS verification and SSRF protection. **Only use it for testing.** A security warning is printed when used in non-test environments.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Lightweight configuration. Disables retries and redirects, minimal connection pool.

| Configuration | Value |
|---------------|-------|
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

Returns a safe string representation. ProxyURL credentials are sanitized, TLSConfig displays as `<configured>` or `<default>`, and Headers are not output.

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
| `RequireSecure` | `bool` | Require cookies to have the Secure attribute |
| `RequireHttpOnly` | `bool` | Require cookies to have the HttpOnly attribute |
| `RequireSameSite` | `string` | Required SameSite value, e.g. `"Strict"`, `"Lax"`; empty string means no check |
| `AllowSameSiteNone` | `bool` | Whether to allow SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | Require Secure attribute when SameSite=None (default `true`) |

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
