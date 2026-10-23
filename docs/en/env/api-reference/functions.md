---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo env | Global Functions Reference"
description: "CyberGo env package function API reference: Load, GetString, GetInt, GetBool, GetDuration, GetSlice, GetSecure, Lookup, Keys and ParseInto, all thread-safe."
sidebar_position: 2
---

# Package Functions

Package-level convenience functions provide a simple API suitable for most use cases. These functions use the global default loader, and all are thread-safe.

:::info Initialization requirements
The global default loader must be explicitly initialized via `Load()` or `LoadWithConfig()` — it is **not** auto-created on first call. If not initialized, function behavior is as follows:

- `Get*` functions (`GetString`, `GetInt`, `GetBool`, etc.): return the passed default value (or zero value)
- `Lookup`: returns `("", false)`
- `Keys`/`All`/`Len`/`GetSecure`: return `nil`/`0`
- `Set`/`Delete`/`Validate`/`ParseInto`: return `ErrNotInitialized`
:::

## Load Functions

### Load

```go
func Load(filenames ...string) error
```

Loads environment variable files and applies them to the system environment.

**Parameters:**
- `filenames` - list of file paths. When not provided, defaults to loading the `.env` file (uses `DefaultConfig()`'s `Filenames` setting).

**Returns:**
- `error` - load error

**Behavior:**
- Creates a new Loader instance and sets it as the default loader
- Automatically applies to the system environment (`os.Environ`)
- Later-loaded files can overwrite earlier ones (controlled by the `OverwriteExisting` config; `Load()` defaults to `false`, i.e., no overwriting)
- Returns `ErrAlreadyInitialized` if the default loader is already initialized
- Supports multiple formats (.env, JSON, YAML)

```go
// Load .env file
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// Load specified files (in order; to overwrite, set OverwriteExisting)
if err := env.Load(".env", ".env.local", "config.json"); err != nil {
    log.Fatal(err)
}

// JSON/YAML nested structures support dot-path access
// config.json: {"database": {"host": "localhost", "port": 5432}}
env.Load("config.json")
host := env.GetString("database.host") // "localhost"
port := env.GetInt("database.port")    // 5432
```

---

## Key Resolution

All getter functions support smart key resolution, providing flexible access methods.

### Resolution Rules

**1. Exact match (priority)**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. Uppercase conversion (simple keys)**
```go
// For keys without dots, the uppercase version is tried automatically
name := env.GetString("app_name")  // Looks up app_name -> APP_NAME
```

**3. Dot-path resolution (nested keys)**
```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of the following can access this value
name := env.GetString("APP_NAME")   // Flat key (recommended)
name := env.GetString("app.name")   // Dot path (auto-converted)
name := env.GetString("APP.NAME")   // Uppercase dot path
```

### Path Conversion Table

| Input Key | Stored Key |
|-----------|------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"db.port"` | `"DB_PORT"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

### Index Access

Array elements can be accessed by index, or fall back to comma-separated values:

```go
// JSON: {"servers": [{"host": "a.com"}, {"host": "b.com"}]}
// Stored as: SERVERS_0_HOST=a.com, SERVERS_1_HOST=b.com

host0 := env.GetString("servers.0.host")  // "a.com"
host1 := env.GetString("servers.1.host")  // "b.com"

// If the key doesn't exist but there's a comma-separated base value
// HOSTS=localhost,example.com
host0 := env.GetString("hosts.0")  // "localhost" (parsed from comma-separated value)
```

---

## Value Getter Functions

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

Gets a string value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - optional default value

**Returns:**
- `string` - value or default value (returns empty string when not found and no default)

```go
// Basic usage
host := env.GetString("HOST", "localhost")

// Dot-path access (JSON/YAML nested structures)
dbHost := env.GetString("database.host", "localhost")
appName := env.GetString("app.name")

// Returns empty string when no default
value := env.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

Gets an integer value. Automatically converts strings to integers. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `int64`

**Returns:**
- `int64` - value or default value (returns 0 when not found and no default)

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)

// Returns 0 when no default
value := env.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

Gets a boolean value. Supports dot-path resolution.

- **Truthy values (case-insensitive):** `true`, `1`, `yes`, `on`, `enabled`
- **Falsy values (case-insensitive):** `false`, `0`, `no`, `off`, `disabled`

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `bool` - value or default value (returns false when not found and no default)

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)

// Returns false when no default
value := env.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

Gets an unsigned integer value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `uint64`

**Returns:**
- `uint64` - value or default value (returns 0 when not found and no default)

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)

// Returns 0 when no default
value := env.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

Gets a floating-point value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `float64`

**Returns:**
- `float64` - value or default value (returns 0 when not found and no default)

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")

// Returns 0 when no default
value := env.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Gets a duration value. Supports dot-path resolution.

**Supported formats:**
- `300ms` - milliseconds
- `1.5s` - seconds
- `2m30s` - minutes + seconds
- `1h30m` - hours + minutes

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `time.Duration` - value or default value (returns 0 when not found and no default)

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)

// Returns 0 when no default
value := env.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

Gets a secure value (for sensitive data).

**Parameters:**
- `key` - key name

**Returns:**
- `*SecureValue` - secure value wrapper, returns nil when key doesn't exist or loader unavailable

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // plaintext value (call only when needed)
    masked := secret.Masked()  // for logging: [SECURE:32 bytes]
}
```

:::warning
You must call `Release()` or `Close()` after use to release resources. Using `defer` is recommended to ensure release.
:::

:::tip
See [SecureValue API](./secure-value) for complete API documentation.
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

Generic function to get a slice value.

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**Note:** This is a generic function, not a Loader method. To get a slice from a specific Loader instance, use `GetSliceFrom[T]`.

**Parse order:**
1. First looks up indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If no indexed keys, parses the `KEY` value by comma separation
3. Supports dot-path resolution

**Parameters:**
- `key` - key name
- `defaultValue` - optional default value

**Returns:**
- `[]T` - slice value

```go
// Indexed key format (recommended)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Comma-separated format
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS", []int64{80})  // [80, 443, 8080]

// Float slice
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Boolean slice
flags := env.GetSlice[bool]("FLAGS")

// Duration slice
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")

// Unsigned integer slice
ports := env.GetSlice[uint]("PORTS")
port64s := env.GetSlice[uint64]("PORTS")

// int type
portInts := env.GetSlice[int]("PORTS")

// Returns nil when no default
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

Gets a slice value from a specified Loader instance. This is a standalone generic function (not a Loader method).

**Parameters:**
- `loader` - Loader instance pointer (returns default value if nil)
- `key` - key name
- `defaultValue` - optional default value

**Returns:**
- `[]T` - slice value

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Get slice from loader instance
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})

// Also supports int, uint, uint64 types
portsInt := env.GetSliceFrom[int](loader, "PORTS")
portsUint := env.GetSliceFrom[uint](loader, "PORTS")
portsUint64 := env.GetSliceFrom[uint64](loader, "PORTS")
```

:::tip The difference
- `GetSlice[T]` - package-level function using the default loader
- `GetSliceFrom[T]` - generic function specifying a Loader instance (Go does not support generic methods)
:::

---

## Query Functions

### Lookup

```go
func Lookup(key string) (string, bool)
```

Checks whether a key exists and gets its value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)

