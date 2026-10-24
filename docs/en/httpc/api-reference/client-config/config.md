---
sidebar_label: "Configuration"
title: "Configuration - CyberGo HTTPC | Config & Presets"
description: "HTTPC Config API reference: Timeouts, Connection, Security, Retry, Middleware, EnableProxyPoolHTTP2, SensitiveHeaders, ValidateConfig, proxy-rotation retry rules."
sidebar_position: 10
---

# Configuration

`Config` is HTTPC's main configuration struct, composed of five sub-configs plus `Defaults`. This page lists each field's type, default value, and validation bounds, together with the values of the five presets.

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
    Defaults   RequestDefaults
}
```

All five sub-configs and `Defaults` are **value types**. `DefaultConfig()` returns a Config with secure defaults; its fields can be modified directly.

| Field | Type | Description |
|-------|------|-------------|
| `Config.Timeouts` | `TimeoutConfig` | Request/dial/TLS-handshake/response-header/idle-connection timeouts |
| `Config.Connection` | `ConnectionConfig` | Connection pooling, proxies, HTTP/2, cookies, and DNS-over-HTTPS |
| `Config.Security` | `SecurityConfig` | TLS, validation, and SSRF protection |
| `Config.Retry` | `RetryConfig` | Automatic retries of transient failures |
| `Config.Middleware` | `MiddlewareConfig` | Per-client middleware chain |
| `Config.Defaults` | `RequestDefaults` | Per-request defaults (User-Agent, default headers) |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

`New()` deep-copies the Config internally (including the `Defaults.Headers` map and the `Middleware.Middlewares` slice). Modifying the original `cfg` after the client is created does not affect that client's behavior.

Two fields are **shared by reference** and are not deep-copied:

- `Retry.CustomPolicy`: if the custom retry policy carries mutable state, do not pass the same Config instance concurrently to multiple `New()` calls.
- `Security.CertificatePinner`: pinner implementations are expected to be concurrency-safe and can be shared across clients.

:::tip Related types
For request-level fine-grained control use the `RequestOption` function options (see [Request Options](../core/options)); a custom retry policy must implement the [`RetryPolicy`](../types/interfaces#retrypolicy) interface.
:::

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // Total request timeout (including retries), default 180s
    Dial           time.Duration // TCP connection timeout, default 10s
    TLSHandshake   time.Duration // TLS handshake timeout, default 10s
    ResponseHeader time.Duration // Wait-for-response-header timeout, default 0 (disabled, relies on context timeout)
    IdleConn       time.Duration // Idle-connection keep-alive time, default 90s
}
```

| Field | Default | Maximum |
|-------|---------|---------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

Setting a field to 0 means no timeout cap (not recommended for production). A `ResponseHeader` of 0 means that timeout is disabled.

:::tip ResponseHeader design
`ResponseHeader` defaults to 0 (disabled). In this case `TimeoutConfig.Request` or `WithTimeout()` is the sole timeout mechanism, and `WithTimeout()` has full control over request duration. This design suits AI APIs, long polling, and other scenarios that need extended response times.

Set it to a positive value only when a transport-layer hard cap is required (e.g. to defend against Slowloris attacks). Two caveats apply:

- The timeout takes effect at the Transport layer and applies to **all requests sharing the same client**.
- When it is shorter than the deadline set by `WithTimeout`, it fires first.
:::

## ProxyStrategy

```go
type ProxyStrategy = proxypool.Strategy

const (
    ProxyStrategyRoundRobin = proxypool.StrategyRoundRobin // Round-robin (default)
    ProxyStrategyRandom     = proxypool.StrategyRandom     // Random
)
```

Proxy-pool selection strategy.

