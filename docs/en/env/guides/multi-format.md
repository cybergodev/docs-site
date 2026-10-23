---
sidebar_label: "Multi-format Config"
title: "Multi-format Config - CyberGo env | .env/JSON/YAML"
description: "CyberGo env multi-format guide: auto-detect .env/JSON/YAML with mixed loading, key flattening of nested data, load order, Marshal/UnmarshalMap, RegisterParser."
sidebar_position: 1
---

# Multi-format Config

The env library supports three configuration formats: `.env`, JSON, and YAML, with automatic format detection and loading.

## Format Detection

### Auto-detection Rules

| Extension | Format | Constant |
|-----------|--------|----------|
| `.env` | .env format | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| Other | Auto | `FormatAuto` |

### DetectFormat Function

```go
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat("app.yml")        // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv
format = env.DetectFormat("unknown")        // FormatAuto

fmt.Println(format.String())  // "json", "yaml", "dotenv", "auto"
```

## Loading Multi-format Files

### Single Format

```go
loader.LoadFiles("config.env")
loader.LoadFiles("settings.json")
loader.LoadFiles("secrets.yaml")
```

### Mixed Formats

```go
// Auto-detect each file's format
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### Override Order

With the default configuration (`OverwriteExisting = false`), **the first file loaded wins**: duplicate keys in later files are skipped, and each key keeps the value from the file that set it first. Only when `OverwriteExisting = true` do later files overwrite earlier ones.

```go
// Default: first-wins - duplicate keys keep the .env value
loader.LoadFiles(
    ".env",           // Base configuration (wins for duplicate keys)
    "config.json",    // Only adds keys missing from .env
    "secrets.yaml",   // Only adds keys missing from the first two files
)

// Contrast: for last-wins (later files override), enable OverwriteExisting
cfg := env.DefaultConfig()
cfg.OverwriteExisting = true
loader2, _ := env.New(cfg)
loader2.LoadFiles(".env", "config.json", "secrets.yaml")
// Duplicate keys now resolve to secrets.yaml: secrets.yaml > config.json > .env
```

:::tip
The `DevelopmentConfig()` and `TestingConfig()` presets enable `OverwriteExisting = true` by default (later files override earlier ones). The package-level `env.Load()` uses `DefaultConfig` and keeps first-wins; switch to `env.LoadWithConfig` with `cfg.OverwriteExisting = true` for last-wins.
:::

## JSON Format

### File Structure

```json
{
    "APP_NAME": "myapp",
    "APP_PORT": "8080",
    "DEBUG": "true",
    "DATABASE": {
        "HOST": "localhost",
        "PORT": "5432"
    }
}
```

:::tip
Nested objects are flattened to `DATABASE_HOST`, `DATABASE_PORT`.
:::

### Key Resolution

Nested JSON/YAML structures are flattened for storage. The library supports multiple key access methods:

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// Stored as: DATABASE_HOST=localhost, DATABASE_PORT=5432

// Method 1: Flat key (recommended)
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// Method 2: Dot path (auto-converted)
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// Method 3: Uppercase dot path
host := loader.GetString("DATABASE.HOST")   // localhost
```

**Resolution rules:**

| Input Key | Converted to |
|-----------|---------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (exact match) |
| `"database.host"` | `"DATABASE_HOST"` (dots to underscores) |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (array index) |

:::tip Recommended usage
- **Use flat keys in code**: `GetString("DATABASE_HOST")` - explicit and efficient
- **Readable paths in config files**: JSON/YAML uses natural nested structure
:::

**Flattening rules:**

| JSON Path | Stored Key |
|-----------|------------|
| `database.host` | `DATABASE_HOST` |
| `database.port` | `DATABASE_PORT` |
| `app.server.name` | `APP_SERVER_NAME` |
| `servers.0.host` | `SERVERS_0_HOST` |

### Array Access

JSON arrays are flattened to indexed keys:

```json
{
    "servers": [
        { "host": "server1.example.com", "port": 8080 },
        { "host": "server2.example.com", "port": 8081 }
    ],
    "hosts": ["server1.example.com", "server2.example.com"]
}
```

```go
// Array of objects: access elements by index using flat keys
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Array of strings: aggregate the whole list with GetSliceFrom (HOSTS_0, HOSTS_1 → slice)
hosts := env.GetSliceFrom[string](loader, "HOSTS")
// hosts = ["server1.example.com", "server2.example.com"]
```

There is no whole-column aggregation function for arrays of objects (the `SERVERS_N_HOST` shape) — read them one by one by index as shown above; do not use a "stop at empty string" loop, since both empty values and missing keys return `""` and cannot be distinguished. For arrays of strings, use `GetSliceFrom` (indexed keys first, comma-separated fallback).

### JSON Parsing Configuration

```go
cfg := env.DefaultConfig()

// null values convert to empty strings (default true)
cfg.JSONNullAsEmpty = true

// numbers convert to strings (default true)
cfg.JSONNumberAsString = true

// booleans convert to strings (default true)
cfg.JSONBoolAsString = true

// Max nesting depth (default 16)
cfg.JSONMaxDepth = 20
```

