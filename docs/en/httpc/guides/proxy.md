---
sidebar_label: "Proxy & Proxy Pool"
title: "Proxy & Proxy Pool - CyberGo HTTPC | Proxy Config & Rotation"
description: "HTTPC proxy guide: HTTP/HTTPS/SOCKS5 proxy, system proxy with NO_PROXY, pool strategies, circuit breaking, EnableProxyPoolHTTP2 HTTP/2, per-request rotation."
sidebar_position: 100
---

# Proxy & Proxy Pool

Whether you are traversing a corporate network, rotating egress IPs for a scraping job, or evading IP blocks on a target site, proxies are a frequent need for an HTTP client. HTTPC ships four proxy modes — single proxy, system-proxy detection, proxy-pool rotation, and status-code-triggered rotation — covering the full spectrum from "fixed egress" to "a different IP per request", and they cooperate with SSRF protection, TLS validation, and the retry engine. All proxy configuration lives in `ConnectionConfig`.

## Proxy Mode Overview

The four modes take effect automatically by priority; when several are configured, only the highest priority applies:

| Priority | Setting | Behavior | Typical scenario |
|----------|---------|----------|------------------|
| 1 (highest) | `ProxyURL` | Always use the specified proxy (single-proxy mode) | Corporate egress, local VPN port |
| 2 | `ProxyPool` | Rotate across the pool, with circuit breaking and recovery | Scraping, load dispersion, IP rotation |
| 3 | `EnableSystemProxy` | Auto-detect system proxy settings | Desktop apps following user configuration |
| 4 (lowest) | None | Direct connection | Default behavior |

:::tip
If both `ProxyURL` and `ProxyPool` are set, `ProxyURL` wins. To use the proxy pool, clear `ProxyURL`.
:::

## Single Proxy Configuration

`ProxyURL` designates one fixed proxy and supports four protocols:

| Protocol | Form | Notes |
|----------|------|-------|
| HTTP | `http://proxy:8080` | Most common; HTTPS requests are forwarded through a CONNECT tunnel |
| HTTPS | `https://proxy:8443` | TLS to the proxy server itself |
| SOCKS5 | `socks5://proxy:1080` | Resolves the target domain locally, then connects via the proxy |
| SOCKS5h | `socks5h://proxy:1080` | Domain resolution is delegated to the proxy, avoiding local DNS pollution |

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyURL = "socks5://proxy.example.com:1080"

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// Output: status: 200, proxy: socks5://proxy.example.com:1080
	log.Printf("status: %d, proxy: %s", result.StatusCode(), result.Meta.ProxyURL)
}
```

### Authentication and Masking

Proxy credentials go directly into the userinfo part of the URL:

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://user:password@proxy.example.com:8080"
```

:::tip Credentials are masked automatically
`Config.String()` replaces the username and password in proxy URLs with `***:***`; URLs in error messages and logs are sanitized the same way (credentials and sensitive query parameters are masked). Credentials never leak into logs, but the configuration itself still needs safekeeping.
:::

## System Proxy Detection and NO_PROXY

Once enabled, the operating system's proxy settings are detected automatically — no need to set `ProxyURL` by hand:

<!-- check-code: skip -->
```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableSystemProxy = true
```

### Platform Differences

| Platform | Detection source |
|----------|------------------|
| Windows | Registry Internet Settings (`ProxyEnable` / `ProxyServer`) |
| macOS | The `networksetup` command reading the preferred network service's Web/Secure Web Proxy |
| Linux | Environment variables `HTTP_PROXY` / `HTTPS_PROXY` |

:::tip Meta.ProxyURL does not cover the system proxy
The system-proxy selection is not recorded in `Result.Meta.ProxyURL` (the field only has a value under an explicit `Connection.ProxyURL` or `ProxyPool`; it stays empty for direct connections and system proxies). To confirm the egress proxy on a per-request basis, use an explicit configuration instead.
:::

### Detection Order and Details

1. **Environment variables first** (all platforms): `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` are read first (both cases recognized); if any is set, it is used directly without consulting system settings.
2. **Platform detection as fallback**: without environment variables, platform settings are read. On Linux desktops (GNOME/KDE) the proxy is usually already exported to environment variables by the session, so the engine does not read gsettings/dconf directly.
3. **Request routing**: HTTPS requests prefer `HTTPS_PROXY` and fall back to `HTTP_PROXY` when unset; HTTP requests use only `HTTP_PROXY`, also falling back to `HTTPS_PROXY` when unset — the same resolution order as net/http.
4. **CGI environments connect directly**: a proxy from environment variables does not take effect in CGI environments (`REQUEST_METHOD` set), matching net/http behavior.
5. **Bare addresses are auto-completed**: values without a protocol prefix such as `HTTP_PROXY=proxy:8080` are treated as `http://`.
6. **Caching**: the detection result is cached for the client's lifetime and does not hot-reload when environment variables change; create a new client to pick up changes.

