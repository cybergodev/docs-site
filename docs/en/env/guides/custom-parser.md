---
sidebar_label: "Custom Parser"
title: "Custom Parser - CyberGo env | Extending File Formats"
description: "CyberGo env custom parser: implement EnvParser.Parse, register via RegisterParser, get Validator/Auditor from ComponentFactory; TOML/INI examples included."
sidebar_position: 7
---

# Custom Parser

This guide covers how to create and register custom file format parsers to extend the configuration formats supported by the env library.

## Parser Interface

### EnvParser

All parsers must implement this interface:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**Parameters:**
- `r` - File content reader
- `filename` - File name (for error messages)

**Returns:**
- `map[string]string` - Parsed key-value pairs
- `error` - Parse error

---

## Creating a Custom Parser

### Basic Structure

```go
package myparser

import (
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// Custom parser
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

// Implement the EnvParser interface
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // 1. Read content (note size limit)
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize))
    if err != nil {
        return nil, err
    }

    // 2. Parse content into key-value pairs
    for _, line := range strings.Split(string(content), "\n") {
        line = strings.TrimSpace(line)
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }
        idx := strings.Index(line, "=")
        if idx <= 0 {
            continue
        }
        result[strings.TrimSpace(line[:idx])] = strings.TrimSpace(line[idx+1:])
    }

    // 3. Validate results
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, err
        }
    }

    // 4. Return results
    return result, nil
}
```

### TOML Parser Example

```go
package tomlparser

import (
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// TOMLParser parses TOML format
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // Limit read size
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        return nil, fmt.Errorf("file exceeds size limit")
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Skip empty lines and comments
        if line == "" || strings.HasPrefix(line, "#") {
            continue
        }

        // Parse section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // Parse key = value
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 {
            continue // or return error
        }

        key := strings.TrimSpace(parts[0])
        value := strings.TrimSpace(parts[1])

        // Add section prefix
        if currentSection != "" {
            key = currentSection + "_" + key
        }

        // Remove quotes
        value = strings.Trim(value, "\"'")

        // Convert to uppercase
        key = strings.ToUpper(key)

        // Validate key
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.LogError(env.ActionParse, key, err.Error())
            return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
        }

        result[key] = value
    }

    // Check variable count
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed TOML: "+filename, true, time.Since(start))
    return result, nil
}
```

### INI Parser Example

```go
package iniparser

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// INIParser parses INI format
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")

    var currentSection string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Skip empty lines and comments
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            currentSection = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            if currentSection != "" {
                key = currentSection + "_" + key
            }

            // Validate
            if err := p.validator.ValidateKey(strings.ToUpper(key)); err != nil {
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    return result, nil
}
```

---

## Registering a Parser

### ParserFactory Type

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

The factory function receives a Config and ComponentFactory, and returns a parser instance.

**Parameter descriptions:**
- `cfg` - Configuration object with all limits and security settings
- `factory` - Component factory for obtaining Validator, Auditor, and other components

### RegisterParser Function

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

Register a custom format parser.

**Parameters:**
- `format` - File format constant (use values 100+ to avoid conflicts)
- `factory` - Parser factory function

**Returns:**
- `error` - Error if registration fails

**Error conditions:**
- Built-in formats (FormatEnv, FormatJSON, FormatYAML) cannot be overridden
- Format already registered

**Notes:**
- Must be registered before calling `env.New()`
- Registration in an `init()` function is recommended

### Using ComponentFactory

Obtain the validator and auditor through ComponentFactory:

```go
type SecureParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func NewSecureParser(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &SecureParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
}

func (p *SecureParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... parsing logic

    // Use validator to validate key names
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            _ = p.auditor.Log(env.ActionParse, key, "invalid key", false)
            return nil, err
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", "parse completed", true)
    return result, nil
}
```

### Complete Registration Example

<!-- check-code: skip -->
```go
package main

import (
    "github.com/cybergodev/env"
)

// 1. Define format constants (use values 100+ recommended)
const (
    FormatTOML env.FileFormat = 100
    FormatINI  env.FileFormat = 101
    FormatXML  env.FileFormat = 102
)

// 2. Register in init
func init() {
    // Register TOML parser
    err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // Format already registered or other error
    }

    // Register INI parser
    env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // Registration must complete before New (done in init).
    //
    // Important limitation: LoadFiles does not auto-route to the TOMLParser
    // above based on the .toml extension — DetectFormat only recognizes
    // .env/.json/.yaml/.yml; any other extension falls back to the built-in
    // dotenv parser (see DetectFormat in format.go). To actually invoke
    // TOMLParser via LoadFiles, use ForceRegisterParser to override
    // FormatEnv and name the file *.env:
    err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // The file extension must be .env (with TOML content) to be routed to the overridden parser
    if err := loader.LoadFiles("config.env"); err != nil {
        panic(err)
    }
}
```

::: warning LoadFiles routing limitation
Custom format numbers registered via `RegisterParser` (e.g., `FormatTOML = 100`) **are not recognized by `LoadFiles` based on file extension**. Internally, `LoadFiles` calls `DetectFormat(filename)` to pick the parser, and `DetectFormat` only recognizes the four extensions `.env` / `.json` / `.yaml` / `.yml`; any other extension returns `FormatAuto`, which ultimately falls back to the built-in dotenv parser — the custom parser is never invoked.

Two paths to load a custom format file:

1. **`.env` extension + `ForceRegisterParser`** (recommended): name the custom-format file `*.env` and use `env.ForceRegisterParser(env.FormatEnv, ...)` to override the built-in dotenv parser. Be sure to preserve key/value/size security checks, otherwise you will introduce security holes.
2. **Call the parser manually**: read the file into an `io.Reader`, construct the parser instance yourself, and call `parser.Parse(reader, filename)` to obtain a `map[string]string`, then write the entries one by one via `loader.Set`. Note that the parser's internal `validator`/`auditor` typically depend on `*ComponentFactory`, which must be obtained and passed in when registering the factory.
:::

---

## Best Practices

### 1. Respect Configuration Limits

```go
func (p *CustomParser) checkLimits(result map[string]string) error {
    // Check variable count
    if len(result) > p.cfg.MaxVariables {
        return fmt.Errorf("exceeds max variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    // Check key and value lengths
    for key, value := range result {
        if len(key) > p.cfg.MaxKeyLength {
            return fmt.Errorf("key too long: %s", key)
        }
        if len(value) > p.cfg.MaxValueLength {
            return fmt.Errorf("value too long for: %s", key)
        }
    }

    return nil
}
```

### 2. Use the Validator

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    result := make(map[string]string)

    // ... parsing logic

    // Validate all keys
    for key := range result {
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }
    }

    // Validate all values (if enabled)
    if p.cfg.ValidateValues {
        for key, value := range result {
            if err := p.validator.ValidateValue(value); err != nil {
                return nil, fmt.Errorf("invalid value for %q: %w", key, err)
            }
        }
    }

    return result, nil
}
```

### 3. Provide Meaningful Errors

```go
type CustomParseError struct {
    File    string
    Line    int
    Content string
    Err     error
}

func (e *CustomParseError) Error() string {
    if e.Line > 0 {
        return fmt.Sprintf("%s:%d: %s: %v", e.File, e.Line, e.Content, e.Err)
    }
    return fmt.Sprintf("%s: %s: %v", e.File, e.Content, e.Err)
}

func (e *CustomParseError) Unwrap() error {
    return e.Err
}
```

### 4. Log Audit Events

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... parsing logic

    // Log success
    _ = p.auditor.LogWithDuration(
        env.ActionParse,
        "",
        fmt.Sprintf("parsed %d variables", len(result)),
        true,
        time.Since(start),
    )

    return result, nil
}
```

---

## Complete Example

### Implementing an XML Parser

```go
package main

import (
    "encoding/xml"
    "fmt"
    "io"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// XML configuration structure
type XMLConfig struct {
    XMLName xml.Name   `xml:"config"`
    Entries []XMLEntry `xml:"entry"`
}

type XMLEntry struct {
    Key   string `xml:"key,attr"`
    Value string `xml:",chardata"`
}

// XMLParser parses XML format
type XMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *XMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()

    // Limit read size
    content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
    if err != nil {
        return nil, err
    }
    if int64(len(content)) > p.cfg.MaxFileSize {
        _ = p.auditor.LogError(env.ActionParse, "", "file exceeds size limit")
        return nil, fmt.Errorf("file exceeds size limit: %d > %d", len(content), p.cfg.MaxFileSize)
    }

    var xmlConfig XMLConfig
    if err := xml.Unmarshal(content, &xmlConfig); err != nil {
        _ = p.auditor.LogError(env.ActionParse, "", "xml parse error: "+err.Error())
        return nil, fmt.Errorf("xml parse error: %w", err)
    }

    result := make(map[string]string)

    for _, entry := range xmlConfig.Entries {
        key := strings.ToUpper(entry.Key)

        // Validate key length
        if len(key) > p.cfg.MaxKeyLength {
            return nil, fmt.Errorf("key too long: %s", key)
        }

        // Validate key format
        if err := p.validator.ValidateKey(key); err != nil {
            return nil, fmt.Errorf("invalid key %q: %w", key, err)
        }

        // Validate value length
        if len(entry.Value) > p.cfg.MaxValueLength {
            return nil, fmt.Errorf("value too long for key: %s", key)
        }

        result[key] = entry.Value
    }

    // Check variable count
    if len(result) > p.cfg.MaxVariables {
        return nil, fmt.Errorf("too many variables: %d > %d", len(result), p.cfg.MaxVariables)
    }

    _ = p.auditor.LogWithDuration(env.ActionParse, "", "parsed XML: "+filename, true, time.Since(start))
    return result, nil
}

// Define XML format constant
const FormatXML env.FileFormat = 102

func init() {
    // Register XML parser
    env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}

func main() {
    // LoadFiles does not auto-route to the XML parser based on the .xml
    // extension — DetectFormat only recognizes .env/.json/.yaml/.yml.
    // Here we use ForceRegisterParser to override FormatEnv; the file is
    // loaded with a .env extension (but contains XML content):
    err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &XMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    /*
    config.env file content (XML format):
    <?xml version="1.0"?>
    <config>
        <entry key="DATABASE_HOST">localhost</entry>
        <entry key="DATABASE_PORT">5432</entry>
    </config>
    */
    if err := loader.LoadFiles("config.env"); err != nil {
        panic(err)
    }

    fmt.Println(loader.GetString("DATABASE_HOST"))  // localhost
    fmt.Println(loader.GetInt("DATABASE_PORT"))     // 5432
}
```

---

## Related Documentation

- [ComponentFactory API](/en/env/api-reference/factory) - ComponentFactory and RegisterParser
- [Interfaces](/en/env/api-reference/interfaces) - EnvParser interface definition
- [Config API](/en/env/api-reference/config) - Configuration options details
- [Multi-format Config](/en/env/guides/multi-format) - JSON/YAML format details
