---
title: Variable Expansion - CyberGo env Variable Syntax
description: Guide for env library variable expansion syntax, supporting ${VAR} references, defaults, conditional expansion, and cycle detection
---

# Variable Expansion

The env library supports variable references in configuration files, enabling configuration reuse and dynamic value substitution.

## Enabling Variable Expansion

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // Enabled by default

loader, _ := env.New(cfg)
loader.LoadFiles(".env")
```

## Basic Syntax

### Simple References

```bash
# Reference other variables
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1
# API_URL expands to: https://api.example.com/v1

# Shorthand syntax
HOST=localhost
URL=$HOST:8080
# URL expands to: localhost:8080
```

### Default Value Syntax

| Syntax | Description |
|--------|-------------|
| `${VAR:-default}` | Use default if VAR is not set |
| `${VAR:=default}` | Use default if VAR is not set (same as `:-`) |
| `${VAR:?error}` | Return error if VAR is not set or empty |

---

## Syntax Details

### `${VAR:-default}` - Use Default Value

The most common default value syntax. The default is used when the variable is not set; if the variable exists (even with an empty value), the original value is used:

```bash
# If LOG_LEVEL doesn't exist, use "info"
LOG_LEVEL=${LOG_LEVEL:-info}

# If TIMEOUT doesn't exist, use "30s"
TIMEOUT=${TIMEOUT:-30s}

# Nested defaults
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# If DB_HOST=localhost and DB_PORT doesn't exist
# DB_URL expands to: localhost:5432
```

**Use cases:**
- Default values for optional configuration items
- Unified configuration across development/production environments

---

### `${VAR:=default}` - Use Default Value

Behaves identically to `${VAR:-default}`, using the default value when the variable is not set:

```bash
# If DEBUG doesn't exist, use "false"
DEBUG=${DEBUG:=false}

# Use default if not present
CACHE_TTL=${CACHE_TTL:=3600}
```

::: info Relationship to `:-`
`${VAR:=default}` behaves identically to `${VAR:-default}` in this library. When the variable is not set, the default value is used as the expansion result. `:=` does not write the default value back to the variable store.
:::

---

### `${VAR:?error}` - Error Message

Returns an error if the variable is not set or empty:

```bash
# If DATABASE_URL doesn't exist, loading fails with an error message
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# If API_KEY doesn't exist, error
API_KEY=${API_KEY:?API_KEY must be set}
```

**Use cases:**
- Required configuration validation
- Fail early to avoid runtime errors

---

## Escaping

### Escaping Dollar Signs

Use `$$` for a literal `$`:

```bash
# Price configuration
PRICE=$$99.99
# Expands to: $99.99

# String containing $
MESSAGE=Price is $$100
# Expands to: Price is $100
```

### Single Quotes

Variables inside single quotes are not expanded:

```bash
# No expansion
LITERAL='${NO_EXPANSION}'
# Value is: ${NO_EXPANSION}

# Compare with double quotes
EXPANDED="${WILL_EXPAND}"
# ${WILL_EXPAND} will be expanded
```

---

## Nested Expansion

Variables can reference each other:

```bash
# Base configuration
APP_NAME=myapp
ENV=production

# Nested references
DB_HOST=db.${ENV}.example.com
# Expands to: db.production.example.com

API_URL=https://${APP_NAME}.${ENV}.api.example.com
# Expands to: https://myapp.production.api.example.com
```

---

## Cycle Detection

The library automatically detects circular references and returns an error:

```bash
# Circular reference (error)
A=${B}
B=${A}

# Loading returns ErrExpansionDepth error
```

---

## Expansion Depth Limit

Default maximum expansion depth is 5, with a hard maximum of 20:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // Custom depth
```

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultMaxExpansionDepth` | 5 | Default value (public API) |

::: info Note
The hard maximum expansion depth is 20 (internal limit). Configured `MaxExpansionDepth` values cannot exceed this limit.
:::

---

## Complete Example

```bash
# .env file

# Base configuration
APP_NAME=myapp
ENV=development
DEBUG=true

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${APP_NAME}}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API configuration
API_BASE=https://api.${ENV}.example.com
API_URL=${API_BASE}/v1
API_KEY=${API_KEY:?API_KEY is required}

# Log configuration
LOG_LEVEL=${LOG_LEVEL:-info}

# Price (escaped)
PRICE=$$99.99
```

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("DB_URL:", loader.GetString("DB_URL"))
    fmt.Println("API_URL:", loader.GetString("API_URL"))
    fmt.Println("PRICE:", loader.GetString("PRICE"))
}
```

---

## Related Documentation

- [Getting Started](/en/env/getting-started) - Basic usage
- [Config API](/en/env/api-reference/config) - ExpandVariables configuration
- [Constants & Errors](/en/env/api-reference/constants) - Expansion depth limits