| Constant | Description |
|----------|-------------|
| `ProxyStrategyRoundRobin` | Round-robin (default); each selection advances to the next proxy, so retries naturally land on different IPs |
| `ProxyStrategyRandom` | Random; uniformly selects from healthy proxies |

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Global max idle connections, default 50
    MaxConnsPerHost        int           // Max connections per host, default 10
    ProxyURL               string        // Proxy address, e.g. "http://proxy:8080"
    EnableSystemProxy      bool          // Auto-detect system proxy, default false
    ProxyPool              []string      // List of proxy servers for rotation
    ProxyPoolStrategy      ProxyStrategy // Proxy selection strategy, default RoundRobin
    ProxyFailureThreshold  int           // Consecutive-failure threshold, 0 defaults to 3
    ProxyCooldown          time.Duration // Circuit-break cooldown, 0 defaults to 30s
    ProxyRotatePerRequest  bool          // Force a different proxy for each independent request, default false
    ProxyRotateOnStatus    []int         // HTTP status codes that trigger proxy rotation
    EnableProxyPoolHTTP2   bool          // Restore HTTP/2 for a multi-proxy pool (per-proxy transports), default false
    EnableHTTP2            bool          // Enable HTTP/2, default true; forced off under a rotating multi-proxy pool unless EnableProxyPoolHTTP2 is set
    EnableCookies          bool          // Enable cookie management, default false
    PublicSuffixList       cookiejar.PublicSuffixList // Public-suffix database for the cookie jar, default nil
    EnableDoH              bool          // Enable DNS-over-HTTPS, default false
    DoHCacheTTL            time.Duration // DoH cache TTL, default 5min
    MaxResponseHeaderBytes int64         // Max response-header bytes, default 0 (uses Go stdlib default 1MB)
}
```

### Field Overview

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ConnectionConfig.MaxIdleConns` | `int` | 50 | Global maximum idle connections |
| `ConnectionConfig.MaxConnsPerHost` | `int` | 10 | Maximum connections per host (idle + active) |
| `ConnectionConfig.ProxyURL` | `string` | `""` | Explicit proxy address (e.g. `"http://proxy:8080"`); highest priority |
| `ConnectionConfig.EnableSystemProxy` | `bool` | `false` | Auto-detect system proxy settings |
| `ConnectionConfig.ProxyPool` | `[]string` | `nil` | Proxy-pool list for rotation |
| `ConnectionConfig.ProxyPoolStrategy` | `ProxyStrategy` | `ProxyStrategyRoundRobin` | Proxy selection strategy |
| `ConnectionConfig.ProxyFailureThreshold` | `int` | 3 (0 is treated as 3) | Consecutive-failure threshold before the proxy is circuit-broken |
| `ConnectionConfig.ProxyCooldown` | `time.Duration` | 30s (0 is treated as 30s) | How long a circuit-broken proxy stays out of rotation |
| `ConnectionConfig.ProxyRotatePerRequest` | `bool` | `false` | Force a different proxy for each independent request (requires `ProxyPool`) |
| `ConnectionConfig.ProxyRotateOnStatus` | `[]int` | `nil` | HTTP status codes that trigger a proxy-switch retry (requires `Retry.MaxRetries > 0`) |
| `ConnectionConfig.EnableProxyPoolHTTP2` | `bool` | `false` | Restore HTTP/2 for a multi-proxy pool (per-proxy transports); requires `EnableHTTP2=true` — see [Proxy Pool and HTTP/2](#proxy-pool-and-http-2-enableproxypoolhttp2) |
| `ConnectionConfig.EnableHTTP2` | `bool` | `true` | Enable HTTP/2; automatically forced off under a rotating multi-proxy pool unless `EnableProxyPoolHTTP2` is set |
| `ConnectionConfig.EnableCookies` | `bool` | `false` | Enable automatic cookie handling with a cookie jar |
| `ConnectionConfig.PublicSuffixList` | `cookiejar.PublicSuffixList` | `nil` | Supplies a public-suffix database to the cookie jar (recommended: `golang.org/x/net/publicsuffix.List`). Without one, the jar accepts cookies on public suffixes and applies looser domain matching, which can leak cookies across unrelated subdomains |
| `ConnectionConfig.EnableDoH` | `bool` | `false` | Enable DNS-over-HTTPS resolution |
| `ConnectionConfig.DoHCacheTTL` | `time.Duration` | 5min | Cache duration for DoH DNS responses |
| `ConnectionConfig.MaxResponseHeaderBytes` | `int64` | 0 | Maximum response-header bytes; 0 uses the Go stdlib default of 1MB (`net/http.DefaultMaxHeaderBytes`), defending against malicious servers sending oversized headers |

`PublicSuffixList` is used only when `EnableCookies` is on (i.e. the cookie jar is active). Supplying it tightens cookie domain matching and prevents supercookie leakage.

### Proxy Pool

`ProxyPool` specifies a set of proxy servers; requests are distributed among them according to `ProxyPoolStrategy`. Connection failures (dial/TLS) trigger passive circuit breaking:

- After `ProxyFailureThreshold` accumulated failures, the proxy is temporarily removed from rotation.
- After `ProxyCooldown`, the proxy recovers (half-open probing).

Priority: lower than `ProxyURL`, higher than `EnableSystemProxy`. If both `ProxyURL` and `ProxyPool` are set, `ProxyURL` takes effect (single-proxy mode).

`ProxyRotateOnStatus` specifies HTTP status codes that trigger a proxy switch on retry (e.g. `[]int{403}` for CF/WAF IP-based blocking). The field requires `Retry.MaxRetries > 0`.

Unlike connection failures, status-code rotation does **not** circuit-break the proxy. Blocking is target-specific: a proxy blocked on one site still works on another.

`ProxyRotatePerRequest` makes each independent request (e.g. each `Get`/`Post` call) use a different proxy. When disabled, HTTP connection reuse causes consecutive requests to the same host to reuse the previous request's proxy tunnel, bypassing proxy-pool selection. When enabled, idle connections are closed at the start of each request, forcing the Transport to re-evaluate the proxy pool.

The switch adds a small overhead (no connection reuse) in exchange for per-request rotation. It requires `ProxyPool`; it has no effect with `ProxyURL` or when no proxy pool is configured.

:::tip ProxyRotatePerRequest vs ProxyRotateOnStatus
Both rotate proxies, but they trigger differently:

- `ProxyRotateOnStatus` triggers a rotation retry when a **specific status code is received**. It is passive and requires retries.
- `ProxyRotatePerRequest` switches the proxy **at the start of each request**. It is active and needs no retries.

For scraping/data-collection scenarios targeting the same host, `ProxyRotatePerRequest` ensures each request has a different source IP.
:::

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin
cfg.Connection.ProxyFailureThreshold = 3
cfg.Connection.ProxyCooldown = 30 * time.Second
cfg.Connection.ProxyRotateOnStatus = []int{403}
```

#### Proxy Pool and HTTP/2 (`EnableProxyPoolHTTP2`)

While a multi-proxy pool is active (`ProxyPool` with more than one entry and no `ProxyURL`), HTTP/2 is **automatically disabled** and the pool is forced onto HTTP/1.1. net/http's h2 connection pool is keyed by target host only. With several proxies sharing one pool, every request would be pinned to whichever proxy's tunnel connected first, and rotation and load dispersion would be silently bypassed.

`EnableProxyPoolHTTP2 = true` restores HTTP/2: each proxy gets its own transport (its own h2 connection pool) behind a per-request dispatcher. Proxy rotation, `ProxyRotateOnStatus`, and `Meta.ProxyURL` reporting behave exactly as with the default forced HTTP/1. The difference is that concurrent requests routed to the same proxy multiplex over one HTTP/2 tunnel instead of opening one HTTP/1 connection each.

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyPool = []string{
    "http://proxy1:8080",
    "http://proxy2:8080",
    "http://proxy3:8080",
}
cfg.Connection.EnableHTTP2 = true          // prerequisite (DefaultConfig already sets it)
cfg.Connection.EnableProxyPoolHTTP2 = true // restore HTTP/2 for the pool

client, err := httpc.New(cfg)
```

Two trade-offs:

- **Request correlation**: requests routed to the same proxy share that proxy's connections — **including concurrent ones** (an in-flight tunnel is joined by the next same-proxy request), which correlates them at the network level. Leave the switch off when requests must not be correlatable.
  - `ProxyRotatePerRequest` does **not** prevent the sharing: rotation indexes repeat every pool-size requests, and its idle-connection drain only reaches connections that are no longer in flight.
- **Connection-limit multiplication**: `MaxConnsPerHost` and the derived per-host idle limit apply per proxy transport; the process-wide ceiling becomes limit × pool size (total dials are still capped by the engine-level global limit).

Validation and exceptions:

- The field requires `EnableHTTP2 = true`; otherwise `New()` returns `ErrInvalidConnection`. Requesting pool HTTP/2 while the master switch is off is a configuration error.
- The `Security.TLSFingerprint` path ignores the field (the fingerprint stack ships its own per-proxy backends).

For the full mechanics see [Proxy & Proxy Pool](../../guides/proxy#proxy-pools-and-http-2-enableproxypoolhttp2).

### DNS-over-HTTPS

Enabling DoH reduces DNS resolution latency and prevents DNS hijacking:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Default DoH providers (by priority): Cloudflare → Google → AliDNS. See [Connection Pool](../../guides/connection-pool) for details.

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config           // Custom TLS configuration
    MinTLSVersion           uint16                // Minimum TLS version, default TLS 1.2
    MaxTLSVersion           uint16                // Maximum TLS version, default TLS 1.3
    InsecureSkipVerify      bool                  // Skip certificate verification (testing only)
    TLSFingerprint          string                // Browser TLS fingerprint preset, default "" (standard stack, no spoofing)
    TLSFingerprintDisableSessionTickets bool      // Disable TLS session-ticket caching/resumption on the fingerprint path, default false
    MaxResponseBodySize     int64                 // Response body size limit, default 10MB
    MaxRequestBodySize      int64                 // Request body size limit, default 0 (no limit on request body size; unlike MaxResponseBodySize, no automatic fallback)
    MaxDecompressedBodySize int64                 // Decompressed body size limit, default 100MB
    AllowPrivateIPs         bool                  // Allow private IPs, default false
    SSRFExemptCIDRs         []string              // SSRF-exempt CIDRs
    ValidateURL             bool                  // URL validation, default true
    ValidateHeaders         bool                  // Header validation, default true
    StrictContentLength     bool                  // Strict Content-Length, default true
    CertificatePinner       CertificatePinner     // Certificate pinning (SPKI hash/public key), default nil (disabled)
    RedirectWhitelist       []string              // Redirect-whitelist domains
    SensitiveHeaders        []string              // Extra header names stripped as credentials on cross-origin redirects, default nil
    FollowRedirects         bool                  // Follow redirects, default true
    MaxRedirects            int                   // Max redirect count, default 10 (0 is the "unset" sentinel, falls back to 10)
}
```

#### Relationship Among the Three Size Limits

| Field | Default | Description |
|-------|---------|-------------|
| `MaxResponseBodySize` | 10MB | Limits the raw response-body byte count (as transferred, i.e. still compressed) |
| `MaxDecompressedBodySize` | 100MB | Limits the **decompressed** response-body byte count (guards against decompression bombs); falls back to `MaxResponseBodySize` when unset (≤0) |
| `MaxRequestBodySize` | 0 (no limit) | Upload request-body cap; unlike the response side there is **no automatic fallback** — it must be set explicitly to take effect |

### Certificate Pinning (CertificatePinner)

`CertificatePinner` enables certificate pinning: the TLS handshake is rejected when the server does not present a pinned key/certificate. This defends against man-in-the-middle attacks even if a trusted CA is compromised. Defaults to `nil` (disabled). Create one with the following constructors:

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
Certificate pinning requires the pinned values to be updated in sync when the server rotates its certificate (e.g. Let's Encrypt renewal). Pin multiple hashes (current + backup) and establish an update workflow to avoid connection outages caused by key rotation.
:::

:::warning SSRF protection
`AllowPrivateIPs` defaults to `false`, blocking connections to private/reserved IPs (127.0.0.1, 10.x, 192.168.x, 169.254.x, etc. — covering localhost, loopback, link-local, and private/reserved ranges).

Setting it to `true` **completely bypasses connection-level SSRF dial validation** (not just permitting private IP ranges). Use it only when connecting to internal services (VPN, proxies, corporate intranets). For selective exemptions use `SSRFExemptCIDRs` instead. See [SSRF Protection](../../security/ssrf) for details.
:::

### SSRF Exemption Example

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // VPC internal
    "100.64.0.0/10",    // Tailscale
}
```

Invalid CIDRs make `New()` return an error immediately (`invalid configuration: ...`); they are not silently ignored.

### TLS Fingerprinting (TLSFingerprint)

`TLSFingerprint` enables browser transport-layer fingerprint spoofing, simulating three parts at once:

- TLS ClientHello (JA3/JA4).
- HTTP/2 frames (SETTINGS order and values, connection window, initial stream ID, pseudo-header order).
- An ordered header block (browser-exact casing plus a version-matched User-Agent).

The value is a preset name (case-insensitive). `""` (default) uses the standard stack with no spoofing. See the [TLS Fingerprinting guide](../../guides/tls-fingerprint) for the full preset list and behavior semantics.

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSFingerprint = "chrome-latest" // or "chrome-windows", "firefox-latest", ...
client, err := httpc.New(cfg)
```

:::warning Mutually exclusive with TLSConfig
`Security.TLSConfig` is mutually exclusive with this field (validation rejects the combination). When the field is set, `MinTLSVersion`/`MaxTLSVersion` are silently ignored: the preset's ClientHello dictates the version range. See the [TLS Fingerprinting guide](../../guides/tls-fingerprint).
:::

Setting `TLSFingerprintDisableSessionTickets` to `true` makes every connection on the fingerprint path perform a full handshake. The default is `false`: Chrome profiles cache TLS session tickets per connection pool and resume repeat connections with a PSK, matching how a real browser revisits a host. See [Session Resumption](../../guides/tls-fingerprint#session-resumption) for the mechanism.

### Redirect Whitelist

`RedirectWhitelist` restricts redirects to the listed domains only; the default is `nil` (all redirect targets allowed). This field is the gate against "redirect-based SSRF". A more conservative alternative is `Security.FollowRedirects = false` (which is what `SecureConfig()` uses).

```go
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "cdn.example.com",
}
```

See [Redirects](../../guides/redirects) for the complete picture of redirect behavior.

### Sensitive Header Stripping (SensitiveHeaders)

`SensitiveHeaders` extends the set of header names treated as **credentials** when a redirect carries the request to a different origin:

- **The built-in set is always stripped**: `Authorization`, `Proxy-Authorization`, `Cookie`, `X-Api-Key`, and `X-Auth-Token` are stripped on cross-origin hops regardless of whether they are listed (net/http itself covers only the first three).
- **Custom credential headers must be listed explicitly**: a header such as `X-Secret-Key` that is not listed is forwarded verbatim to whatever the `Location` header points at, which is an open-redirect credential leak (CWE-525).
- **Entry matching**: entries are canonicalized (case-insensitive matching) and deduped.

Default: `nil`.

```go
cfg := httpc.DefaultConfig()
cfg.Security.SensitiveHeaders = []string{"X-Secret-Key", "X-Tenant-Token"}
```

Invalid header names make `New()` return `ErrInvalidSecurity` (the same key rules as `WithHeader`). For the full semantics of cross-origin credential stripping see [Redirects](../../guides/redirects).

:::warning Masking scope
Masking in `Result.String()` and audit output covers only the built-in sensitive names. Custom headers listed here **remain visible** in those outputs, so they cannot be relied on to hide credentials.
:::

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries         int           // Max retry count, default 3
    Delay              time.Duration // Initial retry delay, default 1s
    BackoffFactor      float64       // Backoff multiplier, default 2.0
    EnableJitter       bool          // Enable jitter, default true
    MaxRetryDelay      time.Duration // Max retry-delay cap, default 30s
    RetryNonIdempotent bool          // Allow retrying non-idempotent methods (POST, PATCH, custom), default false
    CustomPolicy       RetryPolicy   // Custom retry policy, default nil
}
```

