---
sidebar_label: "File Format"
title: "File Format - CyberGo env | .env/JSON/YAML Syntax"
description: "File format reference for CyberGo env: .env, JSON, and YAML syntax, quoting, export prefixes, ${VAR} expansion, multi-line values, flattening, and DetectFormat."
sidebar_position: 1
---

# File Format

The env library supports multiple configuration file formats: `.env`, JSON, and YAML.

## .env Format

### Basic Syntax

```bash
# Comment
KEY=value

# Equals sign in value
URL=https://example.com?foo=bar

# Empty lines are ignored

# Invalid: keys cannot have spaces
# MY KEY=value
```

### Quotes

```bash
# Double quotes: preserve spaces, support escapes
MESSAGE="Hello World"
PATH="/usr/local/bin"

# Single quotes: no escape processing (backslash sequences preserved as-is)
# Note: single quotes do not prevent variable expansion — expansion happens after quote stripping
LITERAL='no escaping here: \n stays literal'

# No quotes
SIMPLE=value

# Empty values
EMPTY=
EMPTY=""
EMPTY=''
```

### Escape Characters

Escapes are supported in double quotes:

```bash
# Newline
MULTILINE="line1\nline2"

# Tab
TABBED="col1\tcol2"

# Quotes
QUOTED="He said \"Hello\""

# Backslash
PATH="C:\\Users\\name"

# Dollar sign
PRICE="Price: \$100"
```

### Variable Expansion

`ExpandVariables` is enabled by default (`DefaultConfig` sets it to true; disable with `cfg.ExpandVariables = false`). Supported syntax:

```bash
# Reference other variables
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Simple syntax
URL=$BASE_URL/path

# Default values
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# Nested expansion
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### export Syntax

`AllowExportPrefix` is enabled by default (true). Supported:

```bash
# Bash-style export
export KEY=value
export ANOTHER="quoted value"
```

### YAML Style

The `KEY: value` colon-separated form is **always available** — the line parser unconditionally accepts both `=` and `:` as separators, no switch required:

```bash
# Colon-separated key-value pairs (no AllowYamlSyntax needed)
KEY: value
ANOTHER: "quoted value"
```

`AllowYamlSyntax` is disabled by default (false — the only parsing switch that defaults to off); when enabled, it affects how **values** are parsed: they follow YAML scalar semantics, where `null`/`~` are treated as empty strings and YAML boolean and number literals are recognized per YAML rules.

### Multi-line Values

The `.env` parser scans line by line, parsing each line independently, and **does not support quoted strings spanning multiple lines** — double-quoted values must close on a single line, otherwise `ErrInvalidValue` is returned. For line breaks, use `\n` escapes (only effective in double quotes; single quotes don't process escapes):

```bash
# \n inside double quotes is parsed as a newline character
LINES="line1\nline2\nline3"
# The actual value is three lines of text: line1 / line2 / line3

# Multi-line certificates like PRIVATE_KEY should be joined with \n
PRIVATE_KEY="-----BEGIN KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END KEY-----"
```

For true multi-line strings, use [JSON or YAML format](#format-detection) instead, or extend multi-line support via a custom parser.

## JSON Format

### Basic Structure

```json
{
    "APP_NAME": "my-app",
    "APP_VERSION": "1.0.0",
    "DEBUG": true,
    "PORT": 8080
}
```

### Nested Objects

Nested objects are flattened:

```json
{
    "database": {
        "host": "localhost",
        "port": 5432
    }
}
```

Result:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### Arrays

Arrays are flattened to indexed keys:

```json
{
    "ALLOWED_HOSTS": ["localhost", "example.com"],
    "PORTS": [80, 443, 8080]
}
```

Result:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

:::tip Accessing array elements
Use the `GetSlice[T]` function or dot-path to access indexed keys:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
See [GetSlice documentation](../api-reference/functions#getslice-t).
:::

### Type Conversion Options

`JSONNullAsEmpty` / `JSONNumberAsString` / `JSONBoolAsString` all **default to true (enabled)** in `DefaultConfig` — there is no need to assign true one by one; only set them explicitly when you want to disable a conversion:

```go
cfg := env.DefaultConfig()

// Example: disable "numbers convert to strings" so JSON numbers
// keep their original type semantics
cfg.JSONNumberAsString = false
```

### Depth Limit

```go
cfg.JSONMaxDepth = 10  // Max nesting depth
```

## YAML Format

### Basic Structure

```yaml
APP_NAME: my-app
APP_VERSION: "1.0.0"
DEBUG: true
PORT: 8080
```

### Nested Structures

```yaml
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
    password: secret
```

Flattened result:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### Lists

Lists are flattened to indexed keys:

```yaml
allowed_hosts:
  - localhost
  - example.com
  - api.example.com
```

Result:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
ALLOWED_HOSTS_2=api.example.com
```

### Multi-line Strings

:::warning
YAML block scalars (literal block `|` and folded block `>`) are **currently not supported**. The parser treats `|`/`>` as ordinary scalar characters, and subsequent indented lines will break key-value parsing.
:::

For values that need to preserve line breaks, use double quotes with `\n` escapes:

```yaml
description: "Line1\nLine2\nLine3"
```

Or extend block scalar support via a custom parser.

### Type Conversion Options

`YAMLNullAsEmpty` / `YAMLNumberAsString` / `YAMLBoolAsString` likewise **default to true (enabled)**; set them to false explicitly only when you want to disable a conversion. `YAMLMaxDepth` defaults to 10 — adjust it only when you need deeper nesting:

```go
cfg := env.DefaultConfig()

// Example: disable "booleans convert to strings"
cfg.YAMLBoolAsString = false

// Example: relax the nesting depth
cfg.YAMLMaxDepth = 20
```

## Format Detection

### Auto-detection

```go
// Detect by extension
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// Returns FormatAuto when no matching extension (defaults to .env parser)
format = env.DetectFormat("config")  // FormatAuto
```

### Format Constants

```go
const (
    FormatAuto  FileFormat = iota  // Auto-detect
    FormatEnv                      // .env format
    FormatJSON                     // JSON format
    FormatYAML                     // YAML format
)
```

### Format String

```go
format := env.FormatJSON
fmt.Println(format.String())  // Output: json
```

## Best Practices

### Choosing a Format

| Scenario | Recommended Format |
|----------|-------------------|
| Simple configuration | `.env` |
| Complex nested configuration | JSON or YAML |
| Sharing with other tools | JSON |
| Human readability priority | YAML |
| Docker/K8s environment | `.env` |

### File Naming

```bash
.env              # Default configuration
.env.local        # Local overrides (not committed)
.env.development  # Development environment
.env.staging      # Staging environment
.env.production   # Production environment
.env.test         # Test environment
```

### Mixed Usage

```go
// You can mix different formats
loader.LoadFiles(
    "base.env",           // Base configuration
    "database.json",      // Database configuration
    "secrets.yaml",       // Sensitive configuration
    ".env.local",         // Local overrides
)
```

### Git Ignore

```bash
# Ignore sensitive configuration
.env.local
.env.*.local
.env.production
secrets.yaml

# Keep templates
!.env.example
```

## Related Documentation

- [Multi-format Config](../guides/multi-format) - Multi-format loading guide
- [ComponentFactory API](../api-reference/factory) - DetectFormat function reference
- [Config API](../api-reference/config) - JSON/YAML parsing options
