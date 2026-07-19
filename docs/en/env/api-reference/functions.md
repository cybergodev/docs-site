---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo env | Global Helpers"
description: "CyberGo env package functions: Load, GetString, GetInt, GetBool, GetDuration, GetSlice, GetSecure, Lookup, Keys, ParseInto over the global default Loader."
sidebar_position: 2
---

# Package Functions

Package-level convenience functions provide a concise API suitable for most use cases. These functions use the global default loader, and all functions are thread-safe.

:::info Initialization Required
The global default loader must be explicitly initialized via `Load()` or `LoadWithConfig()` and is **not** automatically created on the first call. If uninitialized, the functions behave as follows:

- `Get*` functions (`GetString`, `GetInt`, `GetBool`, etc.): return the provided default value (or the zero value)
- `Lookup`: returns `("", false)`
- `Keys`/`All`/`Len`/`GetSecure`: return `nil`/`0`
- `Set`/`Delete`/`Validate`/`ParseInto`: return `ErrNotInitialized`
:::

## Loading Functions

### Load

```go
func Load(filenames ...string) error
```

Loads environment variable files and applies them to the system environment.

**Parameters:**
- `filenames` - List of file paths. When not provided, no files are loaded; you must explicitly pass `".env"` to load the default file.

**Returns:**
- `error` - Loading error

**Behavior:**
- Creates a new Loader instance and sets it as the default loader
- Automatically applies to the system environment (`os.Environ`)
- Files loaded later override earlier ones
- Returns `ErrAlreadyInitialized` if the default loader is already initialized
- Supports multiple formats (.env, JSON, YAML)

```go
// Load .env file
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// Load specified files (in order, later overrides earlier)
if err := env.Load(".env", ".env.local", "config.json"); err != nil {
    log.Fatal(err)
}

// JSON/YAML nested structure supports dot notation access
// config.json: {"database": {"host": "localhost", "port": 5432}}
env.Load("config.json")
host := env.GetString("database.host") // "localhost"
port := env.GetInt("database.port")    // 5432
```

---

## Key Name Resolution

All getter functions support smart key name resolution, providing flexible access methods.

### Resolution Rules

**1. Exact Match (Priority)**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. Uppercase Conversion (Simple Keys)**
```go
// For keys without dots, automatically tries the uppercase version
name := env.GetString("app_name")  // Looks up app_name -> APP_NAME
```

**3. Dot Path Resolution (Nested Keys)**
```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// All of these can access the value
name := env.GetString("APP_NAME")   // Flattened key name (recommended)
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

// If the key doesn't exist but a comma-separated base value exists
// HOSTS=localhost,example.com
host0 := env.GetString("hosts.0")  // "localhost" (parsed from comma-separated value)
```

---

## Value Getter Functions

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

Gets a string value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - Optional default value

**Returns:**
- `string` - Value or default value (returns empty string if not found and no default)

```go
// Basic usage
host := env.GetString("HOST", "localhost")

// Dot path access (JSON/YAML nested structures)
dbHost := env.GetString("database.host", "localhost")
appName := env.GetString("app.name")

// Returns empty string when no default value
value := env.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

Gets an integer value. Automatically converts string to integer. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `int64`

**Returns:**
- `int64` - Value or default value (returns 0 if not found and no default)

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)

// Returns 0 when no default value
value := env.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

Gets a boolean value. Supports dot path resolution.

- **Truth values (case-insensitive):** `true`, `1`, `yes`, `on`, `enabled`
- **False values (case-insensitive):** `false`, `0`, `no`, `off`, `disabled`

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value

**Returns:**
- `bool` - Value or default value (returns false if not found and no default)

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)

// Returns false when no default value
value := env.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

Gets an unsigned integer value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `uint64`

**Returns:**
- `uint64` - Value or default value (returns 0 if not found and no default)

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)

// Returns 0 when no default value
value := env.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

Gets a floating-point value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value, type `float64`

**Returns:**
- `float64` - Value or default value (returns 0 if not found and no default)

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")

// Returns 0 when no default value
value := env.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Gets a time duration value. Supports dot path resolution.

**Supported formats:**
- `300ms` - Milliseconds
- `1.5s` - Seconds
- `2m30s` - Minutes + Seconds
- `1h30m` - Hours + Minutes

**Parameters:**
- `key` - Key name (supports dot path)
- `defaultValue` - Optional default value

**Returns:**
- `time.Duration` - Value or default value (returns 0 if not found and no default)

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)

// Returns 0 when no default value
value := env.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

Gets a secure value (for sensitive data).

**Parameters:**
- `key` - Key name

**Returns:**
- `*SecureValue` - Secure value wrapper; returns nil if the key does not exist or the loader is unavailable

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()   // plaintext (call only when needed)
    masked := secret.Masked()  // For logging: [SECURE:32 bytes]
}
```

