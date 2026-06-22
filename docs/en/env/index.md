---
title: "CyberGo env - Environment Variable Management Library"
description: "CyberGo env is a secure Go library for environment variables, loading .env, JSON and YAML with type-safe reads, SecureValue memory protection and audit logging."
---

# env

A highly secure Go environment variable management library with support for `.env`, JSON, and YAML formats, providing thread safety, audit logging, and secure storage.

## Core Features

- **Multi-format Support** - Automatic detection of `.env`, JSON, YAML
- **Type Safety** - Automatic type conversion and validation
- **Thread Safety** - Thread-safe concurrent access with sharded locks
- **Secure Storage** - Memory locking and auto-zeroing for sensitive values
- **Audit Logging** - Complete operation tracking
- **Variable Expansion** - `${VAR}` syntax support
- **Struct Mapping** - Tag-driven configuration binding

## Feature Overview

| Feature | Description |
|---------|-------------|
| [Type Conversion](/en/env/getting-started) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [Struct Mapping](/en/env/guides/struct-mapping) | Tag-driven configuration binding |
| [Secure Storage](/en/env/api-reference/secure-value) | Sensitive value memory protection |
| [Multi-format Loading](/en/env/guides/multi-format) | .env, JSON, YAML |

## Quick Navigation

<div class="vp-features">

### Getting Started
- [Getting Started](/en/env/getting-started) - 5-minute tutorial
- [Cheat Sheet](/en/env/cheatsheet) - Common code snippets

### API Reference
- [Package Functions](/en/env/api-reference/functions) - Complete API documentation
- [Loader](/en/env/api-reference/loader) - Loader methods
- [SecureValue](/en/env/api-reference/secure-value) - Secure value handling

### Security
- [Security Overview](/en/env/security/) - Security architecture and best practices

</div>