**Returns:**
- `string` - value (returned as stored, no trimming: `.env` values are trimmed at parse time, JSON/YAML values may keep surrounding whitespace)
- `bool` - whether it exists

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // key does not exist
}

// Dot path
if value, exists := env.Lookup("database.host"); exists {
    fmt.Println(value)
}
```

---

### Keys

```go
func Keys() []string
```

Gets all key names.

**Returns:**
- `[]string` - key name list, returns nil when loader unavailable

```go
keys := env.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func All() map[string]string
```

Gets all key-value pairs.

**Returns:**
- `map[string]string` - key-value mapping, returns nil when loader unavailable

```go
all := env.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func Len() int
```

Gets the variable count.

**Returns:**
- `int` - variable count, returns 0 when loader unavailable

```go
count := env.Len()
fmt.Printf("Loaded %d environment variables\n", count)
```

---

## Set and Delete

### Set

```go
func Set(key, value string) error
```

Sets an environment variable.

**Parameters:**
- `key` - key name
- `value` - value

**Returns:**
- `error` - set error

**Error types:**
- `*ValidationError` - invalid key name format (Field="key")
- `*SecurityError` - key is forbidden (matchable with `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - invalid value (when `ValidateValues` is true, value contains null bytes, control characters, or other unsafe content)
- `ErrClosed` - loader has been closed

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // Could be *SecurityError (forbidden key) or *ValidationError (key format)
}
```

---

### Delete

```go
func Delete(key string) error
```

Deletes an environment variable.

**Parameters:**
- `key` - key name

**Returns:**
- `error` - delete error

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

---

## Validation and Mapping

### Validate

```go
func Validate() error
```

Validates that required keys exist, delegating to the default loader (equivalent to `Loader.Validate`). `RequiredKeys` must be set on the Config passed to `LoadWithConfig` when initializing the default loader.

**Returns:**
- `error` - validation error; returns `ErrNotInitialized` if the default loader has not been initialized

```go
// RequiredKeys is configured on the default loader via LoadWithConfig
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}

