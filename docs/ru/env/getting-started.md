---
title: Быстрый старт - CyberGo env | Руководство за 5 минут
description: Полное вводное руководство по быстрому освоению библиотеки управления переменными окружения CyberGo env за 5 минут, от установки через go get до запуска первой программы, охватывающее загрузку файлов конфигурации .env, типобезопасное чтение, отображение тегов структур, управление конфигурацией для нескольких сред и синтаксис подстановки переменных с подробными примерами кода на Go.
---

# Быстрый старт

Освойте библиотеку env за 5 минут: от установки до практического использования.

## Установка

```bash
go get github.com/cybergodev/env
```

::: tip Требования
Go 1.24+
:::

## Создание файла .env

Создайте файл `.env` в корневом каталоге проекта:

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

# Множественные значения (разделённые запятыми)
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
    // Загрузить файл .env и применить к системному окружению
    if err := env.Load(".env"); err != nil {
        panic(err)
    }

    // Получить переменные окружения
    host := env.GetString("DB_HOST", "localhost")
    port := env.GetInt("DB_PORT", 5432)

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## Чтение значений - все типы

### Базовые типы

```go
// === С значением по умолчанию ===

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

::: tip Разрешение ключей
Библиотека поддерживает несколько способов доступа к ключам:

```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все следующие способы получат это значение
name := env.GetString("APP_NAME")      // Плоский ключ (рекомендуется)
name := env.GetString("app.name")      // Путь через точку (автоматическое преобразование)
name := env.GetString("APP.NAME")      // Путь через точку в верхнем регистре
```

**Правила разрешения:**
1. **Точное совпадение**: приоритет поиска точного ключа `KEY`
2. **Преобразование в верхний регистр**: для ключей в нижнем регистре пробуется верхний регистр `key` → `KEY`
3. **Разрешение пути**: путь через точку преобразуется в подчёркивание `app.name` → `APP_NAME`
:::

### Поддерживаемые логические значения

`GetBool` поддерживает следующие значения (без учёта регистра):

| Истинные | Ложные |
|----------|--------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

### Типы срезов

```go
// Срез строк
hosts := env.GetSlice[string]("HOSTS", []string{"localhost"})

// Срез целых чисел (поддерживаются int, int64, uint, uint64)
ports := env.GetSlice[int64]("PORTS", []int64{80, 443})
portsInt := env.GetSlice[int]("PORTS")  // также поддерживается int

// Срез чисел с плавающей точкой
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Срез логических значений
flags := env.GetSlice[bool]("FLAGS", []bool{true, false})

// Срез Duration
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")
```

**Порядок разбора:**
1. Сначала поиск индексных ключей `KEY_0`, `KEY_1`, `KEY_2`...
2. Если индексных ключей нет, разбор значения `KEY` по запятым

```go
// Способ 1: индексные ключи (рекомендуется)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Способ 2: разделение запятыми
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS")  // [80, 443, 8080]
```

### Проверка и поиск

```go
// Проверить существование ключа
value, exists := env.Lookup("API_KEY")
if !exists {
    // Ключ не существует
}

// Получить все ключи
keys := env.Keys()

// Получить все пары ключ-значение
all := env.All()

// Получить количество переменных
count := env.Len()
```

### Безопасные значения

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Получить исходное значение
    value := secret.String()

    // Использование маски в логах (предотвращение утечки)
    log.Printf("API Key: %s", secret.Masked())  // Вывод: [SECURE:32 bytes]
}
```

## Отображение в структуру

Используйте теги для отображения переменных окружения в структуру:

```go
type Config struct {
    Host     string        `env:"DB_HOST" envDefault:"localhost"`
    Port     int64         `env:"DB_PORT" envDefault:"5432"`
    Password string        `env:"DB_PASSWORD"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"ALLOWED_HOSTS" envSeparator:","`
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

::: details Подробнее
Руководство по [отображению в структуру](/ru/env/guides/struct-mapping).
:::

## Предустановки конфигурации

Библиотека предоставляет четыре предустановки конфигурации для разных сценариев:

| Предустановка | Назначение | Особенности |
|---------------|------------|-------------|
| `DefaultConfig()` | Общие сценарии | Безопасные значения по умолчанию, подходит для большинства случаев |
| `DevelopmentConfig()` | Среда разработки | Мягкие ограничения, разрешена перезапись |
| `TestingConfig()` | Среда тестирования | Жёсткие ограничения, разрешена перезапись, подходит для модульных тестов |
| `ProductionConfig()` | Продакшен | Строгая валидация + аудит |

```go
// Среда разработки - мягкие ограничения
cfg := env.DevelopmentConfig()

// Среда тестирования - жёсткие ограничения
cfg := env.TestingConfig()

// Продакшен - строгая валидация + аудит
cfg := env.ProductionConfig()
```

### Подробное сравнение предустановок

| Функция | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Перезапись существующих переменных | ✗ | ✓ | ✓ | ✗ |
| Ошибка при отсутствии файла | ✗ | ✗ | ✗ | ✓ |
| Аудиторский журнал | ✗ | ✗ | ✗ | ✓ |
| YAML синтаксис | ✗ | ✓ | ✗ | ✗ |
| Ограничение размера файла | 2MB | 10MB | 64KB | 64KB |
| Максимум переменных | 500 | 500 | 50 | 50 |
| Проверка запрещённых ключей | ✓ | ✓ | ✓ | ✓ |
| Валидация значений | ✓ | ✓ | ✓ | ✓ |

::: tip Рекомендации по выбору
- **Среда разработки**: используйте `DevelopmentConfig()`, мягкие ограничения для быстрой итерации
- **Среда тестирования**: используйте `TestingConfig()`, разрешение перезаписи для изоляции тестов
- **Продакшен**: используйте `ProductionConfig()`, включён аудит и строгая валидация
:::

## Многосредовая конфигурация

### Загрузка по среде

```go
// Определить файл конфигурации на основе среды
goEnv := os.Getenv("GO_ENV")
if goEnv == "" {
    goEnv = "development"
}

// Загрузить все файлы конфигурации одним вызовом (по порядку, последующие перезаписывают предыдущие)
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
    // Создать конфигурацию
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // Создать загрузчик
    loader, err := env.New(cfg)
    if err != nil {
        panic(err)
    }
    defer loader.Close()

    // Загрузить файлы (по порядку, последующие перезаписывают предыдущие)
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

## Несколько файлов и форматов

### Загрузка нескольких файлов

Загрузка по порядку, последующие перезаписывают предыдущие:

```go
// Функции уровня пакета
env.Load(".env", "config.json", "config.yaml")

// Экземпляр Loader
loader.LoadFiles(".env", ".env.local")
```

### Многоформатная поддержка

Автоматическое обнаружение формата файла:

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

::: details Поддерживаемые форматы
| Формат | Расширение | Метод обнаружения |
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
    case errors.Is(err, env.ErrForbiddenKey):
        // Запрещённый ключ
    case errors.Is(err, env.ErrInvalidKey):
        // Недопустимый формат ключа
    default:
        // Другая ошибка
    }
}
```

::: details Получение подробной информации об ошибках
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

## Следующие шаги

<div class="vp-features">

### Углублённое изучение
- [Отображение в структуру](/ru/env/guides/struct-mapping) - детальная привязка конфигурации
- [Сериализация](/ru/env/guides/serialization) - сериализация и десериализация конфигурации
- [Многоформатная конфигурация](/ru/env/guides/multi-format) - подробности о JSON/YAML
- [Сценарии тестирования](/ru/env/guides/testing) - использование в тестах

### Справочник API
- [Функции пакета](/ru/env/api-reference/functions) - полный список функций уровня пакета
- [Loader API](/ru/env/api-reference/loader) - методы загрузчика
- [Config API](/ru/env/api-reference/config) - параметры конфигурации

### Безопасность
- [Обзор безопасности](/ru/env/security/) - архитектура безопасности и лучшие практики
- [SecureValue API](/ru/env/api-reference/secure-value) - обработка безопасных значений

</div>
