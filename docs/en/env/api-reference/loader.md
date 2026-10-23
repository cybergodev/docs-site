---
sidebar_label: "Loader"
title: "Loader API - CyberGo env | Loader Reference"
description: "CyberGo env Loader API reference: multi-format LoadFiles, type-safe GetString/GetInt/GetSlice, Set/Delete, Validate, serialization and thread-safe lifecycle."
sidebar_position: 3
---

# Loader API

Complete method reference for the `Loader` type. Loader is the core type of the env library, providing environment variable loading, storage, and access functionality.

:::tip Thread safety
All methods of Loader are thread-safe and can be called concurrently from multiple goroutines.
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

## Method Overview

All `Loader` methods grouped as follows (qualified names like `Loader.GetString`); see the corresponding sections below for details:

| Method | Description |
|--------|-------------|
| `Loader.LoadFiles` | Load multiple files in order (.env/JSON/YAML auto-detected) |
| `Loader.GetString` / `Loader.Lookup` | String read and existence lookup |
| `Loader.GetInt` / `Loader.GetUint64` / `Loader.GetFloat64` / `Loader.GetBool` / `Loader.GetDuration` | Typed reads |
| `Loader.GetSecure` | Defensive copy of a sensitive value |
| `Loader.Set` / `Loader.Delete` | Write and delete (with key/value validation) |
| `Loader.Keys` / `Loader.All` / `Loader.Len` | Collection views |
| `Loader.Apply` / `Loader.IsApplied` | Apply to the process environment and state query |
| `Loader.LoadTime` / `Loader.Config` | Load time and read-only config copy |
| `Loader.Validate` / `Loader.ParseInto` | Required-key validation and struct mapping |
| `Loader.Close` / `Loader.IsClosed` | Lifecycle: zero storage and close |

---

## Creation

### New

```go
func New(cfg ...Config) (*Loader, error)
```

Creates a new loader instance.

**Parameters:**
- `cfg` - optional configuration options. When not provided or a zero-value Config is passed, `DefaultConfig()` is automatically used.

**Returns:**
- `*Loader` - loader instance
- `error` - configuration validation error

**Behavior:**
- Validates configuration
- Creates internal components (validator, auditor, expander)
- Automatically loads files if `cfg.Filenames` is non-empty
- Automatically applies to system environment if `cfg.AutoApply` is true

```go
// Use default configuration
loader, err := env.New()

// Use custom configuration
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
- `filenames` - list of file paths; defaults to loading `.env` when empty

**Returns:**
- `error` - load error

**Behavior:**
- Loads files in order; by default (`OverwriteExisting=false`) the **first-loaded file wins** — same-name keys in later files are skipped; with `OverwriteExisting=true`, later files overwrite earlier ones (built into the Dev/Testing presets)
- Auto-detects file format (.env, JSON, YAML)
- Determines behavior for missing files based on `FailOnMissingFile` config
- If `AutoApply` is true, automatically applies after loading

```go
// Load default .env file
err := loader.LoadFiles()

// Load specified files
err := loader.LoadFiles(".env", ".env.local")

// Mixed formats
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**Error types:**
- `ErrFileNotFound` - file not found (when `FailOnMissingFile=true`)
- `ErrFileTooLarge` - file exceeds size limit
- `ErrClosed` - loader has been closed
- `*ParseError` - parse error
- `*JSONError` - JSON parse error
- `*YAMLError` - YAML parse error
- `*SecurityError` - file path security check failed (e.g., path traversal attack)

**Format detection rules:**

| Extension | Format |
|-----------|--------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| Other | FormatAuto (uses .env parser) |

---

## Getting Values

### Key Resolution

All getter methods support smart key resolution:

| Input Key | Resolved Result |
|----------|-----------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (exact match) |
| `"database.host"` | `"DATABASE_HOST"` (dots to underscores) |
| `"app.name"` | `"APP_NAME"` (uppercase + underscores) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (array index) |

**Resolution order:**
1. Exact match - directly look up the key name
2. Uppercase conversion - simple keys try uppercase version
3. Path resolution - dot paths are converted to underscore format
4. Index fallback - index access falls back to comma-separated values

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

Gets a string value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - optional default value

**Returns:**
- `string` - value or default value (returns empty string when not found and no default)

