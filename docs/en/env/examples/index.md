---
sidebar_label: "Examples Overview"
title: "Examples - CyberGo env | Runnable Go Config Examples"
description: "CyberGo env examples: 13 runnable Go programs covering quick start, config presets, SecureValue, audit logging, multi-format conversion and extensibility."
sidebar_position: 1
---

# Examples

The env library ships 13 runnable examples in the `examples/` directory of the source repository. Each example is a self-contained `main` program, covering everything from global-mode basics to security features and advanced capabilities. All examples are included in normal builds (`go build ./...`).

## Running the Examples

Clone the repository at [github.com/cybergodev/env](https://github.com/cybergodev/env), then run `go run` from the **project root**:

```bash
git clone https://github.com/cybergodev/env.git
cd env
go run ./examples/01_quickstart/
```

Examples reference shared configuration files under `examples/data/` using relative paths, so they must be run from the project root for those paths to resolve.

### Shared Data Files

| File | Format | Purpose |
|------|--------|---------|
| `config.env` | dotenv | Flat KEY=value pairs, variable expansion demo |
| `config.json` | JSON | Nested structure (app/db/cache/features) |
| `config.yaml` | YAML | Same structure as JSON, for struct mapping demos |

## Example Index

| # | Directory | What It Demonstrates | Related Docs |
|---|-----------|----------------------|--------------|
| 01 | `01_quickstart/` | Global-mode basics: `Load` initialization, typed access via `GetString`/`GetInt`/`GetBool`/`GetDuration`, `Lookup` existence checks, runtime `Set` | [Quick Start](../getting-started/) |
| 02 | `02_loader_config/` | Instance mode with four config presets (Default/Development/Production/Testing), custom configs, and explicit lifecycle control | [Config](../api-reference/config), [Loader](../api-reference/loader) |
| 03 | `03_type_access/` | Every typed getter: string, int, bool, duration, float, uint, and slice, plus `Lookup`, including dot-notation paths | [Quick Start](../getting-started/) |
| 04 | `04_struct_mapping/` | Struct mapping with `env` tags: nested structs, `envDefault` defaults, and marshaling | [Struct Mapping](../guides/struct-mapping) |
| 05 | `05_secure_values/` | `SecureValue` lifecycle: `Close` vs `Release`, memory zeroing, and mlock memory locking | [Memory Locking](../security/memory-locking), [SecureValue](../api-reference/secure-value) |
| 06 | `06_audit_logging/` | JSON, Channel, and Log audit handlers, automatically capturing read, write, and delete events | [Audit Logging](../guides/audit-logging) |
| 07 | `07_marshal_unmarshal/` | Format conversion: map ↔ string, struct ↔ map, multi-format output, and round trips | [Serialization](../guides/serialization) |
| 08 | `08_utilities/` | Utility functions: introspection (`Len`/`Keys`/`All`), key deletion, masking, and format detection | [Multi-format Config](../guides/multi-format) |
| 09 | `09_error_handling/` | Sentinel errors (`errors.Is`) and typed errors (`errors.As`), including missing-file and closed-loader cases | [Error Handling](../guides/error-handling) |
| 10 | `10_concurrency/` | Concurrent reads, writes, and mixed access, demonstrating shard-lock concurrency safety | [Concurrency](../guides/concurrency) |
| 11 | `11_advanced/` | Variable expansion (`$VAR` and `${VAR}`), multiple file loading with override, and prefix filtering | [Variable Expansion](../guides/variable-expansion) |
| 12 | `12_extensibility/` | Registering a custom parser with `RegisterParser`, interface-segregated consumption via `EnvGetter` (dependency injection and test doubles), and custom components (`CustomAuditor` counting audit events) | [Custom Parser](../guides/custom-parser), [Interfaces](../api-reference/interfaces) |
| 13 | `13_customization/` | Custom Validator/Expander/FileSystem, fail-closed auditing (`ErrAuditFailed`), custom Marshaler/Unmarshaler, and brace operators | [Interfaces](../api-reference/interfaces), [Audit Logging](../guides/audit-logging), [Serialization](../guides/serialization) |

## Reading Order

We recommend reading the examples in numeric order: 01–03 cover the global and instance modes plus typed access, 04–07 introduce production features such as struct mapping, secure values, and auditing, and 08–13 move on to utilities, error handling, advanced features, and extensibility. Every example can be verified directly with `go run` and pairs well with its linked documentation page.
