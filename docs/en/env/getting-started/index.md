---
sidebar_label: "Quick Start"
title: "Quick Start - CyberGo env | 5-Minute Tutorial"
description: "Get started with CyberGo env in 5 minutes: installation, .env loading, type-safe reading, struct mapping, variable expansion, and errors.Is handling."
sidebar_position: 1
---

# Quick Start

Get started with the env library in 5 minutes, from installation to practical usage.

## Installation

```bash
go get github.com/cybergodev/env
```

:::tip
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
For the complete `.env` syntax rules (quoting, escapes, multi-line values), see [File Format](/en/env/reference/file-format).
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
}
```

:::tip
env provides two usage modes:

| Mode | Usage | Use Case |
|------|-------|----------|
| **Global mode** | `env.Load()` + `env.GetString()` | Simple applications, scripts, quick prototyping |
| **Instance mode** | `env.New()` + `loader.GetString()` | Multiple instances, test isolation, fine-grained lifecycle control |

The global mode uses package-level functions backed by a default Loader singleton. After calling `env.Load()`, all `env.GetXxx()` calls use that instance. The instance mode creates an independent Loader via `env.New()`, suitable for scenarios requiring isolation or managing multiple configurations simultaneously.

The examples in this documentation use the global mode by default. See the [Multi-environment Configuration](#multi-environment-configuration) section for the full instance mode usage.
:::

## Reading Values - All Types

### Basic Types

```go
// === With default values ===

// String - returns default "localhost" when not found
host := env.GetString("HOST", "localhost")

// Integer (int64) - returns default 8080 when not found
port := env.GetInt("PORT", 8080)

// Boolean - returns default false when not found
debug := env.GetBool("DEBUG", false)

// Duration - returns default 30s when not found
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


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

:::tip
The library supports multiple key access methods:

```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of the following can access this value
name := env.GetString("APP_NAME")      // Flat key (recommended)
name := env.GetString("app.name")      // Dot path (auto-converted)
name := env.GetString("APP.NAME")      // Uppercase dot path
```

**Resolution rules:**
1. **Exact match**: Looks up the exact key `KEY` first
2. **Uppercase conversion**: Lowercase keys try the uppercase version `key` → `KEY`
3. **Path resolution**: Dot paths are converted to underscores `app.name` → `APP_NAME`
:::

### Boolean Support

`GetBool` supports the following values (case-insensitive):

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

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
1. First looks up indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If no indexed keys, parses the `KEY` value by comma separation

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
}
```

:::details
[Struct Mapping](/en/env/guides/struct-mapping) guide.
:::

## Configuration Presets

The library provides four preset configurations for different scenarios:

| Preset | Purpose | Characteristics |
|--------|---------|-----------------|
| `DefaultConfig()` | General use | Safe defaults, suitable for most cases |
| `DevelopmentConfig()` | Development | Relaxed limits, allows overwriting |
| `TestingConfig()` | Testing | Compact limits, allows overwriting, suited for unit tests |
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
| File size limit | 2MB | 10MB | 64KB | 64KB |
| Max variables | 500 | 500 | 50 | 50 |
| Forbidden key check | ✓ | ✓ | ✓ | ✓ |
| Value validation | ✓ | ✓ | ✓ | ✓ |

:::tip
- **Development**: Use `DevelopmentConfig()` with relaxed limits for fast iteration
- **Testing**: Use `TestingConfig()` with overwrite support for test isolation
- **Production**: Use `ProductionConfig()` with audit and strict validation
:::

## Multi-environment Configuration

### Load by Environment

```go
// Determine config file based on environment
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// Load all config files in one call (in order, later files overwrite earlier ones)
env.Load(".env", ".env."+goEnv, ".env.local")
```

### Using a Loader Instance

When you need more control, use a Loader instance:

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

	// Load files (in order, later files overwrite earlier ones)
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

Files are loaded in order, later files overwrite earlier ones:

::: code-group

```go [Package functions]
env.Load(".env", "config.json", "config.yaml")
```

```go [Loader instance]
loader.LoadFiles(".env", ".env.local")
```

:::

### Multi-format Support

File format is auto-detected:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

:::details
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

:::details
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

<div class="vp-features">

### Learn More
- [Struct Mapping](/en/env/guides/struct-mapping) - Detailed configuration binding
- [Serialization](/en/env/guides/serialization) - Config serialization and deserialization
- [Multi-format Config](/en/env/guides/multi-format) - JSON/YAML in depth
- [Testing](/en/env/guides/testing) - Usage in tests

### API Reference
- [Package Functions](/en/env/api-reference/functions) - Complete list of package-level functions
- [Loader API](/en/env/api-reference/loader) - Loader methods
- [Config API](/en/env/api-reference/config) - Configuration options

### Security
- [Security Overview](/en/env/security/) - Security architecture and best practices
- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling

</div>
