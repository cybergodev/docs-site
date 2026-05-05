---
title: env - Environment Variable Management
description: CyberGo env is a highly secure Go environment variable management library with multi-format loading, type-safe conversion, secure storage, and audit logging.
---

# env

A highly secure Go environment variable management library supporting `.env`, JSON, and YAML formats, with thread safety, audit logging, and secure storage.

## Core Features

- **Multi-Format Support** - `.env`, JSON, YAML auto-detection
- **Type Safety** - Automatic type conversion and validation
- **Thread Safety** - Thread-safe concurrent access with sharded locking
- **Secure Storage** - Memory locking and auto-zeroing for sensitive values
- **Audit Logging** - Complete operation tracking
- **Variable Expansion** - `${VAR}` syntax support
- **Struct Mapping** - Tag-driven configuration binding

## Key Features Overview

| Feature | Description |
|---------|-------------|
| [Type Conversion](/en/env/getting-started) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [Struct Mapping](/en/env/guides/struct-mapping) | Tag-driven configuration binding |
| [Secure Storage](/en/env/api-reference/secure-value) | Memory-protected sensitive values |
| [Multi-Format Loading](/en/env/guides/multi-format) | .env, JSON, YAML |

## Quick Navigation

<div class="vp-features">

### Getting Started
- [Quick Start](/en/env/getting-started) - 5-minute tutorial
- [Cheat Sheet](/en/env/cheatsheet) - Common code snippets

### API Reference
- [Package Functions](/en/env/api-reference/functions) - Complete API documentation
- [Loader](/en/env/api-reference/loader) - Loader methods
- [SecureValue](/en/env/api-reference/secure-value) - Secure value handling

### Security
- [Security Overview](/en/env/security/) - Security architecture and best practices

</div>
