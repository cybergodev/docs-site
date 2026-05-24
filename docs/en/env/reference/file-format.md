---
title: "File Format - CyberGo env | .env/JSON/YAML Syntax"
description: "Complete reference for CyberGo env supported configuration file formats, covering .env key-value syntax, JSON object format, and YAML hierarchical format with comment rules, data type support, UTF-8 encoding, DetectFormat auto-detection, and JSONConfig/YAMLConfig format-specific options."
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

# Blank lines are ignored

# Invalid: key cannot contain spaces
# MY KEY=value
```

### Quoting

```bash
# Double quotes: preserve spaces, support escaping
MESSAGE="Hello World"
PATH="/usr/local/bin"

# Single quotes: literal, no escaping
LITERAL='no ${expansion} here'

# Unquoted
SIMPLE=value

# Empty values
EMPTY=
EMPTY=""
EMPTY=''
```

### Escape Characters

Escaping is supported within double quotes:

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

Supported when `ExpandVariables` is enabled:

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

Supported when `AllowExportPrefix` is enabled:

```bash
# Bash-style export
export KEY=value
export ANOTHER="quoted value"
```

### YAML-Style Syntax

Supported when `AllowYamlSyntax` is enabled:

```bash
# YAML-style key-value pairs
KEY: value
ANOTHER: "quoted value"
```

### Multiline Values

```bash
# Newlines inside double quotes
PRIVATE_KEY="-----BEGIN KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END KEY-----"

# Using \n escapes
LINES="line1\nline2\nline3"
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

Arrays are flattened into indexed keys:

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

:::tip Accessing Array Elements
Use the `GetSlice[T]` function or dot-notation paths to access indexed keys:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
See [GetSlice documentation](/en/env/api-reference/functions#getslice-t) for details.
:::

### Type Conversion Options

```go
cfg := env.DefaultConfig()

// Convert null to empty string
cfg.JSONNullAsEmpty = true

// Convert numbers to strings
cfg.JSONNumberAsString = true

// Convert booleans to strings
cfg.JSONBoolAsString = true
```

### Depth Limit

```go
cfg.JSONMaxDepth = 10  // Maximum nesting depth
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

Lists are flattened into indexed keys:

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

### Multiline Strings

```yaml
# Literal block (preserves newlines)
description: |
  Line 1
  Line 2
  Line 3

# Folded block (newlines become spaces)
summary: >
  This is a long
  summary that will
  be on one line.
```

### Type Conversion Options

```go
cfg := env.DefaultConfig()

cfg.YAMLNullAsEmpty = true
cfg.YAMLNumberAsString = true
cfg.YAMLBoolAsString = true
cfg.YAMLMaxDepth = 10
```

## Format Detection

### Auto-Detection

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
|----------|--------------------|
| Simple configuration | `.env` |
| Complex nested configuration | JSON or YAML |
| Sharing with other tools | JSON |
| Human readability priority | YAML |
| Docker/K8s environments | `.env` |

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

- [Multi-Format Configuration](/en/env/guides/multi-format) - Multi-format loading guide
- [ComponentFactory API](/en/env/api-reference/factory) - DetectFormat function reference
- [Config API](/en/env/api-reference/config) - JSON/YAML parsing options
