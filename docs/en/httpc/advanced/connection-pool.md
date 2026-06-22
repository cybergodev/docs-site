---
title: "Connection Pool and Proxy - CyberGo HTTPC | Pool & Proxy"
description: "HTTPC connection pool and proxy guide: MaxIdleConns tuning, ProxyURL manual and system proxy, SOCKS5/HTTP proxies, DoH fallback, and HTTP/2 configuration."
---

# Connection Pool and Proxy

## Connection Pool Configuration

Connection pools are a key factor in HTTP client performance. HTTPC uses `ConnectionConfig` to manage connection pools.

```go
cfg := httpc.DefaultConfig()

// Connection pool parameters
cfg.Connection.MaxIdleConns = 100         // Global max idle connections
cfg.Connection.MaxConnsPerHost = 20       // Max connections per host
cfg.Timeouts.IdleConn = 120 * time.Second // Idle connection keep-alive
```

### Parameter Description

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MaxIdleConns` | 50 | Global max idle connections |
| `MaxConnsPerHost` | 10 | Max connections per host (including active + idle) |
| `IdleConn` | 90s | Idle connection timeout; closed after expiry |
| `Dial` | 10s | Connection establishment timeout |
| `TLSHandshake` | 10s | TLS handshake timeout |
| `ResponseHeader` | 0 | Disabled (uses Request timeout) |

### Scenario Recommendations

| Scenario | MaxIdleConns | MaxConnsPerHost | IdleConn |
|----------|-------------|-----------------|----------|
| High-concurrency API | 100 | 20 | 120s |
| General service | 50 | 10 | 90s |
| Low-frequency requests | 10 | 2 | 30s |
| Internal microservices | 50 | 10 | 60s |

:::tip
`MaxConnsPerHost` includes both active and idle connections. New requests exceeding this limit queue until a connection is released.
:::

## Proxy Configuration

### Manual Proxy

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy.example.com:8080"

client, _ := httpc.New(cfg)
```

### Proxy with Authentication

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip
`Config.String()` automatically masks the username and password in proxy URLs.
:::

### SOCKS5 Proxy

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"
```

### System Proxy Auto-Detection

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true

// Auto-detects:
// - Windows: Registry Internet Settings
// - macOS: System Preferences Network Proxy
// - Linux: Environment variables HTTP_PROXY / HTTPS_PROXY
```

Proxy priority:

1. `ProxyURL` (manually specified, highest priority)
2. `EnableSystemProxy` (system proxy detection)
3. Direct connection (no proxy)

## DNS-over-HTTPS

Enable DoH to reduce DNS resolution latency and prevent DNS hijacking:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Default DoH providers (in priority order):

| Provider | Address | Description |
|----------|---------|-------------|
| Cloudflare | `1.1.1.1/dns-query` | Fastest, privacy-first |
| Google | `dns.google/resolve` | Global coverage |
| AliDNS | `dns.alidns.com/resolve` | Optimized for China region |

:::tip
When DoH is enabled, DNS resolution results are cached for `DoHCacheTTL` duration. If all DoH providers are unavailable, it falls back to system DNS.
:::

## HTTP/2

HTTP/2 is enabled by default (requires TLS):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Disable HTTP/2
```

HTTP/2 features:
- Multiplexing: Single connection handles multiple concurrent requests
- Header compression: Reduces repeated header transmission
- Server push

## Object Pool Reuse

Internally, HTTPC reuses engine response objects and string builders via sync.Pool to reduce GC pressure; Result itself is created fresh per request and reclaimed by GC.

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result is created fresh per request, reclaimed by GC, no manual release needed
```

In high-concurrency scenarios, internal object pool reuse significantly reduces GC pressure.

## Concurrent Request Pattern

```go
func fetchAll(ctx context.Context, urls []string) ([]*httpc.Result, error) {
    results := make([]*httpc.Result, len(urls))
    errs := make([]error, len(urls))

    var wg sync.WaitGroup
    for i, url := range urls {
        wg.Add(1)
        go func(idx int, u string) {
            defer wg.Done()
            result, err := client.Request(ctx, "GET", u)
            results[idx] = result
            errs[idx] = err
        }(i, url)
    }
    wg.Wait()

    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }
    return results, nil
}
```

## Connection Pool Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Many TIME_WAIT | Idle connection timeout too short | Increase `IdleConn` timeout |
| Connection refused | Insufficient connections per host | Increase `MaxConnsPerHost` |
| Requests queuing | Connection pool too small | Increase `MaxIdleConns` |

For complete performance anti-patterns and optimization recommendations, see [Performance Optimization](./performance).

## Next Steps

- [Performance Optimization](./performance) - Performance tuning guide
- [Configuration API](../api-reference/config) - Connection configuration reference
- [Security Overview](../security/) - SSRF and TLS security
