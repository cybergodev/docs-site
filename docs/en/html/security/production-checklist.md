---
title: "Production Checklist - HTML"
description: "Production security checklist for CyberGo HTML, covering HighSecurityConfig preset, Processor lifecycle, audit configuration, and timeout control."
---

# Production Checklist

## Basic Configuration

- [ ] Use `HighSecurityConfig()` or a custom security configuration
- [ ] Set appropriate `MaxInputSize` (based on business needs)
- [ ] Set `ProcessingTimeout` to prevent long-running blocks
- [ ] Configure `MaxDepth` to limit DOM depth
- [ ] Enable `EnableSanitization` for content sanitization

## Processor Lifecycle

- [ ] Use `defer p.Close()` to ensure Processor is properly released
- [ ] Do not use Processor after closing
- [ ] Consider using a singleton Processor to reuse resources

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## Audit & Monitoring

- [ ] Enable the audit system
- [ ] Configure appropriate audit level filtering
- [ ] Use `WriterAuditSink` for persistent audit logs
- [ ] Monitor error counts in `GetStatistics()`
- [ ] Watch for `ErrInternalPanic` errors and `AuditEventPathTraversal` audit events

```go
auditFile, _ := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE, 0644)
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

## Context & Timeout

- [ ] Use `WithContext` variants for all extraction operations
- [ ] Set reasonable context timeouts
- [ ] Use cancellation-enabled contexts for batch operations

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := html.ExtractWithContext(ctx, data)
```

## Error Handling

- [ ] Distinguish between business errors and security errors
- [ ] Log all `ErrInputTooLarge` and `ErrMaxDepthExceeded`
- [ ] Monitor `ErrInternalPanic` frequency
- [ ] Use `FileError.SafePath()` for file error messages instead of raw paths

## Resource Management

- [ ] Batch operations should not exceed 10000 items per batch
- [ ] Configure `WorkerPoolSize` appropriately
- [ ] Call `ClearCache()` periodically to release cache
- [ ] Monitor memory usage and cache hit rate

## File Processing

- [ ] Validate file path sources (prevent user-controlled paths)
- [ ] Restrict file reading directories
- [ ] Check file size before processing
