---
sidebar_label: "Serialization"
title: "Serialization - CyberGo env | Multi-format Conversion"
description: "CyberGo env serialization guide: map and struct conversion across .env/JSON/YAML, Marshal/Unmarshal, custom Marshaler, quoting rules and FormatAuto detection."
sidebar_position: 4
---

# Serialization

`env.Marshal` and the `Unmarshal*` functions convert between key-value data and `.env`, JSON, and YAML. Use them to export a running configuration, migrate between formats, or feed a struct into a config file.

## Basic Serialization

### Map Serialization

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"APP_NAME":    "my-app",
		"APP_VERSION": "1.0.0",
		"DEBUG":       "true",
	}

	// Serialize to .env format
	result, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output:
	// APP_NAME=my-app
	// APP_VERSION=1.0.0
	// DEBUG=true
}
```

### JSON Format

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"HOST": "localhost",
		"PORT": "8080",
	}

	// Serialize to JSON
	result, err := env.Marshal(data, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output:
	// {
	//   "HOST": "localhost",
	//   "PORT": 8080
	// }
}
```

### YAML Format

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"DATABASE_HOST": "localhost",
		"DATABASE_PORT": "5432",
		"DATABASE_NAME": "myapp",
	}

	// Serialize to YAML
	result, err := env.Marshal(data, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output:
	// DATABASE_HOST: localhost
	// DATABASE_NAME: myapp
	// DATABASE_PORT: "5432"
}
```

## Output Shape

Marshal output is not a verbatim dump of flat keys. Both structured formats transform keys and values, so you need to know the transformation to read an export correctly.

### JSON: underscore keys rebuild nested objects

When marshaling to JSON, keys containing underscores are split on `_` and rebuilt as nested objects (`DATABASE_HOST` → `{"DATABASE": {"HOST": ...}}`). Leaf values are restored by type inference: `"8080"` becomes a number, `"true"` a bool, `"null"` null, and floats likewise.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"DATABASE_HOST": "localhost",
		"DATABASE_PORT": "5432",
		"DEBUG":         "true",
	}

	result, err := env.Marshal(data, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output (keys sorted lexicographically):
	// {
	//   "DATABASE": {
	//     "HOST": "localhost",
	//     "PORT": 5432
	//   },
	//   "DEBUG": true
	// }
}
```

This mirrors the loading direction: loading JSON flattens nested objects into `DATABASE_HOST`, and marshaling back to JSON rebuilds the nesting, so the structure survives a round trip.

### YAML: quoted scalars preserve round trips

When marshaling to YAML, keys stay flat. Scalars that YAML would type-coerce when read back (numbers, `true`/`false`, `null`/`~`, and similar) are double-quoted, so a Marshal → Unmarshal round trip keeps the value a string:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{
		"HOST":  "localhost",
		"PORT":  "8080",
		"DEBUG": "true",
	}

	result, err := env.Marshal(data, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output (keys sorted lexicographically):
	// DEBUG: "true"
	// HOST: localhost
	// PORT: "8080"
}
```

This behavior dates from v1.2.3. Before that, `PORT: 8080` was emitted unquoted and the YAML parser turned it back into a number on reload, causing type drift across round trips.

## Struct Serialization

### Basic Serialization

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"HOST"`
	Port  int64  `env:"PORT"`
	Debug bool   `env:"DEBUG"`
}

func main() {
	cfg := Config{
		Host:  "localhost",
		Port:  8080,
		Debug: true,
	}

	// Serialize struct to .env format
	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output:
	// DEBUG=true
	// HOST=localhost
	// PORT=8080
}
```

### Nested Structs

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type DatabaseConfig struct {
	Host string `env:"DB_HOST"`
	Port int64  `env:"DB_PORT"`
}

type AppConfig struct {
	Name     string `env:"APP_NAME"`
	Database DatabaseConfig
}

func main() {
	cfg := AppConfig{
		Name: "my-app",
		Database: DatabaseConfig{
			Host: "localhost",
			Port: 5432,
		},
	}

	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
}
```

### MarshalStruct Function

`MarshalStruct` converts a struct to `map[string]string`:

```go
func MarshalStruct(v any) (map[string]string, error)
```

**Parameters:**
- `v` - struct pointer or value

**Returns:**
- `map[string]string` - environment variable mapping
- `error` - serialization error

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"HOST"`
	Port  int64  `env:"PORT"`
	Debug bool   `env:"DEBUG"`
}

func main() {
	cfg := Config{
		Host:  "localhost",
		Port:  8080,
		Debug: true,
	}

	// Convert to map
	data, err := env.MarshalStruct(cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", data)
	// Output: map[DEBUG:true HOST:localhost PORT:8080]

	// Can be used to export to file
	content, _ := env.Marshal(data, env.FormatEnv)
	fmt.Println(content)
}
```

