---
sidebar_label: "Component Factory"
title: "ComponentFactory API - CyberGo env | Component Factory"
description: "CyberGo env ComponentFactory API reference: creates Validator, Auditor, FileSystem and Expander components; registers custom parsers; manages Close lifecycle."
sidebar_position: 8
---

# ComponentFactory API

`ComponentFactory` creates and manages components shared between Loader and Parser, providing clear lifecycle management.

## Type Definition

```go
type ComponentFactory struct {
    // Contains private fields
}
```

**Core responsibilities:**
- Create shared validators, auditors, and variable expanders
- Manage component lifecycle
- Support custom parser access to internal components

**Thread safety:** All methods of ComponentFactory are thread-safe.

---

## Methods

`ComponentFactory` provides five methods (qualified names like `ComponentFactory.Validator`):

| Method | Returns | Description |
|--------|---------|-------------|
| `ComponentFactory.Validator` | `Validator` | Shared key/value validator |
| `ComponentFactory.Auditor` | `FullAuditLogger` | Shared audit logger |
| `ComponentFactory.Expander` | `VariableExpander` | Shared variable expander |
| `ComponentFactory.Close` | `error` | Release resources (idempotent, safe to call repeatedly) |
| `ComponentFactory.IsClosed` | `bool` | Whether the factory has been closed |

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

Returns the validator component, used for key name and value validation.

```go
// Use in a custom parser
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // invalid key name
}

if err := validator.ValidateValue("some value"); err != nil {
    // value contains illegal content (e.g., null bytes, control characters)
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

Returns the audit logging component, providing full audit logging capabilities.

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

Returns the variable expander component, used for `${VAR}` syntax variable expansion.

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

Releases resources held by the factory. After closing, the factory and components created through it should not be used anymore.

**Behavior:**
- Safe to close, multiple calls return nil
- Releases auditor resources
- Uses atomic operations to ensure thread safety

```go
// Usually managed automatically by the Loader
loader, _ := env.New(cfg)
defer loader.Close()  // Automatically closes ComponentFactory
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

Checks whether the factory has been closed.

```go
if factory.IsClosed() {
    // factory has been closed, cannot be used
}
```

---

## Creation

### Automatic Creation (Recommended)

ComponentFactory is automatically created and managed when a Loader is created:

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// ComponentFactory is automatically created inside the Loader
defer loader.Close()  // Automatically closes the factory
```

### Using in a Custom Parser

When registering a custom parser, use ComponentFactory to get the validator and auditor:

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
Config created
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
      Close() releases
```

:::warning
- Each Loader typically has its own ComponentFactory
- After calling Close(), all components created through that factory should not be used anymore
- The factory is thread-safe and can be accessed concurrently
:::

---

## Audit Handler Factories

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

Creates a JSON-format audit handler that outputs structured logs.

**Parameters:**
- `w` - output target (e.g., `os.Stdout`, a file)

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Output example:**
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
- `logger` - standard log.Logger instance

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Output example:**
```text
[AUDIT] 2024/01/15 10:30:00 action=load key=API_KEY success=true reason="loaded" file=.env duration=1.23ms
```

Events are emitted as key-value pairs — `action`, `key` (omitted when the event has no key), `success`, `reason` (quoted), plus optional `file` and `duration` (below 1ms shown in μs, otherwise in ms); the `[AUDIT]` prefix and timestamp come from the `log.Logger` you pass in.

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

Creates a channel audit handler for asynchronous processing of audit events.

**Parameters:**
- `ch` - audit event channel

:::warning Channel ownership
`ChannelAuditHandler` does **not own** the channel, and `Close()` will **not** close the underlying channel. The caller must close the channel themselves to signal the receiver to stop. Additionally, when the channel buffer is full, `Log()` will block — a buffered channel is recommended.
:::

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
cfg.AuditHandler = env.NewNopAuditHandler() // Logs nothing
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

Creates a closeable audit handler that owns its own buffered channel. Unlike `ChannelAuditHandler` which accepts an external channel, `CloseableChannelHandler` creates and owns its own buffered channel. Calling `Close()` closes the handler and the channel. Use `Channel()` to receive events.

**Parameters:**
- `bufferSize` - buffered channel size (negative values are treated as 0)

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

`CloseableChannelHandler` implements the `AuditHandler` interface (`CloseableChannelHandler.Log` / `CloseableChannelHandler.Close`) and provides the following additional methods:

```go
func (h *CloseableChannelHandler) Channel() <-chan AuditEvent
func (h *CloseableChannelHandler) DroppedEvents() int64
func (h *CloseableChannelHandler) IsClosed() bool
```

**Method description:**

| Method | Purpose |
|--------|---------|
| `CloseableChannelHandler.Log` | Sends an event: **non-blocking with a drop** (and an error) when the buffered channel is full; unbuffered (capacity 0) sends block until a receiver is ready or the handler closes |
| `CloseableChannelHandler.Close` | Shuts the handler down and closes its owned channel (`range` consumer loops exit accordingly); safe to call repeatedly |
| `CloseableChannelHandler.Channel` | Returns the internal read-only channel for consuming audit events |
| `CloseableChannelHandler.IsClosed` | Checks whether the handler has been closed (thread-safe, can be called concurrently) |
| `CloseableChannelHandler.DroppedEvents` | Returns the cumulative count of dropped events (full-buffer drops or sends attempted after Close); the counter never resets |

