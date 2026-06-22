---
title: "Шпаргалка - CyberGo env | Быстрый справочник API"
description: "Шпаргалка CyberGo env: загрузка файлов, типобезопасное чтение, валидация, SecureValue-хранилище, сериализация и аудит — сниппеты на одной странице."
---

# Шпаргалка

При наличии базового понимания библиотеки, используйте этот быстрый справочник часто используемых фрагментов кода.

## Загрузка конфигурации

```go
// Загрузка на уровне пакета
env.Load(".env")                                        // Загрузка файла .env
env.Load(".env", ".env.local", "config.json")          // Несколько файлов

// Загрузка через загрузчик
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // Несколько файлов
```

## Чтение значений

```go
// Основные типы
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // Возвращает int64
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// Срезы (поддержка индексного формата KEY_0,KEY_1 или разделения запятыми)
env.GetSlice[string]("HOSTS", []string{"localhost"})
env.GetSlice[int64]("PORTS", []int64{80})
env.GetSlice[int]("PORTS", []int{80})          // также поддерживается int
env.GetSlice[float64]("RATES", []float64{0.1})

// Получение срезов из Loader
env.GetSliceFrom[string](loader, "HOSTS")
env.GetSliceFrom[int64](loader, "PORTS")

// Запросы
val, ok := env.Lookup("KEY")
keys := env.Keys()
all := env.All()
count := env.Len()

// Безопасное значение
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // или secret.Close()
    value := secret.Reveal()
    masked := secret.Masked()
}
```

## Разрешение имён ключей

```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все эти способы позволяют получить значение
env.GetString("APP_NAME")      // Плоское имя ключа (рекомендуется)
env.GetString("app.name")      // Путь через точку
env.GetString("APP.NAME")      // Путь через точку в верхнем регистре

// Индекс массива
env.GetString("servers.0.host")  // SERVERS_0_HOST
```

| Ввод | Преобразуется в |
|------|-----------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

## Маппинг структур

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

cfg := Config{}
env.ParseInto(&cfg)
```

## Предустановки конфигурации

| Предустановка | Назначение | Особенности |
|---------------|-----------|-------------|
| `DefaultConfig()` | Общие | Безопасные значения по умолчанию |
| `DevelopmentConfig()` | Разработка | Мягкие ограничения, поддержка синтаксиса YAML, лимит файла 10МБ |
| `TestingConfig()` | Тестирование | Перезапись существующих переменных, изоляция тестов, лимит файла 64КБ |
| `ProductionConfig()` | Производство | Строгая валидация + аудит, без перезаписи существующих переменных, лимит файла 64КБ |

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AllowedKeys = []string{"APP_NAME", "PORT"}
```

## Экземпляр Loader

```go
loader, _ := env.New(cfg)
defer loader.Close()

loader.LoadFiles(".env")
loader.GetString("KEY")
loader.Set("KEY", "value")
loader.Delete("KEY")
loader.Keys()
loader.All()
loader.Validate()
loader.Apply()  // Применить к os.Environ
loader.Len()    // Количество переменных
loader.LoadTime() // Время последней загрузки
loader.IsApplied() // Применено ли к системному окружению
loader.IsClosed()  // Закрыт ли загрузчик
loader.Config()    // Получить конфигурацию
```

## Обработка ошибок

```go
import "errors"

// Сторожевые ошибки
errors.Is(err, env.ErrFileNotFound)
errors.Is(err, env.ErrFileTooLarge)
errors.Is(err, env.ErrForbiddenKey)
errors.Is(err, env.ErrInvalidKey)
errors.Is(err, env.ErrClosed)
errors.Is(err, env.ErrAlreadyInitialized)

// Структурированные ошибки
var parseErr *env.ParseError
errors.As(err, &parseErr)
// parseErr.File, parseErr.Line

var fileErr *env.FileError
errors.As(err, &fileErr)
// fileErr.Path, fileErr.Size, fileErr.Limit

var secErr *env.SecurityError
errors.As(err, &secErr)
// secErr.Action, secErr.Reason
```

## Инструменты безопасности

```go
// Конфиденциальные значения
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
}

// Маскирование
log.Printf("Key: %s", secret.Masked())
log.Printf("Key: %s", env.MaskValue("API_KEY", "secret"))

// Обнаружение
env.IsSensitiveKey("PASSWORD")  // true
env.IsMemoryLockSupported()     // Linux/macOS/Windows: true

// Очистка
env.ClearBytes(sensitiveData)
clean := env.SanitizeForLog(msg)

// Маскирование имени ключа
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## Множественные среды

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // Один вызов, последующие перезаписывают предыдущие
```

## Многоформатность

```go
// Загрузка
loader.LoadFiles("config.env", "config.json", "config.yaml")

// Определение формата
format := env.DetectFormat("config.json")  // FormatJSON

// Сериализация
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// Десериализация
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // Автоопределение
```

## Синтаксис .env

```bash
# Комментарий
KEY=value
KEY="value with spaces"
KEY='literal ${noexpand}'
KEY=${OTHER_KEY}           # Ссылка на переменную
KEY=${MISSING:-default}    # Значение по умолчанию (если переменная не существует)
KEY=${MISSING:=default}    # Значение по умолчанию (если переменная не существует, аналогично :-)
KEY=${MISSING:?error}      # Сообщение об ошибке (если переменная не существует или пуста)
export KEY=value           # Стиль bash
KEY=$$                     # Экранированный знак доллара
```

## Логические значения

| Истина | Ложь |
|--------|------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## Форматы времени

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## Ограничивающие константы

| Параметр | По умолчанию | Жёсткий предел |
|----------|-------------|----------------|
| Размер файла | 2 МБ | 100 МБ |
| Длина строки | 1 КБ | 64 КБ |
| Длина ключа | 64 | 1024 |
| Длина значения | 4 КБ | 1 МБ |
| Количество переменных | 500 | 10000 |
| Глубина подстановки | 5 | 20 |

## Тестирование

```go
func TestExample(t *testing.T) {
    cfg := env.TestingConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.Set("KEY", "value")
    // Тестирование...
}

func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: %v", err)
    }
    os.Exit(m.Run())
}
```

## Встроенные запрещённые ключи

Следующие имена ключей запрещены к установке по умолчанию:

| Категория | Ключи |
|-----------|-------|
| Системные пути | `PATH` |
| Динамическая компоновка Linux | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Среды выполнения языков | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## Типы интерфейсов

```go
// Детализированные интерфейсы
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// Комбинированный интерфейс
// env.EnvLoader        // Комбинация всех вышеуказанных
```

## Связанная документация

- [Быстрый старт](/ru/env/getting-started) - Полный учебник
- [Функции пакета](/ru/env/api-reference/functions) - Подробный API
- [Loader API](/ru/env/api-reference/loader) - Методы Loader
- [Config API](/ru/env/api-reference/config) - Параметры конфигурации
- [Обработка ошибок](/ru/env/advanced/error-handling) - Шаблоны обработки ошибок
