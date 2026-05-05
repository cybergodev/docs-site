---
title: Quick Start - CyberGo env | 5-Minute Guide
description: Get started with the env library in 5 minutes - from installation to type-safe reading, struct mapping, and multi-environment configuration
---

# Quick Start

Get started with the env library in 5 minutes, from installation to practical usage.

## Installation

```bash
go get github.com/cybergodev/env
```

::: tip Requirements
Go 1.24+
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

# Multi-value (comma-separated)
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

## Minimal Usage

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // Load .env file and apply to system environment
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    // Get environment variables
    host := env.GetString("DB_HOST", "localhost")
    port := env.GetInt("DB_PORT", 5432)

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## Reading Values - All Types

### Basic Types

```go
// === With default values ===

// String - returns "localhost" if not found
host := env.GetString("HOST", "localhost")

// Integer (int64) - returns 8080 if not found
port := env.GetInt("PORT", 8080)

// Boolean - returns false if not found
debug := env.GetBool("DEBUG", false)

// Duration - returns 30s if not found
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


// === Without default values ===

// String - returns "" if not found
host := env.GetString("HOST")

// Integer (int64) - returns 0 if not found
port := env.GetInt("PORT")

// Boolean - returns false if not found
debug := env.GetBool("DEBUG")

// Duration - returns 0 if not found
timeout := env.GetDuration("TIMEOUT")
```

::: tip Key Resolution
The library supports multiple key access methods:

```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of these access the same value
name := env.GetString("APP_NAME")      // Flat key (recommended)
name := env.GetString("app.name")      // Dot path (auto-converted)
name := env.GetString("APP.NAME")      // Uppercase dot path
```

**Resolution rules:**
1. **Exact match**: Look for the exact key name first `KEY`
2. **Uppercase conversion**: Try uppercase version for lowercase keys `key` → `KEY`
3. **Path resolution**: Convert dot paths to underscores `app.name` → `APP_NAME`
:::

### Boolean Values

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
portsInt := env.GetSlice[int]("PORTS")  // Also supports int type

// Float slices
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Boolean slices
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Duration slices
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**Parsing order:**
1. First look for indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If no indexed keys, parse by comma-separated value of `KEY`

```go
// Method 1: Indexed keys (recommended)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Method 2: Comma-separated
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### Lookup and Query

```go
// Check if a key exists
value, exists := env.Lookup("API_KEY")
if !exists {
    // Key does not exist
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

    // Get the raw value
    value := secret.String()

    // Use masked value for logging (prevents leakage)
    log.Printf("API Key: %s", secret.Masked())  // e.g. [SECURE:32 bytes]
}
```

## Struct Mapping

Use struct tags to map environment variables to a struct:

```go
type Config struct {
    Host     string        `env:"DB_HOST" envDefault:"localhost"`
    Port     int64         `env:"DB_PORT" envDefault:"5432"`
    Password string        `env:"DB_PASSWORD"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"ALLOWED_HOSTS" envSeparator:","`
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

::: details See also
[Struct Mapping](/en/env/guides/struct-mapping) guide.
:::

## Configuration Presets

The library provides four preset configurations for different scenarios:

| Preset | Use Case | Features |
|--------|----------|----------|
| `DefaultConfig()` | General | Safe defaults, suitable for most cases |
| `DevelopmentConfig()` | Development | Relaxed limits, allows overwriting |
| `TestingConfig()` | Testing | Compact limits, allows overwriting, ideal for unit tests |
| `ProductionConfig()` | Production | Strict validation + audit logging |

```go
// Development - relaxed limits
cfg := env.DevelopmentConfig()

// Testing - compact limits
cfg := env.TestingConfig()

// Production - strict validation + audit logging
cfg := env.ProductionConfig()
```

### Preset Comparison

| Feature | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Overwrite existing | ✗ | ✓ | ✓ | ✗ |
| Error on missing file | ✗ | ✗ | ✗ | ✓ |
| Audit logging | ✗ | ✗ | ✗ | ✓ |
| YAML syntax | ✗ | ✓ | ✗ | ✗ |
| File size limit | 2MB | 10MB | 64KB | 64KB |
| Max variables | 500 | 500 | 50 | 50 |
| Forbidden key check | ✓ | ✓ | ✓ | ✓ |
| Value validation | ✓ | ✓ | ✓ | ✓ |

::: tip Selection Guide
- **Development**: Use `DevelopmentConfig()` with relaxed limits for rapid iteration
- **Testing**: Use `TestingConfig()` with overwriting enabled for test isolation
- **Production**: Use `ProductionConfig()` with audit and strict validation enabled
:::

## Multi-Environment Configuration

### Loading by Environment

```go
// Determine environment
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// Load all config files in one call (in order, later files override earlier ones)
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

    // Create loader
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // Load files (in order, later files override earlier ones)
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        panic(err)
    }

    // Validate required keys
    if err := loader.Validate(); err != nil {
        panic(err)
    }

    // Use the loader
    host := loader.GetString("DB_HOST")
    fmt.Println("Host:", host)
}
```

## Multi-File and Multi-Format

### Multi-File Loading

Files are loaded in order, with later files overriding earlier ones:

```go
// Package-level functions
env.Load(".env", "config.json", "config.yaml")

// Loader instance
loader.LoadFiles(".env", ".env.local")
```

### Multi-Format Support

File format is auto-detected:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

::: details Supported formats
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
        // File not found
    case errors.Is(err, env.ErrFileTooLarge):
        // File too large
    case errors.Is(err, env.ErrForbiddenKey):
        // Forbidden key
    case errors.Is(err, env.ErrInvalidKey):
        // Invalid key format
    default:
        // Other errors
    }
}
```

::: details Getting detailed error information
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

### Deep Dive
- [Struct Mapping](/en/env/guides/struct-mapping) - Detailed configuration binding
- [Serialization](/en/env/guides/serialization) - Configuration serialization and deserialization
- [Multi-Format Configuration](/en/env/guides/multi-format) - JSON/YAML details
- [Testing Scenarios](/en/env/guides/testing) - Usage in tests

### API Reference
- [Package Functions](/en/env/api-reference/functions) - Complete list of package-level functions
- [Loader API](/en/env/api-reference/loader) - Loader methods
- [Config API](/en/env/api-reference/config) - Configuration options

### Security
- [Security Overview](/en/env/security/) - Security architecture and best practices
- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling

</div>