```go
handler := env.NewCloseableChannelHandler(64)
defer handler.Close()

// Can check status before closing
if !handler.IsClosed() {
    // handler is still available
}

// Consume events until the channel is closed
go func() {
    for event := range handler.Channel() {
        fmt.Printf("Audit: %+v\n", event)
    }
    // After handler.Close(), the channel is closed and the loop exits
}()
```

---

## File System

### OSFileSystem

The default filesystem implementation, wrapping OS file operations:

```go
type OSFileSystem struct{}
```

**Implements interface:** `FileSystem`

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

**Mapping to the standard library:** `OSFileSystem.Open`, `OSFileSystem.OpenFile`, `OSFileSystem.Stat`, `OSFileSystem.MkdirAll`, `OSFileSystem.Remove`, and `OSFileSystem.Rename` each forward to the same-named call in the os package; `OSFileSystem.Getenv`, `OSFileSystem.Setenv`, `OSFileSystem.Unsetenv`, and `OSFileSystem.LookupEnv` forward to process environment variable operations. The zero value is valid and safe for concurrent use.

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Global default filesystem instance. `DefaultFileSystem` is a package-level exported variable holding `OSFileSystem{}`; it is what the `FileSystem` field that `Config` provides by embedding `ComponentConfig` uses when not explicitly set.

---

### Using a Custom Filesystem

Mock a filesystem in tests:

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
- `filename` - file name or path

**Returns:**
- `FileFormat` - detected format

**Detection rules:**

| Extension | Returned Format |
|-----------|-----------------|
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

**Used in LoadFiles:**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// Auto-detects each file's format and uses the corresponding parser
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

**Custom formats:**

```go
// Define custom format constants (recommend using values of 100+ to avoid conflicts)
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

Returns the string representation of a format (`FileFormat.String`).

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
- `format` - file format constant
- `factory` - parser factory function

**Returns:**
- `error` - returns error on registration failure

**Error cases:**
- Built-in formats (FormatEnv, FormatJSON, FormatYAML) cannot be overridden
- Format already registered
- `factory` is nil

**Notes:**
- Must be registered before calling `env.New()`
- Recommend using format values of 100+ to avoid conflicts with built-in formats
- The factory function should return a thread-safe parser

```go
package main

import (
	"io"

	"github.com/cybergodev/env"
)

// 1. Define custom format constant
const FormatTOML env.FileFormat = 100

// 2. Implement the parser interface
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

// 3. Register the parser (register in init() to ensure it's done before use)
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

// 4. Use the custom format
func main() {
	// Registration is done in init() (executes before main)
	loader, _ := env.New(env.DefaultConfig())
	defer loader.Close()

	// Now you can load .toml files
	loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

Force-registers a parser, allowing overriding of built-in parsers.

**Parameters:**
- `format` - file format constant
- `factory` - parser factory function

**Returns:**
- `error` - returns error on registration failure (when `factory` is nil)

:::danger
Use with caution. Overriding built-in parsers may introduce security vulnerabilities if the replacement parser does not implement the same security checks (key validation, value validation, size limits, etc.).

Suitable for the following advanced scenarios:
- Adding custom security checks to built-in parsers
- Implementing format extensions (e.g., HEREDOC, multi-line values)
- Testing with mock parsers
:::

```go
// Override the default .env parser (advanced use)
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
- `cfg` - configuration object containing limits and security settings
- `factory` - component factory, can get validator and auditor

**Returns:**
- `EnvParser` - parser instance
- `error` - creation error

---

### EnvParser Interface

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

Interface that parsers must implement.

**Parameters:**
- `r` - file content reader
- `filename` - file name (for error messages)

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

---

## Built-in Parsers

The library has three built-in format parsers:

### DotEnv Parser

`.env` format parser, supporting:
- `KEY=value` syntax
- `export KEY=value` syntax
- Single quotes `'value'` and double quotes `"value"`
- Variable expansion `${VAR}` and `${VAR:-default}`
- Comments `#`

### JSON Parser

JSON format parser, supporting:
- Key-value object pairs
- Nested structures (flattened)
- Number, string, boolean conversion
- Arrays (flattened to `KEY_0`, `KEY_1`...)

### YAML Parser

YAML format parser, supporting:
- Key-value pairs
- Nested structures (flattened)
- Multiple scalar types
- Lists (flattened to indexed keys)

---

## Complete Example

### Register a Custom Parser

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

	// Now you can load .ini files
	// loader.LoadFiles("config.ini")

	fmt.Println("INI parser registered")
}
```

### Custom Filesystem

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

// In-memory filesystem (for testing)
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
	// Create in-memory filesystem
	fs := NewMemoryFileSystem()
	fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

	// Configure to use custom filesystem
	cfg := env.TestingConfig()
	cfg.FileSystem = fs

	loader, _ := env.New(cfg)
	defer loader.Close()

	loader.LoadFiles(".env")

	fmt.Println(loader.GetString("APP_NAME")) // myapp
	fmt.Println(loader.GetInt("PORT"))        // 8080
}
```

---

## Related Documentation

- [Interfaces](./interfaces) - All interface definitions
- [Custom Parser](../guides/custom-parser) - Custom parser guide
- [Testing](../guides/testing) - Testing with custom filesystem