if err := env.Validate(); err != nil {
    // Missing required keys
}
```

---

### ParseInto

```go
func ParseInto(v any) error
```

Maps environment variables to a struct.

**Parameters:**
- `v` - struct pointer

**Returns:**
- `error` - mapping error

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int64  `env:"PORT" envDefault:"8080"`
}

var cfg Config
if err := env.ParseInto(&cfg); err != nil {
    panic(err)
}
```

**Struct tags:**
| Tag | Description |
|------|-------------|
| `env:"KEY"` | Map to specified key |
| `env:"-"` | Ignore this field |
| `envDefault:"value"` | Default value |

Slice fields are separated by comma `,` by default (spaces around the separator are automatically removed); there is no custom separator tag.

:::tip
See [Struct Mapping](../guides/struct-mapping) for the complete guide.
:::

---

## Utility Functions

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Resets the global default loader. Primarily used in test scenarios.

**Returns:**
- `error` - error from closing the old loader (if any); returns nil if there was no loader or closing succeeded

**Behavior:**
- After locking with `defaultMu.Lock()`, atomically swaps the default loader to nil using `defaultLoader.Swap(nil)`, then immediately releases the lock
- Closes the old loader **outside** the lock (to avoid potentially time-consuming cleanup while holding the lock, preventing deadlocks if `Close()` triggers code that needs the default loader)
- After reset, allows creating a new default loader via `Load()` or `LoadWithConfig()`

```go
func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: failed to reset loader: %v", err)
    }
    os.Exit(m.Run())
}

func TestSomething(t *testing.T) {
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("warning: %v", err)
    }
    defer env.ResetDefaultLoader()
    // ... test code
}
```

:::warning
This function is concurrency-safe but should only be called during tests or startup to avoid unexpected behavior.
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

Initializes the default loader with custom configuration.

**Parameters:**
- `cfg` - custom configuration

**Returns:**
- `error` - initialization error

**Behavior:**
- Sets the package-level default loader (used by `GetString`, `GetInt`, etc.)
- **Forces** `AutoApply = true` (regardless of cfg setting)
- Returns `ErrAlreadyInitialized` if the default loader is already initialized

