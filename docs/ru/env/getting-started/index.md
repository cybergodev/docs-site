---
sidebar_label: "Быстрый старт"
title: "Быстрый старт - CyberGo env | Руководство на 5 минут"
description: "CyberGo env за 5 минут: go get, .env, типобезопасное чтение, GetSecure, маппинг структур, ${VAR}, errors.Is, четыре пресета и многофайловая загрузка."
sidebar_position: 1
---

# Быстрый старт

Начните работу с библиотекой env за 5 минут — от установки до практического использования.

## Установка

```bash
go get github.com/cybergodev/env
```

::: tip Требование
Go 1.25+
:::

## Создание файла .env

Создайте файл `.env` в корне проекта:

```bash
# Конфигурация базы данных
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=secret

# Конфигурация приложения
DEBUG=true
APP_NAME=myapp
LOG_LEVEL=info

# Множественные значения (через запятую)
ALLOWED_HOSTS=localhost,example.com,api.example.com
```

## Простейшее использование

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // Загрузка файла .env и применение к системному окружению
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    // Получение переменных окружения
    host := env.GetString("DB_HOST", "localhost")
    port := env.GetInt("DB_PORT", 5432)

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## Чтение значений - все типы

### Основные типы

```go
// === Со значением по умолчанию ===

// Строка - если не найдено, возвращается значение по умолчанию "localhost"
host := env.GetString("HOST", "localhost")

// Целое число (int64) - если не найдено, возвращается значение по умолчанию 8080
port := env.GetInt("PORT", 8080)

// Логическое значение - если не найдено, возвращается значение по умолчанию false
debug := env.GetBool("DEBUG", false)

// Временной интервал - если не найдено, возвращается значение по умолчанию 30s
timeout := env.GetDuration("TIMEOUT", 30*time.Second)


// === Без значения по умолчанию ===

// Строка - если не найдено, возвращается пустая строка ""
host := env.GetString("HOST")

// Целое число (int64) - если не найдено, возвращается 0
port := env.GetInt("PORT")

// Логическое значение - если не найдено, возвращается false
debug := env.GetBool("DEBUG")

// Временной интервал - если не найдено, возвращается 0
timeout := env.GetDuration("TIMEOUT")
```

::: tip Разрешение имён ключей
Библиотека поддерживает несколько способов доступа к ключам:

```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все эти способы позволяют получить значение
name := env.GetString("APP_NAME")      // Плоское имя ключа (рекомендуется)
name := env.GetString("app.name")      // Путь через точку (автопреобразование)
name := env.GetString("APP.NAME")      // Путь через точку в верхнем регистре
```

**Правила разрешения:**
1. **Точное совпадение**: приоритет поиска точного имени ключа `KEY`
2. **Преобразование в верхний регистр**: для ключей в нижнем регистре пробуется версия в верхнем `key` → `KEY`
3. **Разрешение пути**: путь через точку преобразуется в подчёркивание `app.name` → `APP_NAME`
:::

### Поддержка логических значений

`GetBool` поддерживает следующие значения (без учёта регистра):

| Истина | Ложь |
|--------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

### Тип среза

```go
// Срез строк
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// Срез целых чисел (поддерживаются int, int64, uint, uint64)
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // также поддерживается тип int

// Срез чисел с плавающей точкой
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Срез логических значений
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Срез Duration
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**Порядок разбора:**
1. Сначала поиск индексных ключей `KEY_0`, `KEY_1`, `KEY_2`...
2. Если индексных ключей нет, значение `KEY` разбирается с разделением по запятой

```go
// Способ 1: индексные ключи (рекомендуется)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Способ 2: разделение запятой
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### Проверка и поиск

```go
// Проверка существования ключа
value, exists := env.Lookup("API_KEY")
if !exists {
    // Ключ не существует
}

// Получение всех ключей
keys := env.Keys()

// Получение всех пар ключ-значение
all := env.All()

// Получение количества переменных
count := env.Len()
```

### Безопасное значение

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Получение исходного значения (вызывать только когда нужно открытое значение, напр. криптооперации, API-вызовы)
    value := secret.Reveal()

    // Использование маски в логах (предотвращает утечку)
    log.Printf("API Key: %s", secret.Masked())  // Вывод: [SECURE:32 bytes]
}
```

## Маппинг структур

Используйте теги для маппинга переменных окружения в структуру:

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/env"
)

type Config struct {
    Host     string        `env:"DB_HOST" envDefault:"localhost"`
    Port     int64         `env:"DB_PORT" envDefault:"5432"`
    Password string        `env:"DB_PASSWORD"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"ALLOWED_HOSTS"`
}

func main() {
    env.Load(".env")

    var cfg Config
    if err := env.ParseInto(&cfg); err != nil {
        panic(err)
    }

    fmt.Printf("%+v\n", cfg)
}
```

::: details Подробности
Руководство по [маппингу структур](/ru/env/guides/struct-mapping).
:::

## Предустановки конфигурации

Библиотека предоставляет четыре предустановки конфигурации для разных сценариев:

| Предустановка | Назначение | Особенности |
|---------------|-----------|-------------|
| `DefaultConfig()` | Общие случаи | Безопасные значения по умолчанию, подходят для большинства ситуаций |
| `DevelopmentConfig()` | Среда разработки | Мягкие ограничения, разрешена перезапись |
| `TestingConfig()` | Среда тестирования | Жёсткие ограничения, разрешена перезапись, подходит для модульных тестов |
| `ProductionConfig()` | Среда производства | Строгая валидация + аудиторский лог |

```go
// Среда разработки - мягкие ограничения
cfg := env.DevelopmentConfig()

// Среда тестирования - жёсткие ограничения
cfg := env.TestingConfig()

// Среда производства - строгая валидация + аудиторский лог
cfg := env.ProductionConfig()
```

### Подробное сравнение предустановок

| Функция | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Перезапись существующих переменных | ✗ | ✓ | ✓ | ✗ |
| Ошибка при отсутствии файла | ✗ | ✗ | ✗ | ✓ |
| Аудиторский лог | ✗ | ✗ | ✗ | ✓ |
| Синтаксис YAML | ✗ | ✓ | ✗ | ✗ |
| Ограничение размера файла | 2МБ | 10МБ | 64КБ | 64КБ |
| Макс. количество переменных | 500 | 500 | 50 | 50 |
| Проверка запрещённых ключей | ✓ | ✓ | ✓ | ✓ |
| Валидация значений | ✓ | ✓ | ✓ | ✓ |

::: tip Рекомендации по выбору
- **Среда разработки**: используйте `DevelopmentConfig()`, мягкие ограничения для быстрой итерации
- **Среда тестирования**: используйте `TestingConfig()`, разрешена перезапись для изоляции тестов
- **Среда производства**: используйте `ProductionConfig()`, включает аудит и строгую валидацию
:::

## Конфигурация для разных сред

### Загрузка по среде

```go
// Определение файла конфигурации по среде
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// Один вызов загружает все файлы конфигурации (по порядку, последующие перезаписывают предыдущие)
env.Load(".env", ".env."+goEnv, ".env.local")
```

### Использование экземпляра Loader

Когда требуется больше контроля, используйте экземпляр Loader:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

func main() {
    // Создание конфигурации
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // Создание загрузчика
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // Загрузка файлов (по порядку, последующие перезаписывают предыдущие)
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        panic(err)
    }

    // Валидация обязательных ключей
    if err := loader.Validate(); err != nil {
        panic(err)
    }

    // Использование
    host := loader.GetString("DB_HOST")
    fmt.Println("Host:", host)
}
```

## Множественные файлы и форматы

### Загрузка нескольких файлов

Загрузка по порядку, последующие перезаписывают предыдущие:

::: code-group

```go [Функции уровня пакета]
env.Load(".env", "config.json", "config.yaml")
```

```go [Экземпляр Loader]
loader.LoadFiles(".env", ".env.local")
```

:::

### Многоформатная поддержка

Автоматическое определение формата файла:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

::: details Поддерживаемые форматы
| Формат | Расширение | Метод определения |
|--------|-----------|-------------------|
| .env | `.env` | Расширение файла |
| JSON | `.json` | Расширение файла |
| YAML | `.yaml`, `.yml` | Расширение файла |
:::

## Обработка ошибок

```go
import "errors"

err := loader.LoadFiles(".env")
if err != nil {
    switch {
    case errors.Is(err, env.ErrFileNotFound):
        // Файл не найден
    case errors.Is(err, env.ErrFileTooLarge):
        // Файл слишком большой
    case errors.Is(err, env.ErrSecurityViolation):
        // Запрещённый ключ (фактически возвращается *SecurityError)
    default:
        // Другая ошибка
    }

    // Недопустимый формат ключа: фактически возвращается *ValidationError, Field=="key"
    var valErr *env.ValidationError
    if errors.As(err, &valErr) && valErr.Field == "key" {
        // Недопустимый формат ключа
    }
}
```

::: details Получение подробной информации об ошибке
```go
// Подробности ошибки разбора
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("Файл %s строка %d: %v\n", parseErr.File, parseErr.Line, parseErr.Err)
}

// Подробности ошибки файла
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("Файл %s операция %s не удалась: %v\n", fileErr.Path, fileErr.Op, fileErr.Err)
}

// Подробности ошибки безопасности
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Ошибка безопасности: %s - %s\n", secErr.Action, secErr.Reason)
}
```
:::

## Дальнейшие шаги

<div class="vp-features">

### Углублённое изучение
- [Маппинг структур](/ru/env/guides/struct-mapping) - Подробная привязка конфигурации
- [Сериализация](/ru/env/guides/serialization) - Сериализация и десериализация конфигурации
- [Многоформатная конфигурация](/ru/env/guides/multi-format) - Подробно о JSON/YAML
- [Сценарии тестирования](/ru/env/guides/testing) - Использование в тестах

### API справочник
- [Функции пакета](/ru/env/api-reference/functions) - Полный список функций уровня пакета
- [Loader API](/ru/env/api-reference/loader) - Методы загрузчика
- [Config API](/ru/env/api-reference/config) - Параметры конфигурации

### Безопасность
- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и лучшие практики
- [SecureValue API](/ru/env/api-reference/secure-value) - Обработка безопасных значений

</div>
