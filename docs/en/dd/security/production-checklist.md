---
sidebar_label: "Production Checklist"
title: "Production Checklist - CyberGo DD | Pre-Launch Security Checks"
description: "A complete pre-deployment security checklist for CyberGo DD in production, covering basic configuration verification, sensitive-data filter rule enablement and test validation, audit-logging switch confirmation, file-rotation strategy, HMAC integrity-signing configuration, and key performance-baseline tuning items to ensure your logging system goes live securely, reliably, and compliantly."
sidebar_position: 3
---

# Production Checklist

Before going live, check each of the following security configurations to ensure the logging system is secure and reliable.

## Basic Configuration

- [ ] **Log level** -- Set to `LevelInfo` or higher in production
- [ ] **Output format** -- Use `FormatJSON` for easier log collection and analysis
- [ ] **File rotation** -- Configure reasonable size limits and retention policies
- [ ] **Buffer flushing** -- Ensure `Flush()` or `Close()` is called before program exit

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
})
defer logger.Close()
```

## Security Filtering

- [ ] **Enable sensitive-data filtering** -- Use `DefaultSecurityConfig()` or higher
- [ ] **Custom patterns** -- Add business-specific sensitive-field patterns
- [ ] **Filter-statistics monitoring** -- Periodically check filter stats to spot anomalies

```go
logger.SetSecurityConfig(dd.DefaultSecurityConfig())
```

## File Security

- [ ] **Log permissions** -- File mode `0600`, directory mode `0700` (library defaults; directories need the execute bit to be enterable)
- [ ] **Path validation** -- Ensure log paths are not controllable by user input
- [ ] **Symlinks** -- Forbid symlinks in production
- [ ] **Disk space** -- Configure a rotation policy to prevent filling the disk

## Audit & Integrity

- [ ] **Audit logging** -- Enable audit logging to record security events
- [ ] **Integrity signing** -- Enable HMAC signing to ensure logs are tamper-evident
- [ ] **Audit-log separation** -- Store audit logs separately from business logs

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
```

## Performance

- [ ] **Sampling strategy** -- Consider enabling log sampling for high-throughput scenarios
- [ ] **Buffered writes** -- Use `BufferedWriter` to reduce I/O count
- [ ] **Synchronous-write awareness** -- The default write path is synchronous; use `BufferedWriter` for high-throughput scenarios to reduce syscalls
- [ ] **Memory monitoring** -- Monitor logging-related memory usage

## Lifecycle

- [ ] **Graceful shutdown** -- Use `Shutdown(ctx)` instead of `Close()` (note: `Shutdown` does not internally wait for filter goroutines, while `Close` calls `WaitForFilterGoroutines`; before switching, explicitly call `logger.WaitForFilterGoroutines(...)` to avoid races where filter goroutines still access a closed writer)
- [ ] **Timeout settings** -- Set a reasonable shutdown timeout (5-10 seconds recommended)
- [ ] **Global logger** -- Replace via `SetDefault()` rather than re-creating repeatedly

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## Compliance Checks

- [ ] **HIPAA** -- Use `HealthcareConfig()` for the medical industry
- [ ] **PCI-DSS** -- Use `FinancialConfig()` for the financial industry
- [ ] **GDPR** -- Ensure no Personally Identifiable Information (PII) is logged
- [ ] **Data retention** -- Configure log retention periods compliant with regulations

## Monitoring & Alerting

- [ ] **Write errors** -- Configure `SetWriteErrorHandler` to monitor write failures
- [ ] **Filter goroutines** -- Monitor `ActiveFilterGoroutines()` count
- [ ] **Audit statistics** -- Periodically check audit-event statistics
- [ ] **Error-code alerting** -- Alert on security error codes such as `PATH_TRAVERSAL`, `REDOS_PATTERN`

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    metrics.WriteErrors.Inc()
    alert("log write failed: " + err.Error())
})
```

## Next Steps

- [Security Overview](./) -- Security feature overview
- [Security Filtering API](../api-reference/security-audit/security) -- Configuration reference
- [Performance Tuning](../advanced/performance) -- Performance tuning
