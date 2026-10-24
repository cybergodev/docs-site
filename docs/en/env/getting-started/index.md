---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo env | 5-Minute Tutorial"
description: "Get started with CyberGo env in 5 minutes: go get installation, .env loading, type-safe reads, GetSecure secure values, struct mapping and config presets."
sidebar_position: 1
---

# Quick Start

Install env, load a `.env` file, read typed values, and map them into a struct.

## Installation

```bash
go get github.com/cybergodev/env
```

:::tip Requirements
Go 1.25+
:::

## Create a .env File

Create a `.env` file in your project root:

```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret

# Application configuration
DEBUG=true
APP_NAME=myapp
LOG_LEVEL=info

# Multiple values (comma-separated)
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

::: tip Full syntax reference
For the complete `.env` syntax rules (quoting, escapes, multi-line values), see [File Format](../reference/file-format).
:::

## Minimal Usage

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// Load the .env file and apply to the system environment
	if err := env.Load(".env"); err != nil {
		panic(err)
	}

	// Get environment variables
	host := env.GetString("DB_HOST", "localhost")
	port := env.GetInt("DB_PORT", 5432)

	fmt.Printf("Server: %s:%d\n", host, port)
	// Output: Server: localhost:5432
}
```

:::tip Two usage modes
env has two usage modes:

| Mode | Usage | Use Case |
|------|-------|----------|
| **Global mode** | `env.Load()` + `env.GetString()` | Simple applications, scripts, quick prototyping |
| **Instance mode** | `env.New()` + `loader.GetString()` | Multiple instances, test isolation, fine-grained lifecycle control |

Global mode uses package-level functions backed by a default Loader singleton. After `env.Load()` succeeds, every `env.GetXxx()` call reads from that instance. Instance mode creates an independent Loader via `env.New()`, which you use when you need isolation or several configurations at once.

The examples on this page use global mode. [Multi-environment Configuration](#multi-environment-configuration) shows the instance-mode equivalent.

Calling `Get*`/`Lookup` before `Load()` raises no error: they return the default or zero value. `Set`/`Delete`/`Validate`/`ParseInto` return `ErrNotInitialized` instead. See [Package Functions](../api-reference/functions) for details.
:::

## Reading Values - All Types

### Basic Types

```go
// === With default values ===

// String - returns default "localhost" when not found
host := env.GetString("HOST", "localhost")

// Integer (int64) - returns default 8080 when not found
port := env.GetInt("PORT", 8080)

// Float (float64) - returns default 0.99 when not found
rate := env.GetFloat64("RATE", 0.99)

// Unsigned integer (uint64) - returns default 4096 when not found
size := env.GetUint64("MAX_SIZE", 4096)

// Boolean - returns default false when not found
debug := env.GetBool("DEBUG", false)

// Duration - returns default 30s when not found
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
```

```go
// === Without default values ===

// String - returns empty string "" when not found
host := env.GetString("HOST")

// Integer (int64) - returns 0 when not found
port := env.GetInt("PORT")

// Boolean - returns false when not found
debug := env.GetBool("DEBUG")

// Duration - returns 0 when not found
timeout := env.GetDuration("TIMEOUT")
```

:::tip Key-name resolution
A key lookup tries these forms in order:

```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of the following access this value
name := env.GetString("APP_NAME")      // Flat key (recommended)
name = env.GetString("app.name")       // Dot path (auto-converted)
name = env.GetString("APP.NAME")       // Uppercase dot path
```

**Resolution rules:**
1. **Exact match**: looks up the key as given (`KEY`)
2. **Uppercase conversion**: a lowercase key falls back to its uppercase form (`key` → `KEY`)
3. **Path resolution**: dot paths convert to underscores (`app.name` → `APP_NAME`)
4. **Numeric index**: a key ending in an index (`HOSTS.0`) returns that element of the comma-separated value
:::

### Boolean Support

`GetBool` accepts the following values, case-insensitively:

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

An empty string parses as `false`; it does not fall back to the default you passed. Any other value is recorded in the audit log (when auditing is enabled) and returns the default.

### Slice Types

```go
// String slice
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// Integer slices (supports int, int64, uint, uint64)
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // also supports int

// Float slice
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Boolean slice
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Duration slice
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**Parse order:**
1. Look for indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If none exist, split the `KEY` value on commas

An indexed element that fails conversion is recorded in the audit log and skipped. If the comma-separated fallback fails, the whole list is discarded and the default is returned.

```go
// Method 1: Indexed keys (recommended)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Method 2: Comma-separated
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### Lookup and Inspection

```go
// Check if a key exists
value, exists := env.Lookup("API_KEY")
if !exists {
    // key does not exist
}

// Get all keys
keys := env.Keys()

// Get all key-value pairs
all := env.All()

// Get variable count
count := env.Len()
```

### Secure Values

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Get the raw value (only call when plaintext is needed, e.g. for crypto, API calls)
    value := secret.Reveal()

    // Use mask for logging (prevent leakage)
    log.Printf("API Key: %s", secret.Masked())  // Output: [SECURE:32 bytes]
}
```

## Struct Mapping

Use struct tags to map environment variables to a struct:

```go
package main

import (
	"fmt"
	"time"

	"github.com/cybergodev/env"
)

type Config struct {
	Host     string        `env:"DB_HOST" envDefault:"localhost"`
	Port     int64         `env:"DB_PORT" envDefault:"5432"`
	Password string        `env:"DB_PASSWORD"`
	Debug    bool          `env:"DEBUG" envDefault:"false"`
	Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
	Hosts    []string      `env:"ALLOWED_HOSTS"`
}

