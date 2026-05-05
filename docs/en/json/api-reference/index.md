---
title: API Reference - CyberGo JSON | Complete Function Reference
description: "CyberGo JSON complete API reference manual: covering GetString/GetInt path queries, Set/Delete modify operations, Marshal/Unmarshal serialization, Processor, Schema validation, Hook system, and security configuration, 100% compatible with encoding/json standard library."
---

# API Reference

This section provides the complete API reference for the `github.com/cybergodev/json` library.

## Module Index

| Module | Description |
|--------|-------------|
| [Package Functions](./functions) | Package-level function reference, including path queries, type getters, encoding/decoding, etc. |
| [Processor](./processor/) | Processor methods and configuration |
| [Config](./config) | Configuration options in detail |
| [Type Definitions](./types) | Core type definitions (including Encoder/Decoder) |
| [Generic Operations](./generics) | Generic API reference |
| [Interface Definitions](./interfaces) | Extension interface definitions |
| [Stream Processing](./large-file) | Stream processor reference |
| [NDJSON Processing](./jsonl) | JSONL/NDJSON processor |
| [Iterator](./iterator) | Iteration traversal API |
| [Helper Functions](./helpers) | Type conversion and utility functions |
| [Pretty Print](./print) | Formatting and pretty-print output |
| [Security](./security) | Security-related API |
| [Validator](./validator) | Schema validator |
| [Hook System](./hooks) | Operation interception hooks |
| [Custom Encoder](./custom-encoder) | Custom encoders |
| [Constants & Errors](./constants) | Constants and error types |

## Quick Find

### By Feature Category

#### Path Queries

| Function | Description |
|----------|-------------|
| `Get`, `GetString`, `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | Type-safe getters |
| `GetTyped[T]` | Generic getter |
| `SafeGet` | Safe getter returning AccessResult |
| `GetMultiple` | Batch getter |

#### Modify Operations

| Function | Description |
|----------|-------------|
| `Set`, `SetMultiple` | Set values |
| `SetCreate`, `SetMultipleCreate` | Set values with automatic path creation |
| `Delete`, `DeleteClean` | Delete values |
| `ProcessBatch` | Batch operations |

#### Encoding & Decoding

| Function | Description |
|----------|-------------|
| `Marshal`, `Unmarshal` | Standard encoding/decoding |
| `MarshalIndent` | Pretty-print encoding |
| `Encode`, `EncodeWithConfig` | Encode to string |
| `NewEncoder`, `NewDecoder` | Stream encoding/decoding |
| `Parse` | Parse JSON |

#### Formatting

| Function | Description |
|----------|-------------|
| `Prettify` | Format JSON |
| `Compact` | Compact JSON |

#### File Operations

| Function | Description |
|----------|-------------|
| `LoadFromFile`, `SaveToFile` | File read/write |
| `LoadFromReader` | Read from Reader |
| `MarshalToFile`, `UnmarshalFromFile` | File encoding/decoding |

#### Stream Processing

| Type/Method | Description |
|-------------|-------------|
| `ForeachFile` | File stream processing |
| `NDJSONProcessor` | NDJSON/JSONL processor |
| `JSONLWriter` | JSONL writer |

#### Validation

| Function | Description |
|----------|-------------|
| `Valid` | JSON validation |
| `ValidateSchema` | Schema validation (used with `Schema` type) |

## Naming Conventions

The library follows these naming conventions:

| Pattern | Description | Example |
|---------|-------------|---------|
| `Get{Type}` | Get specified type (supports defaultValue) | `GetString`, `GetInt` |
| `GetTyped[T]` | Generic getter, returns T | `GetTyped[User]` |
| `New{Type}` | Create instance | `New` (returns *Processor), `NewEncoder` |
| `Default{Type}` | Default configuration | `DefaultConfig` |
| `{Type}Config` | Configuration preset | `SecurityConfig`, `PrettyConfig` |

## Related

- [Getting Started](../getting-started) -- Installation and basic usage
- [Path Expression Syntax](../path-syntax) -- Path query syntax
- [Usage Examples](../examples) -- Practical code examples
- [Large File Processing](../large-files) -- Stream processing guide
