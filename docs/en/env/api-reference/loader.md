---
title: "Loader API - CyberGo env | Loader Details"
description: "CyberGo env Loader API reference: multi-format file loading, type-safe reading, key set/delete, validation, serialization and Close — all thread-safe."
---

# Loader API

Complete method reference for the `Loader` type. Loader is the core type of the env library, providing environment variable loading, storage, and access functionality.

:::tip Thread Safety
All Loader methods are thread-safe and can be called concurrently from multiple goroutines.
:::

## Type Definition

```go
type Loader struct {
    // Contains private fields
}

// Compile-time interface implementation checks
var _ EnvLoader = (*Loader)(nil)
var _ io.Closer = (*Loader)(nil)
```

---

## Creation

### New

```go
func New(cfg ...Config) (*Loader, error)
```

Creates a new loader instance.

**Parameters:**
- `cfg` - Optional configuration options. When not provided or a zero-value Config is passed, `DefaultConfig()` is used automatically

**Returns:**
- `*Loader` - Loader instance
- `error` - Configuration validation error

**Behavior:**
- Validates configuration validity
- Creates internal components (validator, auditor, expander)
- If `cfg.Filenames` is non-empty, automatically loads files
- If `cfg.AutoApply` is true, automatically applies to system environment

```go
// Using default configuration
loader, err := env.New()

// Using custom configuration
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env"}
cfg.AutoApply = true
loader, err := env.New(cfg)

if err != nil {
    panic(err)
}
defer loader.Close()
```

---

## File Loading

### LoadFiles

```go
func (l *Loader) LoadFiles(filenames ...string) error
```

Loads one or more configuration files.

**Parameters:**
- `filenames` - List of file paths; defaults to `.env` when empty

**Returns:**
- `error` - Loading error

**Behavior:**
- Loads in order; files loaded later override earlier ones (controlled by `OverwriteExisting` configuration)
- Auto-detects file format (.env, JSON, YAML)
- Behavior when file not found is determined by `FailOnMissingFile` configuration
- If `AutoApply` is true, automatically applies after loading

```go
// Load default .env file
err := loader.LoadFiles()

// Load specified files
err := loader.LoadFiles(".env", ".env.local")

// Mixed formats
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**Error Types:**
- `ErrFileNotFound` - File not found (when `FailOnMissingFile=true`)
- `ErrFileTooLarge` - File exceeds size limit
- `ErrClosed` - Loader is closed
- `*ParseError` - Parse error
- `*JSONError` - JSON parse error
- `*YAMLError` - YAML parse error

**Format Detection Rules:**

| Extension | Format |
|-----------|--------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| Other | FormatAuto (uses .env parser) |

---

## Getting Values

### Key Resolution

All getter methods support smart key name resolution:

| Input Key | Resolved |
|-----------|----------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (exact match) |
| `"database.host"` | `"DATABASE_HOST"` (dot to underscore) |
| `"app.name"` | `"APP_NAME"` (uppercase + underscore) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (array index) |

**Resolution Order:**
1. Exact match - Direct key name lookup
2. Uppercase conversion - Simple keys try the uppercase version
3. Path resolution - Dot paths converted to underscore format
4. Index fallback - Falls back to comma-separated values for index access

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

Gets a string value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - Optional default value

**Returns:**
- `string` - Value or default value (returns empty string if not found and no default)

```go
// Basic usage
host := loader.GetString("HOST", "localhost")

// Dot path access (JSON/YAML nested structures)
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// Returns empty string when no default value
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

Gets an integer value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `int64`

**Returns:**
- `int64` - Value or default value (returns 0 if not found and no default)

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// Returns 0 when no default value
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

Gets a boolean value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value

**Returns:**
- `bool` - Value or default value (returns false if not found and no default)

**Supported Values:**
- Truthy: `true`, `1`, `yes`, `on`, `enabled`
- Falsy: `false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// Returns false when no default value
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

Gets an unsigned integer value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `uint64`

**Returns:**
- `uint64` - Value or default value (returns 0 if not found and no default)

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// Returns 0 when no default value
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

Gets a floating-point value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `float64`

**Returns:**
- `float64` - Value or default value (returns 0 if not found and no default)

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// Returns 0 when no default value
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Gets a time duration value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value

**Returns:**
- `time.Duration` - Value or default value (returns 0 if not found and no default)

**Supported Formats:** `ns`, `us`, `ms`, `s`, `m`, `h` (e.g., `30s`, `5m`, `1h30m`)

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// Returns 0 when no default value
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Gets a secure value (for sensitive data protection).

**Parameters:**
- `key` - Key name

**Returns:**
- `*SecureValue` - A **defensive copy** of the secure value; the caller is responsible for releasing it; returns nil if the key doesn't exist or the loader is closed

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // plaintext
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

:::warning Important
You must call `Release()` or `Close()` to release resources after use.
:::

:::tip Defensive Copy
`GetSecure` returns a copy of the original value, independent of the parent Loader. The caller is responsible for calling `Release()` or `Close()` to release it.
:::

:::tip See Also
[SecureValue API](/en/env/api-reference/secure-value) for complete documentation.
:::

---

### Getting Slice Values

Loader does not provide slice getter methods (Go does not support generic methods). Use the standalone generic function `GetSliceFrom[T]` to get slices from a Loader instance:

```go
// Using standalone generic function
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // Also supports int
```

**Supported Types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

:::tip See Also
[Package Functions - GetSliceFrom](/en/env/api-reference/functions#getslicefrom-t) for complete documentation.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

Checks if a key exists and gets its value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)

**Returns:**
- `string` - Value (leading and trailing whitespace removed)
- `bool` - Whether the key exists

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // Key does not exist
}

// Dot path
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// Index access (falls back to comma-separated values)
// HOSTS=localhost,example.com
if value, exists := loader.Lookup("hosts.0"); exists {
    fmt.Println(value)  // "localhost"
}
```

