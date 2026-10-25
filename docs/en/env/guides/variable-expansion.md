---
sidebar_label: "Variable Expansion"
title: "Variable Expansion - CyberGo env | ${VAR} and Default Syntax"
description: "CyberGo env variable expansion: ${VAR} and ${VAR:-default} references, ${VAR:=default} defaults, ${VAR:?error} checks, $VAR shorthand, cycle and depth limits."
sidebar_position: 3
---

# Variable Expansion

With `ExpandVariables` enabled, a `.env` value can reference another variable, which lets you define a value once and reuse it. Expansion runs as a post-processing pass after a line is parsed and its quotes are stripped.

## Enabling Variable Expansion

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // Optional: DefaultConfig already enables it; shown explicitly

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
| `${VAR:-default}` | Use default if VAR doesn't exist |
| `${VAR:=default}` | Use default if VAR doesn't exist, and assign it back to the variable |
| `${VAR:?error}` | Return an error if VAR doesn't exist or is empty |

:::warning Self-reference restriction
The variable referenced by `:-`, `:=`, or `:?` must be **different** from the key being assigned. A self-reference like `KEY=${KEY:-default}` counts as a circular reference and fails loading with `ErrExpansionDepth`. To give a key a default, assign a literal directly (`KEY=default`) or reference another variable.
:::

---

## Syntax Details

### `${VAR:-default}` - Use Default Value

`${VAR:-default}` uses the default when the variable doesn't exist, and the original value when it does — even if that value is empty:

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

Unlike `${VAR:-default}`, `:=` **assigns** the expanded default back to the variable. Later references in the same file see the written value, and it appears in the map after loading. A variable that already exists — from the file or from the process environment — is not reassigned.

```bash
# ASSIGNED is written back as "created" when undefined, and B expands to "created"
B=${ASSIGNED:=created}
# Result: B="created" and ASSIGNED="created"
```

:::info Relation to `:-`
`${VAR:-default}` only returns the default value without writing it back. `${VAR:=default}` returns the default and **assigns it back** to the variable store when the variable doesn't exist; the write-back is visible to later references in the same file and to `Get`/`Apply`, and processing follows key-name sort order. If the variable already exists, `:=` returns the original value and does not reassign.
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

**Values in single quotes are not expanded**, matching bash's single-quote semantics. `PASSWORD='my$ecret'` loads as the literal text `my$ecret`, and `SINGLE='${BASE}'` loads as the literal `${BASE}` rather than the value of `BASE`.

Double-quoted and unquoted values are expanded as usual: `GREET="hello $NAME"` (with `NAME=world`) becomes `hello world`.

Quotes also affect **literal parsing**: double quotes process `\n`, `\r`, `\t`, `\"`, and `\\`, while single quotes keep every backslash sequence as written.

:::warning
Three ways to keep a `${VAR}` literal:

```bash
# Method 1: single quotes (the whole value is not expanded)
LITERAL='${NO_EXPANSION}'
# Value: ${NO_EXPANSION}
```

```bash
# Method 2: double quotes or no quotes, escaping the dollar sign with $$
LITERAL="$${NO_EXPANSION}"
# Value: ${NO_EXPANSION}
```

```go
// Method 3: disable expansion globally
cfg := env.DefaultConfig()
cfg.ExpandVariables = false
```
:::

---

## Nested Expansion

References can be nested:

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

Circular references are detected and fail loading:

```bash
# Circular reference (error)
A=${B}
B=${A}

# Loading returns an ErrExpansionDepth error
```

---

## Expansion Depth Limit

The default maximum expansion depth is 5, and the hard limit is 20:

```go
cfg := env.DefaultConfig()
cfg.MaxExpansionDepth = 10  // Custom depth
```

| Constant | Value | Description |
|----------|-------|-------------|
| `DefaultMaxExpansionDepth` | 5 | Default value (public API) |

:::info
The hard limit is 20 (an internal limit). A configured `MaxExpansionDepth` cannot exceed it.
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

`ParsingConfig.ExpansionScope` controls which variables a `${VAR}` reference can resolve against. It has two values:

| Value | Behavior | Use case |
|-------|----------|----------|
| `ExpansionFileOnly` (runtime default) | Only file-local variables are visible; process-environment references expand to empty strings | Default behavior; blocks secret probing via config files (SEC-03) |
| `ExpansionFileThenProcess` (enum zero value) | File-local variables first, then the process environment | Set explicitly, for trusted config files and traditional dotenv semantics |

Two points are easy to confuse:

1. **The enum zero value is not the runtime default.** `ExpansionFileThenProcess` is the `iota` zero value, but `New()` replaces a zero-value `Config` with `DefaultConfig()`, and `DefaultConfig()` sets `ExpansionScope = ExpansionFileOnly` explicitly. So `env.New(env.Config{})` actually runs with FileOnly.
2. **A partially filled `Config` is not treated as zero.** Since v1.3.0, `Config.IsZero()` covers every field (including enum fields such as `ExpansionScope`), so such a config is not silently replaced by `DefaultConfig()`. `New()` then calls `Config.Validate()`: unset required limits (`MaxFileSize` and others) are still zero, validation fails, and `New()` returns an error wrapping `ErrInvalidConfig`. Always start custom configs from `env.DefaultConfig()` or a preset.

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
// DefaultConfig already selects ExpansionFileOnly; this is an explicit declaration
cfg.ExpansionScope = env.ExpansionFileOnly
loader, _ := env.New(cfg)
```

::: warning SEC-03
`DefaultConfig()` sets the expansion scope to `ExpansionFileOnly`, so `${VAR}` references resolve only within the file. If your application loads externally provided configuration files, keep this default and do not switch back to `ExpansionFileThenProcess`.
:::

## Related Documentation

- [Quick Start](../getting-started/) - basic usage
- [Config API](../api-reference/config) - ExpandVariables configuration
- [Constants & Errors](../api-reference/constants) - expansion depth limits
