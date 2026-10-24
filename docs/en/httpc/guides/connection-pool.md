---
sidebar_label: "Connection Pool & DNS"
title: "Connection Pool & DNS - CyberGo HTTPC | Pool Tuning & DoH"
description: "HTTPC connection pool and DNS guide: MaxIdleConns and MaxConnsPerHost tuning, connection caps, TIME_WAIT mitigation, DoH fallback, and HTTP/2 multiplexing."
sidebar_position: 90
---

# Connection Pool & DNS

The connection pool determines how HTTPC reuses TCP connections, and DNS resolution determines which address a connection targets; together they set concurrency capacity and connection latency. This page covers the parameters, derived rules, and DoH behavior.

## Connection Pool Configuration

HTTPC manages the connection pool through `ConnectionConfig`.

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
| `MaxConnsPerHost` | 10 | Max connections per host (active + idle) |
| `IdleConn` | 90s | Idle connection timeout; closed after expiry |
| `Dial` | 10s | Connection establishment timeout |
| `TLSHandshake` | 10s | TLS handshake timeout |
| `ResponseHeader` | 0 | Disabled (uses the Request timeout) |
| `MaxResponseHeaderBytes` | 0 | Response header size cap; 0 = Go standard-library default of 1MB (`net/http.DefaultMaxHeaderBytes`) |

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

### Derived Parameters and Internal Caps

Some connection parameters have no dedicated configuration field — the engine **derives** them from existing parameters or uses fixed values:

| Parameter | Value | Source |
|-----------|-------|--------|
| `MaxIdleConnsPerHost` | `clamp(MaxConnsPerHost/2, 2, 10)`; 10 when `MaxConnsPerHost=0` | Derived from `MaxConnsPerHost`, no separate field |
| Total connection cap per client | 1000 (active + idle) | Fixed value; exceeding it returns a pool-exhausted error |
| TCP keepalive probe interval | 30s | Fixed value |
| `ExpectContinueTimeout` | 1s | Fixed value (wait for `Expect: 100-continue`) |

:::tip TCP keepalive vs IdleConn
The 30s TCP keep-alive probe maintains a TCP-layer heartbeat — preventing NAT gateways/firewalls from silently dropping long-idle connections — while `IdleConn` decides when the HTTP layer actively closes an idle connection. The two are independent; TCP keep-alive has no public switch (always on).
:::

### When the Pool Exhausts and How to Mitigate It

The total-connection cap (1000) is enforced by an atomic admission counter **at dial time**: every new connection reserves a slot first, and the slot is returned when the connection closes. The count covers both **active and idle** connections.

When no slot is available, the dial fails immediately with an error classified as `ClientError` (`ErrorTypeNetwork`, message `connection pool exhausted`, with the underlying cause retaining the `(max 1000)` wording).