:::warning Important
You must call `Release()` or `Close()` after use to free resources. Use `defer` to ensure release.
:::

:::tip See Also
[SecureValue API](/en/env/api-reference/secure-value) for complete API documentation.
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

Generic function to get a slice value.

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**Note:** This is a generic function, not a Loader method. To get a slice from a specific Loader instance, use `GetSliceFrom[T]`.

**Resolution Order:**
1. First looks for indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If no indexed keys, parses the value of `KEY` by comma separation
3. Supports dot path resolution

**Parameters:**
- `key` - Key name
- `defaultValue` - Optional default value

**Returns:**
- `[]T` - Slice value

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

// Returns nil when no default value
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

Gets a slice value from a specific Loader instance. This is a standalone generic function (not a Loader method).

**Parameters:**
- `loader` - Loader instance pointer (returns default value if nil)
- `key` - Key name
- `defaultValue` - Optional default value

**Returns:**
- `[]T` - Slice value

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

:::tip Difference
- `GetSlice[T]` - Package-level function using the default loader
- `GetSliceFrom[T]` - Generic function specifying a Loader instance (Go does not support generic methods)
:::

---

## Query Functions

### Lookup

```go
func Lookup(key string) (string, bool)
```

Checks if a key exists and gets its value. Supports dot path resolution.

**Parameters:**
- `key` - Key name (supports dot path)

**Returns:**
- `string` - Value (leading and trailing whitespace removed)
- `bool` - Whether the key exists

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // Key does not exist
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
- `[]string` - List of key names; returns nil if the loader is unavailable

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
- `map[string]string` - Key-value mapping; returns nil if the loader is unavailable

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

Gets the number of variables.

**Returns:**
- `int` - Number of variables; returns 0 if the loader is unavailable

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
- `key` - Key name
- `value` - Value

**Returns:**
- `error` - Setting error

**Error Types:**
- `*ValidationError` - Invalid key name format (Field="key")
- `*SecurityError` - Forbidden key (matchable via `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - Invalid value (when `ValidateValues` is true, value contains unsafe content like null bytes or control characters)
- `ErrClosed` - Loader is closed

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
- `key` - Key name

**Returns:**
- `error` - Deletion error

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

Validates that required keys exist. Requires `RequiredKeys` to be set in Config.

**Returns:**
- `error` - Validation error

```go
// Need to configure RequiredKeys first (via custom loader)
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
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
- `v` - Pointer to a struct

**Returns:**
- `error` - Mapping error

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

**Struct Tags:**
| Tag | Description |
|-----|-------------|
| `env:"KEY"` | Maps to specified key |
| `env:"-"` | Ignores this field |
| `envDefault:"value"` | Default value |

Slice fields are split by comma `,` by default (surrounding whitespace around the separator is trimmed automatically); there is no custom separator tag.

:::tip See Also
[Struct Mapping](/en/env/guides/struct-mapping) for a complete guide.
:::

---

## Utility Functions

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Resets the global default loader. Primarily used in testing scenarios.

**Returns:**
- `error` - Error from closing the old loader (if one exists); returns nil if there was no previous loader or if closing succeeded

**Behavior:**
- Atomically swaps the default loader to nil via `atomic.Pointer.Swap`
- Closes the old loader while holding the `defaultMu` lock (lock released only after close completes, ensuring atomic reset)
- After reset, a new default loader can be created via `Load()` or `LoadWithConfig()`

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

:::warning Note
This function is concurrency-safe but should only be called in tests or during startup to avoid unexpected behavior.
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

Initializes the default loader with a custom configuration.

**Parameters:**
- `cfg` - Custom configuration

**Returns:**
- `error` - Initialization error

**Behavior:**
- Sets the package-level default loader (used by `GetString`, `GetInt`, etc.)
- **Forces** `AutoApply = true` (regardless of the cfg setting)
- Returns `ErrAlreadyInitialized` if the default loader is already initialized

**Difference from Load:**
- `Load()` - Only accepts a list of filenames, uses default configuration
- `LoadWithConfig()` - Accepts a full Config, supports all configuration options

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}
// Now you can use package-level functions
port := env.GetInt("PORT", 8080)
```

:::warning Note
This function forces `cfg.AutoApply` to `true`, ensuring variables are applied to the system environment. To control application timing, use `New()` to create an independent instance.
:::

---

## Serialization Functions

### Marshal

```go
func Marshal(data any, format ...FileFormat) (string, error)
```

Serializes data to a string in the specified format. Supports `map[string]string` or struct as input.

**Interface Integration:** If the input type implements the `Marshaler` interface, the `MarshalEnv()` method is called first for serialization.

**Parameters:**
- `data` - Data to serialize (map or struct)
- `format` - Optional format, defaults to `FormatEnv`

**Returns:**
- `string` - Serialized string (keys are sorted)
- `error` - Serialization error

**Supported Formats:**
- `FormatEnv` (default) - .env format
- `FormatJSON` - JSON format
- `FormatYAML` - YAML format

```go
// Map to .env format
mapData := map[string]string{"HOST": "localhost", "PORT": "8080"}
envStr, _ := env.Marshal(mapData)
// HOST=localhost
// PORT=8080

