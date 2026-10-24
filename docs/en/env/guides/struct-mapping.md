---
sidebar_label: "Struct Mapping"
title: "Struct Mapping - CyberGo env | Env Vars to Structs"
description: "CyberGo env struct mapping: map env vars into structs via env/envDefault tags — nested structs, pointers, slices, time/custom types, defaults, and validation."
sidebar_position: 2
---

# Struct Mapping

`env.ParseInto` fills a Go struct from loaded environment variables, using `env` and `envDefault` tags. This gives you typed configuration instead of string lookups at every call site.

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

`env` names the environment variable a field maps to:

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // Maps to SERVER_HOST
    Port int64  `env:"PORT"`         // Maps to PORT
}
```

### envDefault Tag

`envDefault` supplies the value used when the variable is missing. A key that exists but is empty does not trigger the default: a string field takes `""`, and a non-string field keeps its zero value.

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

You can also write the default inline in the `env` tag as `env:"KEY,envDefault:VALUE"`. This is equivalent to the standalone `envDefault` tag, and when both are present the standalone tag takes precedence:

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

Slice fields are split on commas (`,`) and spaces around the separator are trimmed.

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

Nested fields take the outer field's name as a key prefix, and prefixes accumulate. The outer key is the field's `env` tag, or the upper-cased field name when untagged: Host (untagged) under Database (untagged) reads `DATABASE_HOST`. The type name of the struct passed to `ParseInto` does not become a prefix.

An `env` tag on an inner field is still prefixed: `env:"DB_HOST"` under Database reads `DATABASE_DB_HOST`. To read `DB_HOST` directly, put that field in the top-level struct.

### Basic Nesting

```go
type DatabaseConfig struct {
    Host string `envDefault:"localhost"` // DATABASE_HOST
    Port int64  `envDefault:"5432"`      // DATABASE_PORT
    User string                          // DATABASE_USER
}

type RedisConfig struct {
    Host string `envDefault:"localhost"` // REDIS_HOST
    Port int64  `envDefault:"6379"`      // REDIS_PORT
}

type AppConfig struct {
    Database DatabaseConfig
    Redis    RedisConfig
    Debug    bool `env:"DEBUG" envDefault:"false"` // top-level fields carry no prefix
}
```

### Deep Nesting

```go
type Credentials struct {
    Username string // DATABASE_CONNECTION_CREDENTIALS_USERNAME
    Password string // DATABASE_CONNECTION_CREDENTIALS_PASSWORD
}

type Connection struct {
    Host        string // DATABASE_CONNECTION_HOST
    Port        int64  // DATABASE_CONNECTION_PORT
    Credentials Credentials
}

type Database struct {
    Connection Connection
    Name       string // DATABASE_NAME
}

// The struct passed to ParseInto; its type name adds no prefix.
type AppConfig struct {
    Database Database
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

Pointer fields distinguish "unset" from "zero value". When the variable is missing or empty, the pointer stays `nil`. When the variable is `PORT=0`, `cfg.Port` is non-`nil` with `*cfg.Port == 0`. A value-typed field cannot tell these two cases apart.

## Custom Types

### Implementing encoding.TextUnmarshaler Interface

The field-by-field population logic decodes custom struct fields through the standard library `encoding.TextUnmarshaler` interface. That is the interface actually called during population.

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
The `env.Marshaler` (`MarshalEnv()`) and `env.Unmarshaler` (`UnmarshalEnv(map[string]string)`) interfaces take effect **only on the top-level value passed to `env.Marshal`, `env.MarshalStruct`, or `env.UnmarshalInto`**. The field-by-field population logic never calls them. For custom encoding or decoding of struct fields, implement the standard library `encoding.TextMarshaler` / `encoding.TextUnmarshaler`, which are recognized at the field level.
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

To split configuration by environment, put the shared fields in a named nested struct; the key prefix comes from that field name (Base here), and inner tags stay short:

```go
type BaseConfig struct {
    AppName string `env:"APP_NAME"`    // reads BASE_APP_NAME
    Version string `env:"APP_VERSION"` // reads BASE_APP_VERSION
}

type DevelopmentConfig struct {
    Base  BaseConfig
    Debug bool `env:"DEBUG" envDefault:"true"`
}

type ProductionConfig struct {
    Base  BaseConfig
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

Type conversion failures from `ParseInto` and `UnmarshalInto` return `*MarshalError`. Since v1.2.3 the error message does not echo the original value, which keeps sensitive values out of logs. Test with `env.IsMarshalError`, or use `errors.As` to extract field details:

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

`*ParseError` is returned only in **file parsing** scenarios, when `LoadFiles` fails to parse env, JSON, or YAML file content. `ParseInto` populates the struct from key-value pairs that are already loaded, so it never goes through file parsing and does not return `*ParseError`.

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

A nested field's key is the parent field's prefix plus its own key, so inner fields carry short names: `env:"HOST"` under Server reads `SERVER_HOST`, while `env:"SERVER_HOST"` would read `SERVER_SERVER_HOST`.

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
	Host         string        `env:"HOST" envDefault:"0.0.0.0"`
	Port         int64         `env:"PORT" envDefault:"8080"`
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
	Host     string `env:"HOST" envDefault:"localhost"`
	Port     int64  `env:"PORT" envDefault:"5432"`
	User     string `env:"USER" envDefault:"postgres"`
	Password string `env:"PASSWORD"`
	Name     string `env:"NAME" envDefault:"myapp"`
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
