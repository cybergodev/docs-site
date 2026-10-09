---
sidebar_label: "Interfaces"
title: "Interfaces - CyberGo env | Core Interface Hierarchy"
description: "Core interface definitions for CyberGo env: EnvLoader composite plus EnvFileLoader, EnvGetter, EnvSetter, Validator, and EnvParser sub-interfaces for DI."
sidebar_position: 6
---

# Interfaces

The env library uses a fine-grained interface design, supporting dependency injection and flexible composition.

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

**Use case:** Scenarios that only need file loading capability.

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

**Use case:** Read-only configuration access (minimal interface).

```go
func readConfig(getter env.EnvGetter) {
    host := getter.GetString("HOST", "localhost")
    value, exists := getter.Lookup("API_KEY")
    keys := getter.Keys()
}
```

:::warning
`GetInt`, `GetBool`, `GetUint64`, `GetFloat64`, `GetDuration`, `GetSecure`, `Len` are **not** part of the `EnvGetter` interface.
These methods are implemented on the `*Loader` type but are not in the minimal interface.

For full read capabilities, use the `*Loader` type directly:

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

**Use case:** Scenarios that only need set/delete capability.

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

Apply to system environment interface:

```go
type EnvApplicator interface {
    Apply() error
}
```

**Use case:** Applying loaded variables to `os.Environ`.

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

**Use case:** Releasing loader resources.

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
`Validator` provides the `ValidateRequired` method by embedding `RequiredValidator`. A custom validator that only implements `KeyValidator` will return `ErrValidateRequiredUnsupported` when `ValidateRequired` is called.
:::

---

### RequiredValidator

Required key validation interface:

```go
type RequiredValidator interface {
    ValidateRequired(keys map[string]bool) error
}
```

Validates that all required keys exist.

---

### KeyValidator

Key validation interface:

```go
type KeyValidator interface {
    ValidateKey(key string) error
}
```

Validates whether a key name conforms to rules (length, format, forbidden keys, etc.).

---

### ValueValidator

Value validation interface:

```go
type ValueValidator interface {
    ValidateValue(value string) error
}
```

Validates whether a value is safe (no null bytes, control characters, etc.).

---

## Audit Interfaces

### AuditLogger

Minimal audit logging interface (alias of `internal.AuditLogger`):

```go
type AuditLogger interface {
    LogError(action AuditAction, key, errMsg string) error
}
```

**Use case:** Minimal interface for implementing custom audit loggers. For full audit capability, use `FullAuditLogger`.

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

**Use case:** Full audit logging capability. `ComponentFactory.Auditor()` returns this interface.

**Method descriptions:**

| Method | Purpose |
|--------|---------|
| LogError | Log error events (inherited from AuditLogger) |
| `Log` | Log general audit events |
| `LogWithFile` | Log events including file information |
| `LogWithDuration` | Log events including duration |
| `Close` | Close the audit log |

---

### AuditHandler

Audit handler interface (for Config.AuditHandler configuration):

```go
type AuditHandler interface {
    Log(event AuditEvent) error
    Close() error
}
```

**Use case:** Implement this interface to customize how audit events are processed. Unlike the `AuditLogger` interface, `AuditHandler` requires both `Log` and `Close` methods, used for receiving processed audit events and releasing resources.

**Built-in implementations:**
- `JSONAuditHandler` - outputs JSON format logs
- `LogAuditHandler` - outputs using the standard log package
- `ChannelAuditHandler` - sends to a channel
- `CloseableChannelHandler` - closeable handler with its own buffered channel
- `NopAuditHandler` - no-op handler

---

## Variable Expansion Interface

### VariableExpander

Variable expansion interface:

```go
type VariableExpander interface {
    Expand(s string) (string, error)
}
```

**Use case:** Custom variable expansion logic, supporting `${VAR}`, `${VAR:-default}` and other syntaxes.

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

**Use case:** Custom file format parser.

---

## Storage Interface

### EnvStorage

Environment variable storage interface:

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

**Use case:** Custom storage backend.

**Method descriptions:**

| Method | Purpose |
|--------|---------|
| `Get` | Get value, returns value and whether it exists |
| `Set` | Set key-value pair |
| `Delete` | Delete key |
| `Keys` | Return all key names |
| `Len` | Return key-value pair count |
| `ToMap` | Return a copy of all key-value pairs |
| `Clear` | Clear all data |

---

## Serialization Interfaces

### Marshaler

Custom serialization interface:

```go
type Marshaler interface {
    MarshalEnv() ([]byte, error)
}
```

**Use case:** Serialization of custom types.

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

**Use case:** Deserialization of custom types.

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

**Use case:** Mocking a filesystem during testing.

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

File interface:

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
| Close | Close file |
| Stat | Get file info |
| Sync | Sync to disk |

---

### DefaultFileSystem

Default filesystem implementation:

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Uses the real OS filesystem and environment variables:

```go
cfg := env.DefaultConfig()
cfg.FileSystem = env.DefaultFileSystem  // default value
```

---

## Audit Handlers

### JSONAuditHandler

Outputs JSON format audit logs:

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

**Parameters:**
- `w` - output target (e.g., `os.Stdout`, a file)

```go
handler := env.NewJSONAuditHandler(os.Stdout)
```

**Output example:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","key":"API_KEY","success":true}
```

---

### LogAuditHandler

Outputs using the standard log package:

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

**Parameters:**
- `logger` - standard log.Logger instance

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
handler := env.NewLogAuditHandler(logger)
```

**Output example:**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success
```

---

### ChannelAuditHandler

Sends to a channel:

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

**Parameters:**
- `ch` - audit event channel

:::warning
`ChannelAuditHandler` does **not own** the channel, and `Close()` will **not** close the underlying channel. The caller must close the channel themselves to signal the receiver to stop. Additionally, when the channel buffer is full, `Log()` will block — a buffered channel is recommended. For automatic channel lifecycle management, use [NewCloseableChannelHandler](/en/env/api-reference/factory#newcloseablechannelhandler).
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

No-op handler (discards all events):

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

---

### AuditEvent

Audit event structure:

```go
type AuditEvent = internal.Event
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| Timestamp | `time.Time` | Timestamp |
| Action | `AuditAction` | Action type |
| Key | `string` | Key name (masked) |
| File | `string` | File name |
| Reason | `string` | Reason/description |
| Success | `bool` | Whether successful |
| Masked | `bool` | Whether masked |
| Details | `string` | Details |
| Duration | `int64` | Duration (nanoseconds) |

---

## ComponentFactory

Component factory, managing shared components:

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

**Use case:** Internal use, automatically managed when creating a Loader. See [ComponentFactory API](/en/env/api-reference/factory).

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

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

// Only needs read capability
func printConfig(getter env.EnvGetter) {
	for _, key := range getter.Keys() {
		value, _ := getter.Lookup(key)
		fmt.Printf("%s = %s\n", key, value)
	}
}

// Only needs write capability
func setDefaults(setter env.EnvSetter) error {
	return setter.Set("DEFAULT_KEY", "default_value")
}

// Only needs load capability
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

- [Loader API](/en/env/api-reference/loader) - Loader instance methods
- [ComponentFactory API](/en/env/api-reference/factory) - Component factory
- [Custom Parser](/en/env/guides/custom-parser) - Custom parser guide
