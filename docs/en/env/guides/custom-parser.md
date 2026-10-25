---
sidebar_label: "Custom Parser"
title: "Custom Parser - CyberGo env | Extending File Formats"
description: "CyberGo env custom parser guide: implement EnvParser, register via RegisterParser, Validator/Auditor from ComponentFactory, TOML/INI examples."
sidebar_position: 8
---

# Custom Parser

A custom parser implements the `EnvParser` interface and turns a file's contents into `map[string]string`. You register it with `RegisterParser`. A registered parser runs only when a file is routed to it, so read the routing restriction under [Registering a Parser](#registering-a-parser) before choosing a file extension.

## Parser Interface

### EnvParser

Every parser, built-in or custom, implements this interface:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**Parameters:**
- `r` - file content reader
- `filename` - file name, used in error messages

**Returns:**
- `map[string]string` - parsed key-value pairs
- `error` - parse error

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

// Implement EnvParser interface
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
	result := make(map[string]string)

	// 1. Read content (mind the size limit)
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

		// Strip quotes
		value = strings.Trim(value, "\"'")

		// Uppercase
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
	// Limit read size; reject oversized input (consistent with the TOML/XML examples)
	content, err := io.ReadAll(io.LimitReader(r, p.cfg.MaxFileSize+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > p.cfg.MaxFileSize {
		return nil, env.ErrFileTooLarge
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

The factory function receives `Config` and `ComponentFactory` and returns a parser instance.

**Parameters:**
- `cfg` - configuration object with all limits and security settings
- `factory` - component factory; use it to obtain the Validator, Auditor, and other components

### RegisterParser Function

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

Registers a custom format parser.

**Parameters:**
- `format` - file format constant (use 100 or above to avoid the built-in 0–3; such a number is never matched by extension in `LoadFiles` — see the routing restriction below)
- `factory` - parser factory function

**Returns:**
- `error` - non-nil when registration fails

**Error cases:**
- The built-in formats (`FormatEnv`, `FormatJSON`, `FormatYAML`) cannot be overridden
- The format is already registered

**Notes:**
- Register before calling `env.New()`
- Registering from an `init()` function is the common pattern

### Using ComponentFactory

Obtain the validator and auditor from the `ComponentFactory`:

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

// Register from init.
//
// Key point: register for FormatAuto, not for a private 100+ format number.
// DetectFormat recognizes only .env/.json/.yaml/.yml; every other extension
// (including .toml) returns FormatAuto. LoadFiles hands a .toml file to
// TOMLParser only when a parser is registered on FormatAuto — private format
// numbers are never matched by extension.
func init() {
    err := env.RegisterParser(env.FormatAuto, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err) // Format already registered or other error
    }
}

func main() {
    // Registration must happen before New (init already did it).
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // config.toml has an unknown extension -> DetectFormat returns FormatAuto
    // -> the TOMLParser registered above is used, so the .toml name is fine
    if err := loader.LoadFiles("config.toml"); err != nil {
        panic(err)
    }
}
```

`FormatAuto` has a single slot: once registered, every unknown extension goes through that one parser. To run several custom formats side by side, use `ForceRegisterParser` to override the built-in format numbers individually (one slot per format number, for example `FormatEnv` with `*.env` and `FormatJSON` with `*.json`), or call the parsers manually. The private-format-number style is shown for demonstration only — it is **not matched by `LoadFiles`**:

```go
const FormatTOML env.FileFormat = 100 // demo only: never matched by extension in LoadFiles
```

The INI parser works the same way: when used alone, register `INIParser` on `FormatAuto` instead. `FormatAuto` has a single slot, so it cannot coexist with the TOML registration.

:::warning LoadFiles routing restriction
A custom format number registered through `RegisterParser` (for example `FormatTOML = 100`) is **not selected by file extension in `LoadFiles`**. `LoadFiles` calls `DetectFormat(filename)` to choose a parser, and `DetectFormat` recognizes only `.env`, `.json`, `.yaml`, and `.yml`. Every other extension returns `FormatAuto`. With only the 100-numbered parser registered, a `.toml` file resolves to the `FormatAuto` entry; that entry is unregistered, so the loader falls back to the built-in dotenv parser line by line.

Three ways to load a custom format file:

1. **`.env` extension + `ForceRegisterParser`** (recommended): name the file `*.env` and call `env.ForceRegisterParser(env.FormatEnv, ...)` to replace the built-in dotenv parser. Keep the key-name, value, and size checks in your parser, or you introduce security holes.
2. **Register for `FormatAuto`** (the Complete Registration Example above uses this path): `env.RegisterParser(env.FormatAuto, factory)` makes every file with an unrecognized extension go through your parser, so names like `config.toml` or `config.conf` work unchanged.
3. **Call the parser manually**: read the file into an `io.Reader`, construct the parser instance yourself, call `parser.Parse(reader, filename)` to get the `map[string]string`, then write each entry with `loader.Set`. A parser's internal `validator` and `auditor` come from `*ComponentFactory`, which has no public constructor, so a manual-path parser must avoid depending on them.
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

    // Validate all values. The built-in parsers always run the baseline value
    // checks; a custom parser should match that, so this is not gated on
    // ValidateValues.
    for key, value := range result {
        if err := p.validator.ValidateValue(value); err != nil {
            return nil, fmt.Errorf("invalid value for %q: %w", key, err)
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

### 4. Record Audit Logs

```go
func (p *CustomParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    start := time.Now()
    result := make(map[string]string)

    // ... parsing logic

    // Record success
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

// Define an XML format constant (a private format number, demo only;
// LoadFiles never matches it by extension)
const FormatXML env.FileFormat = 102

func init() {
	// Register the XML parser (102 is never matched by LoadFiles; the override
	// in main below is what actually takes effect)
	env.RegisterParser(FormatXML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
		return &XMLParser{
			cfg:       cfg,
			validator: f.Validator(),
			auditor:   f.Auditor(),
		}, nil
	})
}

func main() {
	// LoadFiles does NOT route to the XML parser by the .xml extension:
	// DetectFormat only recognizes .env/.json/.yaml/.yml. This example uses
	// ForceRegisterParser to replace FormatEnv, then loads a file with a .env
	// extension (content in XML format):
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

	fmt.Println(loader.GetString("DATABASE_HOST")) // localhost
	fmt.Println(loader.GetInt("DATABASE_PORT"))    // 5432
}
```

---

## Overriding Built-in Parsers (ForceRegisterParser)

For security, `RegisterParser` **refuses** to override the three built-in formats (`FormatEnv`, `FormatJSON`, `FormatYAML`), and registering the same custom format twice returns an error. To replace a built-in parser — to add multi-line value syntax to `.env`, attach custom security checks, or inject a mock parser in tests — use `ForceRegisterParser`:

<!-- check-code: skip -->
```go
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }, nil
})
```

:::warning Security warning
Replacing a built-in parser can introduce vulnerabilities. If the replacement lacks key validation, value validation, or size limits, you lose the library's default protections. Use this only when your parser implements equivalent checks in full.
:::

**Registration timing**: parser factories are snapshotted when a Loader is created (`createParsers` inside `New()`). Call `RegisterParser`/`ForceRegisterParser` before `env.New()`; a Loader that already exists is unaffected by later registrations.

## Related Documentation

- [ComponentFactory API](../api-reference/factory) - ComponentFactory and RegisterParser
- [Interfaces](../api-reference/interfaces) - EnvParser interface definition
- [Config API](../api-reference/config) - configuration options in detail
- [Multi-format Config](./multi-format) - JSON/YAML formats in detail
