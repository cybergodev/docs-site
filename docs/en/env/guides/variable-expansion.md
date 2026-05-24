---
title: "Variable Expansion - CyberGo env | Variable Syntax"
description: "Complete guide for CyberGo env variable expansion syntax, covering ${VAR} and ${VAR:-default} reference syntax, nested default values, := assignment and :? error output conditional expansion modes, circular reference detection, MaxExpansionDepth limits, and ExpandVariables toggle control for variable reuse and dynamic value substitution in .env files."
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
| `${VAR:-default}` | Use default if VAR does not exist |
| `${VAR:=default}` | Use default if VAR does not exist (same as `:-`) |
| `${VAR:?error}` | Return error if VAR does not exist or is empty |

---

## Syntax Details

### `${VAR:-default}` - Use Default Value

The most common default value syntax. When the variable does not exist, the default value is used; when the variable exists (even if empty), the original value is used:

```bash
# If LOG_LEVEL does not exist, use "info"
LOG_LEVEL=${LOG_LEVEL:-info}

# If TIMEOUT does not exist, use "30s"
TIMEOUT=${TIMEOUT:-30s}

# Nested defaults
DB_HOST=${DB_HOST:-localhost}
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# If DB_HOST=localhost and DB_PORT does not exist
# DB_URL expands to: localhost:5432
```

**Use cases:**
- Default values for optional configuration items
- Unified configuration across development/production environments

---

### `${VAR:=default}` - Use Default Value

Behaves identically to `${VAR:-default}`, using the default value when the variable does not exist:

```bash
# If DEBUG does not exist, use "false"
DEBUG=${DEBUG:=false}

# Use default value if not present
CACHE_TTL=${CACHE_TTL:=3600}
```

::: info Relationship with `:-`
`${VAR:=default}` behaves identically to `${VAR:-default}` in this library. When the variable does not exist, the default value is used as the expansion result. `:=` does not write the default value back to variable storage.
:::

---

### `${VAR:?error}` - Error Message

Returns an error if the variable does not exist or is empty:

```bash
# If DATABASE_URL does not exist, loading fails with an error message
DATABASE_URL=${DATABASE_URL:?Database URL is required}

# If API_KEY does not exist, raise error
API_KEY=${API_KEY:?API_KEY must be set}
```

**Use cases:**
- Required configuration validation
- Fail early to avoid runtime errors

---

## Escaping

### Escaping the Dollar Sign

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
# Not expanded
LITERAL='${NO_EXPANSION}'
# Value: ${NO_EXPANSION}

# Compare with double quotes
EXPANDED="${WILL_EXPAND}"
# ${WILL_EXPAND} will be expanded
```

---

## Nested Expansion

Variables can reference each other with nesting:

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

## Circular Detection

The library automatically detects circular references and returns an error:

```bash
# Circular reference (error)
A=${B}
B=${A}

# Loading returns an ErrExpansionDepth error
```

---

## Expansion Depth Limit

The default maximum expansion depth is 5, with a hard upper limit of 20:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // Custom depth
```

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultMaxExpansionDepth` | 5 | Default value (public API) |

::: info Note
The hard upper limit is 20 (internal restriction). The configured `MaxExpansionDepth` cannot exceed this limit.
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

# Logging configuration
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
