---
sidebar_label: "Cheat Sheet"
title: "Cheat Sheet - CyberGo DD | Common API Quick Reference"
description: "Quick reference for the most common CyberGo DD logging APIs: logger creation and cloning, log-level control, structured field constructors, file-output rotation and buffer config, sensitive-data security filtering rules, hook registration and callbacks, audit logging, and integrity signing verification — for fast lookup and everyday use."
sidebar_position: 2
---

# Cheat Sheet

## Creating a Logger

| Way | Code | Description |
|-----|------|-------------|
| Global default | `dd.Info("msg")` | Zero-config, ready to use |
| Development mode | `dd.New(dd.DevelopmentConfig())` | DEBUG level, with caller |
| Custom | `dd.New(dd.Config{Targets: ...})` | Full configuration |
| File | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | File output only |
| Dual target | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | Console + file |
| JSON dual target | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | JSON format dual target |

:::tip Config zero values
The `dd.Config{...}` literal has zero values for unset fields (Level=Debug, IncludeTime/IncludeLevel/DynamicCaller=false, output has no timestamp/level/caller). For production, prefer starting from `dd.DefaultConfig()` and overriding only the fields you need.
:::

## Preset Configs

```go
dd.DefaultConfig()       // Default: INFO level, text format
dd.DevelopmentConfig()   // Development: DEBUG level, dynamic caller
dd.JSONConfig()          // JSON: DEBUG level + JSON output
```

## Log Levels

| Level | Constant | Method | Formatted |
|-------|----------|--------|-----------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

Structured variants: `DebugWith()`, `InfoWith()`, `WarnWith()`, `ErrorWith()`, `FatalWith()`

## Field Constructors

| Type | Constructor | Example |
|------|-------------|---------|
| Generic | `Any(key, val)` | `dd.Any("data", obj)` |
| String | `String(key, val)` | `dd.String("name", "test")` |
| Integer | `Int(key, val)` | `dd.Int("count", 42)` |
| Boolean | `Bool(key, val)` | `dd.Bool("ok", true)` |
| Time | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| Duration | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| Error | `Err(err)` | `dd.Err(err)` |
| Error + stack | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## Field Chaining

```go
// Preset fields
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("started")                    // Automatically carries svc=api

// Append fields
entry2 := entry.WithField("env", "prod")
entry2.Info("environment ready")         // Carries svc + env
```

## Output Targets

```go
// File writer (auto-rotating)
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
dd.GovernmentConfig()        // Government standard
```

## Lifecycle

```go
logger.Flush()                           // Flush buffers
logger.Close()                           // Close the logger
logger.Shutdown(ctx)                     // Graceful shutdown (with timeout)
dd.SetDefault(logger)                    // Replace the global logger
dd.InitDefault(cfg)                      // Initialize the global logger
```

## Debug Output

```go
// Via the global Logger (subject to security filtering)
dd.Print("value:", val)       // Quick print
dd.Printf("format: %v", val)  // Formatted print

// Direct output (no security filtering; debug only)
dd.JSON(data)                  // JSON-format debug output
dd.Text(data)                  // Text-format debug output
dd.Exit(data)                  // Print then exit
```
