---
title: "Security Overview - HTML"
description: "Security overview of CyberGo HTML, covering input size limits, DOM depth limits, path traversal prevention, panic recovery, and sanitization features."
---

# Security Overview

The HTML library prioritizes security by design with multiple built-in protection layers.

## Security Features

### Input Size Limits

Default maximum input is 50MB to prevent memory exhaustion:

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // Adjust to 10MB
```

### DOM Depth Limits

Default maximum depth of 500 prevents recursive bomb attacks:

```go
cfg.MaxDepth = 200 // Tighten the limit
```

### Path Traversal Prevention

File operations automatically detect and block path traversal attempts (e.g., `../../../etc/passwd`), recording them via the audit system.

### Panic Recovery

All extraction operations include built-in panic recovery, returning `ErrInternalPanic` errors to ensure services don't crash from malicious input.

### Processing Timeout

Configurable processing timeout prevents malicious HTML from causing infinite processing:

```go
cfg.ProcessingTimeout = 10 * time.Second
```

### Content Sanitization

Optional content sanitization removes potentially malicious tags and attributes:

```go
cfg.EnableSanitization = true
```

## Audit System

See [Audit System](../api-reference/audit) for detailed audit configuration.

The audit system can record the following security events:

| Event | Description |
|-------|-------------|
| `AuditEventBlockedTag` | Blocked HTML tag |
| `AuditEventBlockedAttr` | Blocked attribute |
| `AuditEventBlockedURL` | Blocked URL |
| `AuditEventInputViolation` | Input size violation |
| `AuditEventDepthViolation` | DOM depth violation |
| `AuditEventPathTraversal` | Path traversal attempt |
| `AuditEventTimeout` | Processing timeout |
| `AuditEventEncodingIssue` | Encoding anomaly |

## High-Security Configuration

```go
cfg := html.HighSecurityConfig()
// Automatically enables: reduced limits, shorter timeouts, full audit
```

## Error Handling

All security violations return clear errors supporting `errors.Is` / `errors.As` matching:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // Log and reject
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // Possibly maliciously crafted
    case errors.Is(err, html.ErrInternalPanic):
        // Panic recovery, check input
    }
}
```
