---
sidebar_label: "Package Functions"
title: "Package Functions - CyberGo env | Global Functions Reference"
description: "CyberGo env package function API reference: Load, GetString, GetInt, GetBool, GetDuration, GetSlice, GetSecure, Lookup, Keys and ParseInto, all thread-safe."
sidebar_position: 2
---

# Package Functions

Package-level functions are the simple path for most programs. They all read from one package-level default loader (the "default loader" below), and all are thread-safe.

:::info Initialization requirements
You must initialize the default loader explicitly with `Load()`, `Overload()`, or `LoadWithConfig()`. It is **not** created on first use. Before initialization, the functions behave as follows:

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
- `filenames` - file paths to load. When omitted, `Load` loads the files named by `DefaultConfig().Filenames`, which is `.env`. Paths must be relative

**Returns:**
- `error` - load error

**Behavior:**
- Creates a new Loader from `DefaultConfig()` and makes it the default loader
- Forces `AutoApply = true`, so the values reach the process environment (rationale in [LoadWithConfig forces AutoApply](#loadwithconfig-forces-autoapply))
- Reads files in the order given. With the `Load()` default of `OverwriteExisting=false`, the first file wins. Pass a `Config` with `OverwriteExisting=true` to `LoadWithConfig` if later files should override earlier ones.
- Returns `ErrAlreadyInitialized` if a default loader already exists
- Accepts .env, JSON, and YAML files

:::warning A failed initialization can still leave process variables behind
`New()` applies variables to the process environment during construction (`AutoApply=true`). If installing the default loader then fails (for example a concurrent `Load` returns `ErrAlreadyInitialized`), the internal Loader is closed, but the process variables already written are **not** reverted. Read a failed `Load` as "the default loader is unchanged", not as "the process environment is unchanged".
:::

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
nameExact := env.GetString("APP_NAME")  // "myapp"
```

**2. Uppercase conversion (simple keys)**
```go
// For a key without dots, the uppercase form is tried automatically
nameUpper := env.GetString("app_name")  // Looks up app_name, then APP_NAME
```

**3. Dot-path resolution (nested keys)**
```go
// JSON: {"app": {"name": "myapp"}}
// Stored as: APP_NAME=myapp

// Each of these returns the same value
nameFlat := env.GetString("APP_NAME")     // Flat key (recommended)
nameDot := env.GetString("app.name")      // Dot path (converted automatically)
nameUpperDot := env.GetString("APP.NAME") // Uppercase dot path
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
firstHost := env.GetString("hosts.0")  // "localhost" (parsed from comma-separated value)
```

---

## Value Getter Functions

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

Reads a string from the default loader. The value is not trimmed here: `.env` values were trimmed at parse time, while JSON and YAML values keep surrounding whitespace. With no default loader, it returns the default you passed, or `""`.

```go
host := env.GetString("HOST", "localhost")
appName := env.GetString("app.name")  // dot path into nested keys
```

The instance method behaves the same, including the empty-string case; see [Loader · GetString](./loader#getstring).

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

Reads an integer from the default loader. A value that does not parse as an integer is audited and the default is returned (0 when no default was passed). With no default loader, the default (or 0) is returned as well.

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)
```

The instance method behaves the same; see [Loader · GetInt](./loader#getint).

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

Reads a boolean from the default loader. Matching is case-insensitive (ASCII only).

| Truthy | Falsy |
|--------|-------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

- **Key exists with an empty value**: parses as `false` and does **not** fall back to the default.
- **Any other invalid value**: audited, and the default is returned.
- **No default loader**: the default is returned (`false` when none was passed).

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)
```

The instance method behaves the same; see [Loader · GetBool](./loader#getbool).

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

Reads an unsigned integer from the default loader. A negative or malformed value is audited and the default is returned (0 when no default was passed). With no default loader, the default (or 0) is returned as well.

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)
```

The instance method behaves the same; see [Loader · GetUint64](./loader#getuint64).

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

Reads a floating-point value from the default loader. A malformed value is audited and the default is returned (0 when no default was passed). With no default loader, the default (or 0) is returned as well.

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")
```

The instance method behaves the same; see [Loader · GetFloat64](./loader#getfloat64).

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Reads a duration from the default loader. The value must follow Go's `time.ParseDuration` syntax; otherwise it is audited and the default is returned (0 when no default was passed). With no default loader, the default (or 0) is returned as well.

| Example | Meaning |
|---------|---------|
| `300ms` | milliseconds |
| `1.5s` | seconds |
| `2m30s` | minutes + seconds |
| `1h30m` | hours + minutes |

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)
```

The instance method behaves the same; see [Loader · GetDuration](./loader#getduration).

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

Returns a defensive copy of a sensitive value from the default loader; every call returns a new copy. Returns nil when the key does not exist, the default loader is not initialized, or the stored value is already closed.

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

The instance method behaves the same, including key resolution and the `nil` cases; see [Loader · GetSecure](./loader#getsecure). For the full type reference, see [SecureValue API](./secure-value).

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

The two sources fail differently: in indexed keys a bad element is audited and skipped while the rest are kept, and if every indexed element fails the source counts as a miss so the fallback continues. In the comma-separated fallback a single bad element discards the whole list and the default is returned. See "Two failure semantics of GetSliceFrom" below.

**Parameters:**
- `key` - key name
- `defaultValue` - optional default value

**Returns:**
- `[]T` - slice value; nil when it misses and no default was given

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
portsUint := env.GetSlice[uint]("PORTS")
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

Reads a slice value from a specific Loader instance. This is a standalone generic function, not a `Loader` method. Element sources and failure semantics match `GetSlice[T]` (indexed keys first, comma fallback); see "Two failure semantics of GetSliceFrom" below.

**Parameters:**
- `loader` - Loader instance pointer; a nil pointer returns the default value
- `key` - key name
- `defaultValue` - optional default value

**Returns:**
- `[]T` - slice value; nil when it misses and no default was given

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

Reports whether a key exists in the default loader and returns its value, with dot-path resolution. Index access falls back to the comma-separated value. The value is returned as stored, with no trimming applied here: `.env` values were trimmed at parse time; JSON and YAML values keep any surrounding whitespace.

Returns `("", false)` when the default loader is not initialized or is closed.

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // key does not exist
}
```

The instance method behaves the same; see [Loader · Lookup](./loader#lookup).

---

### Keys

```go
func Keys() []string
```

Returns every key name from the default loader. Like `Loader.Keys`, the result is an **approximate** snapshot (collected shard by shard, with no cross-shard consistency); nil when the default loader is not initialized or is closed.

```go
keys := env.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

The instance method behaves the same; see [Loader · Keys](./loader#keys).

---

### All

```go
func All() map[string]string
```

Returns every key-value pair from the default loader, also an approximate snapshot. Each value is an ordinary Go string outside `SecureValue`'s protection (SEC-010), so do not log or retain this map when it can hold secrets. Nil when the default loader is not initialized or is closed.

```go
all := env.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

The instance method behaves the same; see [Loader · All](./loader#all).

---

### Len

```go
func Len() int
```

Returns the variable count of the default loader. O(1), read from an atomic counter, so a concurrent write may not be reflected yet. Returns 0 when the default loader is not initialized or is closed.

```go
count := env.Len()
fmt.Printf("Loaded %d environment variables\n", count)
```

The instance method behaves the same; see [Loader · Len](./loader#len).

---

## Set and Delete

### Set

```go
func Set(key, value string) error
```

Sets an environment variable on the default loader (same as `Loader.Set`). The skip and write rules (`OverwriteExisting`, `AutoApply`) match the instance method; the only package-level difference is that an uninitialized default loader returns `ErrNotInitialized`.

**Error types:**
- `*ValidationError` - invalid key name format (`Field == "key"`)
- `*SecurityError` - the key is forbidden (matchable with `errors.Is(err, env.ErrSecurityViolation)`)
- `ErrInvalidValue` - invalid value content: null bytes or control characters (always checked with the built-in validator). A value over `MaxValueLength` yields a `*ValidationError` with `Rule == "max_length"`, which does **not** match `ErrInvalidValue`
- `ErrClosed` - the loader has been closed
- `ErrAuditFailed` - fail-closed auditing is on and an audit event was lost
- `ErrNotInitialized` - the default loader is not initialized

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // Branch on the error types above: a forbidden key is *SecurityError, a malformed key is *ValidationError
}
```

The instance method behaves the same, including the key rules and the `Setenv` failure path; see [Loader · Set](./loader#set).

---

### Delete

```go
func Delete(key string) error
```

Deletes an environment variable from the default loader (same as `Loader.Delete`): the in-memory value is removed and zeroed, and if this key was written to the process environment by the default loader it is unset there too. Returns `ErrNotInitialized` when the default loader is not initialized.

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

The instance method behaves the same, including the state left behind when the unset fails; see [Loader · Delete](./loader#delete).

---

## Validation and Mapping

### Validate

```go
func Validate() error
```

Checks that the required keys exist, delegating to the default loader (same as `Loader.Validate`). The keys checked are the `RequiredKeys` on the Config that `LoadWithConfig` used to initialize the default loader. Returns `ErrNotInitialized` when the default loader is not initialized.

```go
// RequiredKeys is configured on the default loader via LoadWithConfig
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
// Construction (New) validates required keys at the end of each file's parse,
// so a missing key makes LoadWithConfig fail. Clear Filenames here and supply
// the keys with Set instead
cfg.Filenames = nil

if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}

// In a real project the config files supply these keys
if err := env.Set("DB_HOST", "localhost"); err != nil {
    log.Fatal(err)
}
if err := env.Set("API_KEY", "example-key"); err != nil {
    log.Fatal(err)
}

if err := env.Validate(); err != nil {
    // Missing required keys; errors.Is(err, env.ErrMissingRequired) is true
}
```

The instance method behaves the same, including the `Rule` and `Field` of the `*ValidationError`; see [Loader · Validate](./loader#validate).

---

### ParseInto

```go
func ParseInto(v any) error
```

Maps the default loader's variables onto a struct (same as `Loader.ParseInto`). `v` must be a pointer to a struct, otherwise `*ValidationError` (`Field` is `value`) is returned; tag parsing or type conversion failures return `*MarshalError`; an uninitialized default loader returns `ErrNotInitialized`.

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

The instance method behaves the same; see [Loader · ParseInto](./loader#parseinto). For the full guide, see [Struct Mapping](../guides/struct-mapping).

---

## Utility Functions

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Resets the default loader. Use it mainly in tests.

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
- `cfg` - custom configuration. A **fully zero `Config` is rejected** and is not "equivalent to `DefaultConfig()`": this function sets `AutoApply` to `true` first, so `IsZero()` no longer holds, and `Validate` then fails because limits such as `MaxFileSize` are zero. `env.LoadWithConfig(env.Config{})` returns `invalid configuration: validation error on field "MaxFileSize": must be positive`, and `errors.Is(err, ErrInvalidConfig)` is `true`. Always start from `DefaultConfig()` or a preset. `New()`, `UnmarshalMapWithConfig`, and `UnmarshalStructWithConfig` (along with `UnmarshalMap` / `UnmarshalStruct`, which build on them) treat a fully zero `Config` as `DefaultConfig()`.

**Returns:**
- `error` - initialization error; `ErrAlreadyInitialized` when a default loader already exists

**Behavior:**
- Sets the default loader (the one `GetString`, `GetInt`, and the other package functions read)
- **Forces** `AutoApply = true`, whatever `cfg` says (rationale in [LoadWithConfig forces AutoApply](#loadwithconfig-forces-autoapply))
- Returns an error wrapping `ErrInvalidConfig` when the configuration is invalid

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

---

### Overload

```go
func Overload(filenames ...string) error
```

`Load` with last-file-wins semantics. It initializes the default loader with `OverwriteExisting = true`, so when several files define the same key the **later file wins**. Like `Load`, it forces `AutoApply = true` (see [LoadWithConfig forces AutoApply](#loadwithconfig-forces-autoapply)). Loaded values also replace variables that already exist in the process environment (the godotenv Overload convention).

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
key := env.GetString("database.host", "")
```

---

### ClearInternCache

```go
func ClearInternCache()
```

Releases the memory held by the `.env` key-interning cache.

Parsing `.env` content interns key strings in a **bounded process-wide cache** so repeated keys are not reallocated. The cache has a fixed ceiling and cannot grow without bound, but a long-running application that parses in bursts can call this between bursts to drop the retained keys early.

```go
env.ClearInternCache() // call between parsing bursts
```

**Points to know:**
- Safe for concurrent use. Like the other process-wide knobs, it is **not** part of `Config` and applies to every loader.
- It releases only the cache itself; **already-loaded values are unaffected**, so `GetString` and friends keep working.
- A later `.env` parse repopulates the cache, so there is no need to call it after every parse.

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
- `error` - serialization error, with these concrete types:
  - `data` is `nil` -> `*ValidationError` (`Field` is `data`, not `*MarshalError`)
  - `data` is neither `map[string]string` nor a struct/struct pointer -> `*MarshalError`
  - nesting deeper than 100 levels or a cyclic reference -> `*MarshalError` (message contains `maximum struct nesting depth (100) exceeded`)

Use `env.IsMarshalError(err)` to tell the last two apart from non-marshal errors.

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

- A fully zero `Config` means `DefaultConfig()` (shared with `New`, `UnmarshalMapWithConfig`, and `UnmarshalStructWithConfig`, and therefore with `UnmarshalMap` / `UnmarshalStruct`; not shared with `LoadWithConfig`, which rejects a zero Config).
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
  - `*ValidationError` - `v` is nil or not a non-nil struct pointer (`Field` is `value`)
  - `*MarshalError` - tag parsing or type conversion failed. **A cyclic reference or nesting beyond 100 levels** also returns it (message contains `maximum struct nesting depth (100) exceeded`), which keeps a self-referential type such as `type Node struct { Next *Node }` from recursing until the stack overflows.

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
- `map[string]string` - key-value mapping; when `v` is `nil`, an empty map (`nil`) and a `nil` error are returned — not a failure
- `error` - conversion error
  - `*MarshalError` - `v` is not a struct or struct pointer
  - `*MarshalError` - nesting beyond 100 levels or a cyclic reference (message contains `maximum struct nesting depth (100) exceeded`)

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
- `err` - error to check; nil returns false

**Returns:**
- `bool` - whether it is a `MarshalError`

```go
_, err := env.Marshal(make(chan int)) // a channel is neither a map nor a struct
if env.IsMarshalError(err) {
    // Handle serialization error
}
```

Note that `Marshal(nil)` returns a `*ValidationError` (`Field` is `data`), for which `IsMarshalError` is `false`.

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

`GetBool` accepts `true`/`yes`/`on`/`1`/`enabled` and `false`/`no`/`off`/`0`/`disabled`, case-insensitively. An empty string parses as `false`; any other invalid value is audited and the default is returned. The full rules are under [GetBool](#getbool) above; the instance method's accepted values and audit behavior are in [Loader · GetBool](./loader#getbool).

### Parse failures vs. defaults

The `Get*` functions return the default (or zero value) in two cases: the key is **missing**, or the value **fails to parse**. They never panic and never return an error.

Each parse failure is recorded in the audit log as `parse failed`, so broken configuration shows up there.

One exception: when the key **exists with an empty value**, `GetBool` returns `false` rather than the default — an empty string is a valid explicit value that parses as `false`. `GetInt`, `GetUint64`, `GetFloat64`, and `GetDuration` have no such exception: their empty values fail to parse and fall back to the default as usual.

```go
// DEBUG= (explicitly empty)
debug := env.GetBool("DEBUG", true) // false, not true
port := env.GetInt("PORT", 8080)    // PORT= falls back to 8080
```

### Two failure semantics of GetSliceFrom

`GetSliceFrom[T](loader, key)` collects elements from indexed keys (`KEY_0`, `KEY_1`, ...) and falls back to a comma-separated value. A parse failure has a different effect depending on the source:

| Source | On element parse failure |
|--------|--------------------------|
| Indexed keys (`KEY_0`...) | The element is **skipped** after an audit record; the remaining elements are kept. If every element fails, it counts as a miss and the fallback continues |
| Comma-separated fallback | The **whole list is discarded**; the default (or nil) is returned |

The difference between the two semantics: a bad element in an indexed key only affects itself, while a single bad element in a comma-separated value discards the whole list.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	cfg := env.DefaultConfig()
	cfg.Filenames = nil // no file loading; the demo data comes from Set

	loader, err := env.New(cfg)
	if err != nil {
		panic(err)
	}
	defer loader.Close()

	// Case one: indexed keys, where PORTS_1 is the bad element
	if err := loader.Set("PORTS_0", "80"); err != nil {
		panic(err)
	}
	if err := loader.Set("PORTS_1", "abc"); err != nil {
		panic(err)
	}
	fmt.Println(env.GetSliceFrom[int64](loader, "PORTS")) // Output: [80]

	// Case two: comma-separated, where "abc" fails the whole list and the default wins
	if err := loader.Set("LIMITS", "80,abc"); err != nil {
		panic(err)
	}
	fmt.Println(env.GetSliceFrom[int64](loader, "LIMITS", []int64{443})) // Output: [443]
}
```

The two cases use different key names because indexed keys take precedence over the comma-separated value: as long as the indexed keys yield any element, the comma fallback never runs; the comma-separated value is read only when the indexed keys are all missing or all fail to parse.

The element type must be one of: `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`. Slice length is capped at 10000; going over the cap is audited.

### LoadWithConfig forces AutoApply

`Load()`, `Overload()`, and `LoadWithConfig()` all **force** `AutoApply=true`, whatever the passed configuration says. Package-level convenience functions (`GetString`, `GetInt`, ...) read the loader's memory, while external readers such as `os.Getenv` need the variables in the process environment; forcing the apply makes one initialization satisfy both.

Two consequences follow. First, `LoadWithConfig(env.Config{})` stops looking like a zero-value Config once `AutoApply` is set, so it is rejected for having zero limits. Second, when you need to control exactly when variables are applied, use `New()` and call `Apply()` yourself.

## Related Documentation

- [Loader API](./loader) - Loader instance methods
- [Config API](./config) - Configuration options
- [SecureValue API](./secure-value) - Secure value handling
- [Struct Mapping](../guides/struct-mapping) - Struct mapping guide
