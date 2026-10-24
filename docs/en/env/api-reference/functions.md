---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo env | Global Functions Reference"
description: "CyberGo env package function API reference: Load, GetString, GetInt, GetBool, GetDuration, GetSlice, GetSecure, Lookup, Keys and ParseInto, all thread-safe."
sidebar_position: 2
---

# Package Functions

Package-level functions are the simple path for most programs. They all read from one process-global default loader, and all are thread-safe.

:::info Initialization requirements
You must initialize the global default loader explicitly with `Load()` or `LoadWithConfig()`. It is **not** created on first use. Before initialization, the functions behave as follows:

- `Get*` functions (`GetString`, `GetInt`, `GetBool`, etc.): return the default you passed, or the zero value
- `Lookup`: returns `("", false)`
- `Keys`/`All`/`Len`/`GetSecure`: return `nil`/`0`
- `Set`/`Delete`/`Validate`/`ParseInto`: return `ErrNotInitialized`
:::

## Load Functions

### Load

```go
func Load(filenames ...string) error
```

Loads environment variable files and applies them to the process environment.

**Parameters:**
- `filenames` - file paths to load. When omitted, `Load` loads the files named by `DefaultConfig().Filenames`, which is `.env`.

**Returns:**
- `error` - load error

**Behavior:**
- Creates a new Loader and makes it the default loader
- Applies the variables to the process environment (`os.Environ`)
- Reads files in the order given. With the `Load()` default of `OverwriteExisting=false`, the first file wins. Pass a `Config` with `OverwriteExisting=true` to `LoadWithConfig` if later files should override earlier ones.
- Returns `ErrAlreadyInitialized` if a default loader already exists
- Accepts .env, JSON, and YAML files

```go
// Load .env file
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// Load specified files (in order; the first file to define a key wins)
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

Every getter resolves keys the same way, so a flat key and its dot path both work.

### Resolution Rules

**1. Exact match (highest priority)**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. Uppercase conversion (simple keys)**
```go
// For a key without dots, the uppercase form is tried automatically
name := env.GetString("app_name")  // Looks up app_name, then APP_NAME
```

**3. Dot-path resolution (nested keys)**
```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// Each of these returns the same value
name := env.GetString("APP_NAME")   // Flat key (recommended)
name := env.GetString("app.name")   // Dot path (converted automatically)
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

An array element resolves through an indexed key, or falls back to a comma-separated value:

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

Reads a string value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports exact match, uppercase conversion, dot path)
- `defaultValue` - optional default value

**Returns:**
- `string` - the value, or the default; an empty string when the key is missing and no default was given

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

Reads an integer value, converting the stored string. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `int64`

**Returns:**
- `int64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a boolean value. Supports dot-path resolution.

- **Truthy (case-insensitive):** `true`, `1`, `yes`, `on`, `enabled`
- **Falsy (case-insensitive):** `false`, `0`, `no`, `off`, `disabled`

Any other non-empty value is invalid: it is audited and the function returns the default. An empty string is valid and parses as `false`, so it does **not** fall back to the default.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `bool` - the value, or the default; false when the key is missing and no default was given

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

Reads an unsigned integer value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `uint64`

**Returns:**
- `uint64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a floating-point value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value, type `float64`

**Returns:**
- `float64` - the value, or the default; 0 when the key is missing and no default was given

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

Reads a duration value. Supports dot-path resolution.

**Supported formats:**
- `300ms` - milliseconds
- `1.5s` - seconds
- `2m30s` - minutes + seconds
- `1h30m` - hours + minutes

**Parameters:**
- `key` - key name (supports dot path)
- `defaultValue` - optional default value

**Returns:**
- `time.Duration` - the value, or the default; 0 when the key is missing and no default was given

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

Returns a `SecureValue` for the key, for sensitive data.

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
Call `Release()` or `Close()` after use to release the resources. Use `defer` so the call always runs.
:::

:::tip
See [SecureValue API](./secure-value) for the full reference.
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

Generic function that reads a slice value from the default loader.

**Supported types:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**Note:** this is a generic function, not a `Loader` method. To read a slice from a specific Loader instance, use `GetSliceFrom[T]`.

**Parse order:**
1. Read indexed keys `KEY_0`, `KEY_1`, `KEY_2`...
2. If no indexed keys exist, split the `KEY` value on commas
3. Both forms support dot-path resolution

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

Reads a slice value from a specific Loader instance. This is a standalone generic function, not a `Loader` method.

**Parameters:**
- `loader` - Loader instance pointer; a nil pointer returns the default value
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
- `GetSlice[T]` reads from the default loader.
- `GetSliceFrom[T]` reads from the Loader you pass in, because Go does not support generic methods.
:::

---

## Query Functions

### Lookup

```go
func Lookup(key string) (string, bool)
```

Reports whether a key exists and returns its value. Supports dot-path resolution.

**Parameters:**
- `key` - key name (supports dot paths)

