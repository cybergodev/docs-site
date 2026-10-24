---
sidebar_label: "Overview"
title: "Environment Variables - CyberGo env | Secure Config Library"
description: "CyberGo env: high-security Go environment variable library with .env, JSON and YAML support, type-safe conversion, SecureValue storage and audit logging."
---

# env

env is a Go library for managing environment variables. It loads `.env`, JSON, and YAML files, converts values to Go types, protects sensitive values in memory, and records audit events.

## Core Features

- **Multi-format loading** - `.env`, JSON, and YAML, picked by file extension
- **Type safety** - typed getters with conversion and validation
- **Concurrency safety** - one `Loader` is safe to share across goroutines
- **Secure storage** - memory locking and zeroing for sensitive values
- **Audit logging** - records load, set, and delete operations
- **Variable expansion** - `${VAR}` and `${VAR:-default}` references
- **Struct mapping** - tag-driven binding into Go structs

## Navigate by Use Case

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

## Start Here

- [Quick Start](./getting-started/) - install, load a `.env` file, read typed values
- [Cheat Sheet](./getting-started/cheatsheet) - one-page snippet reference
- [Package Functions](./api-reference/functions) - full function reference
- [Loader](./api-reference/loader) - instance methods and lifecycle
- [SecureValue](./api-reference/secure-value) - secure value handling
- [Security Overview](./security/) - security architecture and defaults
