---
title: "Сериализация - CyberGo env | Мультиформатное преобразование"
description: "Полное руководство по сериализации и десериализации библиотеки CyberGo env — преобразование Map и Go-структур между форматами .env, JSON, YAML, семейство функций Marshal/Unmarshal, реализация пользовательских интерфейсов Marshaler/Unmarshaler, поддержка тегов env, маскирование чувствительных полей и примеры конвертации форматов."
---

# Сериализация

Сериализация и десериализация переменных окружения с помощью функций Marshal и Unmarshal с поддержкой преобразования между форматами `.env`, JSON и YAML.

## Базовая сериализация

### Сериализация Map

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

    // Сериализация в формат .env
    result, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // Вывод:
    // APP_NAME=my-app
    // APP_VERSION=1.0.0
    // DEBUG=true
}
```

### Формат JSON

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

    // Сериализация в JSON
    result, err := env.Marshal(data, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // Вывод:
    // {
    //   "HOST": "localhost",
    //   "PORT": "8080"
    // }
}
```

### Формат YAML

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

    // Сериализация в YAML
    result, err := env.Marshal(data, env.FormatYAML)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // Вывод:
    // DATABASE_HOST: localhost
    // DATABASE_PORT: "5432"
    // DATABASE_NAME: myapp
}
```

## Сериализация структур

### Базовая сериализация

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

    // Сериализация структуры в формат .env
    result, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Println(result)
    // Вывод:
    // HOST=localhost
    // PORT=8080
    // DEBUG=true
}
```

### Вложенные структуры

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

### Функция MarshalStruct

Преобразование структуры в `map[string]string`:

```go
func MarshalStruct(v interface{}) (map[string]string, error)
```

**Параметры:**
- `v` - указатель или значение структуры

**Возвращает:**
- `map[string]string` - отображение переменных окружения
- `error` - ошибка сериализации

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

    // Преобразование в map
    data, err := env.MarshalStruct(cfg)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", data)
    // Вывод: map[DEBUG:true HOST:localhost PORT:8080]

    // Можно использовать для экспорта в файл
    content, _ := env.Marshal(data, env.FormatEnv)
    fmt.Println(content)
}
```

## Десериализация

### Десериализация Map

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // Строка в формате .env
    data := `
HOST=localhost
PORT=8080
DEBUG=true
`

    // Десериализация в map
    result, err := env.UnmarshalMap(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", result)
    // Вывод: map[DEBUG:true HOST:localhost PORT:8080]
}
```

### Десериализация JSON

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

### Десериализация YAML

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

## Десериализация структур

### Из Map

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
    // Вывод: {Host:example.com Port:443}
}
```

### Из строки

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

## Пользовательская сериализация

### Реализация интерфейса Marshaler

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
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
}
```

### Реализация интерфейса Unmarshaler

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

type LogLevel string

type LogConfig struct {
    Level LogLevel `env:"LOG_LEVEL"`
}

func (l *LogLevel) UnmarshalEnv(data map[string]string) error {
    *l = LogLevel(data["LOG_LEVEL"])
    return nil
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
}
```

## Определение формата

### Автоматическое определение

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // Автоматическое определение формата
    format := env.DetectFormat("config.json")
    fmt.Println(format.String()) // json

    format = env.DetectFormat("settings.yaml")
    fmt.Println(format.String()) // yaml

    format = env.DetectFormat(".env")
    fmt.Println(format.String()) // dotenv

    // Автоопределение с FormatAuto
    data := `{"KEY": "value"}`
    result, _ := env.UnmarshalMap(data, env.FormatAuto)
    fmt.Println(result)
}
```

## Практические сценарии

### Сохранение конфигурации в файл

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

    // Сериализация
    content, err := env.Marshal(cfg, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // Запись в файл
    err = os.WriteFile(".env", []byte(content), 0644)
    if err != nil {
        panic(err)
    }
}
```

### Экспорт текущего окружения

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    env.Load(".env")

    // Получение всех переменных окружения
    all := env.All()

    // Экспорт в JSON
    content, err := env.Marshal(all, env.FormatJSON)
    if err != nil {
        panic(err)
    }

    fmt.Println(content)

    // Или запись в файл
    os.WriteFile("env-export.json", []byte(content), 0644)
}
```

### Миграция конфигурации

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // Чтение JSON-конфигурации
    jsonContent, _ := os.ReadFile("config.json")

    // Парсинг JSON
    data, err := env.UnmarshalMap(string(jsonContent), env.FormatJSON)
    if err != nil {
        panic(err)
    }

    // Преобразование в формат .env
    envContent, err := env.Marshal(data, env.FormatEnv)
    if err != nil {
        panic(err)
    }

    // Сохранение как файл .env
    os.WriteFile(".env", []byte(envContent), 0644)

    fmt.Println("Config migrated from JSON to .env")
}
```

## Связанная документация

- [Функции пакета](/ru/env/api-reference/functions) - Справка по функциям Marshal, UnmarshalMap и др.
- [Мультиформатная конфигурация](/ru/env/guides/multi-format) - Руководство по загрузке нескольких форматов
- [Маппинг структур](/ru/env/guides/struct-mapping) - Руководство по маппингу структур
