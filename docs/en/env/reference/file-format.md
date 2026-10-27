---
sidebar_label: "File Format"
title: "File Format - CyberGo env | .env/JSON/YAML Syntax"
description: "File format reference for CyberGo env: .env, JSON and YAML syntax, quoting, ${VAR} expansion, block scalars, key flattening and DetectFormat auto-detection."
sidebar_position: 1
---

# File Format

env reads three configuration file formats: `.env`, JSON, and YAML. The file extension selects the parser, and every format ends up as the same flat `KEY=value` pairs — the formats differ in syntax and in how they handle nested structures.

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
APP_PATH="/usr/local/bin"

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
APP_PATH="C:\\Users\\name"

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

# Default values (can reference any key in the same file, regardless of definition
# order; a self-reference fails as a cycle)
HOST=example.com
PRIMARY_HOST=${HOST:-localhost}
TIMEOUT=${TIMEOUT_SECONDS:-30s}

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

With the default `AllowYamlSyntax = false`, only `=` separates a key from its value. A `KEY: value` line has no separator, so the parser skips it; when auditing is on, each skipped line is recorded as an audit event with its content masked first.

Set `AllowYamlSyntax = true` to treat `:` as a separator as well. Values then follow YAML scalar semantics: `null` and `~` become empty strings, and YAML boolean and number literals are recognized per YAML rules.

```bash
# Default (AllowYamlSyntax = false): no '=' on this line, so the whole line is skipped
KEY: value
```

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true
```

```bash
# With AllowYamlSyntax = true: the colon separator takes effect
KEY: value
ANOTHER: "quoted value"
```

`AllowYamlSyntax` is the only parsing switch that defaults to off, so `.env` files that use `:` as a separator need this setting before they load. Of the four presets, only `DevelopmentConfig()` turns it on: `DefaultConfig()`, `TestingConfig()`, and `ProductionConfig()` all keep it `false`.

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

### Duplicate Keys

Duplicate keys inside a single file are resolved by `DuplicateKeyPolicy`. The default value `DuplicateKeyInherit` (the zero value) keeps each format's historical behavior:

| Format | Default (Inherit) behavior |
|--------|---------------------------|
| `.env` | Follows `OverwriteExisting`: with `false` (the default) the first occurrence wins, with `true` the last occurrence wins |
| YAML | The last occurrence wins (independent of `OverwriteExisting`) |
| JSON | The last occurrence wins (independent of `OverwriteExisting`) |

An explicit policy can also be set: `DuplicateKeyFirstWins` keeps the first occurrence (for JSON, a document containing duplicate keys is rejected instead), `DuplicateKeyLastWins` makes the last occurrence win in every format, and `DuplicateKeyError` fails with `ErrDuplicateKey` on any duplicate key. The policy only governs duplicate keys **within a single file**; how multiple files override one another is decided by `OverwriteExisting` (see [Multi-file Loading](../getting-started/#multi-file-loading) in the Quick Start guide).

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError // error on duplicate keys within a single file
```

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

`JSONNullAsEmpty` and `JSONNumberAsString` **default to true** in `DefaultConfig`; `JSONBoolAsString` defaults to `false` and has no effect on JSON output (it is marked Deprecated). The first two need no explicit assignment; set one of them to false only when you want to disable that conversion:

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

YAML supports block scalars: a literal block `|` preserves the content and line breaks of each line, while a folded block `>` folds the line break between adjacent lines into a space (an empty line folds into a line break). The block content is every line after the header indented deeper than the key's own level, and multi-line values (certificates, keys, and the like) are stored verbatim, with no null/boolean/number type conversion:

```yaml
private_key: |
  -----BEGIN PRIVATE KEY-----
  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
  -----END PRIVATE KEY-----

description: >
  Adjacent lines of a folded block
  are joined with spaces in the result
```

The header can carry a chomping indicator that controls trailing line breaks: `-` (strip) removes all of them, `+` (keep) keeps all of them, and the default (clip) keeps exactly one. It can also carry an explicit indentation indicator digit (for example `|2`, meaning the block content is indented two spaces relative to its parent). When anything else follows on the header line (for example `| text`), it is not a block scalar: `|` and `>` are then treated as ordinary scalar characters.

To express line breaks on a single line, a double-quoted value with `\n` escapes works just as well:

```yaml
description: "Line1\nLine2\nLine3"
```

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

// Returns FormatAuto when no extension matches (the loader falls back to the .env parser
// when no parser is registered for that format)
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
