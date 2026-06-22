---
title: "Мультиформатная конфигурация - CyberGo env | .env/JSON/YAML"
description: "Руководство CyberGo env: загрузка .env, JSON и YAML с автоопределением и смешанной загрузкой, приоритет слияния и конвертация для контейнеров."
---

# Мультиформатная конфигурация

Библиотека env поддерживает три формата конфигурации: `.env`, JSON и YAML с автоматическим определением формата при загрузке.

## Определение формата

### Правила автоматического определения

| Расширение | Формат | Константа |
|--------|------|------|
| `.env` | Формат .env | `FormatEnv` |
| `.json` | JSON | `FormatJSON` |
| `.yaml`, `.yml` | YAML | `FormatYAML` |
| Другое | Авто | `FormatAuto` |

### Функция DetectFormat

```go
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat("app.yml")        // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv
format = env.DetectFormat("unknown")        // FormatAuto

fmt.Println(format.String())  // "json", "yaml", "dotenv", "auto"
```

## Загрузка файлов нескольких форматов

### Один формат

```go
loader.LoadFiles("config.env")
loader.LoadFiles("settings.json")
loader.LoadFiles("secrets.yaml")
```

### Смешанные форматы

```go
// Автоматическое определение формата каждого файла
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

### Порядок перекрытия

Загруженные позже файлы перекрывают загруженные ранее:

```go
// Порядок: base -> env -> json -> yaml
loader.LoadFiles(
    ".env",           // Базовая конфигурация
    "config.json",    // Перекрывает .env
    "secrets.yaml",   // Перекрывает config.json
)
```

## Формат JSON

### Структура файла

```json
{
    "APP_NAME": "myapp",
    "APP_PORT": "8080",
    "DEBUG": "true",
    "DATABASE": {
        "HOST": "localhost",
        "PORT": "5432"
    }
}
```

::: tip Примечание
Вложенные объекты будут преобразованы в плоский вид: `DATABASE_HOST`, `DATABASE_PORT`.
:::

### Разрешение имён ключей

Вложенные структуры JSON/YAML преобразуются в плоское хранилище. Библиотека поддерживает несколько способов доступа к ключам:

```go
loader.LoadFiles("config.json")

// JSON: {"database": {"host": "localhost", "port": 5432}}
// Хранится как: DATABASE_HOST=localhost, DATABASE_PORT=5432

// Способ 1: Плоские ключи (рекомендуется)
host := loader.GetString("DATABASE_HOST")   // localhost
port := loader.GetInt("DATABASE_PORT")      // 5432

// Способ 2: Путь через точку (автопреобразование)
host := loader.GetString("database.host")   // localhost
port := loader.GetInt("database.port")      // 5432

// Способ 3: Верхний регистр с точкой
host := loader.GetString("DATABASE.HOST")   // localhost
```

**Правила разрешения:**

| Входной ключ | Преобразуется в |
|----------|--------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (точное совпадение) |
| `"database.host"` | `"DATABASE_HOST"` (точка в подчёркивание) |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (индекс массива) |

::: tip Рекомендуемое использование
- **В коде используйте плоские ключи**: `GetString("DATABASE_HOST")` - явно и эффективно
- **В конфигурационных файлах - читаемые пути**: JSON/YAML используют естественную вложенную структуру
:::

**Правила преобразования в плоский вид:**

| JSON-путь | Ключ хранения |
|-----------|--------|
| `database.host` | `DATABASE_HOST` |
| `database.port` | `DATABASE_PORT` |
| `app.server.name` | `APP_SERVER_NAME` |
| `servers.0.host` | `SERVERS_0_HOST` |

### Доступ к массивам

Массивы JSON преобразуются в ключи с индексом:

```json
{
    "servers": [
        { "host": "server1.example.com", "port": 8080 },
        { "host": "server2.example.com", "port": 8081 }
    ]
}
```

```go
// Доступ к элементам массива через плоские ключи
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Получение всех хостов через цикл
var hosts []string
for i := 0; ; i++ {
    h := loader.GetString(fmt.Sprintf("SERVERS_%d_HOST", i))
    if h == "" {
        break
    }
    hosts = append(hosts, h)
}
// hosts = ["server1.example.com", "server2.example.com"]
```

### Конфигурация парсинга JSON

```go
cfg := env.DefaultConfig()

// Значение null преобразуется в пустую строку (по умолчанию true)
cfg.JSONNullAsEmpty = true

// Числа преобразуются в строки (по умолчанию true)
cfg.JSONNumberAsString = true

// Логические значения преобразуются в строки (по умолчанию true)
cfg.JSONBoolAsString = true

// Максимальная глубина вложенности (по умолчанию 10)
cfg.JSONMaxDepth = 20
```

### Примеры преобразования типов

```json
{
    "PORT": 8080,
    "DEBUG": true,
    "TIMEOUT": 30,
    "RATES": [0.1, 0.2, 0.3]
}
```

```go
// JSONNumberAsString = true (по умолчанию)
port := loader.GetString("PORT")  // "8080" (строка)
port := loader.GetInt("PORT")     // 8080 (целое)

