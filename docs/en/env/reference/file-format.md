---
sidebar_label: "File Format"
title: "File Format - CyberGo env | .env/JSON/YAML Syntax"
description: "File format reference for CyberGo env: .env, JSON and YAML syntax, quoting, export prefixes, ${VAR} expansion, AllowYamlSyntax and key flattening."
sidebar_position: 1
---

# File Format

env reads three configuration file formats: `.env`, JSON, and YAML. The file extension selects the parser, and every format flattens into the same flat key-value store.

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

# Single quotes: no escape processing (backslash sequences preserved as-is),
# and values inside them are not expanded
LITERAL='no escaping here: \n stays literal'
# Note: '${HOME}' inside single quotes also stays literal

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

`ExpandVariables` is enabled by default: `DefaultConfig` sets it to true, and `cfg.ExpandVariables = false` disables it. Supported syntax:

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

With the default `AllowYamlSyntax = false`, only `=` separates a key from its value. A `KEY: value` line has no separator, so the parser skips it; when auditing is on, that skip is recorded as an audit event.

Set `AllowYamlSyntax = true` to treat `:` as a separator as well. Values then follow YAML scalar semantics: `null` and `~` become empty strings, and YAML boolean and number literals are recognized per YAML rules.

```bash
# Colon-separated key-value pairs (requires AllowYamlSyntax = true)
KEY: value
ANOTHER: "quoted value"
```

`AllowYamlSyntax` is the only parsing switch that defaults to off, so `.env` files that use `:` as a separator need this setting before they load.

### Multi-line Values

The `.env` parser reads line by line and parses each line on its own. It **does not support quoted strings that span multiple lines**: a double-quoted value must close on the same line, otherwise the parser returns `ErrInvalidValue`. For a line break inside a value, use a `\n` escape, which works only inside double quotes:

```bash
# \n inside double quotes is parsed as a newline character
LINES="line1\nline2\nline3"
# The actual value is three lines of text: line1 / line2 / line3

# Multi-line certificates like PRIVATE_KEY should be joined with \n
PRIVATE_KEY="-----BEGIN KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END KEY-----"
```

For real multi-line strings, use [JSON or YAML format](#format-detection), or add multi-line support with a custom parser.

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
Use `GetSlice[T]` or a dot path to reach indexed keys:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
See [GetSlice documentation](../api-reference/functions#getslice-t).
:::

### Type Conversion Options

`JSONNullAsEmpty`, `JSONNumberAsString`, and `JSONBoolAsString` all **default to true** in `DefaultConfig`. There is no need to set them individually; set one to false only when you want to disable that conversion:

```go
cfg := env.DefaultConfig()

// Disable "numbers convert to strings" so JSON numbers keep their
// original type semantics
cfg.JSONNumberAsString = false
```

### Depth Limit

```go
cfg.JSONMaxDepth = 10  // Max nesting depth (default 16)
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
YAML block scalars (literal block `|` and folded block `>`) are **not supported**. The parser treats `|` and `>` as ordinary scalar characters, and the following indented lines break key-value parsing.
:::

For values that must preserve line breaks, use a double-quoted value with `\n` escapes:

```yaml
description: "Line1\nLine2\nLine3"
```

Or add block-scalar support with a custom parser.

### Type Conversion Options

`YAMLNullAsEmpty`, `YAMLNumberAsString`, and `YAMLBoolAsString` likewise **default to true**; set one to false only to disable that conversion. `YAMLMaxDepth` defaults to 16; adjust it only when you need deeper nesting:

```go
cfg := env.DefaultConfig()

// Disable "booleans convert to strings"
cfg.YAMLBoolAsString = false

// Relax the nesting depth
cfg.YAMLMaxDepth = 20
```

## Format Detection

### Auto-detection

```go
// Detect by extension
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// Returns FormatAuto when no extension matches (the loader falls back to the .env parser)
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
// Different formats can be mixed in one call
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

- [Multi-format Config](../guides/multi-format) - multi-format loading
- [ComponentFactory API](../api-reference/factory) - DetectFormat function reference
- [Config API](../api-reference/config) - JSON/YAML parsing options
