---
sidebar_label: "Loader"
title: "Loader API - CyberGo env | Loader Reference"
description: "CyberGo env Loader API reference: multi-format LoadFiles, type-safe GetString/GetInt/GetSlice, Set/Delete, Validate, serialization and thread-safe lifecycle."
sidebar_position: 3
---

# Loader API

`Loader` is the core type of the `env` package. It loads environment variable files, holds the values, and returns them through typed getters.

:::tip Thread safety
Every `Loader` method is thread-safe and can be called concurrently from multiple goroutines.
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

The table groups all `Loader` methods by purpose. Qualified names are like `Loader.GetString`; details follow in the sections below.

| Method | Description |
|--------|-------------|
| `Loader.LoadFiles` | Load multiple files in order (.env/JSON/YAML auto-detected) |
| `Loader.GetString` / `Loader.Lookup` | String read and existence lookup |
| `Loader.GetInt` / `Loader.GetUint64` / `Loader.GetFloat64` / `Loader.GetBool` / `Loader.GetDuration` | Typed reads |
| `Loader.GetSecure` | Defensive copy of a sensitive value |
| `Loader.Set` / `Loader.Delete` | Write and delete (with key/value validation) |
| `Loader.Keys` / `Loader.All` / `Loader.Len` | Collection views |
| `Loader.Apply` / `Loader.IsApplied` | Apply to the process environment and state query |
| `Loader.LoadTime` / `Loader.Config` | Load time and configuration copy |
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
- `cfg` - optional configuration. Omit it, or pass a zero-value `Config`, and `DefaultConfig()` is used. You may pass at most one `Config`; passing several returns `ErrInvalidConfig`.

**Returns:**
- `*Loader` - loader instance
- `error` - configuration validation error

**Behavior:**
- Validates the configuration
- Creates the internal components (validator, auditor, expander)
- Loads files if `cfg.Filenames` is non-empty
- Applies to the process environment if `cfg.AutoApply` is true
- Does **not** set the package-level default loader; use `Load` or `LoadWithConfig` for that

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
- Reads files in the order given. With the default `OverwriteExisting=false`, the **first file wins**: a same-name key in a later file is skipped.
- With `OverwriteExisting=true`, later files overwrite earlier ones. Both the Development and Testing presets set it to `true`.
- Detects each file's format (.env, JSON, YAML)
- Handles a missing file according to `FailOnMissingFile`
- Applies to the process environment after loading when `AutoApply` is true

Paths must be **relative**. Absolute paths, Windows drive letters, UNC paths, and any `..` component are rejected with a `*SecurityError`. If your configuration is mounted at an absolute location (Docker, Kubernetes), change to that directory first or pass a path relative to the working directory.

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
- `ErrFileTooLarge` - file exceeds the size limit. When the `Stat` pre-check catches it, the error is wrapped in `*FileError` with `Op=size_check`; when the read itself crosses the limit, `ErrFileTooLarge` is returned directly
- `ErrClosed` - loader has been closed
- `*ParseError` - parse error
- `*JSONError` - JSON parse error
- `*YAMLError` - YAML parse error
- `*SecurityError` - file path failed the security check (e.g. a path traversal attempt)
- `ErrAuditFailed` - fail-closed auditing is on and an audit event was lost

**Format detection rules:**

| Extension | Format |
|-----------|--------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| Other | FormatAuto (uses the .env parser) |

Detection looks only at the extension, never at the content: `.env.local` has the extension `.local`, so it resolves to `FormatAuto` and is still parsed as `.env`.

---

## Getting Values

### Key Resolution

Every getter method resolves keys the same way:

| Input Key | Resolved Result |
|----------|-----------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (exact match) |
| `"database.host"` | `"DATABASE_HOST"` (dots become underscores) |
| `"app.name"` | `"APP_NAME"` (uppercase plus underscores) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (array index) |

**Resolution order:**
1. Exact match - look up the key name as given
2. Uppercase conversion - a simple key also tries its uppercase form
3. Path resolution - dot paths are converted to the underscore format
4. Index fallback - an index that is missing falls back to the comma-separated value

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

Reads a string value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - optional default value

**Returns:**
- `string` - the value, or the default; an empty string when the key is missing and no default was given

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

Reads an integer value, converting the stored string. Supports dot-path resolution. A value that does not parse as an integer is audited and the default is returned.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `int64`

**Returns:**
- `int64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a boolean value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `bool` - the value, or the default; false when the key is missing and no default was given

**Supported values:**
- Truthy: `true`, `1`, `yes`, `on`, `enabled`
- Falsy: `false`, `0`, `no`, `off`, `disabled`

Matching is case-insensitive. An empty string parses as `false` rather than falling back to the default. Any other unmatched value is audited and returns the default.

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

Reads an unsigned integer value. Supports dot-path resolution. A negative value or a malformed one fails to parse; the failure is audited and the default is returned.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `uint64`

**Returns:**
- `uint64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a floating-point value. Supports dot-path resolution. A malformed value is audited and the default is returned.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `float64`

