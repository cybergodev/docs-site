---
title: "API Reference - CyberGo DD | Overview"
description: "CyberGo DD API reference overview covering Logger, Config, Writers, Security filtering, Audit logging, Hooks, and Integrity signing modules."
---

# API Reference

The DD logging library provides a rich set of APIs, organized by functional modules:

## Core Components

| Module | Description | Documentation |
|--------|-------------|---------------|
| **Package Functions** | Global logging functions, convenience constructors | [Package Functions](./functions) |
| **Logger** | Core logger and its methods | [Logger](./logger) |
| **LoggerEntry** | Log Entry with preset fields | [LoggerEntry](./entry) |
| **Config** | Configuration struct and presets | [Configuration](./config) |
| **Interfaces** | CoreLogger, LogProvider and other interfaces | [Interface Definitions](./interfaces) |

## Output and Writing

| Module | Description | Documentation |
|--------|-------------|---------------|
| **Writers** | FileWriter, BufferedWriter, MultiWriter | [Output Targets](./writers) |
| **Context** | Context integration and ContextExtractor | [Context Integration](./context) |

## Extended Features

| Module | Description | Documentation |
|--------|-------------|---------------|
| **Fields** | Structured field constructors (20+ types) | [Structured Fields](./fields) |
| **Hooks** | Lifecycle hook system | [Hook System](./hooks) |
| **Security** | Sensitive data filtering and security config | [Security Filtering](./security) |
| **Audit** | Audit logging and audit events | [Audit Logging](./audit) |
| **Integrity** | Log integrity signing and verification | [Integrity Signing](./integrity) |

## Utility Tools

| Module | Description | Documentation |
|--------|-------------|---------------|
| **Debug Visual** | Print/JSON/Text/Exit debug functions | [Debug Output](./debug-visual) |
| **Recorder** | Testing helper log recorder | [Testing Helper](./recorder) |
| **Constants** | Log levels, formats, error codes | [Constants and Errors](./constants) |

## Quick Reference

```go
// Basic usage
dd.Info("message")                        // → Package Functions
dd.InfoWith("msg", dd.String("k", "v"))   // → Package Functions + Fields

// Create a custom logger
logger, _ := dd.New(dd.DefaultConfig())    // → Package Functions + Config
logger.WithFields(fields).Info("msg")      // → Logger + Entry

// File output
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // → Writers

// Security
sec := dd.DefaultSecurityConfig()          // → Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // → Audit
```

## Next Steps

- [Package Functions](./functions) -- Global functions and constructors
- [Logger](./logger) -- Core logger in detail
- [Configuration](./config) -- Configuration options
