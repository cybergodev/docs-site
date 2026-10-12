---
sidebar_label: "Struct Mapping"
title: "Struct Mapping - CyberGo env | Env Vars to Structs"
description: "CyberGo env struct mapping: map env vars into structs via env/envDefault tags — nested structs, pointers, slices, time/custom types, defaults, and validation."
sidebar_position: 2
---

# Struct Mapping

Use struct tags to automatically map environment variables to Go structs, enabling type-safe configuration management.

## Basic Mapping

### Simple Example

```go
package main

import (
	"fmt"
	"github.com/cybergodev/env"
)

type Config struct {
	Host  string `env:"SERVER_HOST"`
	Port  int64  `env:"SERVER_PORT"`
	Debug bool   `env:"DEBUG"`
}

func main() {
	env.Load(".env")

	cfg := Config{}
	if err := env.ParseInto(&cfg); err != nil {
		panic(err)
	}

	fmt.Printf("%+v\n", cfg)
}
```

### Using a Loader Instance

```go
loader, _ := env.New(env.DefaultConfig())
loader.LoadFiles(".env")

var cfg Config
if err := loader.ParseInto(&cfg); err != nil {
    panic(err)
}
```

## Tag Syntax

### env Tag

Specifies the environment variable name:

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // Maps to SERVER_HOST
    Port int64  `env:"PORT"`         // Maps to PORT
}
```

### envDefault Tag

Sets a default value:

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

The default can also be written inline in the `env` tag — `env:"KEY,envDefault:VALUE"` — which is equivalent to the standalone `envDefault` tag (when both are present, the standalone tag takes precedence):

```go
type Config struct {
    Host string `env:"HOST,envDefault:localhost"`
    Port int64  `env:"PORT,envDefault:8080"`
}
```

### Ignoring Fields

Use `env:"-"` to skip a field:

```go
type Config struct {
    Host    string `env:"HOST"`
    Ignored string `env:"-"`  // Will not be populated
}
```

## Supported Types

### Basic Types

```go
type Config struct {
    String  string  `env:"STRING_VALUE"`
    Int     int     `env:"INT_VALUE"`
    Int8    int8    `env:"INT8_VALUE"`
    Int16   int16   `env:"INT16_VALUE"`
    Int32   int32   `env:"INT32_VALUE"`
    Int64   int64   `env:"INT64_VALUE"`
    Uint    uint    `env:"UINT_VALUE"`
    Uint64  uint64  `env:"UINT64_VALUE"`
    Float32 float32 `env:"FLOAT32_VALUE"`
    Float64 float64 `env:"FLOAT64_VALUE"`
    Bool    bool    `env:"BOOL_VALUE"`
}
```

### Time Types

```go
import "time"

type Config struct {
    Timeout  time.Duration `env:"TIMEOUT"`
    Interval time.Duration `env:"INTERVAL"`
}
```

Supported formats:
- `30s` - 30 seconds
- `5m` - 5 minutes
- `1h30m` - 1 hour 30 minutes
- `100ms` - 100 milliseconds

### Slice Types

Slice fields are separated by commas (`,`); spaces around the separator are trimmed automatically.

```go
type Config struct {
    Hosts []string `env:"HOSTS"`      // Comma-separated
    Ports []int64  `env:"PORTS"`      // Comma-separated
}
```

`.env` file:

```bash
HOSTS=localhost,example.com,api.example.com
PORTS=80,443,8080
```

## Nested Structs

### Basic Nesting

```go
type DatabaseConfig struct {
    Host string `env:"DB_HOST" envDefault:"localhost"`
    Port int64  `env:"DB_PORT" envDefault:"5432"`
    User string `env:"DB_USER"`
    Password string `env:"DB_PASSWORD"`
}

type RedisConfig struct {
    Host string `env:"REDIS_HOST" envDefault:"localhost"`
    Port int64  `env:"REDIS_PORT" envDefault:"6379"`
}

type AppConfig struct {
    Database DatabaseConfig
    Redis    RedisConfig
    Debug    bool `env:"DEBUG" envDefault:"false"`
}
```

### Deep Nesting

```go
type Credentials struct {
    Username string `env:"DB_USER"`
    Password string `env:"DB_PASSWORD"`
}

type Connection struct {
    Host        string      `env:"DB_HOST"`
    Port        int64       `env:"DB_PORT"`
    Credentials Credentials
}

