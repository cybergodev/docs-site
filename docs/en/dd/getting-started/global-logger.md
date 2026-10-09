---
sidebar_label: "Global Logger"
title: "Global Logger - CyberGo DD | Default Logger Usage Guide"
description: "CyberGo DD global logger pattern: Default() lazy init, SetDefault() replacement, InitDefault() with error handling, and dd.Info() vs logger.Info()."
sidebar_position: 3
---

# Global Logger

DD provides a process-level global Logger. All **package-level convenience functions** (`dd.Info()`, `dd.Errorf()`, etc.) delegate to it. This is the simplest usage mode — start logging with zero configuration.

## Two Usage Modes Compared

| Mode | Code Example | Use Case |
|------|-------------|----------|
| **Global Logger** | `dd.Info("hello")` | Scripts, small projects, quick prototyping |
| **Instance Logger** | `logger, _ := dd.New(cfg); logger.Info("hello")` | Custom config, multiple Logger instances, DI |

The global Logger is essentially a singleton `*Logger` protected by `sync.Once`, created automatically on first access.

## Package-Level Convenience Functions

All standard logging methods have package-level counterparts that operate on the global Logger:

```go
package main

import "github.com/cybergodev/dd"

func main() {
	// Basic logging
	dd.Debug("debug info")
	dd.Info("service started")
	dd.Warn("high memory usage")
	dd.Error("request failed")
	// dd.Fatal("fatal error")  // ⚠️ calls os.Exit(1)

	// Formatted
	username := "alice"
	dd.Infof("user %s logged in", username)

	// Structured logging
	dd.InfoWith("request completed",
		dd.String("method", "GET"),
		dd.Int("status", 200),
	)

	// Field chaining
	dd.WithFields(dd.String("service", "api")).
		Info("service ready")

	// Level control
	dd.SetLevel(dd.LevelDebug)
	if dd.IsDebugEnabled() {
		dd.Debug("debug enabled")
	}
}
```

:::tip All package-level functions
Basic (`Debug/Info/Warn/Error/Fatal`), formatted (`Debugf/Infof/...`), structured (`DebugWith/InfoWith/...`), generic level (`Log/Logf/LogWith`), field chaining (`WithFields/WithField`), level queries (`IsLevelEnabled/IsDebugEnabled/...`), sampling (`SetSampling/GetSampling`), writer management (`AddWriter/RemoveWriter/WriterCount`), lifecycle (`Flush`).
:::

## Global Logger Initialization

### Default(): Lazy Initialization

`dd.Default()` returns the global Logger, created on first call with `DefaultConfig()`:

```go
// First call → auto-created (sync.Once ensures thread safety)
logger := dd.Default()
logger.Info("hello") // equivalent to dd.Info("hello")
```

### InitDefault(): Custom Configuration

Initialize the global Logger with custom configuration at startup:

```go
package main

import (
	"log"

	"github.com/cybergodev/dd"
)

func main() {
	cfg := dd.DefaultConfig()
	cfg.Level = dd.LevelDebug
	cfg.Format = dd.FormatJSON

	if err := dd.InitDefault(cfg); err != nil {
		log.Fatalf("failed to init logger: %v", err)
	}

	// All package-level functions now use this configuration
	dd.Info("global Logger initialized")
}
```

:::warning InitDefault replaces the old instance
If a global Logger already exists (e.g., auto-created by `Default()`), `InitDefault()` **closes the old instance** and replaces it. The old instance is closed in a background goroutine with a 100ms delay to allow in-flight writes to complete.
:::

### SetDefault(): Direct Replacement

Replace the global Logger with an already-created Logger instance:

```go
logger, _ := dd.New(dd.DevelopmentConfig())
dd.SetDefault(logger)

// Package-level functions now use the new Logger
dd.Info("using custom Logger")
```

## Error Handling

When global Logger initialization fails, it falls back to stderr output (does not panic). Detect initialization status with:

```go
logger := dd.Default()

if err := dd.DefaultInitError(); err != nil {
    // Logger is running in fallback mode (output to stderr)
    log.Printf("warning: global Logger init failed: %v", err)
}

// Or get Logger and error at once
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("fallback mode: %v", err)
}
```

## Using with Instance Loggers

Global Logger and instance Loggers can coexist. A common pattern is initializing the global Logger in `main` while using interfaces for DI:

```go
// main.go
func main() {
    cfg := dd.DefaultConfig()
    cfg.Format = dd.FormatJSON
    _ = dd.InitDefault(cfg)
    defer dd.Flush()
}

// service.go — use interface for testability
type Service struct {
    logger dd.LogProvider // interface, mockable
}

func NewService(logger dd.LogProvider) *Service {
    return &Service{logger: logger}
}

// Create Service with global Logger
svc := NewService(dd.Default())
```

:::tip Recommended interface for DI
`dd.LogProvider` is the most complete logging interface for dependency injection. More concise interfaces: `dd.CoreLogger` (logging methods only), `dd.LevelLogger` (+ level management), `dd.ConfigurableLogger` (+ config & lifecycle). See [Interfaces](../api-reference/core/interfaces).
:::

## Next Steps

- [Configuration](../guides/basics/configuration) -- Full Config field reference
- [Cheat Sheet](./cheatsheet) -- Common API quick reference
- [Interfaces](../api-reference/core/interfaces) -- Logger interface hierarchy
