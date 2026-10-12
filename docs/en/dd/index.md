---
sidebar_label: "Overview"
title: "Structured Logging - CyberGo DD | High-Performance Go Logger"
description: "CyberGo DD is a structured logging library for Go: thread-safe output, file rotation, sensitive-data redaction, audit logging, and HMAC integrity signing."
---

# DD

DD (read as "data-driven" or "distributed debugger" in the source comments) is a high-performance structured logging library from the CyberGo organization, providing thread-safe log recording, flexible output target configuration, and comprehensive security protection.

## Features

- **Structured Logging** -- Type-safe field recording with optional JSON output
- **Multiple Output Targets** -- Simultaneous output to console, file, and custom `io.Writer`
- **File Rotation** -- Automatic size-based rotation with configurable backup count and retention policies
- **Sensitive Data Filtering** -- Built-in regex patterns for automatic redaction of passwords, keys, tokens, and other sensitive information
- **Field Validation** -- Field key naming convention validation (snake_case/camelCase, etc.) with Log4Shell injection protection
- **Audit Logging** -- Asynchronous audit event recording with HMAC integrity signing and sequence numbers
- **Hook System** -- Lifecycle hooks including BeforeLog, AfterLog, OnRotate, and more
- **Context Integration** -- Provides TraceID/SpanID/RequestID context utilities and a ContextExtractor extension point (logging methods do not accept `ctx`; pass fields via `WithFields`)
- **Log Sampling** -- Optional log sampling strategy for high-throughput scenarios
- **Low-Allocation Optimization** -- Minimized memory allocation on hot paths for exceptional performance

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
| [Core Concepts](./guides/basics/core-concepts) | Logger hierarchy, processing pipeline, interface levels |
| [Configuration](./guides/basics/configuration) | Config struct, presets, output targets |
| [Structured Logging](./guides/basics/structured-logging) | Field constructors, method chaining |
| [File Output & Rotation](./guides/basics/file-output) | FileWriter, BufferedWriter |
| [Log Sampling](./guides/operations/sampling) | High-throughput log volume reduction |
| [Hook System](./guides/operations/hooks) | Lifecycle hook extensions |
| [Error Handling](./guides/operations/error-handling) | Structured errors, sentinel errors, errors.Is |
| [Sensitive Data Filtering](./guides/security/sensitive-filtering) | Auto-redaction, security levels |
| [Field Validation](./guides/security/field-validation) | Naming convention checks, Log4Shell protection |
| [Audit Logging](./guides/security/audit-logging) | Asynchronous audit events, integrity signing |
| [Distributed Tracing](./guides/integration/context-tracing) | TraceID/SpanID/RequestID |
| [Migration Guide](./guides/integration/migration) | Migrate from log/slog/zap/logrus |

## Next Steps

- [Installation](./getting-started/installation) -- Requirements and integration
- [Quick Start](./getting-started/) -- 5-minute getting started guide
- [Core Concepts](./guides/basics/core-concepts) -- Understand DD architecture
- [Configuration](./guides/basics/configuration) -- Full Config fields and presets
- [Cheat Sheet](./getting-started/cheatsheet) -- Common API quick reference
- [API Reference](./api-reference/) -- Complete API documentation
- [Basic Examples](./examples/basic-usage) -- Practical code examples
- [Migration Guide](./guides/integration/migration) -- Migrate from log/slog/zap/logrus