### Type Conversion Example

```json
{
    "PORT": 8080,
    "DEBUG": true,
    "TIMEOUT": 30,
    "RATES": [0.1, 0.2, 0.3]
}
```

```go
// JSONNumberAsString = true (default)
port := loader.GetString("PORT")  // "8080" (string)
port := loader.GetInt("PORT")     // 8080 (integer)

// JSONBoolAsString = true (default)
debug := loader.GetString("DEBUG")  // "true" (string)
debug := loader.GetBool("DEBUG")    // true (boolean)
```

## YAML Format

### File Structure

```yaml
# Application configuration
APP_NAME: myapp
APP_PORT: "8080"
DEBUG: true

# Database configuration
DATABASE:
  HOST: localhost
  PORT: "5432"
  USER: postgres
  PASSWORD: secret

# List values
ALLOWED_HOSTS:
  - localhost
  - example.com
```

### Key Resolution

YAML nested structures use the same flattening rules as JSON:

```go
loader.LoadFiles("config.yaml")

// Access using flat keys
host := loader.GetString("DATABASE_HOST")        // localhost
user := loader.GetString("DATABASE_USER")        // postgres
```

### Array Access

YAML lists are flattened to indexed keys:

```yaml
servers:
  - host: server1.example.com
    port: 8080
  - host: server2.example.com
    port: 8081
```

```go
// Access using flat keys
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Get the entire list
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### YAML Parsing Configuration

```go
cfg := env.DefaultConfig()

// null/~ values convert to empty strings (default true)
cfg.YAMLNullAsEmpty = true

// numbers convert to strings (default true)
cfg.YAMLNumberAsString = true

// booleans convert to strings (default true)
cfg.YAMLBoolAsString = true

// Max nesting depth (default 16)
cfg.YAMLMaxDepth = 15
```

### Type Conversion Example

```yaml
PORT: 8080
DEBUG: true
TIMEOUT: 30
RATES:
  - 0.1
  - 0.2
  - 0.3
```

```go
// YAMLNumberAsString = true (default)
port := loader.GetString("PORT")  // "8080" (string)
port := loader.GetInt("PORT")     // 8080 (integer)

// YAMLBoolAsString = true (default)
debug := loader.GetString("DEBUG")  // "true" (string)
debug := loader.GetBool("DEBUG")    // true (boolean)

// List access
rates := env.GetSliceFrom[float64](loader, "RATES")  // [0.1, 0.2, 0.3]
```

## .env Format

### File Structure

```bash
# Comment
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# Quotes
MESSAGE="Hello World"

# Literal $ uses $$ escaping (note: single quotes do NOT prevent
# expansion — ${noexpand} inside 'literal ${noexpand}' still expands)
PRICE=100$$

# Variable expansion
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Log level
LOG_LEVEL=info
```

### Variable Expansion

For the full expansion syntax (`$$` escaping, `${VAR:-default}`, expansion scope, and more) see the [Variable Expansion](./variable-expansion) guide; this section is a quick overview:

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // Enabled by default

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// .env content:
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// Output: https://api.example.com/v1
```

### Expansion Syntax

| Syntax | Description |
|--------|-------------|
| `${VAR}` | Reference a variable |
| `${VAR:-default}` | Use default if variable doesn't exist |

```bash
# Expansion examples
HOST=localhost
PORT=8080

# Reference other variables
URL=http://${HOST}:${PORT}

# Default value (reference other variables, use default when undefined)
TIMEOUT_VALUE=${TIMEOUT:-30s}
DEBUG_VALUE=${DEBUG:-false}
```

### export Syntax

```bash
# Supports export prefix (when AllowExportPrefix = true)
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML-style Syntax

The `KEY: value` colon-separated form is **always available** (the line parser unconditionally accepts both `=` and `:` as separators, no switch needed). `AllowYamlSyntax` controls YAML scalar semantics for values:

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // Values parsed with YAML scalar semantics (null/~ → empty string)
```

```bash
# Colon-separated key-value pairs (always supported)
KEY: value
ANOTHER_KEY: "quoted value"
```

## Mixed Configuration Modes

### Development/Production Separation

```text
config/
├── base.json          # Base configuration
├── development.env    # Development config
├── production.yaml    # Production config
└── local.env          # Local config (not committed)
```

