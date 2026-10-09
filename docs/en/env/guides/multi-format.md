---
sidebar_label: "Multi-format Config"
title: "Multi-format Config - CyberGo env | .env/JSON/YAML"
description: "Multi-format config guide for CyberGo env: .env, JSON, and YAML auto-detection with mixed loading, nested object flattening, and merge priority."
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

Later-loaded files overwrite earlier ones:

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

:::tip
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
    ]
}
```

```go
// Access array elements using flat keys
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

// null values convert to empty strings (default true)
cfg.JSONNullAsEmpty = true

// numbers convert to strings (default true)
cfg.JSONNumberAsString = true

// booleans convert to strings (default true)
cfg.JSONBoolAsString = true

// Max nesting depth (default 10)
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

// Max nesting depth (default 10)
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

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // Enable YAML style
```

```bash
# Supports YAML-style key-value pairs
KEY: value
ANOTHER_KEY: "quoted value"
```

## Mixed Configuration Modes

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
Command-line args > Environment variables > local config > environment config > base config
```

## Serialization

### Marshal

Serializes configuration to the specified format. Prepare data first, then call `env.Marshal` with the target format:

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

```go [To .env]
envStr, _ := env.Marshal(cfg, env.FormatEnv)
```

```go [To JSON]
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)
```

```go [To YAML]
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

:::

### UnmarshalMap

Deserialize to map:

::: code-group

```go [From .env]
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)
```

```go [From JSON]
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)
```

```go [From YAML]
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)
```

:::

:::tip
Pass `env.FormatAuto` to let the library auto-detect the format from content: `data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)`.
:::

### UnmarshalStruct

Deserialize to struct:

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config
```

::: code-group

```go [From .env]
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)
```

```go [From JSON]
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)
```

```go [From YAML]
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

:::

## Custom Format

### Register Parser

```go
// Define format constant
const FormatTOML env.FileFormat = 100

// Implement EnvParser interface
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

// Register parser
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

See [Custom Parser](/en/env/guides/custom-parser).

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

### JSON/YAML flattening rules

Nested structures are flattened into environment variable keys on load, with these defaults:

| Rule | Example |
|------|---------|
| Nested keys joined with underscores | `{"database": {"host": "..."}}` → `DATABASE_HOST` |
| Array elements use `key_index` | `{"hosts": ["a", "b"]}` → `HOSTS_0`, `HOSTS_1` |
| `null` becomes an empty string | `{"name": null}` → `NAME=""` |
| Numbers and booleans become strings | `{"port": 5432}` → `PORT="5432"` |
| Nesting depth cap defaults to 10 | Controlled by `JSONMaxDepth`/`YAMLMaxDepth` (1–100) |

During file loading, conversion behavior is controlled by `Config`'s `JSONConfig`/`YAMLConfig` (e.g. `JSONNullAsEmpty`, `JSONNumberAsString`); the string-parsing paths of `UnmarshalMap`/`UnmarshalStruct` use built-in default rules and do not read these settings.

### Prefix filtering (Prefix)

`ComponentConfig.Prefix` restricts loading to variables starting with the given prefix (case-insensitive) — commonly used to take only your application's slice from a shared configuration file:

<!-- check-code: skip -->
```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_" // Only load keys starting with MYAPP_
loader, _ := env.New(cfg)
```

Prefix filtering combines with the `OverwriteExisting` policy: filtered-out keys neither overwrite nor enter storage.

### Unknown-extension fallback

`DetectFormat` returns `FormatAuto` for unknown extensions, in which case the loader **falls back to the `.env` parser** for line-by-line parsing. Therefore files like `config.conf` or `config.txt` still load correctly as long as their content is `KEY=value` shaped.

## Related Documentation

- [Serialization](/en/env/guides/serialization) - Serialization/deserialization in depth
- [ComponentFactory API](/en/env/api-reference/factory) - Format detection and parser registration
- [Custom Parser](/en/env/guides/custom-parser) - Adding custom formats
- [Config API](/en/env/api-reference/config) - JSON/YAML parsing configuration
