---
title: "Production Checklist - CyberGo HTTPC | Pre-Deploy Audit"
description: "HTTPC production security checklist: TLS verification, SSRF and CIDR audit, timeout configuration, response size limits, retry strategy, and audit monitoring."
---

# Production Checklist

## Required Checks

### TLS Configuration

- [ ] `InsecureSkipVerify` set to `false` (default value)
- [ ] `MinTLSVersion` at least `tls.VersionTLS12`
- [ ] Not using `TestingConfig()`

### SSRF Protection

- [ ] `AllowPrivateIPs` is `false` (default value)
- [ ] If accessing internal services, use `SSRFExemptCIDRs` with precise specification
- [ ] Use `SecureConfig()` when handling user-provided URLs

### Timeout Configuration

- [ ] All timeout values are set and reasonable
- [ ] `Timeouts.Request` is not 0 (prevents infinite waiting)
- [ ] Consider using `WithContext` to set per-request timeouts

### Response Limits

- [ ] `MaxResponseBodySize` has a reasonable upper limit
- [ ] `MaxDecompressedBodySize` has a reasonable upper limit
- [ ] Use streaming downloads for large responses

### Retry Configuration

- [ ] `MaxRetries` does not exceed 5
- [ ] Use retries cautiously with non-idempotent requests (POST/PUT/PATCH)
- [ ] Enable `EnableJitter` to prevent thundering herd

### Resource Management

- [ ] Call `Close()` after using the client
- [ ] Use `defer` to ensure resource cleanup

## Recommended

### Middleware

- [ ] Use `RecoveryMiddleware()` to prevent panic crashes
- [ ] Use `LoggingMiddleware()` to record request logs
- [ ] Use `MetricsMiddleware()` to collect metrics
- [ ] Use `AuditMiddleware()` in security-sensitive scenarios

### Headers

- [ ] Set a meaningful `User-Agent`
- [ ] Do not store sensitive information in default headers
- [ ] Use `WithBearerToken` instead of manually setting Authorization

### Cookies

- [ ] Enable `CookieSecurity` validation in security-sensitive scenarios
- [ ] Use `StrictCookieSecurityConfig()` to enforce security attributes

### Redirects

- [ ] Disable redirects when handling user-input URLs
- [ ] Use `RedirectWhitelist` to limit redirect destinations

## Code Examples

### Production-Grade Client Creation

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // Timeouts
    cfg.Timeouts.Request = 30 * time.Second
    cfg.Timeouts.Dial = 10 * time.Second
    cfg.Timeouts.TLSHandshake = 10 * time.Second
    cfg.Timeouts.ResponseHeader = 30 * time.Second

    // Connection pool
    cfg.Connection.MaxIdleConns = 50
    cfg.Connection.MaxConnsPerHost = 10

    // Security
    cfg.Security.AllowPrivateIPs = false
    cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024

    // Retry
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Retry.EnableJitter = true

    // Middleware
    cfg.Middleware.UserAgent = "my-service/1.0"
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
        httpc.RequestIDMiddleware("X-Request-ID", nil),
    }

    return httpc.New(cfg)
}
```

### Secure Client

```go
func createSecureClient() (httpc.Client, error) {
    cfg := httpc.SecureConfig()
    cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
    cfg.Security.RedirectWhitelist = []string{"api.example.com"}
    return httpc.New(cfg)
}
```

## Check Commands

```bash
# Check for misuse of TestingConfig
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# Check InsecureSkipVerify
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# Check AllowPrivateIPs
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## Next Steps

- [Security Overview](./) - Security features overview
- [SSRF Protection](./ssrf) - SSRF protection in depth
- [Configuration API](../api-reference/config) - Complete configuration reference