## Deserialization

### Map Deserialization

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// .env format string
	data := `
HOST=localhost
PORT=8080
DEBUG=true
`

	// Deserialize to map
	result, err := env.UnmarshalMap(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// Output: map[DEBUG:true HOST:localhost PORT:8080]
}
```

### JSON Deserialization

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	jsonData := `{
        "API_KEY": "secret123",
        "API_URL": "https://api.example.com",
        "TIMEOUT": "30"
    }`

	result, err := env.UnmarshalMap(jsonData, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// Output: map[API_KEY:secret123 API_URL:https://api.example.com TIMEOUT:30]
}
```

### YAML Deserialization

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	yamlData := `
DATABASE_HOST: localhost
DATABASE_PORT: "5432"
DATABASE_USER: postgres
`

	result, err := env.UnmarshalMap(yamlData, env.FormatYAML)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", result)
	// Output: map[DATABASE_HOST:localhost DATABASE_PORT:5432 DATABASE_USER:postgres]
}
```

## Struct Deserialization

### Deserialize from Map

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host string `env:"HOST"`
	Port int64  `env:"PORT"`
}

func main() {
	data := map[string]string{
		"HOST": "example.com",
		"PORT": "443",
	}

	var cfg Config
	err := env.UnmarshalInto(data, &cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// Output: {Host:example.com Port:443}
}
```

### Deserialize from String

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type ServerConfig struct {
	Host    string `env:"SERVER_HOST"`
	Port    int64  `env:"SERVER_PORT"`
	Enabled bool   `env:"ENABLED"`
}

func main() {
	envData := `
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
ENABLED=true
`

	var cfg ServerConfig
	err := env.UnmarshalStruct(envData, &cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
	// Output: {Host:0.0.0.0 Port:8080 Enabled:true}
}
```

## Custom Serialization

:::tip Scope of the two custom interfaces
- **Field level**: to customize encoding or decoding of struct fields, implement the standard library `encoding.TextMarshaler` / `encoding.TextUnmarshaler` (`MarshalText()` / `UnmarshalText([]byte)`). The field-by-field logic in `env.Marshal` and `env.UnmarshalInto` recognizes both interfaces.
- **Top level**: the `env.Marshaler` (`MarshalEnv()`) and `env.Unmarshaler` (`UnmarshalEnv(map[string]string)`) interfaces take effect **only on the top-level value passed directly to `env.Marshal`, `env.MarshalStruct`, or `env.UnmarshalInto`**. When the same type appears as a field of an outer struct, they are not called.
:::

### Field level: Implement encoding.TextMarshaler

```go
package main

import (
	"fmt"
	"strings"

	"github.com/cybergodev/env"
)

type LogLevel string

// Implement encoding.TextMarshaler — called when serializing as a struct field
func (l LogLevel) MarshalText() ([]byte, error) {
	return []byte(strings.ToUpper(string(l))), nil
}

type LogConfig struct {
	Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
	cfg := LogConfig{
		Level: LogLevel("debug"),
	}

	result, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output: LOG_LEVEL=DEBUG
}
```

### Field level: Implement encoding.TextUnmarshaler

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

type LogLevel string

// Implement encoding.TextUnmarshaler — called when deserializing as a struct field
func (l *LogLevel) UnmarshalText(text []byte) error {
	switch string(text) {
	case "debug", "info", "warn", "error":
		*l = LogLevel(text)
		return nil
	default:
		return fmt.Errorf("invalid log level: %s", string(text))
	}
}

type LogConfig struct {
	Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
	data := map[string]string{
		"LOG_LEVEL": "info",
	}

	var cfg LogConfig
	err := env.UnmarshalInto(data, &cfg)
	if err != nil {
		panic(err)
	}

	fmt.Printf("Level: %s\n", cfg.Level)
	// Output: Level: info
}
```

### Top level: Implement env.Marshaler / env.Unmarshaler

When you pass a type's value **directly** to `env.Marshal` or `env.UnmarshalInto` (not as a field of an outer struct), the `env.Marshaler` and `env.Unmarshaler` interfaces take effect on that top-level value:

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

// Top-level type directly implements env.Marshaler
type EnvBlob string

func (e EnvBlob) MarshalEnv() ([]byte, error) {
	// Custom serialization output for the whole value
	return []byte("APP_NAME=custom\nAPP_VERSION=2.0.0"), nil
}

func main() {
	// Top-level value, not a field of an outer struct
	result, err := env.Marshal(EnvBlob(""), env.FormatEnv)
	if err != nil {
		panic(err)
	}

	fmt.Println(result)
	// Output:
	// APP_NAME=custom
	// APP_VERSION=2.0.0
}
```

## Format Detection

### Auto-detect Format

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

func main() {
	// Auto-detect format
	format := env.DetectFormat("config.json")
	fmt.Println(format.String()) // json

	format = env.DetectFormat("settings.yaml")
	fmt.Println(format.String()) // yaml

	format = env.DetectFormat(".env")
	fmt.Println(format.String()) // dotenv

	// Use FormatAuto for auto-detection
	data := `{"KEY": "value"}`
	result, _ := env.UnmarshalMap(data, env.FormatAuto)
	fmt.Println(result)
}
```

## Practical Scenarios

### Save Configuration to File

```go
package main

import (
	"github.com/cybergodev/env"
	"os"
)

func main() {
	cfg := map[string]string{
		"HOST": "localhost",
		"PORT": "8080",
	}

	// Serialize
	content, err := env.Marshal(cfg, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	// Write to file
	err = os.WriteFile(".env", []byte(content), 0644)
	if err != nil {
		panic(err)
	}
}
```

### Export Current Environment

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
	"os"
)