```go
// Basic usage
host := loader.GetString("HOST", "localhost")

// Dot-path access (JSON/YAML nested structures)
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// Returns empty string when no default
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

Gets an integer value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `int64`

**Returns:**
- `int64` - value or default value (returns 0 when not found and no default)

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// Returns 0 when no default
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

Gets a boolean value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `bool` - value or default value (returns false when not found and no default)

**Supported values:**
- Truthy: `true`, `1`, `yes`, `on`, `enabled`
- Falsy: `false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// Returns false when no default
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

Gets an unsigned integer value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `uint64`

**Returns:**
- `uint64` - value or default value (returns 0 when not found and no default)

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// Returns 0 when no default
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

Gets a floating-point value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `float64`

**Returns:**
- `float64` - value or default value (returns 0 when not found and no default)

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// Returns 0 when no default
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Gets a duration value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `time.Duration` - value or default value (returns 0 when not found and no default)

**Supported formats:** `ns`, `us`, `ms`, `s`, `m`, `h` (e.g., `30s`, `5m`, `1h30m`)

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// Returns 0 when no default
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Gets a secure value (sensitive data protection).

**Parameters:**
- `key` - key name

**Returns:**
- `*SecureValue` - **defensive copy** of the secure value; caller is responsible for releasing; returns nil if the key doesn't exist or loader is closed

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // plaintext value
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

:::warning
You must call `Release()` or `Close()` after use to release resources.
:::

:::tip Defensive copies
`GetSecure` returns a copy of the original value, independent from the parent Loader. The caller is responsible for calling `Release()` or `Close()`.
:::

:::tip
See [SecureValue API](./secure-value) for complete documentation.
:::

---

### Getting Slice Values

Loader does not provide a slice getter method (Go does not support generic methods). Use the standalone generic function `GetSliceFrom[T]` to get slices from a Loader instance:

```go
// Use standalone generic function
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // also supports int
```

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

:::tip
See [Package Functions - GetSliceFrom](./functions#getslicefrom-t) for complete documentation.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

Checks whether a key exists and gets its value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)

**Returns:**
- `string` - value (returned as stored, no trimming: `.env` values are trimmed at parse time, JSON/YAML values may keep surrounding whitespace)
- `bool` - whether it exists

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // key does not exist
}

// Dot path
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// Index access (falls back to comma-separated value)
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
- `key` - key name
- `value` - value

**Returns:**
- `error` - set error

**Behavior:**
- Validates key name validity
- If `ValidateValues` is true, validates value safety
- If `OverwriteExisting` is false and key already exists, skips (returns nil)
- If `AutoApply` is true, also sets in the system environment

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // Handle error
}
```

**Error types:**
- `*ValidationError` - invalid key name format (Field="key")
- `*SecurityError` - key is forbidden (matchable with `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - invalid value (when `ValidateValues` is true, value contains null bytes, control characters, or other unsafe content)
- `ErrClosed` - loader has been closed

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

Deletes an environment variable.

**Parameters:**
- `key` - key name

**Returns:**
- `error` - delete error

**Behavior:**
- If the variable has been applied to the system environment, also removes it from the system environment

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
- `[]string` - key name list; returns nil if loader is closed

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
- `map[string]string` - key-value mapping; returns nil if loader is closed

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
- `int` - variable count; returns 0 if loader is closed

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
- `error` - apply error

**Behavior:**
- Iterates over all loaded variables
- Determines whether to overwrite existing system environment variables based on `OverwriteExisting` config
- After applying, accessible via `os.Getenv()`

**Error types:**
- `ErrClosed` - loader has been closed
- Wrapped `os` error - failed to set environment variable (key name masked, sensitive key names not exposed in error message)

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// After that, os.Getenv() can access it too
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

Checks whether variables have been applied to the system environment.

**Returns:**
- `bool` - whether applied

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
- `time.Time` - load time; returns zero value if never loaded

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
- `Config` - configuration (should be treated as read-only)

:::warning
`Config()` returns a **copy** of the configuration for read-only use: value fields are isolated copies, but pointer/interface fields such as `KeyPattern`, `FileSystem`, and `AuditHandler` (as well as slice fields like `AllowedKeys` and `RequiredKeys`) **share their underlying objects** with the running loader — mutating them affects loader behavior, so do not modify them. For a safe mutable copy, manually copy the required fields.
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

