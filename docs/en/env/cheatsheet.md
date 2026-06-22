---
title: "Cheat Sheet - CyberGo env | Common API Quick Reference"
description: "One-page CyberGo env cheat sheet of common Go API snippets: file loading, type-safe reading, validation, SecureValue storage, serialization and audit logging."
---

# Cheat Sheet

A quick reference for frequently used code snippets, assuming you are already familiar with the library.

## Loading Configuration

```go
// Package-level loading
env.Load(".env")                                        // Load .env file
env.Load(".env", ".env.local", "config.json")          // Multiple files

// Loader-level loading
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // Multiple files
```

## Reading Values

```go
// Basic types
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // Returns int64
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// Slices (supports KEY_0,KEY_1 index format or comma-separated)
env.GetSlice[string]("HOSTS", []string{"localhost"})
env.GetSlice[int64]("PORTS", []int64{80})
env.GetSlice[int]("PORTS", []int{80})          // Also supports int
env.GetSlice[float64]("RATES", []float64{0.1})

// Get slices from Loader
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// Lookup
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// Secure values
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // or secret.Close()
    value := secret.Reveal()   // plaintext (use only when needed)
    masked := secret.Masked()  // masked (for logging)
}
```

## Key Resolution

```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of the following can access the value
env.GetString("APP_NAME")      // Flat key name (recommended)
env.GetString("app.name")      // Dot path
env.GetString("APP.NAME")      // Uppercase dot path

// Array index
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| Input | Converts To |
|-------|-------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## Struct Mapping

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## Configuration Presets

| Preset | Use Case | Features |
|--------|----------|----------|
| `DefaultConfig()` | General | Safe defaults |
| `DevelopmentConfig()` | Development | Relaxed restrictions, YAML syntax support, 10MB file limit |
| `TestingConfig()` | Testing | Override existing variables, test isolation, 64KB file limit |
| `ProductionConfig()` | Production | Strict validation + audit, no override, 64KB file limit |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader Instance

```go
loader, _ := env.New(cfg)
defer loader.Close()

loader.LoadFiles(".env")
loader.GetString("KEY")
loader.Set("KEY", "value")
loader.Delete("KEY")
loader.Keys()
loader.All()
loader.Validate()
loader.Apply()  // Apply to os.Environ
loader.Len()    // Variable count
loader.LoadTime() // Last load time
loader.IsApplied() // Whether applied to system environment
loader.IsClosed()  // Whether closed
loader.Config()    // Get configuration
```

## Error Handling

```go
import "errors"

// Sentinel errors
errors.Is(err, env.ErrFileNotFound)
errors.Is(err, env.ErrFileTooLarge)
errors.Is(err, env.ErrForbiddenKey)
errors.Is(err, env.ErrInvalidKey)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// Structured errors
var parseErr *env.ParseError
errors.As(err, &parseErr)
// parseErr.File, parseErr.Line

var fileErr *env.FileError
errors.As(err, &fileErr)
// fileErr.Path, fileErr.Size, fileErr.Limit

var secErr *env.SecurityError
errors.As(err, &secErr)
// secErr.Action, secErr.Reason
```

## Security Tools

```go
// Sensitive values
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
}

// Masking
log.Printf("Key: %s", secret.Masked())
log.Printf("Key: %s", env.MaskValue("API_KEY", "secret"))

// Detection
env.IsSensitiveKey("PASSWORD")  // true
env.IsMemoryLockSupported()     // Linux/macOS/Windows: true

// Cleanup
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// Key masking
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## Multi-Environment

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // Single call, later overrides earlier
```

## Multi-Format

```go
// Loading
loader.LoadFiles("config.env", "config.json", "config.yaml")

// Detect format
format := env.DetectFormat("config.json")  // FormatJSON

// Serialization
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// Deserialization
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // Auto-detect
```

## .env Syntax

```bash
# Comment
KEY=value
KEY="value with spaces"
KEY='literal ${noexpand}'
KEY=${OTHER_KEY}           # Variable reference
KEY=${MISSING:-default}    # Default value (used when variable does not exist)
KEY=${MISSING:=default}    # Default value (used when variable does not exist, same as :-)
KEY=${MISSING:?error}      # Error message (errors when variable does not exist or is empty)
export KEY=value           # bash style
KEY=$$                     # Escaped dollar sign
```

## Boolean Values

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## Time Format

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## Limit Constants

| Limit | Default | Hard Cap |
|-------|---------|----------|
| File size | 2 MB | 100 MB |
| Line length | 1 KB | 64 KB |
| Key length | 64 | 1024 |
| Value length | 4 KB | 1 MB |
| Variable count | 500 | 10000 |
| Expansion depth | 5 | 20 |

## Testing

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // Tests...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## Built-in Forbidden Keys

The following key names are forbidden by default:

| Category | Keys |
|----------|------|
| System path | `PATH` |
| Linux dynamic linking | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Language runtimes | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## Interface Types

```go
// Fine-grained interfaces
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// Composite interface
// env.EnvLoader        // Combines all of the above
```

## Related Documentation

- [Getting Started](/en/env/getting-started) - Full tutorial
- [Package Functions](/en/env/api-reference/functions) - Detailed API
- [Loader API](/en/env/api-reference/loader) - Loader methods
- [Config API](/en/env/api-reference/config) - Configuration options
- [Error Handling](/en/env/advanced/error-handling) - Error handling patterns