**Difference from Load:**
- `Load()` - accepts only a file name list, uses default config
- `LoadWithConfig()` - accepts full Config, supports all configuration options

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}
// Now package-level functions can be used
port := env.GetInt("PORT", 8080)
```

:::warning
This function forces `cfg.AutoApply` to `true`, ensuring variables are applied to the system environment. To control application timing, use `New()` to create an independent instance.
:::

---

### Overload

```go
func Overload(filenames ...string) error
```

`Load`'s last-file-wins variant: initializes the default loader with `OverwriteExisting = true`. When several files define the same key, the **later file wins**, and loaded values replace variables that already exist in the process environment (the godotenv Overload convention).

**Security note:** `Load` never touches existing process-environment variables — deployment-injected variables (container secrets, CI variables) always win over file values; `Overload` removes that protection (a file value replaces an existing process variable of the same name). When in doubt, prefer `Load` and order files by priority. Within a single file the duplicate-key semantics are unchanged (see `DuplicateKeyPolicy` in [Config API](./config#duplicatekeypolicy-in-document-duplicate-keys)).

**Parameters:**
- `filenames` - file paths; defaults to `.env` when omitted

**Returns:**
- `error` - load error; returns `ErrAlreadyInitialized` if the default loader is already initialized

```go
// config.yaml values override config.json values for shared keys
if err := env.Overload("config.json", "config.yaml"); err != nil {
    log.Fatal(err)
}
key := env.GetString("deepseek.key", "")
```

---

## Serialization Functions

### Marshal

```go
func Marshal(data any, format ...FileFormat) (string, error)
```

Serializes data to a string in the specified format. Supports `map[string]string` or struct as input.

**Interface integration:** If the input type implements the `Marshaler` interface, the `MarshalEnv()` method is called first for serialization.

**Parameters:**
- `data` - data to serialize (map or struct)
- `format` - optional format, defaults to `FormatEnv`

**Returns:**
- `string` - serialized string (keys sorted)
- `error` - serialization error

**Supported formats:**
- `FormatEnv` (default) - .env format
- `FormatJSON` - JSON format
- `FormatYAML` - YAML format

> See [Serialization · Output Shape](../guides/serialization) for JSON/YAML output behaviors such as type inference, nested objects rebuilt from underscore keys, and scalar quoting for round-trip safety.

```go
// map to .env format
mapData := map[string]string{"HOST": "localhost", "PORT": "8080"}
envStr, _ := env.Marshal(mapData)
// HOST=localhost
// PORT=8080

// map to JSON format (numeric strings output as numbers, keys sorted alphabetically)
jsonStr, _ := env.Marshal(mapData, env.FormatJSON)
// {
//   "HOST": "localhost",
//   "PORT": 8080
// }

// struct to .env format
type Config struct {
    Host string `env:"HOST"`
    Port string `env:"PORT"`
}
envStr, _ := env.Marshal(Config{Host: "localhost", Port: "8080"})
```

---

### UnmarshalMap

```go
func UnmarshalMap(data string, format ...FileFormat) (map[string]string, error)
```

Parses a formatted string into a map. Supports auto format detection.

**Parameters:**
- `data` - formatted string
- `format` - optional format, defaults to `FormatEnv`; use `FormatAuto` for auto-detection

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

```go
// .env format
m, _ := env.UnmarshalMap("HOST=localhost\nPORT=8080")

// JSON format (nested structures are flattened)
m, _ := env.UnmarshalMap(`{"database": {"host": "localhost"}}`, env.FormatJSON)
// m["DATABASE_HOST"] = "localhost"