type Database struct {
    Connection Connection
    Name       string `env:"DB_NAME"`
}
```

## Pointer Types

Pointer fields are supported:

```go
package main

import (
	"fmt"
	"log"

	"github.com/cybergodev/env"
)

type Config struct {
	Host    *string `env:"HOST"`
	Port    *int64  `env:"PORT"`
	Enabled *bool   `env:"ENABLED"`
}

func main() {
	cfg := Config{}
	if err := env.ParseInto(&cfg); err != nil {
		log.Fatal(err)
	}

	if cfg.Port != nil {
		fmt.Println("Port:", *cfg.Port)
	}
}
```

Pointer fields distinguish "unset" from "zero value": when the variable is unset (or its value is empty) the pointer stays `nil`; when set to `PORT=0`, `cfg.Port` is non-`nil` with `*cfg.Port == 0`. Value-typed fields cannot tell these two cases apart.

## Custom Types

### Implementing encoding.TextUnmarshaler Interface

Custom decoding of struct fields is done by implementing the standard library `encoding.TextUnmarshaler` interface — this is the interface that **actually gets called** during field-by-field population.

```go
package main

import (
	"fmt"

	"github.com/cybergodev/env"
)

type LogLevel string

// Implement encoding.TextUnmarshaler — called at field level
func (l *LogLevel) UnmarshalText(text []byte) error {
	switch string(text) {
	case "debug", "info", "warn", "error":
		*l = LogLevel(text)
		return nil
	default:
		return fmt.Errorf("invalid log level: %s", string(text))
	}
}

type Config struct {
	Level LogLevel `env:"LOG_LEVEL"`
}

func main() {
	data := map[string]string{"LOG_LEVEL": "info"}

	var cfg Config
	if err := env.UnmarshalInto(data, &cfg); err != nil {
		panic(err)
	}

	fmt.Println(cfg.Level)
	// Output: info
}
```

### Type Alias with Validation

<!-- check-code: skip -->
```go
type Port int64

// Implement encoding.TextUnmarshaler with range validation during parsing
func (p *Port) UnmarshalText(text []byte) error {
    val, err := strconv.ParseInt(string(text), 10, 64)
    if err != nil {
        return err
    }
    if val < 1 || val > 65535 {
        return errors.New("port must be 1-65535")
    }
    *p = Port(val)
    return nil
}
```

:::tip About env.Marshaler / env.Unmarshaler
`env.Marshaler` (`MarshalEnv()`) and `env.Unmarshaler` (`UnmarshalEnv(map[string]string)`) interfaces **only take effect on the top-level value passed to `env.Marshal`/`env.MarshalStruct`/`env.UnmarshalInto`**, and are not called by the field-by-field population logic. For custom encoding/decoding of struct fields, implement the standard library `encoding.TextMarshaler` / `encoding.TextUnmarshaler`, which are recognized at the field level.
:::

## Configuration Validation

### Struct Validation

```go
package main

import (
	"errors"
	"log"

	"github.com/cybergodev/env"
)

type ServerConfig struct {
	Host string `env:"SERVER_HOST" envDefault:"0.0.0.0"`
	Port int64  `env:"SERVER_PORT" envDefault:"8080"`
}

func (c *ServerConfig) Validate() error {
	if c.Port < 1024 || c.Port > 65535 {
		return errors.New("port must be 1024-65535")
	}
	return nil
}

func main() {
	cfg := ServerConfig{}
	if err := env.ParseInto(&cfg); err != nil {
		log.Fatal(err)
	}

	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
}
```

### Required Field Validation

```go
type Config struct {
    APIKey    string `env:"API_KEY"`     // Required
    APISecret string `env:"API_SECRET"`  // Required
    Timeout   int64  `env:"TIMEOUT" envDefault:"30"`  // Optional
}

func (c *Config) Validate() error {
    if c.APIKey == "" {
        return errors.New("API_KEY is required")
    }
    if c.APISecret == "" {
        return errors.New("API_SECRET is required")
    }
    return nil
}
```

## Practical Patterns

### Centralized Configuration Management

<!-- check-code: skip -->
```go
// config/config.go
package config

import "github.com/cybergodev/env"

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    Log      LogConfig
}

