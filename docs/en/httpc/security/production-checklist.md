---
title: "Production Checklist - HTTPC"
description: "HTTPC production checklist: TLS verification, SSRF confirmation, timeout and size limits, retry strategies, resource cleanup, and audit middleware setup."
---

# Production Checklist

## Required Checks

### TLS Configuration

- [ ] `InsecureSkipVerify` set to `false` (default value)
- [ ] `MinTLSVersion` is at least `tls.VersionTLS12`
- [ ] Not using `TestingConfig()`

### SSRF Protection

- [ ] `AllowPrivateIPs` is `false` (default value)
- [ ] If internal service access is needed, specify precisely with `SSRFExemptCIDRs`
- [ ] Use `SecureConfig()` when handling user-provided URLs

### Timeout Configuration

- [ ] All timeout values are set and reasonable
- [ ] `Timeouts.Request` is not 0 (prevents indefinite waiting)
- [ ] Consider using `WithContext` to set per-request timeouts

### Response Limits

- [ ] `MaxResponseBodySize` is set to a reasonable upper limit
- [ ] `MaxDecompressedBodySize` is set to a reasonable upper limit
- [ ] Use streaming downloads for large responses

### Retry Configuration

- [ ] `MaxRetries` does not exceed 5
- [ ] Use retry cautiously for non-idempotent requests (POST/PUT/PATCH)
- [ ] Enable `EnableJitter` to prevent thundering herd

### Resource Management

- [ ] Call `Close()` on clients after use
- [ ] Call `ReleaseResult()` on Result objects after use
- [ ] Use `defer` to ensure resource cleanup

## Recommended Items

### Middleware

- [ ] Use `RecoveryMiddleware()` to prevent panic crashes
- [ ] Use `LoggingMiddleware()` to log requests
- [ ] Use `MetricsMiddleware()` to collect metrics
- [ ] Use `AuditMiddleware()` in security-sensitive scenarios

### Request Headers

- [ ] Set a meaningful `User-Agent`
- [ ] Do not store sensitive information in default request headers
- [ ] Use `WithBearerToken` instead of manually setting Authorization

### Cookies

- [ ] Enable `CookieSecurity` validation in security-sensitive scenarios
- [ ] Use `StrictCookieSecurityConfig()` to enforce security attributes

### Redirects

- [ ] Disable redirects when handling user-input URLs
- [ ] Use `RedirectWhitelist` to restrict redirect targets

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

## Audit Commands

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
- [SSRF Protection](./ssrf) - Detailed SSRF protection
- [Config API](../api-reference/config) - Complete configuration reference
