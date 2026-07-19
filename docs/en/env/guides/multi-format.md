---
sidebar_label: "Multi-format Config"
title: "Multi-format Config - CyberGo env | .env/JSON/YAML"
description: "CyberGo env multi-format: load .env/JSON/YAML, auto-detect, flatten nested keys, merge priority, Marshal/UnmarshalMap, RegisterParser for containers."
sidebar_position: 3
---

# Multi-format Config

The env library supports `.env`, JSON, and YAML configuration formats with automatic format detection and loading.

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

Files loaded later override earlier ones:

```go
// Order: base -> env -> json -> yaml
loader.LoadFiles(
    ".env",           // Base configuration
    "config.json",    // Overrides .env
    "secrets.yaml",   // Overrides config.json
)
```

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

::: tip Note
Nested objects are flattened to `DATABASE_HOST`, `DATABASE_PORT`.
:::

### Key Name Resolution

Nested structures in JSON/YAML are flattened for storage. The library supports multiple key name access methods:

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// Stored as: DATABASE_HOST=localhost, DATABASE_PORT=5432

// Method 1: Flattened key name (recommended)
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// Method 2: Dot path (auto-converted)
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// Method 3: Uppercase dot path
host := loader.GetString("DATABASE.HOST")   // localhost
```

**Resolution Rules:**

| Input Key | Converted To |
|-----------|-------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (exact match) |
| `"database.host"` | `"DATABASE_HOST"` (dot to underscore) |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (array index) |

::: tip Recommended Usage
- **Use flattened key names in code**: `GetString("DATABASE_HOST")` - clear and efficient
- **Readable paths in config files**: JSON/YAML uses natural nested structures
:::

**Flattening Rules:**

| JSON Path | Storage Key |
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
    ]
}
```

```go
// Access array elements using flattened key names
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Use a loop to get all hosts
var hosts []string
for i := 0; ; i++ {
    h := loader.GetString(fmt.Sprintf("SERVERS_%d_HOST", i))
    if h == "" {
        break
    }
    hosts = append(hosts, h)
}
// hosts = ["server1.example.com", "server2.example.com"]
```

### JSON Parsing Configuration

```go
cfg := env.DefaultConfig()

// Convert null values to empty strings (default: true)
cfg.JSONNullAsEmpty = true

// Convert numbers to strings (default: true)
cfg.JSONNumberAsString = true

// Convert booleans to strings (default: true)
cfg.JSONBoolAsString = true

// Maximum nesting depth (default: 10)
cfg.JSONMaxDepth = 20
```

### Type Conversion Examples

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

### Key Name Resolution

YAML nested structures use the same flattening rules as JSON:

```go
loader.LoadFiles("config.yaml")

// Access using flattened key names
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
// Access using flattened key names
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Get the entire list
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### YAML Parsing Configuration

```go
cfg := env.DefaultConfig()

// Convert null/~ values to empty strings (default: true)
cfg.YAMLNullAsEmpty = true

// Convert numbers to strings (default: true)
cfg.YAMLNumberAsString = true

// Convert booleans to strings (default: true)
cfg.YAMLBoolAsString = true

// Maximum nesting depth (default: 10)
cfg.YAMLMaxDepth = 15
```

### Type Conversion Examples

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
# Comments
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# Quotes
MESSAGE="Hello World"
LITERAL='literal ${noexpand}'

# Variable expansion
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Log level
LOG_LEVEL=info
```

### Variable Expansion

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
| `${VAR}` | Reference variable |
| `${VAR:-default}` | Use default value when variable does not exist |

```bash
# Expansion examples
HOST=localhost
PORT=8080

# Reference other variables
URL=http://${HOST}:${PORT}

# Default values (reference another variable, use default when undefined)
TIMEOUT_VALUE=${TIMEOUT:-30s}
DEBUG_VALUE=${DEBUG:-false}
```

### export Syntax

```bash
# export prefix supported (when AllowExportPrefix = true)
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### YAML-style Syntax

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // Enable YAML-style syntax
```

```bash
# Supports YAML-style key-value pairs
KEY: value
ANOTHER_KEY: "quoted value"
```

## Mixed Configuration Patterns

### Development/Production Separation

```text
config/
├── base.json          # Base configuration
├── development.env    # Development overrides
├── production.yaml    # Production overrides
└── local.env          # Local overrides (not committed)
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

    // 3. Local overrides (optional)
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

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

```text
CLI flags > Environment variables > Local config > Environment config > Base config
```

## Serialization

### Marshal

Serialize configuration to a specified format:

```go
data := map[string]string{
    "HOST": "localhost",
    "PORT": "8080",
}
```

::: code-group

```go [.env (default)]
envStr, _ := env.Marshal(data)
// HOST=localhost
// PORT=8080
```

```go [JSON]
jsonStr, _ := env.Marshal(data, env.FormatJSON)
// {
//   "HOST": "localhost",
//   "PORT": 8080
// }
```

```go [YAML]
yamlStr, _ := env.Marshal(data, env.FormatYAML)
// HOST: localhost
// PORT: 8080
```

:::

### Marshal Struct

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}
```

::: code-group

```go [to .env]
envStr, _ := env.Marshal(cfg, env.FormatEnv)
```

```go [to JSON]
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)
```

```go [to YAML]
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

:::

### UnmarshalMap

Deserialize to a map:

::: code-group

```go [from .env]
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)
```

```go [from JSON]
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)
```

```go [from YAML]
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)
```

:::

::: tip Auto-detect format
Pass `env.FormatAuto` to let the library determine the format from content: `data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)`.
:::

### UnmarshalStruct

Deserialize to a struct:

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config
```

::: code-group

```go [from .env]
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)
```

```go [from JSON]
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)
```

```go [from YAML]
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

:::

## Custom Formats

### Register a Parser

```go
// Define format constant
const FormatTOML env.FileFormat = 100

// Implement the EnvParser interface
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // Implement TOML parsing
    result := make(map[string]string)
    // ...
    return result, nil
}

// Register the parser
func init() {
    env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}
```

See [Custom Parser](/en/env/guides/custom-parser) for details.

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

    // Load mixed-format configuration
    err = loader.LoadFiles(
        "config/base.json",       // JSON base configuration
        "config/database.yaml",   // YAML database configuration
        "config/app.env",         // .env application configuration
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

## Related Documentation

- [Serialization](/en/env/guides/serialization) - Serialization/deserialization details
- [ComponentFactory API](/en/env/api-reference/factory) - Format detection and parser registration
- [Custom Parser](/en/env/guides/custom-parser) - Adding custom formats
- [Config API](/en/env/api-reference/config) - JSON/YAML parsing configuration