Validates that required keys exist.

**Returns:**
- `error` - validation error

**Behavior:**
- Checks that all keys specified in `ValidationConfig.RequiredKeys` exist

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // Missing required keys
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
- `v` - struct pointer

**Returns:**
- `error` - mapping error

**Supported tags:**
- `env:"KEY"` - specifies the environment variable name
- `env:"-"` - ignore this field
- `envDefault:"value"` - specifies a default value

Slice fields are separated by comma `,` by default (spaces around the separator are automatically removed); there is no custom separator tag.

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS"`
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
- `error` - close error

**Behavior:**
- Securely zeros all stored sensitive data
- If the loader owns a ComponentFactory, also closes the factory
- Safe to close; multiple calls return nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Use loader...
```

:::warning Behavior after Close
After closing, all operations return errors or zero values:
- `LoadFiles` → `ErrClosed`
- `GetString` → returns empty value
- `Set` → `ErrClosed`
- `Keys` → returns nil
- `Len` → returns 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

Checks whether the loader has been closed.

**Returns:**
- `bool` - whether closed

```go
if loader.IsClosed() {
    // loader has been closed
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
			log.Fatal("Configuration file not found")
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

## Lifecycle and Process-Environment Semantics

### Close does not roll back os.Environ

`Close()` zeroes only the **in-memory** copies of variables; it does **not** unset variables previously written to the process environment via `Apply`, `AutoApply`, or `Set` (with `AutoApply` on). To remove them before closing, call `Delete` per key:

<!-- check-code: skip -->
```go
loader.Delete("API_KEY") // unsets in the process env only if this loader set it
loader.Close()
```

### Per-key ownership tracking in Delete

The loader records which keys **it** wrote to the process environment (`appliedKeys`). `Delete` unsets only those keys and **never touches** process variables it did not set (`HOME`, `TERM`, ...). Multiple loaders therefore never interfere with each other.

### Apply distinguishes "unset" from "explicitly empty"

`Apply` uses `LookupEnv` to detect existing values: a variable explicitly set to an empty string counts as "present" and is likewise skipped when `OverwriteExisting=false` — it is not mistaken for unset and overwritten.

### State and metadata methods

| Method | Description |
|--------|-------------|
| `Config()` | Returns a copy of the configuration for read-only use; value fields are copied, but pointer/interface fields such as `KeyPattern`, `FileSystem`, and `AuditHandler` share their underlying objects, and mutating them affects the running loader |
| `IsClosed()` | Whether the loader is closed (nil receiver returns true) |
| `IsApplied()` | Whether variables have been applied to os.Environ |
| `LoadTime()` | Time of the most recent load (zero value if never loaded) |

### Key-resolution details on the read path

- **Exact match first**: lookup tries the key as-is, then falls back to the uppercase form
- **Dot paths**: `database.host` expands to `DATABASE_HOST` (JSON/YAML flattened keys); an indexed path like `service.cors.origins.0` falls back to the comma-separated value when the indexed key is missing
- **No trimming**: `Lookup` returns the stored value as-is — `.env` values were trimmed at parse time, JSON/YAML values may keep surrounding whitespace
- **Lock-free fast path**: single-key reads (`Lookup`/`GetSecure`) bypass the loader-level read lock via an atomic closed flag, avoiding reader-count contention under high concurrency; races with `Close` degrade gracefully to "read the value or read the cleared state"

### Silent-skip semantics of Set

With `OverwriteExisting=false`, calling `Set` on an existing key is **silently skipped and returns nil** (no error). To observe skips, watch the audit log (`skipped (no overwrite)` events).

### Defense-in-depth for file loading (TOCTOU)

Between the `Stat()` size check and the actual read there is a theoretical replacement window; the library mitigates it with two layers: parsers internally wrap the file stream in a hardened read path enforcing the size cap, so even a file that grows after the check is cut off at the hard cap (100 MB), preventing memory exhaustion.

## Related Documentation

- [Package Functions](./functions) - Package-level convenience functions
- [Config API](./config) - Configuration options
- [SecureValue API](./secure-value) - Secure value handling
- [Interfaces](./interfaces) - All interface definitions