**Returns:**
- `float64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a duration value. Supports dot-path resolution. The value must follow Go's `time.ParseDuration` syntax; otherwise parsing fails, the failure is audited, and the default is returned.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `time.Duration` - the value, or the default; 0 when the key is missing and no default was given

**Supported formats:** `ns`, `us`, `ms`, `s`, `m`, `h` (e.g. `30s`, `5m`, `1h30m`)

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

Returns a defensive copy of a sensitive value.

**Parameters:**
- `key` - key name

**Returns:**
- `*SecureValue` - a **defensive copy** of the stored value, independent of the parent Loader. You own it and must release it (`Release()` zeroes and returns it to the pool; `Close()` zeroes only). Returns nil if the key does not exist, the loader is closed, or the stored value is already closed.

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // plaintext value
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

:::tip
See [SecureValue API](./secure-value) for the full reference.
:::

---

### Getting Slice Values

`Loader` has no slice getter method, because Go does not support generic methods. Use the standalone generic function `GetSliceFrom[T]` with a Loader instance:

```go
// Use standalone generic function
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // also supports int
```

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

:::tip
See [Package Functions - GetSliceFrom](./functions#getslicefrom-t) for the full reference.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

Reports whether a key exists and returns its value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)

**Returns:**
- `string` - the value as stored, with no trimming applied here. `.env` values were trimmed at parse time; JSON and YAML values keep any surrounding whitespace.
- `bool` - whether the key exists

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
- `error` - set error; `ErrAuditFailed` when fail-closed auditing is on and an event is lost

**Behavior:**
- Validates the key name
- Validates value safety when `ValidateValues` is true
- Skips the call and returns nil when `OverwriteExisting` is false and the key already exists
- Also writes to the process environment when `AutoApply` is true. When `Setenv` fails, `Set` returns the error and stores nothing in memory. With `OverwriteExisting` false and a process variable of that name already present, only the in-memory value updates; the process environment keeps its original value.

With the built-in validator, the baseline value checks run even when `ValidateValues=false`: the length ceiling and control-character rejection still apply, and the UTF-8 check follows `ValidateUTF8`. This matches the `.env` line-parsing path.

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // Handle error
}
```