// JSONBoolAsString = true (по умолчанию)
debug := loader.GetString("DEBUG")  // "true" (строка)
debug := loader.GetBool("DEBUG")    // true (логическое)
```

## Формат YAML

### Структура файла

```yaml
# Конфигурация приложения
APP_NAME: myapp
APP_PORT: "8080"
DEBUG: true

# Конфигурация базы данных
DATABASE:
  HOST: localhost
  PORT: "5432"
  USER: postgres
  PASSWORD: secret

# Значения списков
ALLOWED_HOSTS:
  - localhost
  - example.com
```

### Разрешение имён ключей

Вложенные структуры YAML используют те же правила преобразования в плоский вид, что и JSON:

```go
loader.LoadFiles("config.yaml")

// Доступ через плоские ключи
host := loader.GetString("DATABASE_HOST")        // localhost
user := loader.GetString("DATABASE_USER")        // postgres
```

### Доступ к массивам

Списки YAML преобразуются в ключи с индексом:

```yaml
servers:
  - host: server1.example.com
    port: 8080
  - host: server2.example.com
    port: 8081
```

```go
// Доступ через плоские ключи
host0 := loader.GetString("SERVERS_0_HOST")  // server1.example.com
port0 := loader.GetInt("SERVERS_0_PORT")     // 8080
host1 := loader.GetString("SERVERS_1_HOST")  // server2.example.com

// Получение всего списка
hosts := env.GetSliceFrom[string](loader, "ALLOWED_HOSTS") // ["localhost", "example.com"]
```

### Конфигурация парсинга YAML

```go
cfg := env.DefaultConfig()

// Значение null/~ преобразуется в пустую строку (по умолчанию true)
cfg.YAMLNullAsEmpty = true

// Числа преобразуются в строки (по умолчанию true)
cfg.YAMLNumberAsString = true

// Логические значения преобразуются в строки (по умолчанию true)
cfg.YAMLBoolAsString = true

// Максимальная глубина вложенности (по умолчанию 10)
cfg.YAMLMaxDepth = 15
```

### Примеры преобразования типов

```yaml
PORT: 8080
DEBUG: true
TIMEOUT: 30
RATES:
  - 0.1
  - 0.2
  - 0.3
```

```go
// YAMLNumberAsString = true (по умолчанию)
port := loader.GetString("PORT")  // "8080" (строка)
port := loader.GetInt("PORT")     // 8080 (целое)

// YAMLBoolAsString = true (по умолчанию)
debug := loader.GetString("DEBUG")  // "true" (строка)
debug := loader.GetBool("DEBUG")    // true (логическое)

// Доступ к списку
rates := env.GetSliceFrom[float64](loader, "RATES")  // [0.1, 0.2, 0.3]
```

## Формат .env

### Структура файла

```bash
# Комментарии
APP_NAME=myapp
APP_PORT=8080
DEBUG=true

# Кавычки
MESSAGE="Hello World"
LITERAL='literal ${noexpand}'

# Подстановка переменных
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Значения по умолчанию
LOG_LEVEL=${LOG_LEVEL:-info}
```

### Подстановка переменных

```go
cfg := env.DefaultConfig()
cfg.ExpandVariables = true  // Включено по умолчанию

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

// Содержимое .env:
// BASE_URL=https://api.example.com
// API_URL=${BASE_URL}/v1

apiURL := loader.GetString("API_URL")
// Вывод: https://api.example.com/v1
```

### Синтаксис подстановки

| Синтаксис | Описание |
|------|------|
| `${VAR}` | Ссылка на переменную |
| `${VAR:-default}` | Использовать значение по умолчанию, если переменная не существует |

```bash
# Примеры подстановки
HOST=localhost
PORT=8080

# Ссылка на другие переменные
URL=http://${HOST}:${PORT}