func main() {
	env.Load(".env")

	var cfg Config
	if err := env.ParseInto(&cfg); err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// Output: {Host:localhost Port:5432 Password:secret Debug:true Timeout:30s Hosts:[localhost example.com api.example.com]}
}
```

:::details
See the [Struct Mapping](../guides/struct-mapping) guide for tags, nested structs, and validation.
:::

## Configuration Presets

env ships four presets, one per common scenario:

| Preset | Purpose | Characteristics |
|--------|---------|-----------------|
| `DefaultConfig()` | General use | Safe defaults for most cases |
| `DevelopmentConfig()` | Development | Relaxed limits, overwrites existing keys |
| `TestingConfig()` | Testing | Small limits, overwrites existing keys, suited for unit tests |
| `ProductionConfig()` | Production | Strict validation + audit logging |

```go
// Development - relaxed limits
cfg := env.DevelopmentConfig()

// Testing - compact limits
cfg := env.TestingConfig()

// Production - strict validation + audit logging
cfg := env.ProductionConfig()
```

### Detailed Preset Comparison

| Feature | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Overwrite existing variables | ✗ | ✓ | ✓ | ✗ |
| Error on missing file | ✗ | ✗ | ✗ | ✓ |
| Audit logging | ✗ | ✗ | ✗ | ✓ |
| YAML syntax | ✗ | ✓ | ✗ | ✗ |
| File size limit | 8MB | 10MB | 64KB | 64KB |
| Max variables | 1000 | 1000 | 50 | 50 |
| Forbidden key check | ✓ | ✓ | ✓ | ✓ |
| Value validation | ✓ | ✓ | ✓ | ✓ |

:::tip How to choose
- **Development**: `DevelopmentConfig()` for relaxed limits during fast iteration
- **Testing**: `TestingConfig()` for overwrite support and test isolation
- **Production**: `ProductionConfig()` for audit logging and strict validation
:::

## Multi-environment Configuration

### Load by Environment

```go
// Determine config file based on environment
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// Default: the first file loaded wins (keys already set by .env are
// not overridden by later files)
env.Load(".env", ".env."+goEnv, ".env.local")

// When you need last-file-wins (e.g. .env.local overrides .env):
cfg := env.DefaultConfig()
cfg.OverwriteExisting = true
cfg.Filenames = []string{".env", ".env." + goEnv, ".env.local"}
if err := env.LoadWithConfig(cfg); err != nil { log.Fatal(err) }
```

::: tip Overwrite semantics
Later files do **not** override earlier ones by default: `DefaultConfig()` and `ProductionConfig()` both use first-file-wins and skip keys that already exist. This prevents a later file from silently replacing configuration loaded at runtime. Set `OverwriteExisting = true` (already set in the `DevelopmentConfig()`/`TestingConfig()` presets) for last-file-wins behavior.
:::

### Using a Loader Instance

When you need lifecycle control, create a Loader instance:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// Create configuration
	cfg := env.ProductionConfig()
	cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

	// Create a loader
	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	// Load files (in order; under ProductionConfig the first file wins, existing keys are not overwritten)
	if err := loader.LoadFiles(".env", ".env.production"); err != nil {
		panic(err)
	}

	// Validate required keys
	if err := loader.Validate(); err != nil {
		panic(err)
	}

	// Use
	host := loader.GetString("DB_HOST")
	fmt.Println("Host:", host)
}
```

## Multi-file and Multi-format

### Multi-file Loading

Files load in the order you list them. With `DefaultConfig()` the **first file loaded wins**: keys that already exist are skipped in later files. Set `OverwriteExisting = true` (already set in the `DevelopmentConfig()`/`TestingConfig()` presets) when later files should override earlier ones:

::: code-group

```go [Package functions]
env.Load(".env", "config.json", "config.yaml")
```

```go [Loader instance]
loader.LoadFiles(".env", ".env.local")
```

:::

### Multi-format Support

`LoadFiles` picks the parser from the file extension:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

:::details Supported formats
| Format | Extension | Detection |
|--------|-----------|-----------|
| .env | `.env` | File extension |
| JSON | `.json` | File extension |
| YAML | `.yaml`, `.yml` | File extension |
:::

## Error Handling

```go
import "errors"

err := loader.LoadFiles(".env")
if err != nil {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        // file not found
    case errors.Is(err, env.ErrFileTooLarge):
        // file too large
    case errors.Is(err, env.ErrSecurityViolation):
        // forbidden key (actually returns *SecurityError)
    default:
        // other errors
    }

    // Invalid key format: actually returns *ValidationError, Field=="key"
    var valErr *env.ValidationError
    if errors.As(err, &valErr) && valErr.Field == "key" {
        // invalid key format
    }
}
```

:::details Getting detailed errors
```go
// Parse error details
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("File %s line %d: %v\n", parseErr.File, parseErr.Line, parseErr.Err)
}

// File error details
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("File %s operation %s failed: %v\n", fileErr.Path, fileErr.Op, fileErr.Err)
}

// Security error details
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Security error: %s - %s\n", secErr.Action, secErr.Reason)
}
```
:::

## Next Steps

### Learn More
- [Struct Mapping](../guides/struct-mapping) - configuration binding in detail
- [Serialization](../guides/serialization) - config serialization and deserialization
- [Multi-format Config](../guides/multi-format) - JSON/YAML in detail
- [Testing](../guides/testing) - using env in tests

### API Reference
- [Package Functions](../api-reference/functions) - every package-level function
- [Loader API](../api-reference/loader) - Loader methods
- [Config API](../api-reference/config) - configuration options

### Security
- [Security Overview](../security/) - security architecture and defaults
- [SecureValue API](../api-reference/secure-value) - secure value handling
