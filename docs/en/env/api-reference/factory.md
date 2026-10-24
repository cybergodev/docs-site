---
sidebar_label: "Component Factory"
title: "ComponentFactory API - CyberGo env | Component Factory"
description: "CyberGo env ComponentFactory API reference: creates Validator, Auditor, FileSystem and Expander components; registers custom parsers; manages Close lifecycle."
sidebar_position: 8
---

# ComponentFactory API

`ComponentFactory` creates and owns the components a Loader and its parsers share — the validator, the auditor, and the variable expander — so all of them see one consistent set of rules.

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

**Thread safety:** every method is safe to call from multiple goroutines.

---

## Methods

`ComponentFactory` provides five methods (qualified names like `ComponentFactory.Validator`):

| Method | Returns | Description |
|--------|---------|-------------|
| `ComponentFactory.Validator` | `Validator` | Shared key/value validator |
| `ComponentFactory.Auditor` | `FullAuditLogger` | Shared audit logger |
| `ComponentFactory.Expander` | `VariableExpander` | Shared variable expander |
| `ComponentFactory.Close` | `error` | Release resources (idempotent; repeated calls return nil) |
| `ComponentFactory.IsClosed` | `bool` | Whether the factory has been closed |

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

Returns the shared validator, which checks key names and values.

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

Returns the shared audit logger.

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

Returns the shared variable expander, which resolves `${VAR}` references.

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

Releases the resources the factory holds. Once closed, neither the factory nor the components created through it are usable.

**Behavior:**
- Safe to call repeatedly; every call returns nil
- Releases auditor resources
- Uses atomic operations for thread safety

```go
// Managed by the Loader; you rarely call this directly
loader, _ := env.New(cfg)
defer loader.Close()  // Automatically closes ComponentFactory
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

Reports whether the factory has been closed.

```go
if factory.IsClosed() {
    // factory has been closed, cannot be used
}
```

---

## Creation

### Automatic Creation (Recommended)

`New()` creates the ComponentFactory and ties its lifetime to the loader.

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// ComponentFactory is automatically created inside the Loader
defer loader.Close()  // Automatically closes the factory
```

### Using in a Custom Parser

A custom parser receives the ComponentFactory as a factory argument. Use it to obtain the validator and auditor:

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
- Every `New(cfg)` call builds a fresh ComponentFactory owned by that loader and closed by its `Close()`. The objects behind `ComponentConfig.CustomValidator` / `CustomAuditor` / `CustomExpander` are shared across loaders and must be safe for concurrent use.
- After `Close()`, do not use any component created through that factory.
- The factory is thread-safe, so concurrent access is allowed.
:::

---

## Audit Handler Factories

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

Creates an audit handler that writes one JSON object per event.

**Parameters:**
- `w` - output target (e.g. `os.Stdout`, a file)

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

Creates an audit handler that writes through a `log.Logger`.

**Parameters:**
- `logger` - the `log.Logger` to write through

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Output example:**
```text
[AUDIT] 2024/01/15 10:30:00 action=load key=API_KEY success=true reason="loaded" file=.env duration=1.23ms
```

Events are emitted as key-value pairs: `action`, `key`, `success`, and the quoted `reason`, plus optional `file` and `duration`. The `key` pair is omitted when the event has no key, and durations below 1ms are shown in μs, longer ones in ms.

The `[AUDIT]` prefix and the timestamp come from the `log.Logger` you pass in.

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

Creates an audit handler that hands events to a channel you own, for asynchronous processing.

**Parameters:**
- `ch` - channel that receives the events

:::warning Channel ownership
`ChannelAuditHandler` does **not own** the channel, and `Close()` does **not** close it. The caller must close the channel to signal the receiver to stop. `Log()` blocks when the channel buffer is full, so pass a buffered channel.
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