### NO_PROXY Bypass Rules

`NO_PROXY` lists hosts that bypass the proxy, with semantics matching net/http's httpproxy package:

| Rule | Example | Match scope |
|------|---------|-------------|
| Bypass everything | `*` | All hosts connect directly |
| Domain suffix | `example.com` or `.example.com` | The domain and all its subdomains |
| Wildcard subdomains | `*.example.com` | Equivalent to `.example.com` |
| IP literal | `10.0.0.5` | Exact match on that IP |
| CIDR range | `10.0.0.0/8` | All IPs inside the range |
| Host + port | `example.com:443` | Host matches and the port is exact |

Separate multiple rules with commas; `localhost` always connects directly and does not need to be listed in `NO_PROXY`.

```bash
# Linux/macOS example
export HTTPS_PROXY=http://proxy.corp.example.com:8080
export NO_PROXY=localhost,127.0.0.1,.internal.corp.com,10.0.0.0/8
```

```powershell
# Windows (PowerShell) example
$env:HTTPS_PROXY = "http://proxy.corp.example.com:8080"
$env:NO_PROXY = "localhost,127.0.0.1,.internal.corp.com"
```

:::warning Limitation of dynamic localhost proxies
In system-proxy mode, the SSRF exemption list is probed only once, at client construction. If the system proxy switches to a new internal/loopback address at runtime (e.g. `127.0.0.1`), that address may be blocked by SSRF protection. For dynamic setups, set `Connection.ProxyURL` explicitly (proxy addresses are always exempt from SSRF validation) or configure `SSRFExemptCIDRs`.
:::

## Proxy Pool

When requests need to be spread across multiple proxy IPs (scraping, load dispersion, IP rotation), the proxy pool provides automatic rotation, passive circuit breaking, and status-based switching — with no external components.

### Basic Usage

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyPoolStrategy = httpc.ProxyStrategyRoundRobin // default, may be omitted

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// Output: status: 200, proxy: http://proxy1:8080 (the next request automatically lands on proxy2)
	log.Printf("status: %d, proxy: %s", result.StatusCode(), result.Meta.ProxyURL)
}
```

Pool entries support the `http`, `https`, `socks5`, and `socks5h` protocols and can be mixed.

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ProxyPool` | `[]string` | `nil` | List of proxy URLs |
| `ProxyPoolStrategy` | `ProxyStrategy` | `ProxyStrategyRoundRobin` | Selection strategy |
| `ProxyFailureThreshold` | `int` | `3` (0 falls back) | Consecutive-connection-failure threshold for circuit breaking |
| `ProxyCooldown` | `time.Duration` | `30s` (0 falls back) | Cooldown for circuit-broken proxies |
| `ProxyRotatePerRequest` | `bool` | `false` | Force a different proxy for each independent request (disables idle connection reuse) |
| `ProxyRotateOnStatus` | `[]int` | `nil` | Status codes that trigger a proxy-switching retry (each must be 100–599) |

### Selection Strategy

| Strategy | Constant | Description |
|----------|----------|-------------|
| Round-robin (default) | `ProxyStrategyRoundRobin` | Cycles through proxies in order; every selection advances the cursor |
| Random | `ProxyStrategyRandom` | Picks uniformly at random from healthy proxies |

:::tip Round-robin + retries = automatic IP switching
The round-robin strategy advances the cursor on every selection, so a retry that triggers another selection naturally lands on the next proxy — no extra configuration needed.
:::

### Passive Circuit Breaking

The proxy pool has built-in passive health checking. Only **connection-level failures** (dial/TLS) trigger circuit breaking; HTTP status codes do not:

```text
Proxy connection failure
    ↓
Failure count +1
    ↓
Consecutive failures ≥ ProxyFailureThreshold → circuit open (removed from rotation)
    ↓
Wait ProxyCooldown → half-open probe (restored to rotation)
    ↓
Success → reset count, close circuit
First failure → re-open circuit
```

<!-- check-code: skip -->
```go
cfg.Connection.ProxyFailureThreshold = 5        // more tolerant of transient flaps
cfg.Connection.ProxyCooldown = 60 * time.Second // longer cooldown
```

When every proxy is circuit-broken, the proxy with the shortest cooldown (closest to recovery) is returned as a fallback instead of failing outright.

