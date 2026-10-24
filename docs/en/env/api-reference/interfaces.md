---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo env | Core Interface Hierarchy"
description: "Fine-grained DI interfaces for CyberGo env: EnvLoader composite with EnvFileLoader, EnvGetter, EnvSetter, Validator, FullAuditLogger, EnvParser, FileSystem."
sidebar_position: 6
---

# Interfaces

`env` defines small, single-purpose interfaces. Accept the narrowest one your function needs to stay decoupled from the full `Loader`.

A `*Loader` satisfies `EnvLoader` and its five component interfaces — `EnvFileLoader`, `EnvGetter`, `EnvSetter`, `EnvApplicator`, and `EnvCloser` — so a single loader value can be passed to all of them.

## Core Interfaces

### EnvLoader

The complete loader interface, composing all sub-interfaces:

```go
type EnvLoader interface {
    EnvFileLoader
    EnvGetter
    EnvSetter
    EnvApplicator
    EnvCloser
}
```

---

### EnvFileLoader

File loading interface:

```go
type EnvFileLoader interface {
    LoadFiles(filenames ...string) error
}
```

**Use case:** when a function only needs to load files. The interface has a single method, `EnvFileLoader.LoadFiles`.

```go
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}
```

---

### EnvGetter

Read access interface:

```go
type EnvGetter interface {
    GetString(key string, defaultValue ...string) string
    Lookup(key string) (string, bool)
    Keys() []string
    All() map[string]string
}
```

**Use case:** read-only configuration access, through the minimal read interface. Its four methods:

| Method | Description |
|--------|-------------|
| `EnvGetter.GetString` | Read a string by key, with an optional default |
| `EnvGetter.Lookup` | Look up a key, returning the value and whether it exists |
| `EnvGetter.Keys` | Return every key |
| `EnvGetter.All` | Return every key-value pair |

```go
func readConfig(getter env.EnvGetter) {
    host := getter.GetString("HOST", "localhost")
    value, exists := getter.Lookup("API_KEY")
    keys := getter.Keys()
}
```

:::warning
`GetInt`, `GetBool`, `GetUint64`, `GetFloat64`, `GetDuration`, `GetSecure`, and `Len` are **not** part of `EnvGetter`. `*Loader` implements them, but the minimal interface does not expose them.

For the full read surface, take a `*Loader` directly:

```go
func readFullConfig(loader *env.Loader) {
    port := loader.GetInt("PORT", 8080)      // ✓ available
    debug := loader.GetBool("DEBUG", false)  // ✓ available
    count := loader.Len()                     // ✓ available
}
```
:::

---

### EnvSetter

Write access interface:

```go
type EnvSetter interface {
    Set(key, value string) error
    Delete(key string) error
}
```

**Use case:** when a function only needs to set and delete. Both methods validate, unlike plain storage:

- `EnvSetter.Set` checks the key and value, writes them, and returns an error.
- `EnvSetter.Delete` removes a key. Unlike `EnvStorage.Set`, both methods validate.

```go
func updateConfig(setter env.EnvSetter) error {
    if err := setter.Set("KEY", "value"); err != nil {
        return err
    }
    return setter.Delete("TEMP_KEY")
}
```

---

### EnvApplicator

Interface for writing to the process environment:

```go
type EnvApplicator interface {
    Apply() error
}
```

**Use case:** writing loaded variables to `os.Environ`. The single method is `EnvApplicator.Apply`.

```go
func applyToSystem(applicator env.EnvApplicator) error {
    return applicator.Apply()
}
```

---

### EnvCloser

Resource release interface:

```go
type EnvCloser interface {
    Close() error
}
```

**Use case:** releasing loader resources. The single method is `EnvCloser.Close`.

---

## Validation Interfaces

### Validator

Composite validation interface:

```go
type Validator interface {
    KeyValidator
    ValueValidator
    RequiredValidator
}
```

