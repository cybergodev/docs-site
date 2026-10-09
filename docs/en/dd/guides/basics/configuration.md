---
sidebar_label: "Configuration"
title: "Configuration - CyberGo DD | Config Struct and Presets"
description: "CyberGo DD configuration guide: DefaultConfig, DevelopmentConfig, JSONConfig, ProductionConfig presets, full Config struct field reference, multi-output target configuration, JSON format customization, and Clone deep-copy usage."
sidebar_position: 2
---

# Configuration

DD uses struct-based configuration (`Config`) with IDE autocompletion support — no builder chains or option functions needed. This guide covers all configuration fields and common combinations.

> **API Reference**: See [Config](../../api-reference/core/config) for the complete field list.

## Four Presets

| Preset | Level | Format | Security Filter | Typical Use |
|--------|-------|--------|:---------------:|-------------|
| `DefaultConfig()` | Info | Text | ✅ Basic | Production default |
| `DevelopmentConfig()` | Debug | Text (short time) | ✅ Basic | Local development |
| `JSONConfig()` | Debug | JSON (RFC3339) | ✅ Basic | Log aggregation systems |
| `ProductionConfig()` | Info | JSON (RFC3339) | ✅ Basic | Production (JSON output) |

:::warning Security filter enabled by default
All four presets **enable** basic sensitive-data filtering (passwords, API keys, credit cards, etc.). Even development mode keeps it on — to catch accidental sensitive-data leaks early. To disable, explicitly set `Security: &dd.SecurityConfig{}` or use `SecurityLevelDevelopment`.
:::

## Config Field Overview

```go
type Config struct {
    // ─── Basic ───
    Level         LogLevel     // Log level (LevelDebug ~ LevelFatal)
    Format        LogFormat    // Output format (FormatText / FormatJSON)
    TimeFormat    string       // Time format (default ISO 8601)
    IncludeTime   bool         // Include timestamp
    IncludeLevel  bool         // Include log level

    // ─── Caller Info ───
    DynamicCaller bool         // Dynamic caller detection (file:line)
    FullPath      bool         // Use full file path (default: filename only)

    // ─── Output Targets ───
    Targets       []OutputTarget // Output destinations (ConsoleOutput/FileOutput/CustomOutput)

    // ─── Format Customization ───
    JSON          *JSONOptions // JSON format options (field names, indent, etc.)

    // ─── Security ───
    Security      *SecurityConfig       // Security config (filtering, rate limiting)
    FieldValidation *FieldValidationConfig // Field key naming validation

    // ─── Lifecycle ───
    FatalHandler      FatalHandler      // Custom fatal handler
    WriteErrorHandler WriteErrorHandler // Write-error callback
    LevelResolver      LevelResolver      // Dynamic level resolution (consulted per entry; nil disables)

    // ─── Extensions ───
    ContextExtractors []ContextExtractor // Context field extractors
    Hooks             *HookRegistry      // Lifecycle hooks
    Sampling          *SamplingConfig    // Log sampling

    // ─── Audit ───
    Audit             *AuditConfig       // Security audit logging
}
```

## Output Target Configuration

Use `ConsoleOutput()`, `FileOutput()`, `CustomOutput()` to construct output targets:

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{
        dd.ConsoleOutput(),                          // Console
        dd.FileOutput("logs/app.log"),               // File (default 100MB/10 backups/30 days)
        dd.CustomOutput(os.Stderr),                  // Custom Writer
    }

    // Custom file rotation parameters
    fileTarget := dd.FileOutput("logs/app.log")
    fileTarget.MaxSizeMB = 50              // Rotate at 50MB
    fileTarget.MaxBackups = 5              // Keep 5 backups
    fileTarget.MaxAge = 7 * 24 * time.Hour // Retain 7 days (MaxAge is a time.Duration — the unit is mandatory)

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()
}
```

:::tip Zero-value Config pitfall
Using `dd.Config{Targets: ...}` directly misses timestamps, level, and caller info. Always start from `dd.DefaultConfig()` and modify fields.
:::

## JSON Format Customization

```go
cfg := dd.JSONConfig()

// Custom JSON field names
cfg.JSON = &dd.JSONOptions{
    PrettyPrint: true,
    Indent:      "  ",
    FieldNames: &dd.JSONFieldNames{
        Timestamp: "@timestamp",
        Level:     "severity",
        Message:   "msg",
        Caller:    "source",
        Fields:    "ctx",
    },
}
```

## Security Configuration

```go
cfg := dd.DefaultConfig()

// Option A: By security level (recommended)
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)

// Option B: Industry presets
cfg.Security = dd.HealthcareConfig()   // HIPAA
cfg.Security = dd.FinancialConfig()    // PCI-DSS
cfg.Security = dd.GovernmentConfig()   // Government

// Option C: Custom
cfg.Security = &dd.SecurityConfig{
    MaxMessageSize: 1024 * 1024, // 1MB
    SensitiveFilter: dd.NewSensitiveDataFilter(),
}
```

See [Sensitive Data Filtering](../security/sensitive-filtering) and [Security Overview](../security/).

## Field Validation

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = dd.StrictSnakeCaseConfig()
// All field keys must be snake_case, otherwise a diagnostic goes to stderr
// (the field is still logged — logging methods do not return errors)
```

See [Field Validation](../security/field-validation).

## Log Sampling

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,            // First 100 entries always logged
    Thereafter: 10,             // Then log 1 out of every 10
    Tick:       time.Second,    // Reset counter every second
}
```

See [Log Sampling](../operations/sampling).

## Hooks and Audit

```go
// Hooks
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // Send to metrics system
        return nil
    }},
})
cfg.Hooks = registry

// Audit
cfg.Audit = &dd.AuditConfig{
    Enabled:     true,
    Output:      auditFile,
    JSONFormat:  true,
    MinimumSeverity: dd.AuditSeverityWarning,
}
```

See [Hook System](../operations/hooks) and [Audit Logging](../security/audit-logging).

## Clone: Configuration Deep Copy

`Clone()` creates a configuration copy, useful for deriving different configs from the same base:

```go
base := dd.DefaultConfig()
base.Format = dd.FormatJSON

// Derivation 1: Production config
prodCfg := base.Clone()
prodCfg.Level = dd.LevelInfo
prodCfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/prod.log")}

// Derivation 2: Debug config
debugCfg := base.Clone()
debugCfg.Level = dd.LevelDebug
debugCfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// base is unaffected
```

:::tip Clone copy depth
Deep copy: JSON, Security, Hooks, Sampling, Audit, Targets slice. Shallow copy: FatalHandler, WriteErrorHandler, FieldValidation (functions/pointers shared). ContextExtractors slice copied but extractor instances shared.
:::

## Next Steps

- [Core Concepts](./core-concepts) -- Logger hierarchy and processing pipeline
- [Structured Logging](./structured-logging) -- Field constructors and chaining
- [API Reference - Config](../../api-reference/core/config) -- Complete field documentation
