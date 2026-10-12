---
sidebar_label: "Overview"
title: "Environment Variables - CyberGo env | Secure Config Library"
description: "CyberGo env: high-security Go environment variable library with .env, JSON and YAML support, type-safe conversion, SecureValue storage and audit logging."
---

# env

A high-security Go environment variable management library supporting `.env`, JSON, and YAML formats, with thread safety, audit logging, and secure storage.

## Core Features

- **Multi-format support** - `.env`, JSON, YAML auto-detection
- **Type safety** - automatic type conversion and validation
- **Thread safety** - concurrent access with sharded locks
- **Secure storage** - memory locking and auto-zeroing for sensitive values
- **Audit logging** - complete operation tracking
- **Variable expansion** - `${VAR}` syntax support
- **Struct mapping** - tag-driven configuration binding

## Navigate by Use Case

Not sure where to start? Choose by your need:

| I want to... | Where to look |
|--------------|---------------|
| Get started in 5 minutes | [Quick Start](./getting-started/) |
| Store passwords and keys securely | [Security Overview](./security/) → [SecureValue](./api-reference/secure-value) |
| Prevent sensitive data from being swapped to disk | [Memory Locking](./security/memory-locking) |
| Safely handle sensitive data in logs | [Data Masking](./security/data-masking) |
| Map environment variables to a struct | [Struct Mapping](./guides/struct-mapping) |
| Load JSON/YAML config files | [Multi-format Config](./guides/multi-format) |
| Configure variable references and reuse | [Variable Expansion](./guides/variable-expansion) |
| Serialize/export configuration | [Serialization](./guides/serialization) |
| Record security audit logs | [Audit Logging](./guides/audit-logging) |
| Handle and match errors | [Error Handling](./guides/error-handling) |
| Write unit tests | [Testing](./guides/testing) |
| Extend with custom file formats | [Custom Parser](./guides/custom-parser) |
| Security checks before going live | [Production Checklist](./security/production-checklist) |
| See common code snippets | [Cheat Sheet](./getting-started/cheatsheet) |
| Find answers to common questions | [FAQ](./reference/faq) |

## Key Features Overview

| Feature | Description |
|---------|-------------|
| [Type Conversion](./getting-started/) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [Struct Mapping](./guides/struct-mapping) | Tag-driven configuration binding |
| [Secure Storage](./api-reference/secure-value) | Memory protection for sensitive values |
| [Multi-format Loading](./guides/multi-format) | .env, JSON, YAML |

## Quick Navigation

### Getting Started
- [Quick Start](./getting-started/) - 5-minute tutorial
- [Cheat Sheet](./getting-started/cheatsheet) - Common code snippets

### API Reference
- [Package Functions](./api-reference/functions) - Complete API documentation
- [Loader](./api-reference/loader) - Loader methods
- [SecureValue](./api-reference/secure-value) - Secure value handling

### Security
- [Security Overview](./security/) - Security architecture and best practices