:::tip
`Validator` provides `ValidateRequired` by embedding `RequiredValidator`. A custom validator that implements only `KeyValidator` returns `ErrValidateRequiredUnsupported` when `ValidateRequired` is called.
:::

---

### RequiredValidator

Required key validation interface:

```go
type RequiredValidator interface {
    ValidateRequired(keys map[string]bool) error
}
```

Validates that all required keys exist. The single method is `RequiredValidator.ValidateRequired`.

---

### KeyValidator

Key validation interface:

```go
type KeyValidator interface {
    ValidateKey(key string) error
}
```

Returns an error when a key name breaks the rules: length, format, forbidden keys, and so on. The single method is `KeyValidator.ValidateKey`.

---

### ValueValidator

Value validation interface:

```go
type ValueValidator interface {
    ValidateValue(value string) error
}
```

Returns an error when a value is unsafe: null bytes, control characters, and so on. The single method is `ValueValidator.ValidateValue`.

---

## Audit Interfaces

### AuditLogger

Minimal audit logging interface (alias of `internal.AuditLogger`):

```go
type AuditLogger interface {
    LogError(action AuditAction, key, errMsg string) error
}
```

**Use case:** the smallest thing you can pass where a custom audit logger is accepted. It has a single method, `AuditLogger.LogError`. For full audit capability, use `FullAuditLogger`.

---

### FullAuditLogger

Extended audit logging interface, providing full audit logging capabilities:

```go
type FullAuditLogger interface {
    AuditLogger
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

**Use case:** full audit logging. `ComponentFactory.Auditor()` returns this interface.

**Method descriptions:**

| Method | Purpose |
|--------|---------|
| `AuditLogger.LogError` | Inherited through the embedded `AuditLogger`; logs error events |
| `FullAuditLogger.Log` | Log a general audit event |
| `FullAuditLogger.LogWithFile` | Log an event together with the file it concerns |
| `FullAuditLogger.LogWithDuration` | Log an event together with its duration |
| `FullAuditLogger.Close` | Close the audit log |

---

### AuditHandler

The interface behind `Config.AuditHandler`:

```go
type AuditHandler interface {
    Log(event AuditEvent) error
    Close() error
}
```

**Use case:** implement this interface to control how audit events are processed. Unlike `AuditLogger`, it takes two methods: `AuditHandler.Log` receives events, and `AuditHandler.Close` releases resources.

`AuditHandler.Log` is called from several goroutines at once, so implementations must be safe for concurrent use.

**Built-in implementations:**
- `JSONAuditHandler` - writes JSON-format logs (`JSONAuditHandler.Log` / `JSONAuditHandler.Close`)
- `LogAuditHandler` - writes through the standard `log` package (`LogAuditHandler.Log` / `LogAuditHandler.Close`)
- `ChannelAuditHandler` - sends to a channel (`ChannelAuditHandler.Log` / `ChannelAuditHandler.Close`; `Close` does not close the external channel)
- `CloseableChannelHandler` - closeable handler with its own buffered channel (`CloseableChannelHandler.Log` / `CloseableChannelHandler.Close`)
- `NopAuditHandler` - discards events (`NopAuditHandler.Log` / `NopAuditHandler.Close`)

---

## Variable Expansion Interface

### VariableExpander

Variable expansion interface:

```go
type VariableExpander interface {
    Expand(s string) (string, error)
}
```

**Use case:** custom variable expansion. The single method is `VariableExpander.Expand`, which supports `${VAR}`, `${VAR:-default}`, and the other syntaxes listed in [Config API](./config).

```go
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

## Parsing Interface

### EnvParser

Parser interface:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**Parameters:**
- `r` - file content reader
- `filename` - file name (for error messages)

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

**Use case:** implementing a custom file format parser. The single method is `EnvParser.Parse`.

---

## Storage Interface

### EnvStorage

The storage contract for loaded variables:

```go
type EnvStorage interface {
    Get(key string) (string, bool)
    Set(key, value string)
    Delete(key string)
    Keys() []string
    Len() int
    ToMap() map[string]string
    Clear()
}
```

**Use case:** substituting your own storage backend. The library's internal sharded storage satisfies this interface as a compile-time contract. No library API accepts an `EnvStorage` today, so implement it only if you need your own storage type.

**Method descriptions:**

| Method | Purpose |
|--------|---------|
| `EnvStorage.Get` | Return a value and whether it exists |
| `EnvStorage.Set` | Store a key-value pair, replacing any previous value |
| `EnvStorage.Delete` | Remove a key |
| `EnvStorage.Keys` | Return all key names |
| `EnvStorage.Len` | Return the number of key-value pairs |
| `EnvStorage.ToMap` | Return a copy of all key-value pairs |
| `EnvStorage.Clear` | Remove all data |

---

## Serialization Interfaces

### Marshaler

Custom serialization interface:

```go
type Marshaler interface {
    MarshalEnv() ([]byte, error)
}
```

**Use case:** custom serialization. The single method is `Marshaler.MarshalEnv`.

```go
type LogLevel string

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

// Usage
level := LogLevel("debug")
env.Marshal(level)  // Calls MarshalEnv
```

---

### Unmarshaler

Custom deserialization interface:

```go
type Unmarshaler interface {
    UnmarshalEnv(data map[string]string) error
}
```

**Use case:** custom deserialization. The single method is `Unmarshaler.UnmarshalEnv`.

```go
type Config struct {
    Host string
    Port int
}

func (c *Config) UnmarshalEnv(data map[string]string) error {
    c.Host = data["HOST"]
    port, _ := strconv.Atoi(data["PORT"])
    c.Port = port
    return nil
}

// Usage
var cfg Config
env.UnmarshalInto(data, &cfg)  // Calls UnmarshalEnv
```

---

## File System Interface

### FileSystem

Filesystem abstraction interface:

```go
type FileSystem interface {
    Open(name string) (File, error)
    OpenFile(name string, flag int, perm os.FileMode) (File, error)
    Stat(name string) (os.FileInfo, error)
    MkdirAll(path string, perm os.FileMode) error
    Remove(name string) error
    Rename(oldpath, newpath string) error
    Getenv(key string) string
    Setenv(key, value string) error
    Unsetenv(key string) error
    LookupEnv(key string) (string, bool)
}
```

**Use case:** mocking a filesystem in tests.

**Methods (qualified names) and library usage:**

| Method | Used by library | Description |
|--------|:---------------:|-------------|
| `FileSystem.Open` | ✓ | Open a file for reading (the file-loading entry point) |
| `FileSystem.LookupEnv` | ✓ | Distinguish "not set" from "explicitly empty" |
| `FileSystem.Setenv` | ✓ | Write a process environment variable |
| `FileSystem.Unsetenv` | ✓ | Remove a process environment variable |
| `FileSystem.OpenFile` | — | Open a file with flags and permissions |
| `FileSystem.Stat` | — | Query file info by path |
| `FileSystem.MkdirAll` | — | Create directories recursively |
| `FileSystem.Remove` | — | Remove a file |
| `FileSystem.Rename` | — | Rename a file |
| `FileSystem.Getenv` | — | Read a process environment variable (library reads go through `FileSystem.LookupEnv`) |

The library calls only `Open`, `LookupEnv`, `Setenv`, and `Unsetenv`. Size and stat checks go through `File.Stat` on the handle that `Open` returned. The remaining methods exist for your own code that wraps `FileSystem`.

A minimal in-memory mock therefore needs those four methods, plus an `Open` that returns a `File`.

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

// MockFile implements env.File interface (for testing)
type MockFile struct {
    reader *strings.Reader
}