func main() {
	env.Load(".env")

	// Get all environment variables
	all := env.All()

	// Export as JSON
	content, err := env.Marshal(all, env.FormatJSON)
	if err != nil {
		panic(err)
	}

	fmt.Println(content)

	// Or write to file
	os.WriteFile("env-export.json", []byte(content), 0644)
}
```

### Configuration Migration

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
	"os"
)

func main() {
	// Read JSON configuration
	jsonContent, _ := os.ReadFile("config.json")

	// Parse JSON
	data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
	if err != nil {
		panic(err)
	}

	// Convert to .env format
	envContent, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}

	// Save as .env file
	os.WriteFile(".env", []byte(envContent), 0644)

	fmt.Println("Config migrated from JSON to .env")
}
```

## Round-trip Behavior and Format Auto-Detection

### `$` is escaped: Marshal output reloads unchanged

`Marshal` to `.env` quotes values that need it and writes `$` as `\$` (SEC-009, pinned by `TestMarshalEnv_ValueEscaping`). A Marshal → load round trip therefore does not expand the value again, even with `ExpandVariables` enabled.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

func main() {
	data := map[string]string{"PRICE": "100$USD"}

	out, err := env.Marshal(data, env.FormatEnv)
	if err != nil {
		panic(err)
	}
	fmt.Println(out)
	// Output: PRICE="100\$USD"
}
```

A value is quoted when it contains a space, `#`, `'`, a newline, a carriage return, a tab, a double quote, or `$`, and when it is the literal `null` or `~`. An empty value is written as `""`. Inside a quoted value, `"` becomes `\"`, `\` becomes `\\`, and control characters become `\n`, `\r`, and `\t`. A value with no special character — including one whose only unusual character is a backslash, such as `path\to\file` — is emitted unquoted and unchanged.

### MarshalStruct field handling

When marshaling a struct, fields whose value marshals to an **empty string are omitted** (empty strings, nil pointers, empty slices). Scalar zero values (`0`, `false`) are **kept**, because they do not marshal to an empty string. Align the reading side with `envDefault` tags.

### Sorted-key guarantee

`Marshal` output keys are **always sorted lexicographically**, regardless of input map or struct field order. Output for the same configuration is stable, which suits diffing and caching.

### FormatAuto content-detection rules

When `UnmarshalMap` or `UnmarshalStruct` receives `FormatAuto`, the format is detected by **content**, not by extension:

| Signal (in check order) | Verdict |
|--------|---------|
| Empty input | `.env` |
| First character is `{` or `[` | JSON |
| First effective line starts with `- ` | YAML |
| First effective line contains `": "` before any `=` (or has no `=`) | YAML |
| First effective line contains `=` | `.env` |
| First effective line is a bare `KEY:` (only whitespace after the colon) | YAML |
| Nothing above matches | `.env` |

Only the first effective line decides; blank lines and lines starting with `#` are skipped. The governing rule is **which separator appears first in that line**, not a blanket preference for `": "`: `GREETING=hello: world` has its `=` at index 8 and the `": "` after it, so it is `.env`; `connection: host=db port=5432` has the `": "` first, so it is YAML.

### IsMarshalError helper

<!-- check-code: skip -->
```go
if _, err := env.Marshal(data); err != nil {
	if env.IsMarshalError(err) {
		// Marshaling error: unsupported input type or field conversion failure
	}
}
```

## Related Documentation

- [Package Functions](../api-reference/functions) - Marshal, UnmarshalMap, and other functions
- [Multi-format Config](./multi-format) - multi-format loading
- [Struct Mapping](./struct-mapping) - struct mapping