Creates a handler that discards every event. Use it to keep `AuditEnabled` semantics while silencing output.

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // Logs nothing
```

---

### NewCloseableChannelHandler

```go
func NewCloseableChannelHandler(bufferSize int) *CloseableChannelHandler
```

Creates a closeable audit handler that owns its buffered channel. Unlike `ChannelAuditHandler`, which takes an external channel, `CloseableChannelHandler` creates the channel itself, and `Close()` shuts down the handler and closes that channel. Receive events with `Channel()`.

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

`CloseableChannelHandler` implements the `AuditHandler` interface (`CloseableChannelHandler.Log` / `CloseableChannelHandler.Close`) and adds three methods:

```go
func (h *CloseableChannelHandler) Channel() <-chan AuditEvent
func (h *CloseableChannelHandler) DroppedEvents() int64
func (h *CloseableChannelHandler) IsClosed() bool
```

**Method description:**

| Method | Purpose |
|--------|---------|
| `CloseableChannelHandler.Log` | Sends an event. On a full buffered channel the send is **non-blocking**: the event is dropped and an error returned. An unbuffered channel (capacity 0) blocks until a receiver is ready or the handler closes. |
| `CloseableChannelHandler.Close` | Shuts the handler down and closes its owned channel, so `range` consumer loops exit. Safe to call repeatedly. |
| `CloseableChannelHandler.Channel` | Returns the internal read-only channel for consuming audit events |
| `CloseableChannelHandler.IsClosed` | Whether the handler has been closed (thread-safe; safe to call concurrently) |
| `CloseableChannelHandler.DroppedEvents` | Cumulative count of dropped events: full-buffer drops plus sends attempted after `Close`. The counter never resets. |

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

**Mapping to the standard library:** `OSFileSystem.Open`, `OSFileSystem.OpenFile`, `OSFileSystem.Stat`, `OSFileSystem.MkdirAll`, `OSFileSystem.Remove`, and `OSFileSystem.Rename` each forward to the same-named `os` package call.

`OSFileSystem.Getenv`, `OSFileSystem.Setenv`, `OSFileSystem.Unsetenv`, and `OSFileSystem.LookupEnv` forward to the matching process-environment calls.

The library itself calls only `Open`, `LookupEnv`, `Setenv`, and `Unsetenv`. Size and stat checks go through `File.Stat` on the handle returned by `Open`. The zero value is valid and safe for concurrent use.

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Global default filesystem instance. It is the package-level variable holding `OSFileSystem{}`. `Config.FileSystem` uses it when you do not set a filesystem explicitly.

---

### Using a Custom Filesystem

A mock lets you test without touching disk. This one keeps file contents and environment variables in maps:

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

Detects the format from the file extension.

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

The check uses `filepath.Ext`, lowercased, so `.ENV` also yields `FormatEnv`. `.env.local` and `unknown.txt` return `FormatAuto`, which falls back to the `.env` parser at load time.

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
// Each file's format is detected and its matching parser is used
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

Returns the format's name as a string: `"auto"`, `"dotenv"`, `"json"`, or `"yaml"`. Any value outside those four returns `"unknown"`.

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

Registers a parser for a custom format.

**Parameters:**
- `format` - the format's constant
- `factory` - the factory that creates parsers for it

**Returns:**
- `error` - registration error

**Error cases:**
- `format` is one of the built-in formats (`FormatEnv`, `FormatJSON`, `FormatYAML`). Use `ForceRegisterParser` if you must override one.
- `format` is already registered
- `factory` is nil

**Notes:**
- The registry is process-global and is snapshotted when a `Loader` is constructed, so register before calling `env.New()`.
- Use format values of 100 or above to avoid conflicts with built-in formats.
- The factory function must return a thread-safe parser.

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

Force-registers a parser, overriding any existing registration, including the built-in parsers.

**Parameters:**
- `format` - the format's constant
- `factory` - the factory that creates parsers for it

**Returns:**
- `error` - an error only when `factory` is nil

:::danger
Overriding a built-in parser drops its security checks unless your replacement implements the same ones: key validation, value validation, size limits, and so on.

Reasonable uses:
- Adding custom security checks to a built-in parser
- Implementing format extensions (e.g. HEREDOC, multi-line values)
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

Function signature for a parser factory.

**Parameters:**
- `cfg` - configuration, carrying the limits and security settings
- `factory` - component factory, from which the parser obtains its validator and auditor

**Returns:**
- `EnvParser` - the parser instance
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

The library ships three format parsers.

### DotEnv Parser

Parses the `.env` format:

- `KEY=value` syntax
- `export KEY=value` syntax (when `AllowExportPrefix` is true, the default)
- Single-quoted `'value'` and double-quoted `"value"`
- Variable expansion `${VAR}` and `${VAR:-default}` (when `ExpandVariables` is true, the default)
- Comments `#`
- `KEY: value` lines, only when `AllowYamlSyntax` is true

### JSON Parser

Parses JSON:

- Key-value object pairs
- Nested structures, flattened
- Number, string, and boolean conversion
- Arrays, flattened to `KEY_0`, `KEY_1`, ...

### YAML Parser

Parses YAML:

- Key-value pairs
- Nested structures, flattened
- Multiple scalar types
- Lists, flattened to indexed keys

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