// Auto-detect format
m, _ := env.UnmarshalMap(jsonString, env.FormatAuto)
```

---

### UnmarshalMapWithConfig

```go
func UnmarshalMapWithConfig(cfg Config, data string, format ...FileFormat) (map[string]string, error)
```

`UnmarshalMap` with full `Config` semantics: `LimitsConfig` (file size, line/key/value length, variable count), `ParsingConfig` (duplicate-key policy; variable expansion — applies to `.env` input only, JSON/YAML values are never expanded), `JSONConfig`/`YAMLConfig` format options, `ValidationConfig` (key and value rules, `RequiredKeys`), and `ComponentConfig` (custom validator/expander/auditor; `Prefix` filters parsed keys by the same rule as file loading) all take effect. `FileConfig` (`Filenames`/`FailOnMissingFile`/`OverwriteExisting`/`AutoApply`) has no one-shot counterpart and is ignored.

`cfg` follows the standard zero-value contract: a fully zero `Config` means `DefaultConfig()`; a partially-set Config is rejected with `ErrInvalidConfig` — always start from `DefaultConfig()`. `UnmarshalMap` is the no-config shortcut that runs this function's `DefaultConfig` pipeline (SEC-002: every format applies the forbidden-key policy and key validation uniformly).

**Parameters:**
- `cfg` - full configuration (start from `DefaultConfig()` or a preset)
- `data` - formatted string
- `format` - optional format, defaults to `FormatEnv`; `FormatAuto` auto-detects from data

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError
m, err := env.UnmarshalMapWithConfig(cfg, yamlData, env.FormatYAML)
```

---

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v any, format ...FileFormat) error
```

Parses a formatted string and fills a struct.

**Parameters:**
- `data` - formatted string
- `v` - struct pointer
- `format` - optional format, defaults to `FormatEnv`

**Returns:**
- `error` - parse error

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

var cfg Config
err := env.UnmarshalStruct("SERVER_HOST=localhost\nSERVER_PORT=8080", &cfg)
// cfg.Host = "localhost", cfg.Port = 8080

// Parse from JSON
err = env.UnmarshalStruct(`{"server": {"host": "localhost"}}`, &cfg, env.FormatJSON)
```

---

### UnmarshalStructWithConfig

```go
func UnmarshalStructWithConfig(cfg Config, data string, v any, format ...FileFormat) error
```

The config-driven counterpart of `UnmarshalStruct`: it parses the string under `cfg`'s full parsing rules (limits, duplicate-key policy, expansion, validation, custom components — same as [UnmarshalMapWithConfig](#unmarshalmapwithconfig)) and then fills the struct.

**Parameters:**
- `cfg` - full configuration
- `data` - formatted string
- `v` - struct pointer
- `format` - optional format, defaults to `FormatEnv`; `FormatAuto` auto-detects from data

**Returns:**
- `error` - parse or fill error

```go
cfg := env.DefaultConfig()
cfg.DuplicateKeyPolicy = env.DuplicateKeyError
var out Config
if err := env.UnmarshalStructWithConfig(cfg, yamlData, &out, env.FormatYAML); err != nil {
    log.Fatal(err)
}
```

---

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v any) error
```

Fills a struct from a map. Supports `env` and `envDefault` tags.

**Interface integration:** If the target type implements the `Unmarshaler` interface, the `UnmarshalEnv(data)` method is called first.

**Parameters:**
- `data` - key-value mapping
- `v` - struct pointer

**Returns:**
- `error` - fill error

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int    `env:"PORT" envDefault:"8080"`
}

data := map[string]string{"HOST": "example.com"}
var cfg Config
err := env.UnmarshalInto(data, &cfg)
// cfg.Host = "example.com", cfg.Port = 8080 (uses default)
```

---

### MarshalStruct

```go
func MarshalStruct(v any) (map[string]string, error)
```

Converts a struct to a map. Supports `env` tags for key names.

**Interface integration:** If the input type implements the `Marshaler` interface, the `MarshalEnv()` method is called first.

**Parameters:**
- `v` - struct or struct pointer

