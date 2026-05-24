---
title: "Quick Start - CyberGo DD | 5-Minute Guide"
description: "Get started with CyberGo DD: install, first log output, create loggers, configure rotation, structured fields, and hook system in 5 minutes."
---

# Quick Start

## 1. Create a Logger

DD provides multiple convenience constructors for different scenarios:

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    // Option 1: Default global logger (zero configuration)
    dd.Info("using global logger")

    // Option 2: Development mode (DEBUG level, with caller)
    dev, _ := dd.New(dd.DevelopmentConfig())
    defer dev.Close()
    dev.Info("development mode output")

    // Option 3: Output to file
    file, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    defer file.Close()
    file.Info("file output")

    // Option 4: Output to both console and file
    all, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    defer all.Close()
    all.Info("dual output")

    // Option 5: JSON format dual output
    jsonLogger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    defer jsonLogger.Close()
    jsonLogger.Info("JSON format output")
}
```

## 2. Log Levels

DD supports 5 log levels, from lowest to highest:

```go
dd.Debug("debug message")   // LevelDebug
dd.Info("info message")     // LevelInfo (default)
dd.Warn("warning message")  // LevelWarn
dd.Error("error message")   // LevelError
dd.Fatal("fatal error")     // LevelFatal (calls os.Exit)
```

Formatted versions:

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

Output example (default text format):

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 request completed method=GET path=/api/users status=200 elapsed=150ms
```

:::tip JSON Format Output
The default global logger uses text format. To output in JSON format, create a logger with `dd.New(dd.JSONConfig())`.
:::

## 4. Field Chaining

```go
// Create an Entry with preset fields
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// Each log automatically includes preset fields
requestLogger.Info("service started")
requestLogger.InfoWith("routes registered",
    dd.Int("routes", 42),
)
```

## 5. File Rotation

Configure rotation policy via `FileWriter`:

```go
// Default: 100MB, 30 days, 10 backups
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})

logger.Info("hello world")
```

## 6. Sensitive Data Filtering

DD enables basic sensitive data filtering by default with `DefaultConfig()`. You can use stronger filtering presets:

```go
// DefaultConfig() already includes basic security filtering
logger, _ := dd.New(dd.DefaultConfig())

// Password field is automatically redacted
logger.InfoWith("user login",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // output: [REDACTED]
)
```

## Next Steps

- [Core Concepts](./guides/core-concepts) -- Understand Logger hierarchy and processing pipeline
- [Structured Logging](./guides/structured-logging) -- Field usage in depth
- [File Output & Rotation](./guides/file-output) -- FileWriter details
- [Sensitive Data Filtering](./guides/sensitive-filtering) -- Security filtering in practice
- [Cheat Sheet](./cheatsheet) -- Common API quick reference
