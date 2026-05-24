---
title: "Маппинг структур - CyberGo env | Переменные окружения в структуры"
description: "Полное руководство по маппингу структур библиотеки CyberGo env — автоматическое отображение переменных окружения в поля Go-структур через теги env, вложенные структуры, указатели, срезы, пользовательские конвертеры типов, значения по умолчанию envDefault, обязательные поля и хуки маппинга."
---

# Маппинг структур

Автоматическое отображение переменных окружения в Go-структуры с помощью структурных тегов для типобезопасного управления конфигурацией.

## Базовый маппинг

### Простой пример

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int64  `env:"SERVER_PORT"`
    Debug bool  `env:"DEBUG"`
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

### Использование экземпляра Loader

```go
loader, _ := env.New(env.DefaultConfig())
loader.LoadFiles(".env")

var cfg Config
if err := loader.ParseInto(&cfg); err != nil {
    panic(err)
}
```

## Синтаксис тегов

### Тег env

Указание имени переменной окружения:

```go
type Config struct {
    Host string `env:"SERVER_HOST"`  // Маппинг SERVER_HOST
    Port int64  `env:"PORT"`         // Маппинг PORT
}
```

### Тег envDefault

Установка значений по умолчанию:

```go
type Config struct {
    Host    string `env:"HOST" envDefault:"localhost"`
    Port    int64  `env:"PORT" envDefault:"8080"`
    Debug   bool   `env:"DEBUG" envDefault:"false"`
    Timeout int64  `env:"TIMEOUT" envDefault:"30"`
}
```

### Игнорирование полей

Используйте `env:"-"` для пропуска поля:

```go
type Config struct {
    Host    string `env:"HOST"`
    Ignored string `env:"-"`  // Не будет заполнено
}
```

## Поддерживаемые типы

### Базовые типы

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

### Типы времени

```go
import "time"

type Config struct {
    Timeout  time.Duration `env:"TIMEOUT"`
    Interval time.Duration `env:"INTERVAL"`
}
```

Поддерживаемые форматы:
- `30s` - 30 секунд
- `5m` - 5 минут
- `1h30m` - 1 час 30 минут
- `100ms` - 100 миллисекунд

### Типы срезов

```go
type Config struct {
    Hosts []string `env:"HOSTS"`      // Разделение запятой
    Ports []int64  `env:"PORTS"`      // Разделение запятой
}
```

Файл `.env`:

```bash
HOSTS=localhost,example.com,api.example.com
PORTS=80,443,8080
```

### Пользовательский разделитель

Используйте тег `envSeparator` для указания пользовательского разделителя:

```go
type Config struct {
    // Разделение точкой с запятой
    Servers []string `env:"SERVERS" envSeparator:";"`

    // Разделение вертикальной чертой
    Tags []string `env:"TAGS" envSeparator:"|"`

    // Разделение пробелом
    Words []string `env:"WORDS" envSeparator:" "`
}
```

Файл `.env`:

```bash
SERVERS=server1.example.com;server2.example.com;server3.example.com
TAGS=production|api|v2
WORDS=hello world go lang
```

**Примечания:**
- Разделитель по умолчанию — запятая `,`
- `envSeparator` действует только для типов срезов
- Пробелы вокруг разделителя удаляются автоматически

## Вложенные структуры

### Базовая вложенность

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

### Глубокая вложенность

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

## Типы указателей

Поддерживаются поля-указатели:

```go
type Config struct {
    Host    *string `env:"HOST"`
    Port    *int64  `env:"PORT"`
    Enabled *bool   `env:"ENABLED"`
}

func main() {
    cfg := Config{}
    env.ParseInto(&cfg)

    if cfg.Port != nil {
        fmt.Println("Port:", *cfg.Port)
    }
}
```

## Пользовательские типы

### Реализация интерфейса Unmarshaler

```go
type LogLevel string

func (l *LogLevel) UnmarshalEnv(data map[string]string) error {
    *l = LogLevel(data["LOG_LEVEL"])
    return nil
}

type Config struct {
    Level LogLevel `env:"LOG_LEVEL"`
}
```

### Псевдоним типа

```go
type Port int64

func (p *Port) UnmarshalEnv(data map[string]string) error {
    val, err := strconv.ParseInt(data["PORT"], 10, 64)
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

## Валидация конфигурации

### Валидация структуры

```go
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

### Валидация обязательных полей

```go
type Config struct {
    APIKey    string `env:"API_KEY"`     // Обязательное
    APISecret string `env:"API_SECRET"`  // Обязательное
    Timeout   int64  `env:"TIMEOUT" envDefault:"30"`  // Необязательное
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

## Практические паттерны

### Централизованное управление конфигурацией

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

### Разделение по окружениям

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
        env.ParseInto(&cfg)
        return cfg
    default:
        cfg := DevelopmentConfig{}
        env.ParseInto(&cfg)
        return cfg
    }
}
```

## Обработка ошибок

### Ошибки парсинга

```go
cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    var parseErr *env.ParseError
    if errors.As(err, &parseErr) {
        log.Fatalf("Parse error at %s:%d", parseErr.File, parseErr.Line)
    }
    log.Fatal(err)
}
```

### Ошибки преобразования типов

```go
type Config struct {
    Port int64 `env:"PORT"`  // Если PORT не является допустимым целым числом
}

cfg := Config{}
if err := env.ParseInto(&cfg); err != nil {
    // Ошибка преобразования типа будет возвращена
}
```

## Полный пример

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

## Связанная документация

- [Функции пакета - ParseInto](/ru/env/api-reference/functions#parseinto) - Справка по функции ParseInto
- [Loader API - ParseInto](/ru/env/api-reference/loader#parseinto) - Справка по методу Loader
- [Быстрый старт](/ru/env/getting-started) - Базовое использование
