---
sidebar_label: "Component Factory"
title: "ComponentFactory API - CyberGo env | Component Factory"
description: "CyberGo env ComponentFactory API: creates Validator, Auditor, FileSystem adapter, expander; registers custom parsers; Close lifecycle management."
sidebar_position: 8
---

# ComponentFactory API

`ComponentFactory` creates and manages shared components for Loader and Parser, providing clear lifecycle management.

## Type Definition

```go
type ComponentFactory struct {
    // Contains private fields
}
```

**Core Responsibilities:**
- Creates shared validators, auditors, and variable expanders
- Manages component lifecycle
- Supports custom parsers accessing internal components

**Thread Safety:** All ComponentFactory methods are thread-safe.

---

## Methods

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

Returns the validator component for key name and value validation.

```go
// Use in custom parser
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // Invalid key
}

if err := validator.ValidateValue("some value"); err != nil {
    // Value contains illegal content (e.g., null bytes, control characters)
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

Returns the audit logging component, providing complete audit logging functionality.

```go
auditor := factory.Auditor()
_ = auditor.Log(env.ActionSet, "KEY", "value set", true)
_ = auditor.LogError(env.ActionSet, "KEY", "validation failed")
_ = auditor.LogWithFile(env.ActionLoad, "KEY", ".env", "loaded", true)
_ = auditor.LogWithDuration(env.ActionParse, "", "parsed", true, time.Since(start))
```

---

### Expander

```go
func (f *ComponentFactory) Expander() VariableExpander
```

Returns the variable expander component for `${VAR}` syntax variable expansion.

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

Releases resources held by the factory. After closing, the factory and components created through it should not be used.

**Behavior:**
- Safe close; multiple calls return nil
- Releases auditor resources
- Uses atomic operations to ensure thread safety

```go
// Usually managed automatically by Loader
loader, _ := env.New(cfg)
defer loader.Close()  // Auto-close ComponentFactory
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

Checks whether the factory is closed.

```go
if factory.IsClosed() {
    // Factory is closed, unusable
}
```

---

## Creation Methods

### Automatic Creation (Recommended)

Loader automatically creates and manages ComponentFactory during creation:

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// Loader internally auto-creates ComponentFactory
defer loader.Close()  // Auto-close factory
```

### Using in Custom Parsers

When registering custom parsers, get validator and auditor through ComponentFactory:

```go
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func newCustomParser(cfg env.Config, factory *env.ComponentFactory) *CustomParser {
    return &CustomParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }
}

// Define custom format constant (recommend using 100+ to avoid conflicts)
const FormatCustom env.FileFormat = 100

// Register parser
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## Lifecycle Management

```text
Config creation
     ↓
env.New(cfg)
     ↓
Auto-create ComponentFactory
     ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
Validator  Auditor  Expander
    ↓       ↓       ↓
    └───────┼───────┘
            ↓
      Loader/Parser
            ↓
      Close() release
```

:::warning Note
- Each Loader typically owns its own ComponentFactory
- After calling Close(), all components created through the factory should no longer be used
- Factory is thread-safe, supports concurrent access
:::

---

## Audit Handler Factory

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

Creates a JSON format audit handler, outputting structured logs.

**Parameters:**
- `w` - Output target (e.g., `os.Stdout`, file)

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Example Output:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

Creates a standard log format audit handler.

**Parameters:**
- `logger` - Standard log.Logger instance

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Example Output:**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

Creates a channel audit handler for asynchronous audit event processing.