```go
func loadConfig(loader *env.Loader) error {
    // 1. Base configuration
    if err := loader.LoadFiles("config/base.json"); err != nil {
        return err
    }

    // 2. Environment configuration
    env := os.Getenv("APP_ENV")
    if env == "" {
        env = "development"
    }

    switch env {
    case "production":
        if err := loader.LoadFiles("config/production.yaml"); err != nil {
            return err
        }
    default:
        if err := loader.LoadFiles("config/development.env"); err != nil {
            return err
        }
    }

    // 3. Local config (optional)
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

:::tip
By default (`OverwriteExisting = false`) loading is first-wins: the environment and local files loaded later only **add** keys missing from base.json; duplicate keys keep the base.json value. To let environment/local config override the base, set `cfg.OverwriteExisting = true` (e.g. use the `DevelopmentConfig()` preset, which enables it by default).
:::

### Separation by Function

```text
config/
├── app.json       # Application configuration
├── database.yaml  # Database configuration
├── redis.env      # Redis configuration
└── secrets.json   # Secret configuration
```

```go
loader.LoadFiles(
    "config/app.json",
    "config/database.yaml",
    "config/redis.env",
    "config/secrets.json",
)
```

### Configuration Priority

With the default (`OverwriteExisting = false`), the first file loaded wins for duplicate keys:

```text
Command-line args > Environment variables > base config > environment config > local config
```

With `OverwriteExisting = true` enabled (e.g. the `DevelopmentConfig()` preset), later-loaded files win and the priority direction among files flips:

```text
Command-line args > Environment variables > local config > environment config > base config
```

## Serialization

`env.Marshal` exports a map or struct to `.env` / JSON / YAML, while `env.UnmarshalMap` / `env.UnmarshalStruct` parse in the reverse direction; pass `env.FormatAuto` to auto-detect the format from content.

Note the processing applied to structured output: Marshal to JSON rebuilds underscore keys (such as `DATABASE_HOST`) into nested objects and infers strings like `"8080"` and `"true"` back to number / bool; Marshal to YAML automatically quotes scalars that would be type-coerced on the way back in (such as `PORT: "8080"`) so round-trips stay consistent.

See the [Serialization](./serialization) guide for the full function family and output-shape examples.

## Custom Format

Beyond the three built-in formats, implement the `EnvParser` interface and register custom formats with `RegisterParser` (the built-in `.env` / JSON / YAML cannot be overridden — `ForceRegisterParser` excepted).

Note that `LoadFiles` routes by extension and only recognizes `.env` / `.json` / `.yaml` / `.yml` — custom format numbers are never routed automatically. See the [Custom Parser](./custom-parser) guide for complete examples and the two loading paths.

## Complete Example

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/env"
)

func main() {
	// Create loader
	cfg := env.DefaultConfig()
	cfg.ExpandVariables = true

	loader, err := env.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer loader.Close()

	// Load mixed-format configuration (duplicate keys keep the
	// first-loaded file's value by default; see "Override Order")
	err = loader.LoadFiles(
		"config/base.json",     // JSON base configuration
		"config/database.yaml", // YAML database configuration
		"config/app.env",       // .env application configuration
	)
	if err != nil {
		log.Fatal(err)
	}

	// Read configuration
	fmt.Printf("App: %s\n", loader.GetString("APP_NAME"))
	fmt.Printf("DB Host: %s\n", loader.GetString("DATABASE_HOST"))
	fmt.Printf("DB Port: %d\n", loader.GetInt("DATABASE_PORT"))

	// Export current configuration
	all := loader.All()
	exported, _ := env.Marshal(all, env.FormatEnv)
	fmt.Println("\nExported config:")
	fmt.Println(exported)
}
```

## Structured Parsing Details and Prefix Filtering

### JSON/YAML Flattening Rules

Nested structures are flattened into environment variable keys on load, with these defaults:

| Rule | Example |
|------|---------|
| Nested keys joined with underscores | `{"database": {"host": "..."}}` → `DATABASE_HOST` |
| Array elements use `key_index` | `{"hosts": ["a", "b"]}` → `HOSTS_0`, `HOSTS_1` |
| `null` becomes an empty string | `{"name": null}` → `NAME=""` |
| Numbers and booleans become strings | `{"port": 5432}` → `PORT="5432"` |
| Nesting depth cap defaults to 16 | Controlled by `JSONMaxDepth`/`YAMLMaxDepth` (1–100) |

During file loading, conversion behavior is controlled by `Config`'s `JSONConfig`/`YAMLConfig` (e.g. `JSONNullAsEmpty`, `JSONNumberAsString`); the string-parsing paths of `UnmarshalMap`/`UnmarshalStruct` use built-in default rules and do not read these settings.

### Prefix Filtering (Prefix)

`ComponentConfig.Prefix` restricts loading to variables starting with the given prefix (case-insensitive) — commonly used to take only your application's slice from a shared configuration file:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_" // Only load keys starting with MYAPP_
loader, _ := env.New(cfg)
```

Prefix filtering combines with the `OverwriteExisting` policy: filtered-out keys neither overwrite nor enter storage.

### Unknown-Extension Fallback

`DetectFormat` returns `FormatAuto` for unknown extensions, in which case the loader **falls back to the `.env` parser** for line-by-line parsing. Therefore files like `config.conf` or `config.txt` still load correctly as long as their content is `KEY=value` shaped.

## Related Documentation

- [Serialization](./serialization) - Serialization/deserialization in depth
- [ComponentFactory API](../api-reference/factory) - Format detection and parser registration
- [Custom Parser](./custom-parser) - Adding custom formats
- [Config API](../api-reference/config) - JSON/YAML parsing configuration