// Map to JSON format (numeric strings emitted as bare numbers, keys sorted alphabetically)
jsonStr, _ := env.Marshal(mapData, env.FormatJSON)
// {
//   "HOST": "localhost",
//   "PORT": 8080
// }

// Struct to .env format
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

Parses a formatted string into a map. Supports automatic format detection.

**Parameters:**
- `data` - Formatted string
- `format` - Optional format, defaults to `FormatEnv`; use `FormatAuto` for auto-detection

**Returns:**
- `map[string]string` - Parsed key-value pairs
- `error` - Parsing error

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

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v any, format ...FileFormat) error
```

Parses a formatted string and populates a struct.

**Parameters:**
- `data` - Formatted string
- `v` - Pointer to a struct
- `format` - Optional format, defaults to `FormatEnv`

**Returns:**
- `error` - Parsing error

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

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v any) error
```

Populates a struct from a map. Supports `env` and `envDefault` tags.

**Interface Integration:** If the target type implements the `Unmarshaler` interface, the `UnmarshalEnv(data)` method is called first.

**Parameters:**
- `data` - Key-value mapping
- `v` - Pointer to a struct

**Returns:**
- `error` - Population error

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int    `env:"PORT" envDefault:"8080"`
}

data := map[string]string{"HOST": "example.com"}
var cfg Config
err := env.UnmarshalInto(data, &cfg)
// cfg.Host = "example.com", cfg.Port = 8080 (uses default value)
```

---

### MarshalStruct

```go
func MarshalStruct(v any) (map[string]string, error)
```

Converts a struct to a map. Supports `env` tag for specifying key names.

**Interface Integration:** If the input type implements the `Marshaler` interface, the `MarshalEnv()` method is called first.

**Parameters:**
- `v` - Struct or pointer to a struct

**Returns:**
- `map[string]string` - Key-value mapping
- `error` - Conversion error

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

Checks if an error is a serialization/deserialization error.

**Parameters:**
- `err` - Error to check

**Returns:**
- `bool` - Whether the error is of type MarshalError

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
    Host     string        `env:"APP_HOST" envDefault:"0.0.0.0"`
    Port     int64         `env:"APP_PORT" envDefault:"8080"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"HOSTS"`
}

func main() {
    // Load configuration file
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

## Related Documentation

- [Loader API](/en/env/api-reference/loader) - Loader instance methods
- [Config API](/en/env/api-reference/config) - Configuration options
- [SecureValue API](/en/env/api-reference/secure-value) - Secure value handling
- [Struct Mapping](/en/env/guides/struct-mapping) - Struct mapping guide