func Load() (*Config, error) {
    if err := env.Load(".env"); err != nil {
        return nil, err
    }

    cfg := &Config{
        Server:   ServerConfig{},
        Database: DatabaseConfig{},
        Redis:    RedisConfig{},
        Log:      LogConfig{},
    }

    if err := env.ParseInto(cfg); err != nil {
        return nil, err
    }

    return cfg, nil
}
```

### Environment Differentiation

```go
type BaseConfig struct {
    AppName string `env:"APP_NAME"`
    Version string `env:"APP_VERSION"`
}

type DevelopmentConfig struct {
    BaseConfig
    Debug bool `env:"DEBUG" envDefault:"true"`
}

type ProductionConfig struct {
    BaseConfig
    Debug bool `env:"DEBUG" envDefault:"false"`
}

func LoadConfig() interface{} {
    env.Load(".env")

    switch os.Getenv("GO_ENV") {
    case "production":
        cfg := ProductionConfig{}
        if err := env.ParseInto(&cfg); err != nil {
            log.Printf("parse production config: %v", err)
        }
        return cfg
    default:
        cfg := DevelopmentConfig{}
        if err := env.ParseInto(&cfg); err != nil {
            log.Printf("parse development config: %v", err)
        }
        return cfg
    }
}
```

## Error Handling

### Parse Errors

Type conversion failures from `ParseInto` / `UnmarshalInto` uniformly return `*MarshalError` (since v1.2.3 the error message does not echo the original value, preventing sensitive values from leaking). Use `env.IsMarshalError` to test it, or `errors.As` to extract field details:

```go
cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    if env.IsMarshalError(err) {
        var marshalErr *env.MarshalError
        if errors.As(err, &marshalErr) {
            log.Fatalf("Field %s failed to convert: %s", marshalErr.Field, marshalErr.Message)
        }
    }
    log.Fatal(err)
}
```

Note: `*ParseError` is only returned in **file parsing** scenarios (when `LoadFiles` fails to parse env/JSON/YAML file content); `ParseInto` populates the struct directly from already-loaded key-value pairs and never goes through file parsing, so it does not return `*ParseError`.

### Type Conversion Errors

```go
type Config struct {
    Port int64 `env:"PORT"`  // If PORT is not a valid integer
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // Type conversion failure returns *MarshalError (original value not echoed)
}
```

## Complete Example

```go
package main

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/cybergodev/env"
)

type ServerConfig struct {
	Host         string        `env:"SERVER_HOST" envDefault:"0.0.0.0"`
	Port         int64         `env:"SERVER_PORT" envDefault:"8080"`
	ReadTimeout  time.Duration `env:"READ_TIMEOUT" envDefault:"30s"`
	WriteTimeout time.Duration `env:"WRITE_TIMEOUT" envDefault:"30s"`
}

func (c *ServerConfig) Validate() error {
	if c.Port < 1024 || c.Port > 65535 {
		return errors.New("port must be 1024-65535")
	}
	return nil
}

type DatabaseConfig struct {
	Host     string `env:"DB_HOST" envDefault:"localhost"`
	Port     int64  `env:"DB_PORT" envDefault:"5432"`
	User     string `env:"DB_USER" envDefault:"postgres"`
	Password string `env:"DB_PASSWORD"`
	Name     string `env:"DB_NAME" envDefault:"myapp"`
}

func (c *DatabaseConfig) Validate() error {
	if c.Password == "" {
		return errors.New("DB_PASSWORD is required")
	}
	return nil
}

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
}

func LoadConfig() (*Config, error) {
	if err := env.Load(".env"); err != nil {
		return nil, fmt.Errorf("load env: %w", err)
	}

	cfg := &Config{
		Server:   ServerConfig{},
		Database: DatabaseConfig{},
	}

	if err := env.ParseInto(cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := cfg.Server.Validate(); err != nil {
		return nil, fmt.Errorf("server config: %w", err)
	}

	if err := cfg.Database.Validate(); err != nil {
		return nil, fmt.Errorf("database config: %w", err)
	}

	return cfg, nil
}

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Server: %s:%d\n", cfg.Server.Host, cfg.Server.Port)
	fmt.Printf("Database: %s@%s:%d/%s\n",
		cfg.Database.User,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Name,
	)
}
```

## Related Documentation

- [Package Functions - ParseInto](../api-reference/functions#parseinto) - ParseInto function reference
- [Loader API - ParseInto](../api-reference/loader#parseinto) - Loader method reference
- [Quick Start](../getting-started/) - Basic usage