### Status-Code Rotation

For Cloudflare/WAF-style IP blocking — when the response carries specific status codes, the proxy is switched automatically and the request retried:

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotateOnStatus = []int{403} // switch proxy and retry on 403
	cfg.Retry.MaxRetries = 3                        // retries must be enabled

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://protected-site.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// Output: status: 200, proxy: http://proxy2:8080, attempts: 2
	log.Printf("status: %d, proxy: %s, attempts: %d",
		result.StatusCode(), result.Meta.ProxyURL, result.Meta.Attempts)
}
```

:::warning Status-code rotation ≠ circuit breaking
Rotation triggered by `ProxyRotateOnStatus` does **not** circuit-break the proxy — IP blocks are often target-specific (a proxy blocked on site A may work fine on site B). Circuit breaking is triggered only by connection-level failures. `Retry.MaxRetries > 0` is required for it to take effect.

When `ProxyRotateOnStatus` is set and the pool holds multiple proxies, the retry budget is automatically raised to `len(ProxyPool) - 1` (capped at the `MaxRetries` limit of 10), ensuring every proxy gets a chance.
:::

### Per-Request Rotation

`ProxyRotatePerRequest` solves the problem of **connection reuse** pinning the proxy tunnel: an HTTP connection pool reuses established TCP connections, including their proxy tunnels. That means consecutive requests to the same host reuse the previous request's proxy, even when `ProxyPoolStrategy` has already rotated the selector cursor.

When enabled, all idle connections are closed at the start of each request, forcing the Transport to re-evaluate the proxy pool — the cost is no connection reuse (each request establishes a new connection + proxy tunnel), but per-request rotation is guaranteed:

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotatePerRequest = true // rotate the proxy on every request

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	for i := 0; i < 3; i++ {
		result, err := client.Get("https://api.example.com/data")
		if err != nil {
			log.Fatal(err)
		}
		// Output (in order): http://proxy1:8080 / http://proxy2:8080 / http://proxy3:8080
		log.Printf("request %d went through: %s", i+1, result.Meta.ProxyURL)
	}
}
```

:::tip When to use it
Suited for scraping the same host — every request comes from a different source IP, lowering the risk of being IP-blocked by the target site. For requests to different hosts, connection reuse does not pin the same proxy, so enabling it is usually unnecessary.
:::

Like `ProxyRotateOnStatus`, `ProxyRotatePerRequest` automatically raises the retry budget to `len(ProxyPool) - 1` when the pool holds multiple proxies (capped at 10), ensuring every proxy is tried at least once.

### Deterministic Rotation

Status-code rotation retries differ from ordinary retries: the engine reserves a **base proxy index** per request, and the Nth retry deterministically uses the proxy at "base + N", which yields three guarantees:

- **Every retry switches proxy**: within one request, retry N and retry N-1 always land on different proxies;
- **Redirect chains stay on track**: multiple hops within one attempt share the same index, so following redirects never desynchronizes the proxy selection by consuming extra picks;
- **Rotation continues across requests**: the base index increments across requests, preserving the overall round-robin/random distribution.

In addition, connection failures of the proxy itself (dial/TLS failures) are **always retryable** while rotation is active — even when the regular classification says non-retryable (e.g. a permanent address error), the next attempt switches proxies and tries again, and passive circuit breaking naturally weeds out bad proxies. For the retry-side details, see [Retry and Fault Tolerance](./retry-fault-tolerance).

### Proxy Pools and HTTP/2 (`EnableProxyPoolHTTP2`)

While a multi-proxy pool is active (`ProxyPool` with more than one entry and no `ProxyURL`), HTTP/2 is **automatically disabled** and the pool is forced onto HTTP/1.1. The reason lies in net/http's connection-reuse model: the h2 connection pool is keyed by target host only, so with several proxies sharing one pool, every request gets pinned to whichever proxy's tunnel connected first — rotation and load dispersion are silently bypassed, and hard to notice. On HTTP/1 every new connection re-consults the pool, so rotation stays reliable.