# Значения по умолчанию
TIMEOUT=${TIMEOUT:-30s}
DEBUG=${DEBUG:-false}
```

### Синтаксис export

```bash
# Поддержка префикса export (когда AllowExportPrefix = true)
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
```

### Синтаксис в стиле YAML

```go
cfg := env.DefaultConfig()
cfg.AllowYamlSyntax = true  // Включить YAML-стиль
```

```bash
# Поддержка пар ключ-значение в стиле YAML
KEY: value
ANOTHER_KEY: "quoted value"
```

## Паттерны смешанной конфигурации

### Разделение разработки/продакшена

```text
config/
├── base.json          # Базовая конфигурация
├── development.env    # Переопределения для разработки
├── production.yaml    # Переопределения для продакшена
└── local.env          # Локальные переопределения (не коммитить)
```

```go
func loadConfig(loader *env.Loader) error {
    // 1. Базовая конфигурация
    if err := loader.LoadFiles("config/base.json"); err != nil {
        return err
    }

    // 2. Конфигурация окружения
    env := os.Getenv("APP_ENV")
    if env == "" {
        env = "development"
    }

    switch env {
    case "production":
        if err := loader.LoadFiles("config/production.yaml"); err != nil {
            return err
        }
    default:
        if err := loader.LoadFiles("config/development.env"); err != nil {
            return err
        }
    }

    // 3. Локальные переопределения (необязательно)
    if _, err := os.Stat("config/local.env"); err == nil {
        if err := loader.LoadFiles("config/local.env"); err != nil {
            return err
        }
    }

    return nil
}
```

### Разделение по функциональности

```text
config/
├── app.json       # Конфигурация приложения
├── database.yaml  # Конфигурация базы данных
├── redis.env      # Конфигурация Redis
└── secrets.json   # Конфигурация секретов
```

```go
loader.LoadFiles(
    "config/app.json",
    "config/database.yaml",
    "config/redis.env",
    "config/secrets.json",
)
```

### Приоритет конфигурации

```text
Аргументы командной строки > Переменные окружения > local конфигурация > конфигурация окружения > base конфигурация
```

## Сериализация

### Marshal

Сериализация конфигурации в указанный формат:

```go
data := map[string]string{
    "HOST": "localhost",
    "PORT": "8080",
}

// Формат .env (по умолчанию)
envStr, _ := env.Marshal(data)
// HOST=localhost
// PORT=8080

// Формат JSON
jsonStr, _ := env.Marshal(data, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// Формат YAML
yamlStr, _ := env.Marshal(data, env.FormatYAML)
// HOST: localhost
// PORT: "8080"
```

### Marshal структуры

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}

// В .env
envStr, _ := env.Marshal(cfg, env.FormatEnv)

// В JSON
jsonStr, _ := env.Marshal(cfg, env.FormatJSON)

// В YAML
yamlStr, _ := env.Marshal(cfg, env.FormatYAML)
```

### UnmarshalMap

Десериализация в map:

```go
// Из .env
envData := "HOST=localhost\nPORT=8080"
data, _ := env.UnmarshalMap(envData, env.FormatEnv)

// Из JSON
jsonData := `{"HOST":"localhost","PORT":"8080"}`
data, _ := env.UnmarshalMap(jsonData, env.FormatJSON)

// Из YAML
yamlData := "HOST: localhost\nPORT: \"8080\""
data, _ := env.UnmarshalMap(yamlData, env.FormatYAML)

// Автоопределение формата
data, _ := env.UnmarshalMap(jsonData, env.FormatAuto)
```

### UnmarshalStruct

Десериализация в структуру:

```go
type Config struct {
    Host string `env:"HOST"`
    Port int    `env:"PORT"`
}

var cfg Config

// Из .env
env.UnmarshalStruct("HOST=localhost\nPORT=8080", &cfg, env.FormatEnv)

// Из JSON
env.UnmarshalStruct(`{"HOST":"localhost","PORT":"8080"}`, &cfg, env.FormatJSON)

// Из YAML
env.UnmarshalStruct("HOST: localhost\nPORT: \"8080\"", &cfg, env.FormatYAML)
```

## Пользовательский формат

### Регистрация парсера

```go
// Определение константы формата
const FormatTOML env.FileFormat = 100

// Реализация интерфейса EnvParser
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // Реализация парсинга TOML
    result := make(map[string]string)
    // ...
    return result, nil
}

// Регистрация парсера
func init() {
    env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &TOMLParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
}
```

Подробнее в [Пользовательский парсер](/ru/env/guides/custom-parser).

## Полный пример

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    // Создание загрузчика
    cfg := env.DefaultConfig()
    cfg.ExpandVariables = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Загрузка смешанной конфигурации
    err = loader.LoadFiles(
        "config/base.json",       // JSON базовая конфигурация
        "config/database.yaml",   // YAML конфигурация БД
        "config/app.env",         // .env конфигурация приложения
    )
    if err != nil {
        log.Fatal(err)
    }

    // Чтение конфигурации
    fmt.Printf("App: %s\n", loader.GetString("APP_NAME"))
    fmt.Printf("DB Host: %s\n", loader.GetString("DATABASE_HOST"))
    fmt.Printf("DB Port: %d\n", loader.GetInt("DATABASE_PORT"))

    // Экспорт текущей конфигурации
    all := loader.All()
    exported, _ := env.Marshal(all, env.FormatEnv)
    fmt.Println("\nExported config:")
    fmt.Println(exported)
}
```

## Связанная документация

- [Сериализация](/ru/env/guides/serialization) - Подробно о сериализации/десериализации
- [ComponentFactory API](/ru/env/api-reference/factory) - Определение формата и регистрация парсеров
- [Пользовательский парсер](/ru/env/guides/custom-parser) - Добавление пользовательских форматов
- [Config API](/ru/env/api-reference/config) - Конфигурация парсинга JSON/YAML
