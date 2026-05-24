---
title: "Cheat Sheet - CyberGo DD | Common API Quick Reference"
description: "CyberGo DD cheat sheet: logger creation, level control, field constructors, file rotation, sensitive data filtering, hooks, audit, and integrity signing."
---

# Cheat Sheet

## Create Logger

| Method | Code | Description |
|--------|------|-------------|
| Global Default | `dd.Info("msg")` | Zero config, ready to use |
| Dev Mode | `dd.New(dd.DevelopmentConfig())` | DEBUG level, with caller |
| Custom | `dd.New(dd.Config{Targets: ...})` | Full configuration |
| File | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | File output only |
| Dual Target | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | Console + File |
| JSON Dual | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSON format dual target |

## Preset Configurations

```go
dd.DefaultConfig()       // Default: INFO level, text format
dd.DevelopmentConfig()   // Development: DEBUG level, dynamic caller
dd.JSONConfig()          // JSON: JSON format output
```

## Log Levels

| Level | Constant | Method | Formatted |
|-------|----------|--------|-----------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

Structured versions: `DebugWith()`, `InfoWith()`, `WarnWith()`, `ErrorWith()`, `FatalWith()`

## Field Constructors

| Type | Constructor | Example |
|------|------------|---------|
| Generic | `Any(key, val)` | `dd.Any("data", obj)` |
| String | `String(key, val)` | `dd.String("name", "test")` |
| Integer | `Int(key, val)` | `dd.Int("count", 42)` |
| Boolean | `Bool(key, val)` | `dd.Bool("ok", true)` |
| Time | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| Duration | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| Error | `Err(err)` | `dd.Err(err)` |
| Error+Stack | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## Field Chaining

```go
// Preset fields
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("Started")                    // Automatically includes svc=api

// Append fields
entry2 := entry.WithField("env", "prod")
entry2.Info("Environment ready")         // Includes svc + env
```

## Output Targets

```go
// File writer (automatic rotation)
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Buffered writer
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// Multi-writer
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## Context Integration

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## Security Configuration

```go
dd.DefaultSecurityConfig()   // Basic filtering (recommended)
dd.DefaultSecureConfig()     // Complete filtering
dd.HealthcareConfig()        // HIPAA compliance
dd.FinancialConfig()         // PCI-DSS compliance
dd.GovernmentConfig()        // Government standards
```

## Lifecycle

```go
logger.Flush()                           // Flush buffer
logger.Close()                           // Close logger
logger.Shutdown(ctx)                     // Graceful shutdown (with timeout)
dd.SetDefault(logger)                    // Replace global logger
dd.InitDefault(cfg)                      // Initialize global logger
```

## Debug Output

```go
// Via global Logger (with security filtering)
dd.Print("value:", val)       // Quick print
dd.Printf("format: %v", val)  // Formatted print

// Direct output (no security filtering, debug only)
dd.JSON(data)                  // JSON format debug output
dd.Text(data)                  // Text format debug output
dd.Exit(data)                  // Output then exit
```
