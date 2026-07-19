---
sidebar_label: "FAQ"
title: "FAQ - CyberGo HTTPC | Common Q&A"
description: "HTTPC FAQ: package functions vs clients, configuration presets, proxy and DoH, Cookie sessions, retry and timeout tuning, and errors.Is/As matching."
sidebar_position: 1
---

# FAQ

## When should I use package-level functions vs. creating a client?

**Package-level functions** are suitable for simple scenarios: one-off requests, scripts, tools.

```go
result, _ := httpc.Get("https://api.example.com/data")
```

**Creating a client** is suitable when you need custom configuration, connection pool reuse, or middleware.

```go
client, _ := httpc.New(httpc.PerformanceConfig())
defer client.Close()
```

## How do I choose a configuration preset?

| Preset | Use Case |
|--------|----------|
| `DefaultConfig()` | General purpose, secure defaults |
| `SecureConfig()` | Handling user-provided URLs, financial/medical scenarios |
| `PerformanceConfig()` | Internal microservice communication, high-concurrency APIs |
| `TestingConfig()` | Unit testing, local development |
| `MinimalConfig()` | One-off scripts, simple HTTP calls |

## How do I access internal services?

SSRF protection blocks private IP connections by default. To access internal services:

```go
cfg := httpc.DefaultConfig()
cfg.Security.AllowPrivateIPs = true // Warning: fully disables all connection-level SSRF dial validation (not only private IPs); prefer SSRFExemptCIDRs for precise exemptions in production

// Or precise exemptions
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}
```

## How do I set up a proxy?

```go
cfg := httpc.DefaultConfig()
cfg.Connection.ProxyURL = "http://proxy:8080"
client, _ := httpc.New(cfg)

// Use system proxy
cfg.Connection.EnableSystemProxy = true
```

## How do I handle HTTP error codes?

HTTPC does not treat 4xx/5xx as errors. You need to check manually:

```go
result, err := client.Get(url)
if err != nil {
    // Network-level error
    return err
}

switch {
case result.IsSuccess():
    // 2xx success
case result.IsClientError():
    // 4xx client error
    log.Printf("Request parameter error: %d", result.StatusCode())
case result.IsServerError():
    // 5xx server error
    log.Printf("Server failure: %d", result.StatusCode())
}
```

## How do I disable retries?

```go
// Disable globally
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 0

// Or use MinimalConfig
client, _ := httpc.New(httpc.MinimalConfig())

// Disable for a single request
result, _ := client.Get(url, httpc.WithMaxRetries(0))
```

## How do I set a request timeout?

Four ways, from highest to lowest priority:

```go
// 1. Context timeout (recommended)
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
result, _ := client.Request(ctx, "GET", url)

// 2. Request option
result, _ := client.Get(url, httpc.WithTimeout(5*time.Second))

// 3. Middleware enforced timeout
middleware := httpc.TimeoutMiddleware(5 * time.Second)

// 4. Client default timeout
cfg.Timeouts.Request = 30 * time.Second
```

## How do I log requests?

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(func(format string, args ...any) {
        log.Printf("[HTTP] "+format, args...)
    }),
}
client, _ := httpc.New(cfg)
```

## Why does TestingConfig print a warning?

`TestingConfig` disables security features (TLS verification, SSRF protection), which poses security risks in non-test environments. A warning is printed when a non-test environment is detected.

Only use it in `*_test.go` files or local development.

## How do I enable DNS-over-HTTPS?

DoH can reduce DNS resolution latency and prevent DNS hijacking:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

It defaults to three providers: Cloudflare, Google, and AliDNS (with priority-based fallback). If all DoH providers are unavailable, it automatically falls back to system DNS.

:::tip
DoH is useful for scenarios that require DNS resolution security. For regular API calls, there is no need to enable it; the default DNS is sufficient.
:::

## More Resources

- [Quick Start](../getting-started/) - Get started in 5 minutes
- [Tutorial](../guides/tutorial) - A step-by-step complete example
- [Configuration API](../api-reference/client-config/config) - Complete configuration reference
- [Error Handling](../advanced/error-handling) - Error handling guide