**Returns:**
- `map[string]string` - key-value mapping
- `error` - conversion error

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}
m, _ := env.MarshalStruct(cfg)
// m["SERVER_HOST"] = "localhost"
// m["SERVER_PORT"] = "8080"
```

---

### IsMarshalError

```go
func IsMarshalError(err error) bool
```

Checks whether an error is a serialization/deserialization error.

**Parameters:**
- `err` - error to check

**Returns:**
- `bool` - whether it's a MarshalError type

```go
_, err := env.MarshalStruct(invalidData)
if env.IsMarshalError(err) {
    // Handle serialization error
}
```

---

## Complete Example

```go
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/env"
)

type AppConfig struct {
	Host    string        `env:"APP_HOST" envDefault:"0.0.0.0"`
	Port    int64         `env:"APP_PORT" envDefault:"8080"`
	Debug   bool          `env:"DEBUG" envDefault:"false"`
	Timeout time.Duration `env:"TIMEOUT" envDefault:"30s"`
	Hosts   []string      `env:"HOSTS"`
}

func main() {
	// Load configuration files
	if err := env.Load(".env"); err != nil {
		log.Printf("Warning: %v", err)
	}

	// Read individual values
	host := env.GetString("APP_HOST", "localhost")
	port := env.GetInt("APP_PORT", 8080)
	debug := env.GetBool("DEBUG", false)
	timeout := env.GetDuration("TIMEOUT", 30*time.Second)

	fmt.Printf("Server: %s:%d\n", host, port)
	fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

	// Sensitive data
	secret := env.GetSecure("API_KEY")
	if secret != nil {
		defer secret.Release()
		fmt.Printf("API Key length: %d\n", secret.Length())
	}

	// Struct mapping
	var cfg AppConfig
	if err := env.ParseInto(&cfg); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Config: %+v\n", cfg)

	// All variables
	fmt.Printf("Loaded %d variables\n", env.Len())
}
```

## Typed Access Supplement

### GetUint64 / GetFloat64

Beyond the common types, both package-level and Loader methods provide unsigned-integer and float access:

<!-- check-code: skip -->
```go
limit := env.GetUint64("RATE_LIMIT", 1000)     // uint64
rate := env.GetFloat64("SAMPLE_RATE", 0.5)      // float64
u := loader.GetUint64("RATE_LIMIT", 1000)       // same signature on Loader
f := loader.GetFloat64("SAMPLE_RATE", 0.5)
```

### Lenient boolean parsing

`GetBool` accepts the following spellings case-insensitively:

| Truthy | Falsy |
|--------|-------|
| `true`, `yes`, `on`, `1`, `enabled` | `false`, `no`, `off`, `0`, `disabled` |

An empty string parses as `false`; any other value raises a `ValidationError` and **returns the default** (an audit event is recorded as well).

### Parse failures vs. defaults

All `Get*` functions return the default (or zero value) when the key is **missing** or the value **fails to parse** — they never panic or return an error. Parse failures are recorded in the audit log as `parse failed` for easier diagnosis of dirty configuration.

### Two failure semantics of GetSliceFrom

In instance mode, `GetSliceFrom[T](loader, key)` collects elements from indexed keys (`KEY_0`, `KEY_1`, ...) with comma-separated fallback. Parse failures behave differently per source:

| Source | On element parse failure |
|--------|--------------------------|
| Indexed keys (`KEY_0`...) | The element is **skipped** (after an audit record); the rest is kept |
| Comma-separated fallback | The **whole list fails**; the default (or nil) is returned |

The generic element type is constrained to: `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`. Slice length is capped at 10000 (defensive limit; exceeding it is audited).

### LoadWithConfig forces AutoApply

Both `Load()` and `LoadWithConfig()` **force** `AutoApply=true` regardless of the passed configuration — package-level convenience functions rely on variables being in the process environment. Use `New()` (instance mode) when you need manual control over application timing.

## Related Documentation

- [Loader API](./loader) - Loader instance methods
- [Config API](./config) - Configuration options
- [SecureValue API](./secure-value) - Secure value handling
- [Struct Mapping](../guides/struct-mapping) - Struct mapping guide
