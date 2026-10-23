---
sidebar_label: "Cheat Sheet"
title: "Cheat Sheet - CyberGo env | Quick API Reference"
description: "CyberGo env API cheat sheet: core snippets for file loading, typed reads, struct mapping, variable expansion, SecureValue and Marshal/Unmarshal serialization."
sidebar_position: 2
---

# Cheat Sheet

Quick reference for commonly used code snippets, assuming you already understand the library.

## Loading Configuration

```go
// Load via package-level functions
env.Load(".env")                                        // Load .env file
env.Load(".env", ".env.local", "config.json")          // Multiple files

// Load via loader instance
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
env.GetSlice[int]("PORTS", []int{80})          // also supports int
env.GetSlice[float64]("RATES", []float64{0.1})

// Get slice from Loader
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// Query
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// Secure value
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // or secret.Close()
    value := secret.Reveal()   // plaintext value (use only when needed)
    masked := secret.Masked()  // mask (for logging)
}
```

## Key Resolution

```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of these work
env.GetString("APP_NAME")      // Flat key (recommended)
env.GetString("app.name")      // Dot path
env.GetString("APP.NAME")      // Uppercase dot path

// Array index
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| Input | Converted to |
|-------|---------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## Struct Mapping

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS"`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## Configuration Presets

| Preset | Purpose | Characteristics |
|--------|---------|-----------------|
| `DefaultConfig()` | General | Safe defaults |
| `DevelopmentConfig()` | Development | Relaxed limits, allows overwriting, YAML syntax support, 10MB file limit |
| `TestingConfig()` | Testing | Overwrites existing variables, test isolation, 64KB file limit |
| `ProductionConfig()` | Production | Strict validation + audit, no overwriting, 64KB file limit |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Loader Instance

```go
loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)  // Abort on creation failure (e.g. invalid config)
}
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
errors.Is(err, env.ErrSecurityViolation)  // Forbidden key (actually returns *SecurityError)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// Invalid key format: actually returns *ValidationError, Field=="key"
var keyErr *env.ValidationError
if errors.As(err, &keyErr) && keyErr.Field == "key" {
    // Invalid key format: keyErr.Message
}

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
// Sensitive value
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

// Key name masking
masked := env.MaskKey("DB_PASSWORD")  // "[MASKED]"
```

## Multi-environment

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // Single call; first file wins by default, set OverwriteExisting=true for last-file-wins
```

## Multi-format

```go
// Load
loader.LoadFiles("config.env", "config.json", "config.yaml")

// Detect format
format := env.DetectFormat("config.json")  // FormatJSON

// Serialize
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// Deserialize
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // Auto-detect
```

## .env Syntax

```bash
# Comment
KEY=value
KEY="value with spaces"
KEY='literal \n value'     # Single quotes skip escape processing but do NOT prevent expansion (see tip below)
KEY=${OTHER_KEY}           # Variable reference
KEY=${MISSING:-default}    # Default value (used when variable doesn't exist)
KEY=${MISSING:=default}    # Default value (used when variable doesn't exist, same as :-)
KEY=${MISSING:?error}      # Error message (errors when variable doesn't exist or is empty)
export KEY=value           # bash style
KEY=$$                     # Escaped dollar sign (yields a literal $)
```

::: tip Variable expansion and literal $
Single quotes do **not** prevent variable expansion — `${UNDEF}` inside `KEY='a ${UNDEF}'` is still expanded, yielding an empty string when undefined. Use `$$` to escape a literal `$`, or set `cfg.ExpandVariables = false` to disable expansion. See [File Format](../reference/file-format) for the complete rules.
:::

## Boolean Values

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## Time Formats

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## Limit Constants

| Limit | Default | Hard Max |
|-------|---------|----------|
| File size | 8 MB | 100 MB |
| Line length | 8 KB | 64 KB |
| Key length | 128 | 1024 |
| Value length | 8 KB | 1 MB |
| Variable count | 1000 | 10000 |
| Expansion depth | 5 | 20 |

## Testing

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // Test...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## Built-in Forbidden Keys

The following keys are forbidden by default:

| Category | Keys |
|----------|------|
| System path | `PATH` |
| Linux dynamic linker | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Language runtimes | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |
| Windows | `COMSPEC`, `PATHEXT`, `SYSTEMROOT`, `WINDIR` |

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

- [Quick Start](./) - Full tutorial
- [Package Functions](../api-reference/functions) - Detailed API
- [Loader API](../api-reference/loader) - Loader methods
- [Config API](../api-reference/config) - Configuration options
- [Error Handling](../guides/error-handling) - Error handling patterns
