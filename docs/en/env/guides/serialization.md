---
sidebar_label: "Serialization"
title: "Serialization - CyberGo env | Multi-format Conversion"
description: "CyberGo env serialization: Map/struct conversion across .env/JSON/YAML, Marshal/Unmarshal family, Marshaler/Unmarshaler, DetectFormat, export and migration."
sidebar_position: 2
---

# Serialization

Use Marshal and Unmarshal functionality to serialize/deserialize environment variables, supporting `.env`, JSON, and YAML format conversion.

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
    // DATABASE_PORT: 5432
}
```

## Struct Serialization

### Basic Serialization

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
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
    Name     string         `env:"APP_NAME"`
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

Convert a struct to `map[string]string`:

```go
func MarshalStruct(v any) (map[string]string, error)
```

**Parameters:**
- `v` - Struct pointer or value

**Returns:**
- `map[string]string` - Environment variable mapping
- `error` - Serialization error

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"HOST"`
    Port int64  `env:"PORT"`
    Debug bool  `env:"DEBUG"`
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

    // Can be used to export to a file
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
}
```

## Custom Serialization

::: tip Scope of the two custom interfaces
- **Field-level**: For custom encoding/decoding of struct fields, implement the standard library `encoding.TextMarshaler` / `encoding.TextUnmarshaler` (`MarshalText()` / `UnmarshalText([]byte)`). When a struct is processed by `env.Marshal` / `env.UnmarshalInto`, the per-field logic recognizes these two interfaces.
- **Top-level**: The `env.Marshaler` (`MarshalEnv()`) and `env.Unmarshaler` (`UnmarshalEnv(map[string]string)`) interfaces **only take effect on the top-level value passed directly to `env.Marshal` / `env.MarshalStruct` / `env.UnmarshalInto`**; if the value is a field inside an enclosing struct, they are not invoked.
:::

### Field-level: Implementing encoding.TextMarshaler

```go
package main

import (
    "fmt"
    "strings"

    "github.com/cybergodev/env"
)

type LogLevel string

// Implement encoding.TextMarshaler — invoked when serializing as a struct field
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

### Field-level: Implementing encoding.TextUnmarshaler

```go
package main

import (
    "fmt"

    "github.com/cybergodev/env"
)

type LogLevel string

// Implement encoding.TextUnmarshaler — invoked when deserializing as a struct field
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

### Top-level: Implementing env.Marshaler / env.Unmarshaler

When you pass a value of a type **directly** to `env.Marshal` / `env.UnmarshalInto` (rather than as a field of an enclosing struct), the `env.Marshaler` / `env.Unmarshaler` interfaces take effect on that top-level value:

```go
package main

import (
    "fmt"

    "github.com/cybergodev/env"
)

// The top-level type directly implements env.Marshaler
type EnvBlob string

func (e EnvBlob) MarshalEnv() ([]byte, error) {
    // Custom overall serialization output
    return []byte("APP_NAME=custom\nAPP_VERSION=2.0.0"), nil
}

func main() {
    // Serialize the top-level value directly (not a field of an enclosing struct)
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

### Saving Configuration to File

```go
package main

import (
    "os"
    "github.com/cybergodev/env"
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
    "os"
    "github.com/cybergodev/env"
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
    "os"
    "github.com/cybergodev/env"
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

## Related Documentation

- [Package Functions](/en/env/api-reference/functions) - Marshal, UnmarshalMap and other function references
- [Multi-format Config](/en/env/guides/multi-format) - Multi-format loading guide
- [Struct Mapping](/en/env/guides/struct-mapping) - Struct mapping guide
