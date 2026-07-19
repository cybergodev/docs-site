---
sidebar_label: "Overview"
title: "API Reference - CyberGo DD | Overview"
description: "Complete API reference overview for the CyberGo DD structured logging library, covering the Logger core recorder, Config options, Writers output targets, Security filtering, Audit logging, the Hooks system, and Integrity signing."
sidebar_position: 1
---

# API Reference

The DD logging library provides a rich API surface, organized by functional module below.

## Core Components

| Module | Description | Docs |
|--------|-------------|------|
| **Package Functions** | Global log functions, convenience constructors | [Package Functions](./core/functions) |
| **Logger** | Core logger and its methods | [Logger](./core/logger) |
| **LoggerEntry** | Log Entry with preset fields | [LoggerEntry](./core/entry) |
| **Config** | Configuration struct and presets | [Config](./core/config) |
| **Interfaces** | CoreLogger, LogProvider, and other interfaces | [Interfaces](./core/interfaces) |

## Output & Writers

| Module | Description | Docs |
|--------|-------------|------|
| **Writers** | FileWriter, BufferedWriter, MultiWriter | [Output Targets](./output-integration/writers) |
| **Context** | Context integration and ContextExtractor | [Context Integration](./output-integration/context) |

## Extension Features

| Module | Description | Docs |
|--------|-------------|------|
| **Fields** | Structured field constructors (20 kinds) | [Structured Fields](./output-integration/fields) |
| **Hooks** | Lifecycle hook system | [Hook System](./security-audit/hooks) |
| **Security** | Sensitive-data filtering and security config | [Security Filtering](./security-audit/security) |
| **Audit** | Audit logging and audit events | [Audit Logging](./security-audit/audit) |
| **Integrity** | Log integrity signing and verification | [Integrity Signing](./security-audit/integrity) |

## Auxiliary Tools

| Module | Description | Docs |
|--------|-------------|------|
| **Debug Visual** | Print/JSON/Text/Exit debug functions | [Debug Output](./dev-tools/debug-visual) |
| **Recorder** | Test-helper log recorder | [Test Helper](./dev-tools/recorder) |
| **Constants** | Log levels, formats, error codes | [Constants & Errors](./dev-tools/constants) |

## Quick Locator

```go
// Basic usage
dd.Info("message")                        // -> Package Functions
dd.InfoWith("msg", dd.String("k", "v"))   // -> Package Functions + Fields

// Create a custom logger
logger, _ := dd.New(dd.DefaultConfig())    // -> Package Functions + Config
logger.WithFields(fields).Info("msg")      // -> Logger + Entry

// File output
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // -> Writers

// Security
sec := dd.DefaultSecurityConfig()          // -> Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // -> Audit
```

## Next Steps

- [Package Functions](./core/functions) -- Global functions and constructors
- [Logger](./core/logger) -- Core logger in depth
- [Config](./core/config) -- Configuration options