func (f *MockFile) Read(p []byte) (n int, err error)   { return f.reader.Read(p) }
func (f *MockFile) Write(p []byte) (n int, err error)  { return 0, errors.ErrUnsupported }
func (f *MockFile) Close() error                       { return nil }
func (f *MockFile) Stat() (os.FileInfo, error)         { return nil, errors.ErrUnsupported }
func (f *MockFile) Sync() error                        { return nil }

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{reader: strings.NewReader(content)}, nil
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error { return nil }
func (m *MockFileSystem) Remove(name string) error                     { delete(m.files, name); return nil }
func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MockFileSystem) Getenv(key string) string            { return m.env[key] }
func (m *MockFileSystem) Setenv(key, value string) error      { m.env[key] = value; return nil }
func (m *MockFileSystem) Unsetenv(key string) error           { delete(m.env, key); return nil }
func (m *MockFileSystem) LookupEnv(key string) (string, bool) { val, ok := m.env[key]; return val, ok }

// Usage
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

### File

The handle `FileSystem.Open` returns:

```go
type File interface {
    io.Reader
    io.Writer
    io.Closer
    Stat() (os.FileInfo, error)
    Sync() error
}
```

**Method descriptions:**

| Method | Purpose |
|--------|---------|
| Read | Read data |
| Write | Write data |
| Close | Close the file |
| `File.Stat` | Get file info (the library uses it for size checks) |
| `File.Sync` | Flush to disk |

Read, Write, and Close come from the embedded `io` interfaces. `File.Stat` and `File.Sync` are the file-specific operations.

---

### DefaultFileSystem

The default filesystem implementation:

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

It uses the real OS filesystem and process environment:

```go
cfg := env.DefaultConfig()
cfg.FileSystem = env.DefaultFileSystem  // default value
```

---

## Audit Handlers

### JSONAuditHandler

Writes JSON-format audit logs:

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

**Parameters:**
- `w` - output target (e.g. `os.Stdout`, a file)

```go
handler := env.NewJSONAuditHandler(os.Stdout)
```

**Output example:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","key":"API_KEY","success":true}
```

---

### LogAuditHandler

Writes through the standard `log` package:

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

**Parameters:**
- `logger` - the `log.Logger` to write through

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
handler := env.NewLogAuditHandler(logger)
```

**Output example:**
```text
[AUDIT] 2024/01/15 10:30:00 action=load key=API_KEY success=true reason="loaded" file=.env
```