**Parameters:**
- `ch` - Audit event channel

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// Process audit events asynchronously
go func() {
    for event := range ch {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

### NewNopAuditHandler

```go
func NewNopAuditHandler() *NopAuditHandler
```

Creates a no-op audit handler for disabling audit logging.

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // No logs recorded
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

Creates a closeable audit handler with its own buffered channel. Unlike `ChannelAuditHandler` which accepts an external channel, `CloseableChannelHandler` creates and owns its own buffered channel. Call `Close()` to close the handler and the channel. Use `Channel()` to receive events.

**Parameters:**
- `bufferSize` - Buffered channel size (negative values are treated as 0)

```go
handler := env.NewCloseableChannelHandler(64)
defer handler.Close()

go func() {
    for event := range handler.Channel() {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

#### CloseableChannelHandler Methods

In addition to implementing the `AuditHandler` interface (`Log` / `Close`), `CloseableChannelHandler` provides the following specific methods:

```go
func (h *CloseableChannelHandler) Channel() <-chan AuditEvent
func (h *CloseableChannelHandler) IsClosed() bool
```

**Method Descriptions:**

| Method | Signature | Purpose |
|------|------|------|
| `Channel` | `func (h *CloseableChannelHandler) Channel() <-chan AuditEvent` | Returns the internal read-only channel for consuming audit events. After `Close()` is called, this channel is closed and the `range` loop exits accordingly |
| `IsClosed` | `func (h *CloseableChannelHandler) IsClosed() bool` | Checks whether the handler has been closed (thread-safe, can be called concurrently) |

```go
handler := env.NewCloseableChannelHandler(64)
defer handler.Close()

// Check status before closing
if !handler.IsClosed() {
    // Handler is still usable
}

// Consume events until the channel closes
go func() {
    for event := range handler.Channel() {
        fmt.Printf("Audit: %+v\n", event)
    }
    // After handler.Close(), the channel closes and the loop exits
}()
```

---

## File System

### OSFileSystem

Default file system implementation, wrapping OS file operations:

```go
type OSFileSystem struct{}
```

**Implements:** `FileSystem`

```go
// Method list
func (fs OSFileSystem) Open(name string) (File, error)
func (fs OSFileSystem) OpenFile(name string, flag int, perm os.FileMode) (File, error)
func (fs OSFileSystem) Stat(name string) (os.FileInfo, error)
func (fs OSFileSystem) MkdirAll(path string, perm os.FileMode) error
func (fs OSFileSystem) Remove(name string) error
func (fs OSFileSystem) Rename(oldpath, newpath string) error
func (fs OSFileSystem) Getenv(key string) string
func (fs OSFileSystem) Setenv(key, value string) error
func (fs OSFileSystem) Unsetenv(key string) error
func (fs OSFileSystem) LookupEnv(key string) (string, bool)
```

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Global default file system instance.

---

### Using Custom File System

Mock file system in tests:

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{content: content}, nil
}

func (m *MockFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MockFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MockFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MockFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
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

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MockFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

// Usage
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

## Format Detection

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

Detects format based on file extension.

**Parameters:**
- `filename` - File name or path

**Returns:**
- `FileFormat` - Detected format

**Detection Rules:**

| Extension | Returns |
|-----------|---------|
| `.env` | `FormatEnv` |
| `.json` | `FormatJSON` |
| `.yaml`, `.yml` | `FormatYAML` |
| Other | `FormatAuto` |

```go
format := env.DetectFormat("config.json")   // FormatJSON
format := env.DetectFormat("settings.yaml") // FormatYAML
format := env.DetectFormat("app.yml")       // FormatYAML
format := env.DetectFormat(".env")          // FormatEnv
format := env.DetectFormat(".env.local")    // FormatAuto (actually processed as .env)
format := env.DetectFormat("unknown.txt")   // FormatAuto
```

**Applied in LoadFiles:**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// Auto-detect each file's format and use corresponding parser
```

---

### FileFormat Constants

```go
const (
    FormatAuto  FileFormat = iota  // Auto-detect
    FormatEnv                      // .env format
    FormatJSON                     // JSON format
    FormatYAML                     // YAML format
)
```

**Custom Formats:**

```go
// Define custom format constant (recommend using 100+ to avoid conflicts)
const (
    FormatTOML  env.FileFormat = 100
    FormatINI   env.FileFormat = 101
    FormatXML   env.FileFormat = 102
)
```

---

### FileFormat.String

```go
func (f FileFormat) String() string
```

Returns the string representation of the format.

```go
fmt.Println(env.FormatJSON.String())  // "json"
fmt.Println(env.FormatYAML.String())  // "yaml"
fmt.Println(env.FormatEnv.String())   // "dotenv"
fmt.Println(env.FormatAuto.String())  // "auto"
fmt.Println(env.FileFormat(999).String())  // "unknown"
```

---

## Parser Registration

### RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

Registers a custom format parser.

**Parameters:**
- `format` - File format constant
- `factory` - Parser factory function

**Returns:**
- `error` - Error on registration failure

**Error Cases:**
- Built-in formats (FormatEnv, FormatJSON, FormatYAML) cannot be overwritten
- Format already registered

**Notes:**
- Must be registered before calling `env.New()`
- Recommend using format values 100+ to avoid conflicts with built-in formats
- Factory function should return thread-safe parser

```go
package main

import (
    "io"

    "github.com/cybergodev/env"
)

// 1. Define custom format constant
const FormatTOML env.FileFormat = 100

// 2. Implement parser interface
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // Implement TOML parsing logic
    result := make(map[string]string)
    // ... parsing code
    return result, nil
}

// 3. Register parser in init() to ensure it runs before use
func init() {
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }
}

// 4. Use custom format
func main() {
    // Registration completed in init() (runs before main)
    loader, _ := env.New(env.DefaultConfig())
    defer loader.Close()

    // Now can load .toml files
    loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

Force-registers a parser, allowing overwrite of built-in parsers.

**Parameters:**
- `format` - File format constant
- `factory` - Parser factory function

**Returns:**
- `error` - Error on registration failure (when `factory` is nil)

:::danger Warning
Use with caution. Overwriting built-in parsers may introduce security vulnerabilities if the replacement parser does not implement the same security checks (key validation, value validation, size limits, etc.).

Suitable for the following advanced scenarios:
- Adding custom security checks to built-in parsers
- Implementing format extensions (e.g., HEREDOC, multiline values)
- Using mock parsers for testing
:::

```go
// Overwrite default .env parser (advanced use)
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
```

---

### ParserFactory Type

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

Parser factory function signature.

**Parameters:**
- `cfg` - Configuration object, containing limits and security settings
- `factory` - Component factory, can get validator and auditor

**Returns:**
- `EnvParser` - Parser instance
- `error` - Creation error

---

### EnvParser Interface

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

Interface that parsers must implement.

**Parameters:**
- `r` - File content reader
- `filename` - File name (for error messages)

**Returns:**
- `map[string]string` - Parsed key-value pairs
- `error` - Parse error

---

## Built-in Parsers

The library includes three built-in format parsers:

### DotEnv Parser

.env format parser, supports:
- `KEY=value` syntax
- `export KEY=value` syntax
- Single quotes `'value'` and double quotes `"value"`
- Variable expansion `${VAR}` and `${VAR:-default}`
- Comments `#`

### JSON Parser

JSON format parser, supports:
- Key-value pair objects
- Nested structures (flattened)
- Number, string, boolean conversion
- Arrays (flattened to `KEY_0`, `KEY_1`...)

### YAML Parser

YAML format parser, supports:
- Key-value pairs
- Nested structures (flattened)
- Multiple scalar types
- Lists (flattened to indexed keys)

---

## Complete Example

### Register Custom Parser

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// Custom INI parser
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(r)
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")
    var section string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Skip empty lines and comments
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            section = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            // Add section prefix
            if section != "" {
                key = section + "_" + key
            }

            // Validate key
            if err := p.validator.ValidateKey(key); err != nil {
                _ = p.auditor.LogError(env.ActionParse, key, err.Error())
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", fmt.Sprintf("parsed %d variables from %s", len(result), filename), true)
    return result, nil
}

func main() {
    // Define custom format
    const FormatINI env.FileFormat = 101

    // Register parser
    err := env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    // Use custom format
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // Now can load .ini files
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### Custom File System

```go
package main

import (
    "errors"
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// In-memory file system (for testing)
type MemoryFileSystem struct {
    files map[string]string
    env   map[string]string
}

func NewMemoryFileSystem() *MemoryFileSystem {
    return &MemoryFileSystem{
        files: make(map[string]string),
        env:   make(map[string]string),
    }
}

func (m *MemoryFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFile{reader: strings.NewReader(content)}, nil
}

func (m *MemoryFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MemoryFileSystem) Stat(name string) (os.FileInfo, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFileInfo{name: name, size: int64(len(content))}, nil
}

func (m *MemoryFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MemoryFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MemoryFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MemoryFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MemoryFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MemoryFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MemoryFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

// MemoryFile implements env.File
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, errors.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, errors.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo implements os.FileInfo
type MemoryFileInfo struct {
    name string
    size int64
}

func (i *MemoryFileInfo) Name() string       { return i.name }
func (i *MemoryFileInfo) Size() int64        { return i.size }
func (i *MemoryFileInfo) Mode() os.FileMode  { return 0644 }
func (i *MemoryFileInfo) ModTime() time.Time { return time.Time{} }
func (i *MemoryFileInfo) IsDir() bool        { return false }
func (i *MemoryFileInfo) Sys() interface{}   { return nil }

// Usage example
func main() {
    // Create in-memory file system
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // Configure to use custom file system
    cfg := env.TestingConfig()
    cfg.FileSystem = fs

    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.LoadFiles(".env")

    fmt.Println(loader.GetString("APP_NAME"))  // myapp
    fmt.Println(loader.GetInt("PORT"))         // 8080
}
```

---

## Related Documentation

- [Interfaces](/en/env/api-reference/interfaces) - All interface definitions
- [Custom Parser](/en/env/guides/custom-parser) - Custom parser guide
- [Testing Scenarios](/en/env/guides/testing) - Testing with custom file system