**Returns:**
- `string` - the value as stored, with no trimming applied here. `.env` values were trimmed at parse time; JSON and YAML values keep any surrounding whitespace.
- `bool` - whether the key exists

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

Returns every key name in the default loader.

The result is an **approximate** snapshot: keys are collected shard by shard under per-shard read locks, so a write that lands during the sweep may or may not appear. For an exact snapshot, synchronize externally.

**Returns:**
- `[]string` - the key names in unspecified order; nil when no default loader exists or it is closed

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

Returns every key-value pair in the default loader, as an **approximate** snapshot (same collection path as `Keys`).

Each value is an ordinary Go string outside `SecureValue`'s protection (SEC-010). For secrets, use `GetSecure`.

**Returns:**
- `map[string]string` - the key-value mapping; nil when no default loader exists or it is closed

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

Returns the variable count of the default loader. O(1), from an atomic counter.

**Returns:**
- `int` - variable count; 0 when no default loader exists or it is closed

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
- `*ValidationError` - invalid key name format (`Field == "key"`)
- `*SecurityError` - the key is forbidden (matchable with `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - the value is unsafe: null bytes, control characters, or other invalid content. This case arises only when `ValidateValues` is true.
- `ErrClosed` - the loader has been closed

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // Branch on the error types above: a forbidden key is *SecurityError, a malformed key is *ValidationError
}
```

---

### Delete

```go
func Delete(key string) error
```

Deletes an environment variable from the default loader. If the variable was applied to the process environment, it is removed there too.

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

Checks that the required keys exist, delegating to the default loader (same behavior as `Loader.Validate`).

The keys checked are the `RequiredKeys` on the Config that `LoadWithConfig` used to initialize the default loader.

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

Maps the variables in the default loader onto a struct.

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
| `env:"KEY"` | Map the field to this key |
| `env:"-"` | Skip this field |
| `envDefault:"value"` | Default value |

Slice fields split on a comma `,` by default; whitespace around each separator is stripped. There is no tag for a custom separator.

:::tip
See [Struct Mapping](../guides/struct-mapping) for the full guide.
:::

---

## Utility Functions

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Resets the global default loader. Use it mainly in tests.

**Returns:**
- `error` - error from closing the old loader, if any; nil when there was no loader or closing succeeded

**Behavior:**
- Takes `defaultMu.Lock()`, swaps the default loader to nil with `defaultLoader.Swap(nil)`, then releases the lock immediately
- Closes the old loader **outside** the lock. Cleanup can be slow, and holding the lock would deadlock if `Close()` needed the default loader.
- Afterwards, `Load()` or `LoadWithConfig()` can create a new default loader

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
The function is concurrency-safe, but call it only during tests or at startup; elsewhere it can discard a loader other code is still using.
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

Initializes the default loader from a full configuration.

**Parameters:**
- `cfg` - custom configuration

**Returns:**
- `error` - initialization error

**Behavior:**
- Sets the package-level default loader (the one `GetString`, `GetInt`, and the other package functions read)
- **Forces** `AutoApply = true`, whatever `cfg` says
- Returns `ErrAlreadyInitialized` if a default loader already exists

**Difference from Load:**
- `Load()` accepts only a file name list and uses the default config.
- `LoadWithConfig()` accepts a full `Config` and honors every option.

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
This function forces `cfg.AutoApply` to `true`, so the variables always reach the process environment. To control when they are applied, create an independent instance with `New()`.
:::

---

### Overload

```go
func Overload(filenames ...string) error
```

`Load` with last-file-wins semantics. It initializes the default loader with `OverwriteExisting = true`, so when several files define the same key the **later file wins**. Like `Load`, it forces `AutoApply = true`. Loaded values also replace variables that already exist in the process environment (the godotenv Overload convention).

**Security note:** `Load` never touches existing process-environment variables, so deployment-injected values (container secrets, CI variables) always win over file values. `Overload` removes that protection: a file value replaces an existing process variable of the same name.

When in doubt, prefer `Load` and order files by priority. Within a single file, duplicate-key semantics are unchanged; see `DuplicateKeyPolicy` in [Config API](./config#duplicatekeypolicy-in-document-duplicate-keys).

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

Serializes `map[string]string` or a struct into a string. Output keys are always sorted lexicographically, and the default format is `.env`.

**Interface integration:** a struct passed as `data` goes through `MarshalStruct`, so if its type implements `Marshaler`, its `MarshalEnv()` method produces the source text. A `map[string]string` is serialized directly.

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

**Quoting in `.env` output:** a value is quoted when it contains a space, `#`, `'`, `"`, a newline, a carriage return, or a tab. An empty value is written as `""`.

A value that is the literal `null` (any case) or `~` is also quoted, so a reload with `AllowYamlSyntax` on does not turn it into an empty string. A backslash does not trigger quoting by itself; inside a quoted value it is escaped as `\\`.

A value containing `$` is quoted and its `$` escaped as `\$`, so `${...}` text survives a Marshal → Load round trip instead of being expanded (SEC-009).

> See [Serialization · Output Shape](../guides/serialization) for the JSON and YAML output rules: type inference, nested objects rebuilt from underscore keys, and scalar quoting for round-trip safety.

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

Parses a formatted string into a map. Pass `FormatAuto` to detect the format from the data.

**Parameters:**
- `data` - formatted string
- `format` - optional format, defaults to `FormatEnv`; `FormatAuto` detects it from the data

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

Detection looks at the data only: content starting with `{` or `[` is JSON; otherwise the first non-comment line decides between YAML and `.env`.

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

`UnmarshalMap` with full `Config` semantics. These sections take effect:

- `LimitsConfig` - file size, line/key/value length, variable count
- `ParsingConfig` - duplicate-key policy, plus variable expansion. Expansion applies to `.env` input only; JSON and YAML values are never expanded.
- `JSONConfig` / `YAMLConfig` - format options
- `ValidationConfig` - key and value rules, `RequiredKeys`
- `ComponentConfig` - custom validator, expander, and auditor. `Prefix` filters parsed keys by the same rule as file loading.

`FileConfig` (`Filenames`, `FailOnMissingFile`, `OverwriteExisting`, `AutoApply`) has no one-shot counterpart and is ignored.

`cfg` follows the standard zero-value contract:

- A fully zero `Config` means `DefaultConfig()`.
- A partially set Config is rejected with `ErrInvalidConfig`. Start from `DefaultConfig()` or a preset.

`UnmarshalMap` is the no-config shortcut that runs this same `DefaultConfig` pipeline. Every format applies the forbidden-key policy and key validation uniformly (SEC-002).

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

The config-driven counterpart of `UnmarshalStruct`. It parses the string under `cfg`'s full rules — limits, duplicate-key policy, expansion, validation, and custom components, the same set as [UnmarshalMapWithConfig](#unmarshalmapwithconfig) — and then fills the struct.

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

Fills a struct from a map. Honors the `env` and `envDefault` tags.

**Interface integration:** if `v` implements `Unmarshaler`, `UnmarshalInto` calls its `UnmarshalEnv(data)` method and skips the reflection path.

**Parameters:**
- `data` - the key-value mapping to read from
- `v` - non-nil pointer to a struct

**Returns:**
- `error` - fill error

Slice fields split the value on commas. For string slices, empty elements are kept (`"a,,b"` yields three elements). For numeric and boolean slices, an empty element is a conversion error.

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

Converts a struct into a map. `env` tags supply the key names.

**Interface integration:** If the input type implements `Marshaler`, `MarshalStruct` calls its `MarshalEnv()` method.

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

Reports whether an error is a serialization or deserialization error.

**Parameters:**
- `err` - error to check

**Returns:**
- `bool` - whether it is a `MarshalError`

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

Beyond the common types, both the package-level functions and the `Loader` methods offer unsigned-integer and float access:

<!-- check-code: skip -->
```go
limit := env.GetUint64("RATE_LIMIT", 1000)     // uint64
rate := env.GetFloat64("SAMPLE_RATE", 0.5)      // float64
u := loader.GetUint64("RATE_LIMIT", 1000)       // same signature on Loader
f := loader.GetFloat64("SAMPLE_RATE", 0.5)
```

### Lenient boolean parsing

`GetBool` accepts these spellings, case-insensitively:

| Truthy | Falsy |
|--------|-------|
| `true`, `yes`, `on`, `1`, `enabled` | `false`, `no`, `off`, `0`, `disabled` |

An empty string parses as `false`. Any other value raises a `ValidationError`, records an audit event, and **returns the default**.

### Parse failures vs. defaults

All `Get*` functions return the default (or zero value) in two cases: the key is **missing**, or the value **fails to parse**. They never panic and never return an error.

Each parse failure is recorded in the audit log as `parse failed`, so broken configuration shows up there.

### Two failure semantics of GetSliceFrom

`GetSliceFrom[T](loader, key)` collects elements from indexed keys (`KEY_0`, `KEY_1`, ...) and falls back to a comma-separated value. A parse failure has a different effect depending on the source:

| Source | On element parse failure |
|--------|--------------------------|
| Indexed keys (`KEY_0`...) | The element is **skipped** after an audit record; the remaining elements are kept |
| Comma-separated fallback | The **whole list is discarded**; the default (or nil) is returned |

The element type must be one of: `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`. Slice length is capped at 10000; going over the cap is audited.

### LoadWithConfig forces AutoApply

Both `Load()` and `LoadWithConfig()` **force** `AutoApply=true`, whatever the passed configuration says, because package-level functions rely on the variables being in the process environment. To control when variables are applied, use `New()` and call `Apply()` yourself.

## Related Documentation

- [Loader API](./loader) - Loader instance methods
- [Config API](./config) - Configuration options
- [SecureValue API](./secure-value) - Secure value handling
- [Struct Mapping](../guides/struct-mapping) - Struct mapping guide
