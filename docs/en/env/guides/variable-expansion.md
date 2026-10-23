---
sidebar_label: "Variable Expansion"
title: "Variable Expansion - CyberGo env | ${VAR} and Default Syntax"
description: "CyberGo env variable expansion: ${VAR} and ${VAR:-default} references, ${VAR:=default} defaults, ${VAR:?error} checks, $VAR shorthand, cycle and depth limits."
sidebar_position: 3
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
| `${VAR:-default}` | If VAR doesn't exist, use default |
| `${VAR:=default}` | If VAR doesn't exist, use default and assign it back to the variable |
| `${VAR:?error}` | If VAR doesn't exist or is empty, return error |

:::warning Self-reference restriction
Variables referenced by `:-`, `:=`, `:?` must be **different** from the key being assigned. Self-references like `KEY=${KEY:-default}` are detected as circular references and produce an `ErrExpansionDepth` error during loading. To set a default value for a key, assign a literal directly (`KEY=default`), or reference another variable (see examples below).
:::

---

## Syntax Details

### `${VAR:-default}` - Use Default Value

The most common default value syntax. Uses the default value when the variable doesn't exist; uses the original value when the variable exists (even if empty):

```bash
# HOST is defined, use its value
HOST=localhost
PRIMARY_HOST=${HOST:-127.0.0.1}
# PRIMARY_HOST expands to: localhost

# When TIMEOUT is undefined, use default "30s"
TIMEOUT_VALUE=${TIMEOUT:-30s}
# TIMEOUT_VALUE expands to: 30s

# Nested defaults
DB_HOST=localhost
DB_URL=${DB_HOST}:${DB_PORT:-5432}
# When DB_HOST=localhost and DB_PORT is undefined
# DB_URL expands to: localhost:5432
```

**Use cases:**
- Default values for optional configuration items
- Unified configuration across development/production environments

---

### `${VAR:=default}` - Use Default Value and Assign Back

The difference from `${VAR:-default}` is that `:=` **assigns** the expanded default value back to the variable — the write-back is visible to subsequent references within the same file and appears in the map after loading; variables that already exist (from the file or the process environment) are not reassigned.

```bash
# ASSIGNED is written back as "created" when undefined, and B expands to "created"
B=${ASSIGNED:=created}
# Result: B="created" and ASSIGNED="created"
```

:::info Relation to `:-`
`${VAR:-default}` only returns the default value without writing it back; `${VAR:=default}` both returns the default value and **assigns it back** to the variable store when the variable doesn't exist (the write-back is visible to later references within the same file and to `Get`/`Apply`, processed deterministically by key-name sort order). If the variable already exists (whether from the file or the process environment), `:=` does not reassign it and behaves as returning the original value.
:::

---

### `${VAR:?error}` - Error on Missing

Returns an error if the variable doesn't exist or is empty:

```bash
# If DATABASE_URL is undefined, loading fails with an error
DB_URL=${DATABASE_URL:?Database URL is required}

# If API_TOKEN is undefined, error
AUTH_TOKEN=${API_TOKEN:?API_TOKEN must be set}
```

**Use cases:**
- Required configuration item validation
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

### Quotes and Expansion

Variable expansion happens in a unified post-processing stage after quote stripping, so **neither single quotes nor double quotes affect variable expansion**. For example, `SINGLE='${BASE}'` (with `BASE=hello`) expands to `hello`, consistent with double-quote behavior; if the referenced variable is undefined (e.g., `LITERAL='${NO_EXPANSION}'`), the result is an empty string rather than preserving the `${NO_EXPANSION}` literal.

The difference between single and double quotes only matters for **literal parsing**: double quotes process escape sequences like `\n`, `\t`, while single quotes preserve them as-is (no escaping).

:::warning
Do not use quotes to "disable expansion." To preserve the `${VAR}` literal, use the following methods:
:::

```bash
# Method 1: Escape the dollar sign ($$ expands to literal $)
LITERAL='$${NO_EXPANSION}'
# Value: ${NO_EXPANSION}
```

```go
// Method 2: Disable global variable expansion
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```

---

## Nested Expansion

Variables can be nested references:

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

The default maximum expansion depth is 5, with a hard limit of 20:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // Custom depth
```

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultMaxExpansionDepth` | 5 | Default value (public API) |

:::info
The hard limit is 20 (internal limit). The configured `MaxExpansionDepth` cannot exceed this limit.
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

# Log configuration
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

## Expansion Scope (Security Isolation)

`ParsingConfig.ExpansionScope` controls which scopes `${VAR}` references can resolve against. `ExpansionFileThenProcess` is the **zero value** of the Go `iota` enum (`= iota`), but what users actually get at runtime comes from `DefaultConfig()` — `New()` applies `DefaultConfig()` to a zero-valued `Config`, and `DefaultConfig()` explicitly sets `ExpansionScope` to `ExpansionFileOnly` (SEC-003, blocking the `${VAR}` fallback to process-environment reads by default). Therefore **the runtime default = FileOnly**: the "zero value" and the "DefaultConfig default" are two different things.

| Value | Behavior | Use case |
|-------|----------|----------|
| `ExpansionFileOnly` (runtime default) | Only file-local variables are visible; process-environment references expand to empty strings | Default behavior; secret probing prevention (SEC-03) |
| `ExpansionFileThenProcess` (enum zero value) | File-local variables first, process environment fallback | Only when set explicitly, for trusted config files and traditional dotenv semantics |

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
// DefaultConfig already defaults to ExpansionFileOnly; this is an explicit declaration
cfg.ExpansionScope = env.ExpansionFileOnly
loader, _ := env.New(cfg)
```

::: warning SEC-03
`DefaultConfig()` defaults the expansion scope to `ExpansionFileOnly` — `${VAR}` references resolve only within the file, blocking fallback reads from the process environment. If your application loads externally provided configuration files, keep this default and do not explicitly switch back to `ExpansionFileThenProcess`.
:::

Note: `ExpansionScope` is an enum, not a boolean field. Even if it is the only field set on a `Config`, `IsZero()` correctly recognizes the Config as initialized and it will not be silently replaced by defaults. But distinguish the "enum zero value" from the "DefaultConfig default": `ExpansionFileThenProcess` is the enum zero value, while `DefaultConfig()` explicitly sets `ExpansionFileOnly` — the two are not the same.

## Related Documentation

- [Quick Start](../getting-started/) - Basic usage
- [Config API](../api-reference/config) - ExpandVariables configuration
- [Constants & Errors](../api-reference/constants) - Expansion depth limits