See the classification flow in [Error Types](../api-reference/types/errors#error-classification-flow).

The cap is an internal fixed value — `ConnectionConfig` exposes no field for it. It guards against extreme concurrency rather than serving as a tuning knob.

**Trigger condition**: the cap is counted per client, across all hosts. With the default `MaxConnsPerHost=10`, roughly 100 hosts must be saturated simultaneously (100 × 10) to hit the ceiling. Most of those must be in-flight active connections; idle connections are separately capped by `MaxIdleConns=50`. The realistic trigger is a high-fanout crawler hitting hundreds of hosts in parallel through a single client.

**Mitigations** (in order of preference):

1. **Split clients**: spread the fan-out traffic across multiple Clients, each with its own 1000-slot budget;
2. **Shorten `IdleConn`**: idle connections close sooner and return their slots earlier;
3. **Cap concurrency**: limit in-flight requests with a semaphore or worker pool.

For error matching patterns and handling practice, see [Error Handling](./error-handling).

### Multi-IP Dialing and IPv6 Fallback

Whether or not DoH is enabled, dialing never binds to a single resolution result. All IPs the hostname resolves to are first run through the SSRF filter, then **tried in sequence** until one connects. A typical case is falling back to IPv4 when local IPv6 is broken.

If every candidate fails, an aggregate error is returned whose message carries the number of addresses tried (e.g. `connection failed after trying 2 address(es): ...`).

- Each candidate IP's dial is individually bounded by the `Dial` timeout (default 10s): the more candidates, the longer the worst-case total connection time. For slow failures caused by a broken IPv6 environment, fix DNS/routing first instead of raising timeouts.
- On the standard DNS path, the resolution timeout is `min(Dial, 10s)` and is derived from the request context — canceling the request aborts the lookup immediately; the DoH path honors the context natively.

### Idle Connection Management

- **`IdleConn` (default 90s)**: idle connections are closed automatically when the transport-level timeout expires. Raise it for higher connection reuse; lower it to release peer-side resources sooner (watch for TIME_WAIT buildup in high-frequency short-connection workloads).
- **Active cleanup during proxy rotation**: enabling `ProxyRotatePerRequest` or the retry path of status-code rotation **automatically closes all idle connections**, forcing the next request to re-select a proxy — otherwise HTTP/2 connection reuse through CONNECT tunnels would bypass proxy selection and defeat the rotation. For proxy configuration and rotation strategies, see [Proxy & Proxy Pool](./proxy).
- **`client.Close()`**: closes all idle connections, the DoH resolver, and internal resources; requests afterwards return `ErrClientClosed`.
- **Exceeding the global `MaxIdleConns` cap**: when an idle connection is returned and the cap is full, the least-recently-used idle connection is evicted immediately (LRU) — idle connections do not necessarily survive until the `IdleConn` timeout.
- **TLS session resumption cheapens rebuilds**: when an expired idle connection has to be re-established, the built-in TLS session-ticket cache (LRU, capacity 256) skips the full handshake, so a rebuild is faster than the first connection — a complement to raising `IdleConn`.

### Response Decompression Handling

The transport layer **disables the standard library's transparent decompression**; HTTPC handles `gzip` / `deflate` manually at the response-processing layer. Decompression is bounded by `Security.MaxDecompressedBodySize` (default 100MB), defending against decompression-bomb attacks.

The standard path decompresses only these two encodings. A response with `br`, `zstd`, or an unknown `Content-Encoding` fails outright on the standard path. `br` / `zstd` are available only on the `Security.TLSFingerprint` path, which advertises `gzip, deflate, br, zstd`. `Result.RawBody()` returns decompressed bytes.

## DNS-over-HTTPS

With DoH enabled, DNS resolution goes over an encrypted HTTPS channel, preventing ISP hijacking and DNS poisoning, with built-in multi-provider failover:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute // passing 0 also falls back to 5 minutes
```

Default DoH providers (in priority order):

| Provider | Address | Description |
|----------|---------|-------------|
| Cloudflare | `1.1.1.1/dns-query` | Fastest, privacy-first |
| Google | `dns.google/resolve` | Global coverage |
| AliDNS | `dns.alidns.com/resolve` | Optimized for the China region |

### How It Works

- **Parallel A + AAAA queries**: every resolution queries IPv4 and IPv6 records simultaneously and merges the results.
- **Dual-format parsing**: picks JSON (Google/AliDNS style) or RFC 1035 wire format (Cloudflare style) from the response `Content-Type`. When it is missing or unrecognized, JSON is tried first, then wire, staying compatible with misconfigured servers.
- **Concurrent merging**: concurrent cache misses for the same host collapse into a single network round trip (singleflight), preventing cache stampedes from overloading providers.
- **Dedicated internal client**: DoH requests go through a dedicated HTTP client (5s timeout, HTTP/2 enabled) that does not consume the business connection pool or the request timeout budget.

### Fallback Chain

```text
Cloudflare (1.1.1.1) → Google (dns.google) → AliDNS → system DNS resolver
```

The first successful provider wins; if all fail, it automatically falls back to the system DNS resolver and merges both layers of errors into the message. A single provider outage never fails a request.

### Caching

| Item | Value |
|------|-------|
| TTL | `DoHCacheTTL` (default 5 minutes) |
| Capacity cap | 1000 entries; when full, expired entries are evicted first, then the ones closest to expiry |
| Response size cap | 64KB (protects against malicious DNS responses consuming excess memory) |

### Interaction with SSRF Protection

IPs resolved by DoH are first run through the SSRF filter (dropping private/reserved addresses, honoring `SSRFExemptCIDRs`), then **dialed directly to the validated IP**. There is no second DNS resolution between validation and dialing, so DNS rebinding cannot take effect.

Proxy addresses do not go through DoH resolution: proxies are configured explicitly by the developer and dialed directly (see [Proxy & Proxy Pool](./proxy)). For the full picture, see [SSRF Protection](../security/ssrf).

## HTTP/2

HTTP/2 is enabled by default (requires TLS):

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // disable HTTP/2
```

HTTP/2 features:

- **Multiplexing**: a single connection handles multiple concurrent requests
- **Header compression**: reduces repeated header transmission
- **Server push**

When disabled, the transport no longer attempts HTTP/2 negotiation (including the forced attempt for custom TLS configurations); plaintext HTTP/2 (h2c) is not supported.

HTTP/2 multiplexing means concurrent requests to the same host share one connection — exactly why proxy-rotation scenarios need idle connections closed (see per-request rotation in [Proxy & Proxy Pool](./proxy)).

One exception: while a multi-proxy rotation pool is active (`ProxyPool` with more than one entry and no `ProxyURL`), HTTP/2 is **automatically disabled** and requests are forced onto HTTP/1.1, so the shared h2 connection pool cannot pin requests to a single proxy tunnel and bypass rotation.

To restore multiplexing in that scenario, set `Connection.EnableProxyPoolHTTP2 = true` (requires `EnableHTTP2`, on by default) — see [Proxy Pools and HTTP/2](./proxy#proxy-pools-and-http-2-enableproxypoolhttp2).

## Object Pool Reuse

Internally, HTTPC reuses engine response objects and string builders via sync.Pool to reduce GC pressure; Result itself is created fresh per request and reclaimed by GC.

```go
result, err := client.Get(url)
if err != nil {
    return err
}
// Result is created fresh per request, reclaimed by GC, no manual release needed
```

For the list of pooled objects and the capacity guards, see [Performance Optimization](./performance#memory-optimization-mechanisms).

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

## Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| High TIME_WAIT count | Idle connection timeout too short | Increase the `IdleConn` timeout |
| Connection refused | Insufficient connections per host | Increase `MaxConnsPerHost` |
| Requests queuing | Connection pool too small | Increase `MaxIdleConns` |
| Want to control idle connections per host | No dedicated configuration field | Derived from `MaxConnsPerHost` (÷2, clamped to 2–10) |
| Requests fail with `connection pool exhausted` | Simultaneously open connections (active + idle) in one client reached the internal cap of 1000 | See [When the Pool Exhausts and How to Mitigate It](#when-the-pool-exhausts-and-how-to-mitigate-it); split clients, shorten `IdleConn`, or cap concurrency |
| Resolution fails after enabling DoH | All DoH providers unreachable/timing out | Built-in fallback to system DNS; check the egress network or keep defaults |
| Proxy not working or frequently circuit-broken | Interaction between proxy configuration and connection reuse | See the [Proxy & Proxy Pool](./proxy) common issues |

For complete performance anti-patterns and optimization advice, see [Performance Optimization](./performance).

## Next Steps

- [Performance Optimization](./performance) - Performance tuning guide
- [Proxy & Proxy Pool](./proxy) - Single proxy, system proxy, and pool rotation with circuit breaking
- [Configuration API](../api-reference/client-config/config) - Connection configuration field reference
- [Security Overview](../security/) - SSRF and TLS security