---

## Set and Delete

### Set

```go
func (l *Loader) Set(key, value string) error
```

Sets an environment variable.

**Parameters:**
- `key` - Key name
- `value` - Value

**Returns:**
- `error` - Setting error

**Behavior:**
- Validates key name validity
- If `ValidateValues` is true, validates value safety
- If `OverwriteExisting` is false and the key already exists, skips (returns nil)
- If `AutoApply` is true, also sets to system environment

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // Handle error
}
```

**Error Types:**
- `ErrInvalidKey` - Invalid key name
- `ErrForbiddenKey` - Forbidden key
- `ErrClosed` - Loader is closed

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

Deletes an environment variable.

**Parameters:**
- `key` - Key name

**Returns:**
- `error` - Deletion error

**Behavior:**
- If the variable has been applied to the system environment, also deletes from system environment

```go
err := loader.Delete("TEMP_KEY")
if err != nil {
    panic(err)
}
```

---

## Collection Operations

### Keys

```go
func (l *Loader) Keys() []string
```

Gets all key names.

**Returns:**
- `[]string` - List of key names; returns nil if the loader is closed

```go
keys := loader.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func (l *Loader) All() map[string]string
```

Gets all key-value pairs.

**Returns:**
- `map[string]string` - Key-value mapping; returns nil if the loader is closed

```go
all := loader.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func (l *Loader) Len() int
```

Gets the variable count.

**Returns:**
- `int` - Number of variables; returns 0 if the loader is closed

```go
count := loader.Len()
fmt.Printf("Loaded %d variables\n", count)
```

---

## Apply to System

### Apply

```go
func (l *Loader) Apply() error
```

Applies variables to the system environment (`os.Environ`).

**Returns:**
- `error` - Application error

**Behavior:**
- Iterates through all loaded variables
- Whether to overwrite existing system environment variables is controlled by `OverwriteExisting` configuration
- After applying, values can be accessed via `os.Getenv()`

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// After applying, os.Getenv() also has access
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

Checks whether variables have been applied to the system environment.

**Returns:**
- `bool` - Whether applied

```go
if loader.IsApplied() {
    // Variables have been applied to os.Environ
}
```

---

## Status Queries

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

Returns the time of the last file load.

**Returns:**
- `time.Time` - Load time; returns zero value if not loaded

```go
loadTime := loader.LoadTime()
if !loadTime.IsZero() {
    fmt.Printf("Last load time: %v\n", loadTime)
}
```

---

### Config

```go
func (l *Loader) Config() Config
```

Returns the loader's configuration.

**Returns:**
- `Config` - Configuration (should be treated as read-only)

:::warning Note
The returned Config should be treated as read-only. Modifying `KeyPattern`, `AllowedKeys`, `ForbiddenKeys`, `RequiredKeys` and other fields may affect loader behavior. For a safe mutable copy, manually copy the needed fields.
:::

```go
cfg := loader.Config()
fmt.Printf("Max file size: %d\n", cfg.MaxFileSize)
```

---

## Validation and Mapping

### Validate

```go
func (l *Loader) Validate() error
```

Validates that all required keys exist.

**Returns:**
- `error` - Validation error

**Behavior:**
- Checks whether all keys specified in `Config.RequiredKeys` exist

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // Missing required key
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("Missing: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

Maps environment variables to a struct.

**Parameters:**
- `v` - Pointer to a struct

**Returns:**
- `error` - Mapping error

**Supported Tags:**
- `env:"KEY"` - Specifies the environment variable name
- `env:"-"` - Ignores this field
- `envDefault:"value"` - Specifies the default value
- `envSeparator:","` - Specifies the slice separator

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

var cfg Config
err := loader.ParseInto(&cfg)
if err != nil {
    panic(err)
}
```

---

## Resource Release

### Close

```go
func (l *Loader) Close() error
```

Releases resources and clears storage.

**Returns:**
- `error` - Closing error

**Behavior:**
- Securely zeroes all stored sensitive data
- If the loader owns a ComponentFactory, also closes the factory
- Safe to close; multiple calls return nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Use loader...
```

:::warning Behavior After Close
After closing, all operations will return errors or zero values:
- `LoadFiles` -> `ErrClosed`
- `GetString` -> Returns empty value
- `Set` -> `ErrClosed`
- `Keys` -> Returns nil
- `Len` -> Returns 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

Checks whether the loader is closed.

**Returns:**
- `bool` - Whether closed

```go
if loader.IsClosed() {
    // Loader is closed
}
```

---

## Complete Example

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/env"
)

func main() {
    // Create production configuration
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
    cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

    // Create loader
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Load files
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Fatal("Config file not found")
        }
        log.Fatal(err)
    }

    // Validate required keys
    if err := loader.Validate(); err != nil {
        log.Fatal("Missing required configuration:", err)
    }

    // Read configuration
    host := loader.GetString("DB_HOST")
    port := loader.GetInt("DB_PORT", 5432)
    debug := loader.GetBool("DEBUG", false)
    timeout := loader.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // Sensitive data
    secret := loader.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // Apply to system environment
    if err := loader.Apply(); err != nil {
        log.Fatal(err)
    }

    // All variables
    fmt.Printf("Loaded %d variables\n", loader.Len())
    fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## Related Documentation

- [Package Functions](/en/env/api-reference/functions) - Package-level convenience functions
- [Config API](/en/env/api-reference/config) - Configuration options
- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling
- [Interfaces](/en/env/api-reference/interfaces) - All interface definitions