Events are emitted as key-value pairs: `action`, `key`, `success`, `reason`, plus optional `file` and `duration`. The prefix and timestamp depend on the `log.Logger` you pass in. See [NewLogAuditHandler](./factory#newlogaudithandler) for the full format.

---

### ChannelAuditHandler

Sends events to a caller-owned channel:

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

**Parameters:**
- `ch` - channel that receives the events

:::warning Channel ownership
`ChannelAuditHandler` does **not own** the channel, and `Close()` does **not** close it. The caller must close the channel to signal the receiver to stop.

`Log()` blocks when the channel buffer is full, so pass a buffered channel. For automatic channel lifecycle management, use [NewCloseableChannelHandler](./factory#newcloseablechannelhandler).
:::

```go
ch := make(chan env.AuditEvent, 100)
handler := env.NewChannelAuditHandler(ch)

// Asynchronous processing
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

---

### NopAuditHandler

Discards every event:

```go
func NewNopAuditHandler() *NopAuditHandler
```

```go
handler := env.NewNopAuditHandler()
```

---

## Audit Types

### AuditAction

Action type constants:

```go
type AuditAction = internal.Action

const (
    ActionLoad       AuditAction = "load"        // File loading
    ActionParse      AuditAction = "parse"       // Parsing operation
    ActionGet        AuditAction = "get"         // Variable reading
    ActionSet        AuditAction = "set"         // Variable setting
    ActionDelete     AuditAction = "delete"      // Variable deletion
    ActionValidate   AuditAction = "validate"    // Validation operation
    ActionExpand     AuditAction = "expand"      // Variable expansion
    ActionSecurity   AuditAction = "security"    // Security event
    ActionError      AuditAction = "error"       // Error event
    ActionFileAccess AuditAction = "file_access" // File access
)
```

The ten action constants map to these operations:

| Constant | Operation |
|----------|-----------|
| `ActionLoad` | File loading |
| `ActionParse` | Parsing |
| `ActionGet` | Variable reads |
| `ActionSet` | Variable writes |
| `ActionDelete` | Variable deletion |
| `ActionValidate` | Key and value validation |
| `ActionExpand` | Variable expansion |
| `ActionSecurity` | Security events |
| `ActionError` | Error events |
| `ActionFileAccess` | Path access checks |

---

### AuditEvent

The struct passed to every `AuditHandler`:

```go
type AuditEvent = internal.Event
```

**Fields (qualified names):**

| Field | Type | Description |
|-------|------|-------------|
| `AuditEvent.Timestamp` | `time.Time` | Event timestamp |
| `AuditEvent.Action` | `AuditAction` | Action type |
| `AuditEvent.Key` | `string` | Key name (sensitive keys masked) |
| `AuditEvent.File` | `string` | Related file name |
| `AuditEvent.Reason` | `string` | Reason or description |
| `AuditEvent.Success` | `bool` | Whether the operation succeeded |
| `AuditEvent.Masked` | `bool` | Whether the key was masked |
| `AuditEvent.Details` | `string` | Reserved free-form context; the built-in auditor leaves it empty |
| `AuditEvent.Duration` | `int64` | Duration in nanoseconds |

---

## ComponentFactory

Component factory that owns the components shared by a Loader and its parsers:

```go
type ComponentFactory struct {
    // Contains private fields
}
```

### Methods

```go
func (f *ComponentFactory) Validator() Validator
func (f *ComponentFactory) Auditor() FullAuditLogger
func (f *ComponentFactory) Expander() VariableExpander
func (f *ComponentFactory) Close() error
func (f *ComponentFactory) IsClosed() bool
```

**Use case:** loader internals and custom parsers. `New()` creates the factory and wires its lifecycle to `Loader.Close()`. See [ComponentFactory API](./factory).

---

## Complete Example

### Implementing a Custom Audit Handler

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

// Custom audit handler
type CustomAuditHandler struct {
	events []env.AuditEvent
}

func (h *CustomAuditHandler) Log(event env.AuditEvent) error {
	h.events = append(h.events, event)
	return nil
}

func (h *CustomAuditHandler) Close() error {
	return nil
}

func main() {
	cfg := env.ProductionConfig()
	cfg.AuditEnabled = true
	handler := &CustomAuditHandler{}
	cfg.AuditHandler = handler

	loader, _ := env.New(cfg)
	defer loader.Close()
	// Use loader...

	// View audit events
	for _, event := range handler.events {
		fmt.Printf("%s: %s - %s\n", event.Action, event.Key, event.Reason)
	}
}
```

### Using Fine-grained Interfaces

Each function below accepts only the capability it needs, so any `*Loader` passes without exposing the rest of the API:

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

// Needs only the read capability
func printConfig(getter env.EnvGetter) {
	for _, key := range getter.Keys() {
		value, _ := getter.Lookup(key)
		fmt.Printf("%s = %s\n", key, value)
	}
}

// Needs only the write capability
func setDefaults(setter env.EnvSetter) error {
	return setter.Set("DEFAULT_KEY", "default_value")
}

// Needs only the load capability
func loadConfig(loader env.EnvFileLoader) error {
	return loader.LoadFiles(".env")
}

func main() {
	cfg := env.DefaultConfig()
	loader, _ := env.New(cfg)
	defer loader.Close()

	// Use fine-grained interfaces
	loadConfig(loader)
	setDefaults(loader)
	printConfig(loader)
}
```

## Related Documentation

- [Loader API](./loader) - Loader instance methods
- [ComponentFactory API](./factory) - Component factory
- [Custom Parser](../guides/custom-parser) - Guide to custom parsers