`Connection.EnableProxyPoolHTTP2 = true` restores HTTP/2 for the pool: each proxy gets its **own transport** (its own h2 connection pool) behind a per-request dispatcher. Rotation, `ProxyRotateOnStatus`, circuit breaking, and `Meta.ProxyURL` reporting behave exactly as with the default forced HTTP/1; the only difference is that concurrent requests routed to the **same proxy** multiplex over one HTTP/2 tunnel instead of each opening an HTTP/1 connection.

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	// EnableHTTP2 is already true (DefaultConfig) — the prerequisite for this flag
	cfg.Connection.EnableProxyPoolHTTP2 = true

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://api.example.com/data")
	if err != nil {
		log.Fatal(err)
	}
	// Output: status: 200, proxy: http://proxy1:8080, protocol: HTTP/2.0
	log.Printf("status: %d, proxy: %s, protocol: %s",
		result.StatusCode(), result.Meta.ProxyURL, result.Proto())
}
```

:::warning Two trade-offs
- **Request correlation**: requests routed to the same proxy share that proxy's connections — **including concurrent ones** (an in-flight tunnel is joined by the next same-proxy request), which correlates them at the network level. Leave this off when requests must not be correlatable; `ProxyRotatePerRequest` does **not** prevent the sharing — rotation indexes repeat every pool-size requests, and its idle-connection drain only reaches connections that are no longer in flight.
- **Connection-limit multiplication**: `MaxConnsPerHost` and the derived per-host idle limit apply per proxy transport; the process-wide ceiling becomes limit × pool size (total dials are still capped by the engine-level global limit).
:::

Validation and exception: the field requires `Connection.EnableHTTP2 = true` (the default), otherwise `New()` returns `ErrInvalidConnection` outright; the `Security.TLSFingerprint` path ignores it — the fingerprint stack ships its own per-proxy backends and supports HTTP/2 natively. For the field-level reference see the [Configuration API](../api-reference/client-config/config#proxy-pool-and-http-2-enableproxypoolhttp2).

## Finding Out Which Proxy a Request Used

Proxy-pool setups often need to audit "which egress this request actually used". Two tools work together:

- **`Result.Meta.ProxyURL`**: reports the proxy used by the attempt that produced the final response; an empty string for direct connections, and system proxies (`EnableSystemProxy`) are likewise not recorded (still empty). Under rotation each retry may use a different proxy — this field reflects the **final** attempt.
- **The `WithOnResponse` callback**: fires on every attempt (including proxy-switching retries), letting you observe per-attempt status codes and attempt counts.

```go
package main

import (
	"log"

	"github.com/cybergodev/httpc"
)