**Error types:**
- `*ValidationError` - invalid key name format (`Field == "key"`)
- `*SecurityError` - the key is forbidden (matchable with `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - the value is unsafe: null bytes, control characters, or other invalid content. This case arises only when `ValidateValues` is true.
- `ErrClosed` - the loader has been closed
- `ErrAuditFailed` - fail-closed auditing is on and an audit event was lost

`Set` accepts a wider key space than the `.env` line parser, matching keys loaded from JSON/YAML: `.`, `-`, and `@` are allowed, while empty keys, all-digit keys, and characters outside letters, digits, `_`, `@`, `-`, and `.` are rejected.

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

Removes a variable from the loader.

**Parameters:**
- `key` - key name

**Returns:**
- `error` - `ErrClosed` when the loader is closed; the underlying os error when unsetting from the process environment fails (the key name is masked)

**Behavior:**
- Removes and securely zeroes the value in memory
- Unsets it from the process environment only if **this** loader wrote that key there; variables this loader did not set are untouched

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

Returns all key names.

Storage is split into 32 shards. `Keys` sizes the result from an atomic counter, then takes each shard's read lock in turn, so the **snapshot is approximate**: concurrent writes make the shards observe different points in time. Synchronize externally when you need a strictly consistent view.

**Returns:**
- `[]string` - the key names in unspecified order; nil if the loader is closed

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

Returns every key-value pair as an **approximate** snapshot, collected the same way as `Keys`. For an exact snapshot, synchronize externally.

Each value is an ordinary Go string outside `SecureValue`'s protection: it is not zeroed and not memory-locked (SEC-010). Do not log or retain this map when it can hold secrets; use `GetSecure` for those values.

**Returns:**
- `map[string]string` - the key-value mapping; nil if the loader is closed

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

Returns the number of loaded variables.

`Len` is O(1): it reads an atomic counter instead of sweeping the shards. A write that lands concurrently may not be reflected in the returned count.

**Returns:**
- `int` - variable count; 0 if the loader is closed

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

Writes the loaded variables into the process environment (`os.Environ`).

**Returns:**
- `error` - apply error

**Behavior:**
- Iterates over the loaded variables and writes each to the process environment
- Overwrites an existing process variable only when `OverwriteExisting` is true
- Afterwards, `os.Getenv()` returns the values

**Error types:**
- `ErrClosed` - loader has been closed
- Wrapped `os` error - setting an environment variable failed. Key names are masked, so sensitive names do not appear in the message.

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// Afterwards os.Getenv() returns the values
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

Reports whether the loader has written its variables to the process environment, whether through `Apply`, `AutoApply`, or `Set` with `AutoApply` on.

**Returns:**
- `bool` - whether the variables were applied; false if the loader is closed

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

Returns the time of the most recent file load.

**Returns:**
- `time.Time` - the load time; the zero value if nothing has been loaded yet, or if the loader is closed

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

Returns a value copy of the loader's configuration.

**Returns:**
- `Config` - configuration (treat it as read-only)

:::warning
`Config()` returns a **value copy** of the struct. It is safe to read, but not fully detached:

- Value fields (`MaxFileSize`, `ValidateValues`, ...) are independent copies.
- `KeyPattern` is a pointer; `FileSystem` and `AuditHandler` are interfaces; `AllowedKeys`, `RequiredKeys`, `Filenames`, and the other `[]string` fields still share their backing arrays with the loader.

Mutating anything in the second group changes the running loader's behavior. To get a safe mutable copy, copy the fields you need into a new `Config`.
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

Reports whether every key listed in `ValidationConfig.RequiredKeys` exists.

**Returns:**
- `error` - validation error

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

Maps the loader's variables onto a struct. The loader takes a snapshot of its values, then calls `UnmarshalInto` on that snapshot.

**Parameters:**
- `v` - non-nil pointer to a struct

**Returns:**
- `error` - mapping error, including `ErrClosed` when the loader is closed

**Supported tags:**
- `env:"KEY"` - the environment variable name to read
- `env:"-"` - skip this field
- `envDefault:"value"` - default value

Slice fields split on a comma `,`; whitespace around each separator is stripped. There is no tag for a custom separator.

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
- Zeroes all stored sensitive data
- Closes the loader's ComponentFactory, if it owns one
- Safe to call repeatedly; every call returns nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Use loader...
```

:::warning Behavior after Close
After closing, every operation returns either an error or a zero value:
- `LoadFiles` → `ErrClosed`
- `GetString` → empty value
- `Set` → `ErrClosed`
- `Keys` → nil
- `Len` → 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

Reports whether the loader has been closed.

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

`Close()` zeroes only the **in-memory** copies of the variables. It does **not** unset variables already written to the process environment by `Apply`, `AutoApply`, or `Set` (when `AutoApply` is on).

To remove them before closing, call `Delete` for each key:

<!-- check-code: skip -->
```go
loader.Delete("API_KEY") // unsets in the process env only if this loader set it
loader.Close()
```

### Per-key ownership tracking in Delete

The loader records which keys **it** wrote to the process environment (`appliedKeys`). `Delete` unsets only those keys and **never touches** process variables it did not set (`HOME`, `TERM`, ...).

Because of this ownership tracking, multiple loaders in one process do not interfere with each other.

### Apply distinguishes "unset" from "explicitly empty"

`Apply` uses `LookupEnv` to detect existing values. A variable explicitly set to an empty string counts as present, so with `OverwriteExisting=false` it is skipped like any other existing variable rather than overwritten.

### State and metadata methods

| Method | Description |
|--------|-------------|
| `Config()` | Returns a copy of the configuration for read-only use. Value fields are copied, but `KeyPattern`, `FileSystem`, and `AuditHandler` share their underlying objects, as do the `[]string` slices (`AllowedKeys`, `RequiredKeys`, `Filenames`). Mutating any of them affects the running loader |
| `IsClosed()` | Whether the loader is closed (a nil receiver returns true) |
| `IsApplied()` | Whether `Apply` has written the variables to `os.Environ` |
| `LoadTime()` | Time of the most recent load (zero value if never loaded) |

### Key-resolution details on the read path

- **Exact match first**: lookup tries the key as written, then falls back to the uppercase form.
- **Dot paths**: `database.host` expands to `DATABASE_HOST` (the flattened JSON/YAML key). An indexed path such as `service.cors.origins.0` falls back to the comma-separated value when the indexed key is missing.
- **No trimming here**: `Lookup` returns the stored value as-is. `.env` values were trimmed at parse time; JSON and YAML values keep any surrounding whitespace.
- **Lock-free fast path**: single-key reads (`Lookup` and `GetSecure`) skip the loader-level read lock and check an atomic closed flag instead, which avoids reader-count contention under high concurrency. A race with `Close` degrades gracefully: you read either the value or the cleared state.

### Silent-skip semantics of Set

With `OverwriteExisting=false`, calling `Set` on an existing key is **silently skipped**: it returns nil and writes nothing. To observe skips, watch the audit log for `skipped (no overwrite)` events.

### Defense-in-depth for file loading (TOCTOU)

A theoretical replacement window exists between the `Stat()` size check and the actual read. Two layers mitigate it:

- The size check rejects an oversized file before any read.
- The parsers wrap the file stream in a hardened read path that enforces the same cap while reading.

A file that grows after the check is therefore cut off at the hard cap (100 MB), which prevents memory exhaustion.

## Related Documentation

- [Package Functions](./functions) - Package-level convenience functions
- [Config API](./config) - Configuration options
- [SecureValue API](./secure-value) - Secure value handling
- [Interfaces](./interfaces) - Interface definitions
