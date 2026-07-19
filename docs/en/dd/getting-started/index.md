---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo DD | 5-Minute Guide"
description: "A complete getting-started tutorial for the CyberGo DD high-performance structured logging library. From installing the dependency to your first log line, learn step by step how to create loggers, configure output targets and file rotation, log request context with structured fields, and extend behavior with hooks. Master the essentials in 5 minutes and apply them to real projects."
sidebar_position: 1
---

# Quick Start

## 1. Create a Logger

DD provides several convenience constructors for different scenarios:

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    // Option 1: default global logger (zero configuration)
    dd.Info("using the global logger")

    // Option 2: development mode (DEBUG level, with caller)
    dev, err := dd.New(dd.DevelopmentConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer dev.Close()
    dev.Info("development mode output")

    // Option 3: output to a file
    file, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer file.Close()
    file.Info("file output")

    // Option 4: output to both console and file
    all, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer all.Close()
    all.Info("dual-target output")

    // Option 5: JSON format with dual targets
    jsonLogger, err := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer jsonLogger.Close()
    jsonLogger.Info("JSON format output")
}
```

:::warning Zero-value Config pitfall
Options 3/4/5 above use the `dd.Config{...}` literal directly and set only `Targets`/`Format`; the remaining fields keep their zero values: `Level=Debug` (no filtering), `IncludeTime=false` (no timestamp), `IncludeLevel=false` (no level), `DynamicCaller=false` (no caller), `Security=nil` (falls back to `DefaultSecurityConfig()` baseline filtering, which still enables ~36 redaction patterns; to disable, set `&dd.SecurityConfig{}` or `SecurityLevelDevelopment` explicitly). Output will be missing key information such as timestamps and levels.

**Recommended for production**: start from `dd.DefaultConfig()` and modify only the fields you need. This gives you timestamps, level, caller, and default security filtering in one shot:

```go
cfg := dd.DefaultConfig()                 // Level=Info, Format=Text, includes time/level/caller/Security
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}
logger, err := dd.New(cfg)
```

Similarly, `dd.DevelopmentConfig()` (DEBUG + caller) and `dd.JSONConfig()` (DEBUG + JSON + RFC3339) are convenient starting points with complete field sets.
:::

## 2. Log Levels

DD supports 5 log levels, from lowest to highest:

```go
dd.Debug("debug message")   // LevelDebug
dd.Info("general info")     // LevelInfo (default)
dd.Warn("warning message")  // LevelWarn
dd.Error("error message")   // LevelError
dd.Fatal("fatal error")     // LevelFatal (calls os.Exit)
```

Formatted variants:

```go
dd.Debugf("user %s logged in, took %dms", name, elapsed)
dd.Infof("request completed: status=%d", status)
dd.Warnf("connection pool usage %d%%", usage)
dd.Errorf("database query failed: %v", err)
```

## 3. Structured Logging

Use type-safe field constructors:

```go
dd.InfoWith("request completed",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

Example output (default text format):

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 request completed method=GET path=/api/users status=200 elapsed=150ms
```

:::tip JSON output
The default global logger uses the text format. For JSON output, create a JSON logger with `dd.New(dd.JSONConfig())`.
:::

## 4. Field Chaining

```go
// Create an Entry with preset fields
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// Every log call carries the preset fields automatically
requestLogger.Info("service started")
requestLogger.InfoWith("routes registered",
    dd.Int("routes", 42),
)
```

## 5. File Rotation

Configure rotation via `FileWriter`:

```go
// Defaults: 100MB, 30 days, 10 backups
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

logger.Info("hello world")
```

## 6. Sensitive Data Filtering

DD enables basic sensitive-data filtering by default (passwords, API keys, credit card numbers, etc. are auto-redacted):

```go
// The default config already includes basic security filtering
logger, err := dd.New(dd.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// The password field is redacted automatically
logger.InfoWith("user login",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // Output: [REDACTED]
)
```

## Next Steps

- [Core Concepts](../guides/core-concepts) -- Understand the Logger hierarchy and processing pipeline
- [Structured Logging](../guides/structured-logging) -- Field usage in depth
- [File Output & Rotation](../guides/file-output) -- FileWriter in depth
- [Sensitive Data Filtering](../guides/sensitive-filtering) -- Security filtering in practice
- [Cheat Sheet](./cheatsheet) -- Common API quick reference