func main() {
	cfg := httpc.DefaultConfig()
	cfg.Connection.ProxyPool = []string{
		"http://proxy1:8080",
		"http://proxy2:8080",
		"http://proxy3:8080",
	}
	cfg.Connection.ProxyRotateOnStatus = []int{403}

	client, err := httpc.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	result, err := client.Get("https://protected-site.example.com/data",
		httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
			log.Printf("attempt %d got %d", resp.Attempts(), resp.StatusCode())
			return nil
		}),
	)
	if err != nil {
		log.Fatal(err)
	}

	// Output: final proxy: http://proxy2:8080, total attempts: 2
	log.Printf("final proxy: %s, total attempts: %d", result.Meta.ProxyURL, result.Meta.Attempts)
}
```

:::tip Callbacks run per attempt, middleware runs per request
`WithOnResponse` fires inside the engine, on every attempt (including retries); the middleware chain wraps the whole retry cycle and runs once per logical request. Use callbacks for per-attempt observation and [middleware](./middleware-chain) for whole-request auditing.
:::

## Proxy and Retry Interaction

Proxy rotation and the retry engine are deeply integrated; two rules are worth memorizing.

**1. The retry budget is raised automatically.** When `ProxyRotateOnStatus` or `ProxyRotatePerRequest` is set and the pool holds more than one proxy:

```text
effective MaxRetries = max(configured MaxRetries, len(ProxyPool) - 1) (capped at 10)
```

For example, 5 proxies with `MaxRetries = 3`: the budget is raised to 4 (= 5 - 1); the first request uses proxy1, and after a 403 it switches through proxy2…proxy5, trying each proxy exactly once.

**2. Proxy connection failures are force-retried.** While rotation is active, connection failures of the proxy itself (dial failure, TLS failure) bypass the regular retryability classification and go straight into the next retry on the next proxy — permanently dead proxies (wrong port, unreachable host) do not need to be pruned by hand; forced retries plus consecutive-failure circuit breaking eliminate them naturally.

For retry conditions, the backoff math, and the total timeout budget shared across retries, see [Retry and Fault Tolerance](./retry-fault-tolerance).

## Security Notes for Proxy Scenarios

The proxy features handle the following security details automatically — no manual configuration needed:

- **SSRF exemption**: proxy host addresses (`ProxyURL` and every `ProxyPool` entry) are added to the SSRF exemption list automatically and are never blocked by private-IP checks — local proxies (e.g. `127.0.0.1:7890`) work out of the box.
- **Deduplication**: pool entries with the same `host:port` are merged automatically, avoiding rotation skew and double counting.
- **URL validation**: every proxy URL goes through security validation (protocol whitelist http/https/socks5/socks5h, non-empty host, injection protection); an invalid value makes `New()` return an error instead of being silently ignored.

Relationship with TLS: an HTTPS request through an HTTP proxy's CONNECT tunnel is still **end-to-end TLS** — certificate validation, minimum TLS version, and certificate pinning all apply to the target site as usual, and the proxy only ever forwards ciphertext. If local DNS pollution is a concern, prefer `socks5h` (domain resolution delegated to the proxy); with DoH enabled, business domains resolve over the encrypted channel, but the proxy address itself does not go through DoH (proxies are configured explicitly by the developer and dialed directly). For the full SSRF picture, see [SSRF Protection](../security/ssrf).

## Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Proxy not taking effect | Both `ProxyURL` and `ProxyPool` set; `ProxyURL` wins | Clear `ProxyURL` and use only `ProxyPool` |
| Egress IP unchanged for consecutive requests to the same host | Connection reuse pinned the previous proxy tunnel | Enable `ProxyRotatePerRequest` |
| Proxies circuit-breaking frequently | `ProxyFailureThreshold` too low | Increase the threshold or `ProxyCooldown` |
| Status-code rotation not working | `Retry.MaxRetries = 0`, or the pool has only 1 proxy | Set `MaxRetries > 0`; keep at least 2 proxies in the pool |
| What happens when all proxies are broken | The whole pool failed consecutively | The engine falls back to the proxy closest to recovery instead of failing outright; check proxy availability and thresholds |
| System proxy not detected | Environment variables missing and platform settings off | Verify `HTTP_PROXY`/`HTTPS_PROXY` or the system proxy switch |
| Localhost proxy blocked by SSRF | The system proxy's exemption list is probed only at construction | Set `Connection.ProxyURL` explicitly (always exempt) or configure `SSRFExemptCIDRs` |
| Was the proxy circuit-broken after a 403 switch? | Mistakenly assuming status codes trigger circuit breaking | No — status-code rotation never breaks a proxy; only connection-level failures do |
| Why is the pool running HTTP/1.1? | A multi-proxy pool forces HTTP/1 by default, preventing the shared h2 pool from pinning every request to the first proxy | Set `Connection.EnableProxyPoolHTTP2 = true` when you need multiplexing (requires `EnableHTTP2`) — see [Proxy Pools and HTTP/2](#proxy-pools-and-http-2-enableproxypoolhttp2) |
| `Meta.ProxyURL` always empty | Only the system proxy is in effect — `EnableSystemProxy` is not recorded in this field | Use an explicit `ProxyURL` or `ProxyPool` when you need to observe the egress |

For the complete field reference, see [Configuration API — Proxy Pool](../api-reference/client-config/config#proxy-pool).

## Best Practices

| Scenario | Recommended configuration |
|----------|---------------------------|
| Fixed corporate egress | `ProxyURL` (http/https/socks5 as needed) |
| Follow user system settings | `EnableSystemProxy` + `NO_PROXY` allowing internal ranges |
| Multi-proxy load dispersion | `ProxyPool` + the default round-robin strategy |
| Scraping the same host | `ProxyPool` + `ProxyRotatePerRequest` |
| CF/WAF IP blocking | `ProxyPool` + `ProxyRotateOnStatus: []int{403}` |
| Mixed proxy quality | Increase `ProxyFailureThreshold` (tolerate flaps) and `ProxyCooldown` |
| Auditing the egress IP | Read `Result.Meta.ProxyURL`, combined with `WithOnResponse` for per-attempt observation |
| Managing proxy credentials | Keep them in the URL userinfo (auto-masked in logs); store the configuration file separately |

:::warning The performance cost of rotation
Both `ProxyRotatePerRequest` and the retry path of status-code rotation close idle connections, trading connection reuse for egress rotation. For performance-sensitive scenarios that do not need rotation, keep the defaults (reuse connections); see [Connection Pool & DNS](./connection-pool) for idle-connection management.
:::

## Next Steps

- [Connection Pool & DNS](./connection-pool) - How connection reuse interacts with proxy rotation, and DoH resolution
- [Retry and Fault Tolerance](./retry-fault-tolerance) - Retry conditions, backoff algorithm, and proxy-pool interplay
- [Performance Optimization](./performance) - The performance cost of proxy rotation and overall tuning
- [Configuration API](../api-reference/client-config/config) - ConnectionConfig proxy field reference