| Field | Default | Range |
|-------|---------|-------|
| `RetryConfig.MaxRetries` | 3 | 0-10 |
| `RetryConfig.Delay` | 1s | 0-30min |
| `RetryConfig.BackoffFactor` | 2.0 | 1.0-10.0 |
| `RetryConfig.MaxRetryDelay` | 30s | 0-30min |
| `RetryConfig.EnableJitter` | true | — |
| `RetryConfig.RetryNonIdempotent` | false | — |
| `RetryConfig.CustomPolicy` | nil | implement [`RetryPolicy`](../types/interfaces#retrypolicy) |

Retry-delay formula: `min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

`CustomPolicy` implements the [`RetryPolicy`](../types/interfaces#retrypolicy) interface and replaces the built-in retry decisions wholesale; the default is `nil` (built-in policy).

Like the built-in policy, `CustomPolicy` is consulted only for idempotent methods. To let it govern POST/PATCH retries, also set `RetryNonIdempotent`, or use [`WithRetryNonIdempotent`](../core/options#withretrynonidempotent) per request.

When proxy status-code rotation is configured, the effective retry count is raised automatically — see [Config Derivation and Internal Conversion](#config-derivation-and-internal-conversion).

`RetryNonIdempotent` defaults to `false`, which means non-idempotent requests execute **exactly once**. A timeout or retryable 5xx may arrive after the server has already committed the operation; replaying the body would then duplicate it (duplicate payment, double insert, and so on).

Enable the switch only when the endpoint is known to tolerate replay or is guarded by an idempotency key. Idempotent methods (GET/HEAD/PUT/DELETE/OPTIONS/TRACE) are unaffected by this switch and are always retried subject to `MaxRetries`.

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares []MiddlewareFunc // Middleware list, default nil
}
```

Contains only the `Middlewares` field. Request defaults (User-Agent, default headers) live on [`RequestDefaults`](#requestdefaults); the redirect policy lives on [`SecurityConfig`](#securityconfig).

## RequestDefaults

```go
type RequestDefaults struct {
    UserAgent string            // User-Agent, default "httpc/1.0"
    Headers   map[string]string // Default request headers, default empty
}
```

`RequestDefaults` is the canonical location for per-request defaults: User-Agent and default headers. `DefaultConfig()` already supplies sensible defaults; modify them as needed.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `RequestDefaults.UserAgent` | `string` | `"httpc/1.0"` | User-Agent header |
| `RequestDefaults.Headers` | `map[string]string` | empty | Default headers added to every request |

```go
cfg := httpc.DefaultConfig()
cfg.Defaults.UserAgent = "myapp/2.0"
cfg.Defaults.Headers = map[string]string{"Accept": "application/json"}
```

## Configuration Presets

### DefaultConfig

```go
func DefaultConfig() Config
```

Secure default configuration; SSRF protection enabled by default.

### SecureConfig

```go
func SecureConfig() Config
```

Security-first configuration: shorter timeouts, auto-redirect disabled, strict SSRF protection.

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
func PerformanceConfig() Config
```

High-throughput configuration: larger connection pool, longer timeouts, security validation preserved.

:::tip
`PerformanceConfig` keeps `ValidateURL` and `ValidateHeaders` enabled for security. For maximum performance in trusted environments they can be disabled manually: `cfg.Security.ValidateURL = false`. Doing so accepts the security risks (injection attacks, SSRF).
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
func TestingConfig() Config
```

Testing-environment configuration: security checks disabled, short timeouts.

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
This configuration disables TLS verification and SSRF protection. **For testing only.** Using it outside test environments will print a security warning (see [Security Warning Output](#setsecuritywarnoutput)).
:::

### MinimalConfig

```go
func MinimalConfig() Config
```

Lightweight configuration: retries and redirects disabled, minimal connection pool.

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

## Config Derivation and Internal Conversion

When `New()` converts the public Config into the engine configuration, some zero-value fields fall back to built-in defaults. The following derivation rules change the actual behavior:

| Derived item | Rule |
|--------------|------|
| MaxIdleConnsPerHost | Computed as `MaxConnsPerHost / 2`, clamped to [2, 10] and never above MaxConnsPerHost; when `MaxConnsPerHost = 0` (unlimited connections) it takes 10 |
| TLS version fallback | `MinTLSVersion` / `MaxTLSVersion` fall back to TLS 1.2 / TLS 1.3 respectively when 0 |
| MaxRetryDelay fallback | `Retry.MaxRetryDelay` is treated as 30s when 0 |
| TCP KeepAlive | Fixed at 30s, applied automatically with the connection-pool configuration; no need to set it |
| Proxy-rotation auto-raised retries | When `ProxyRotateOnStatus` or `ProxyRotatePerRequest` is set and the proxy pool has more than 1 entry, the effective MaxRetries is raised automatically to `len(ProxyPool)-1` (capped at 10, never lowered) |
| ProxyRotateOnStatus | Passed to the engine as "extra retryable status codes"; a hit consumes one retry budget to switch proxy |

:::tip Why retries are auto-raised
With the default `MaxRetries = 3`, a pool of 5 proxies can try only up to the 4th proxy after a 403 before giving up. Setting `ProxyRotateOnStatus` or `ProxyRotatePerRequest` means walking the entire proxy pool, so the effective retry budget is raised to "pool size − 1".

If `Retry.MaxRetries` is already set to a larger value, that value is kept (auto-raising only increases the budget, never decreases it).
:::

## Security Warning Output

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

`SetSecurityWarnOutput` sets the destination for security warnings. When the process is not running in a test environment (executable name contains `.test`, or `GO_TEST` / `GOTEST=1` is set), a `[SECURITY WARNING]`-level alert is printed to this writer in either of these cases:

- `TestingConfig()` is used.
- `SecurityConfig.InsecureSkipVerify` (`Config.Security`) or `SecurityConfig.TLSConfig.InsecureSkipVerify` is `true`.

Each warning type is counted independently and printed at most once per process. The default destination is `os.Stderr`; pass `io.Discard` to fully suppress warnings, for tests or known-safe internal scenarios. A `nil` writer is normalized to `io.Discard`.

```go
// Suppress security warnings in tests
httpc.SetSecurityWarnOutput(io.Discard)
cfg := httpc.TestingConfig()
```

:::tip Scope of effect
This setting is process-level global state and affects all subsequently created clients. The `TestingConfig` and `InsecureSkipVerify` warnings share the same output writer.
:::

## Validation

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

Validates a configuration. `New()` calls it internally; it can also be called explicitly.

The equivalent method form `Config.Validate` (signature `func (c *Config) Validate() error`, delegating directly to `ValidateConfig`) suits code that already holds a Config instance and is the recommended form for new code:

```go
cfg := httpc.DefaultConfig()
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // Out of range

if err := httpc.ValidateConfig(&cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

Validation rules at a glance (passing `nil` returns `ErrNilConfig`):

| Field | Constraint |
|-------|------------|
| `Timeouts.*` (all 5) | 0 – 30min |
| `Connection.MaxIdleConns` | 0 – 1000 |
| `Connection.MaxConnsPerHost` | 0 – 1000 |
| `Connection.ProxyURL` and each `ProxyPool` entry | Must be a valid proxy URL |
| `Connection.ProxyFailureThreshold` | ≥ 0 |
| `Connection.ProxyCooldown` | 0 – 30min |
| `Connection.ProxyRotateOnStatus` | Each status code within 100 – 599 |
| `Connection.EnableProxyPoolHTTP2` | Requires `Connection.EnableHTTP2` to be set as well (the contradictory combination is `ErrInvalidConnection`) |
| `Connection.DoHCacheTTL` | ≥ 0 |
| `Connection.MaxResponseHeaderBytes` | ≥ 0 |
| `Security.MaxResponseBodySize` | 0 – 1GB |
| `Security.MaxDecompressedBodySize` | 0 – 100MB |
| `Security.MaxRequestBodySize` | 0 – 1GB |
| `Security.MinTLSVersion` / `MaxTLSVersion` | When both non-zero, Min ≤ Max |
| `Security.SSRFExemptCIDRs` | Each entry must be a valid CIDR |
| `Security.SensitiveHeaders` | Each entry must pass header-name validation (same key rules as `WithHeader`) |
| `Retry.MaxRetries` | 0 – 10 |
| `Retry.Delay` | 0 – 30min |
| `Retry.BackoffFactor` | 1.0 – 10.0 |
| `Retry.MaxRetryDelay` | 0 – 30min |
| `Security.MaxRedirects` | 0 – 50 |
| `Defaults.UserAgent` | ≤ 512 characters, no control characters |
| `Defaults.Headers` | Every key/value pair passes header-validity validation |

### Config.String

```go
func (c *Config) String() string
```

Returns a safe string representation. ProxyURL credentials are masked, TLSConfig renders as `<configured>` or `<default>`, and Headers are not output.

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

Cookie security-attribute validation configuration.

| Field | Type | Description |
|-------|------|-------------|
| `CookieSecurityConfig.RequireSecure` | `bool` | Require cookies to carry the Secure attribute |
| `CookieSecurityConfig.RequireHttpOnly` | `bool` | Require cookies to carry the HttpOnly attribute |
| `CookieSecurityConfig.RequireSameSite` | `string` | Required SameSite value, e.g. `"Strict"`, `"Lax"`; empty string means no check |
| `CookieSecurityConfig.AllowSameSiteNone` | `bool` | Whether SameSite=None is allowed; when `false` and `RequireSameSite` is empty, cookies with SameSite=None are rejected |
| `CookieSecurityConfig.RequireSecureForSameSiteNone` | `bool` | Force the Secure attribute when SameSite=None (`true` in `DefaultCookieSecurityConfig()`; `false` when constructing a zero-value struct directly — always prefer the factory constructors) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

Default cookie security configuration. Does not require Secure/HttpOnly/SameSite attributes, but enforces that cookies with SameSite=None must set Secure.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

Strict cookie security configuration. Requires Secure, HttpOnly, and SameSite=Strict.

```go
cfg := httpc.DefaultSessionConfig()
cfg.CookieSecurity = httpc.StrictCookieSecurityConfig()
```

Field-by-field comparison of the two factories:

| Field | DefaultCookieSecurityConfig | StrictCookieSecurityConfig |
|-------|------------------------------|----------------------------|
| `RequireSecure` | `false` | `true` |
| `RequireHttpOnly` | `false` | `true` |
| `RequireSameSite` | `""` (not required) | `"Strict"` |
| `AllowSameSiteNone` | `true` | `false` |
| `RequireSecureForSameSiteNone` | `true` | `true` |
