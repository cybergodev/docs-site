---
sidebar_label: "Migration Guide"
title: "Migration Guide - CyberGo DD | Migrating From Other Log Libraries"
description: "A complete side-by-side migration guide from the standard library log/slog and popular third-party log libraries (zap, logrus, zerolog) to CyberGo DD, with detailed API mapping tables, configuration-parameter comparisons, common migration patterns, and a progressive migration strategy to help you smoothly switch existing logging systems to DD with low risk."
sidebar_position: 8
---

# Migration Guide

If you are using another log library, this guide helps you migrate your project to DD quickly.

## From the Standard Library log

### API Mapping

| log | DD | Notes |
|-----|-----|-------|
| `log.Print(msg)` | `dd.Info(msg)` | Info level |
| `log.Printf(format, args)` | `dd.Infof(format, args)` | Formatted |
| `log.Println(msg)` | `dd.Info(msg)` | Info level |
| `log.Fatal(msg)` | `dd.Fatal(msg)` | Fatal (calls os.Exit) |
| `log.Fatalf(format, args)` | `dd.Fatalf(format, args)` | Formatted Fatal |
| `log.Panic(msg)` | `dd.Error(msg)` + `panic()` | DD has no built-in Panic |
| — | `dd.InfoWith(msg, fields...)` | Structured logging (new) |

### Basic Migration

```go
// Before: log
log.Printf("user %s login failed: %v", username, err)

// After: DD
dd.Infof("user %s login failed: %v", username, err)

// Or using structured logging
dd.ErrorWith("user login failed",
    dd.String("username", username),
    dd.Err(err),
)
```

### Replace the Global Logger

```go
// Before: log
log.SetOutput(file)
log.SetFlags(log.LstdFlags | log.Lshortfile)

// After: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatText,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
dd.SetDefault(logger)
```

## From slog

### API Mapping

| slog | DD | Notes |
|------|-----|-------|
| `slog.Info(msg)` | `dd.Info(msg)` | Info level |
| `slog.Info(msg, "key", value)` | `dd.InfoWith(msg, dd.String("key", value))` | Structured |
| `slog.Debug(msg)` | `dd.Debug(msg)` | Debug level |
| `slog.Error(msg, "err", err)` | `dd.ErrorWith(msg, dd.Err(err))` | Error log |
| `slog.Warn(msg)` | `dd.Warn(msg)` | Warn level |
| `slog.With("key", value)` | `dd.WithFields(dd.String("key", value))` | Preset fields |
| `slog.New(handler)` | `dd.New(cfg)` | Create instance |
| `slog.SetDefault(logger)` | `dd.SetDefault(logger)` | Set global |

### Structured Logging Migration

```go
// Before: slog
slog.Info("request completed",
    "method", "GET",
    "status", 200,
    "duration", 150*time.Millisecond,
)

// After: DD
dd.InfoWith("request completed",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("duration", 150*time.Millisecond),
)
```

:::tip Type Safety
slog uses `any` key-value pairs; DD uses type-specific field constructors. Type errors are caught at compile time.
:::

## From zap

### API Mapping

| zap | DD | Notes |
|-----|-----|-------|
| `zap.L().Info(msg, zap.Field...)` | `dd.InfoWith(msg, dd.Field...)` | Structured |
| `zap.String(key, val)` | `dd.String(key, val)` | String field |
| `zap.Int(key, val)` | `dd.Int(key, val)` | Integer field |
| `zap.Error(err)` | `dd.Err(err)` | Error field |
| `zap.Any(key, val)` | `dd.Any(key, val)` | Any type |
| `zap.Sugar().Infof(...)` | `dd.Infof(...)` | Formatted |
| `logger.With(zap.Field...)` | `logger.WithFields(dd.Field...)` | Preset fields |
| `zapcore.NewCore(...)` | `dd.New(dd.Config{...})` | Create instance |

### Configuration Mapping

```go
// Before: zap
cfg := zap.Config{
    Level:       zap.NewAtomicLevelAt(zap.InfoLevel),
    Encoding:    "json",
    OutputPaths: []string{"stdout", "logs/app.log"},
}
logger, _ := cfg.Build()

// After: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
```

### Field Mapping

```go
// Before: zap
logger.Info("request",
    zap.String("method", "GET"),
    zap.Int("status", 200),
    zap.Duration("elapsed", 150*time.Millisecond),
    zap.Error(err),
)

// After: DD
dd.InfoWith("request",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
    dd.Err(err),
)
```

## From logrus

### API Mapping

| logrus | DD | Notes |
|--------|-----|-------|
| `logrus.Info(msg)` | `dd.Info(msg)` | Info level |
| `logrus.WithField("k", v)` | `dd.WithField("k", v)` | Single field |
| `logrus.WithFields(logrus.Fields{...})` | `dd.WithFields(dd.String(...), ...)` | Multiple fields |
| `logrus.SetLevel(logrus.InfoLevel)` | `dd.SetLevel(dd.LevelInfo)` | Set level |
| `logrus.SetFormatter(&logrus.JSONFormatter{})` | `dd.New(dd.Config{Format: dd.FormatJSON})` | JSON format |
| `logrus.SetOutput(file)` | `dd.Config{Targets: ...}` | Output target |
| `logrus.Fatal(msg)` | `dd.Fatal(msg)` | Fatal |

### Field Migration

```go
// Before: logrus
logrus.WithFields(logrus.Fields{
    "method":  "GET",
    "status":  200,
    "elapsed": 150 * time.Millisecond,
}).Info("Request completed")

// After: DD
dd.WithFields(
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
).Info("Request completed")
```

## DD-Exclusive Features

After migrating, you can take advantage of DD's unique features:

| Feature | Description | Docs |
|---------|-------------|------|
| Sensitive-data filtering | Auto-redact passwords, API keys, etc. | [Sensitive Data Filtering](./sensitive-filtering) |
| Audit logging | Asynchronous security-event recording | [Audit Logging](./audit-logging) |
| HMAC signing | Tamper-protection for logs | [HMAC Signing In Practice](../advanced/integrity) |
| Industry compliance | HIPAA/PCI-DSS presets | [Industry Compliance Configuration](../security/compliance) |
| Lifecycle hooks | 6 hook events | [Hook System](./hooks) |
| LoggerRecorder | Test helper | [Testing Patterns](../examples/testing-patterns) |

## Next Steps

- [Core Concepts](./core-concepts) -- DD architecture overview
- [Structured Logging](./structured-logging) -- Field usage in depth
- [Cheat Sheet](../getting-started/cheatsheet) -- API quick reference
