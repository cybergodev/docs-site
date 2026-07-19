---
sidebar_label: "Variable Expansion"
title: "Variable Expansion - CyberGo env | Variable Syntax"
description: "CyberGo env variable expansion: ${VAR}, ${VAR:-default}, ${VAR:=default}, ${VAR:?error}, $VAR shorthand, circular-ref detection, MaxExpansionDepth limits."
sidebar_position: 4
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

::: warning Self-reference limitation
The variable referenced by `:-`, `:=`, `:?` must differ from the key being assigned. A self-reference such as `KEY=${KEY:-default}` is detected as a cycle and fails at load with `ErrExpansionDepth`. To set a default for a key, assign a literal directly (`KEY=default`) or reference another variable (see the examples below).
:::

---

## Syntax Details

### `${VAR:-default}` - Use Default Value

The most common default value syntax. When the variable does not exist, the default value is used; when the variable exists (even if empty), the original value is used:

```bash
# HOST is defined, use its value
HOST=localhost
PRIMARY_HOST=${HOST:-127.0.0.1}
# PRIMARY_HOST expands to: localhost

# If TIMEOUT is not defined, use the default value "30s"
TIMEOUT_VALUE=${TIMEOUT:-30s}
# TIMEOUT_VALUE expands to: 30s

# Nested defaults
DB_HOST=localhost
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# When DB_HOST=localhost and DB_PORT is not defined
# DB_URL expands to: localhost:5432
```

**Use cases:**
- Default values for optional configuration items
- Unified configuration across development/production environments

---

### `${VAR:=default}` - Use Default Value

Behaves identically to `${VAR:-default}`, using the default value when the variable does not exist:

```bash
# If DEBUG is not defined, use "false"
DEBUG_VALUE=${DEBUG:=false}

# If CACHE_TTL is not defined, use the default value
CACHE_TTL_VALUE=${CACHE_TTL:=3600}
```

::: info Relationship with `:-`
`${VAR:=default}` behaves identically to `${VAR:-default}` in this library. When the variable does not exist, the default value is used as the expansion result. `:=` does not write the default value back to variable storage.
:::

---

### `${VAR:?error}` - Error Message

Returns an error if the variable does not exist or is empty:

```bash
# If DATABASE_URL is not defined, loading fails with an error
DB_URL=${DATABASE_URL:?Database URL is required}

# If API_TOKEN is not defined, raise error
AUTH_TOKEN=${API_TOKEN:?API_TOKEN must be set}
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

### Quotes and Expansion

Variable expansion happens during a unified post-processing stage after quote stripping, and **neither single quotes nor double quotes affect expansion**. For example, `SINGLE='${BASE}'` (with `BASE=hello`) expands to `hello`, identical to the double-quote behavior; if the referenced variable is undefined (e.g., `LITERAL='${NO_EXPANSION}'`), the result is an empty string rather than the literal `${NO_EXPANSION}`.

The only difference between single and double quotes is in **literal parsing**: double quotes process escape sequences like `\n` and `\t`, while single quotes preserve them verbatim (no escaping).

::: warning Note
Do not use quotes to "disable expansion." To preserve the literal `${VAR}`, use one of the following approaches:
:::

```bash
# Method 1: escape the dollar sign ($$ expands to literal $)
LITERAL='$${NO_EXPANSION}'
# Value: ${NO_EXPANSION}
```

```go
// Method 2: disable global variable expansion
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```

---

## Nested Expansion

Variables can reference each other with nesting:

```bash
# Base configuration (avoid the built-in forbidden key ENV, use DEPLOY_ENV instead)
APP_NAME=myapp
DEPLOY_ENV=production

# Nested references
DB_HOST=db.${DEPLOY_ENV}.example.com
# Expands to: db.production.example.com

API_URL=https://${APP_NAME}.${DEPLOY_ENV}.api.example.com
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

# Base configuration (avoid the built-in forbidden key ENV)
APP_NAME=myapp
DEPLOY_ENV=development
DEBUG=true

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${APP_NAME}
DB_URL=postgres://${DB_HOST}:${DB_PORT}/${DB_NAME}

# API configuration
API_BASE=https://api.${DEPLOY_ENV}.example.com
API_URL=${API_BASE}/v1

# Logging configuration
LOG_LEVEL=info

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

- [Getting Started](/en/env/getting-started/) - Basic usage
- [Config API](/en/env/api-reference/config) - ExpandVariables configuration
- [Constants & Errors](/en/env/api-reference/constants) - Expansion depth limits
