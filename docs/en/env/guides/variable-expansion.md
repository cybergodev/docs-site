---
sidebar_label: "Variable Expansion"
title: "Variable Expansion - CyberGo env | ${VAR} and Defaults"
description: "Variable expansion syntax for CyberGo env: ${VAR} and ${VAR:-default} references, ${VAR:?error} validation, and circular reference detection."
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
| `${VAR:=default}` | If VAR doesn't exist, use default (same as `:-`) |
| `${VAR:?error}` | If VAR doesn't exist or is empty, return error |

:::warning
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

### `${VAR:=default}` - Use Default Value

Behaves the same as `${VAR:-default}`, using the default value when the variable doesn't exist:

```bash
# When DEBUG is undefined, use "false"
DEBUG_VALUE=${DEBUG:=false}

# When CACHE_TTL is undefined, use default value
CACHE_TTL_VALUE=${CACHE_TTL:=3600}
```

:::info
`${VAR:=default}` behaves exactly the same as `${VAR:-default}` in this library. When the variable doesn't exist, the default value is used as the expansion result. `:=` does not write the default value back to variable storage.
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

By default, variable expansion resolves references file-first, then process environment — when `${VAR}` is not found in the file, lookup falls back to the process environment (`os.LookupEnv`). This matches traditional dotenv semantics, but it becomes a risk when the configuration file comes from a **not fully trusted source** (user uploads, files delivered by external systems): a file containing `${AWS_SECRET_ACCESS_KEY}` can capture unrelated process secrets into variable values, which may then leak out through logging, serialization, or export operations.

`ParsingConfig.ExpansionScope` controls this behavior:

| Value | Behavior | Use case |
|-------|----------|----------|
| `ExpansionFileThenProcess` (default) | File-local variables first, process environment fallback | Trusted config files, traditional dotenv semantics |
| `ExpansionFileOnly` | Only file-local variables are visible; process-environment references expand to empty strings | Untrusted config sources, secret probing prevention (SEC-03) |

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
// Only allow references to file-local variables; block process-environment reads
cfg.ExpansionScope = env.ExpansionFileOnly
loader, _ := env.New(cfg)
```

::: warning SEC-03
`ExpansionFileOnly` is the security switch that prevents configuration files from "harvesting" process secrets. If your application loads externally provided configuration files, keep this scope enabled at all times.
:::

Note: `ExpansionScope` is an enum, not a boolean field. Even if it is the only field set on a `Config`, `IsZero()` correctly recognizes the Config as initialized and it will not be silently replaced by defaults.

## Related Documentation

- [Quick Start](/en/env/getting-started/) - Basic usage
- [Config API](/en/env/api-reference/config) - ExpandVariables configuration
- [Constants & Errors](/en/env/api-reference/constants) - Expansion depth limits
