---
title: "DD - Structured Logging Library"
description: "CyberGo DD is a high-performance Go structured logging library with thread-safe recording, file rotation, sensitive data filtering, and audit logging."
---

# DD

DD (Data-Driven Debugger) is a high-performance structured logging library from the CyberGo organization, providing thread-safe log recording, flexible output target configuration, and comprehensive security protection.

## Features

- **Structured Logging** -- Type-safe field recording with automatic JSON serialization
- **Multiple Output Targets** -- Simultaneous output to console, file, and custom `io.Writer`
- **File Rotation** -- Automatic rotation by size or time, with configurable backup count and retention policies
- **Sensitive Data Filtering** -- Built-in regex patterns for automatic redaction of passwords, keys, tokens, and other sensitive information
- **Audit Logging** -- Asynchronous audit event recording with integrity signatures and chain verification
- **Hook System** -- Lifecycle hooks including BeforeLog, AfterLog, OnRotate, and more
- **Context Integration** -- Automatic propagation of TraceID, SpanID, and RequestID
- **Log Sampling** -- Optional log sampling strategy for high-throughput scenarios
- **Zero-Allocation Optimization** -- Minimized memory allocation on hot paths for exceptional performance

## Installation

```bash
go get github.com/cybergodev/dd
```

## Quick Start

```go
package main

import (
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // Use the default logger
    dd.Info("service started")

    // Structured logging
    dd.InfoWith("request completed",
        dd.String("method", "GET"),
        dd.Int("status", 200),
        dd.Duration("elapsed", 150*time.Millisecond),
    )

    // Create a custom logger
    logger, _ := dd.New(dd.DefaultConfig())
    defer logger.Close()

    logger.Info("custom logger created")
}
```

## Module Navigation

| Module | Description |
|--------|-------------|
| [Core Concepts](./guides/core-concepts) | Logger hierarchy, processing pipeline, interface levels |
| [Structured Logging](./guides/structured-logging) | Field constructors, method chaining |
| [File Output & Rotation](./guides/file-output) | FileWriter, BufferedWriter |
| [Sensitive Data Filtering](./guides/sensitive-filtering) | Auto-redaction, security levels |
| [Audit Logging](./guides/audit-logging) | Asynchronous audit events, integrity signing |
| [Hook System](./guides/hooks) | Lifecycle hook extensions |

## Next Steps

- [Quick Start](./getting-started) -- 5-minute getting started guide
- [Core Concepts](./guides/core-concepts) -- Understand DD architecture
- [Migration Guide](./guides/migration) -- Migrate from log/slog/zap/logrus
- [Cheat Sheet](./cheatsheet) -- Common API quick reference
- [API Reference](./api-reference/) -- Complete API documentation
- [Basic Examples](./examples/basic-usage) -- Practical code examples
