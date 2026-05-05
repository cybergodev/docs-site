---
title: Шпаргалка - CyberGo env | Часто используемые API
description: Шпаргалка по часто используемым API библиотеки управления переменными окружения CyberGo env, одностраничная сводка основных фрагментов кода для загрузки файлов конфигурации, типобезопасного чтения, валидации переменных, безопасного хранения SecureValue, сериализации и десериализации, отображения в структуру и аудиторского протоколирования для повседневного использования Go-разработчиками.
---

# Шпаргалка

При условии знакомства с библиотекой, быстрая справка по часто используемым фрагментам кода.

## Загрузка конфигурации

```go
// Загрузка на уровне пакета
env.Load(".env")                                        // Загрузить файл .env
env.Load(".env", ".env.local", "config.json")          // Несколько файлов

// Загрузка через загрузчик
loader, _ := env.New()
loader.LoadFiles("config.json")                         // JSON
loader.LoadFiles("config.yaml")                         // YAML
loader.LoadFiles(".env", ".env.local", "config.json")   // Несколько файлов
```

## Чтение значений

```go
// Базовые типы
env.GetString("KEY", "default")
env.GetInt("PORT", 8080)              // Возвращает int64
env.GetBool("DEBUG", false)
env.GetDuration("TIMEOUT", 30*time.Second)

// Срезы (поддерживаются индексный формат KEY_0,KEY_1 или разделение запятыми)
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

// Безопасные значения
secret := env.GetSecure("PASSWORD")
if secret != nil {
    defer secret.Release()  // или secret.Close()
    value := secret.String()
    masked := secret.Masked()
}
```

## Разрешение ключей

```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все следующие способы доступа работают
env.GetString("APP_NAME")      // Плоский ключ (рекомендуется)
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

## Отображение в структуру

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
|---------------|------------|-------------|
| `DefaultConfig()` | Общие | Безопасные значения по умолчанию |
| `DevelopmentConfig()` | Разработка | Мягкие ограничения, поддержка YAML синтаксиса, лимит файла 10MB |
| `TestingConfig()` | Тестирование | Перезапись существующих переменных, изоляция тестов, лимит файла 64KB |
| `ProductionConfig()` | Продакшен | Строгая валидация + аудит, без перезаписи существующих переменных, лимит файла 64KB |

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
loader.IsClosed()  // Закрыт ли
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

// Маскирование ключей
masked := env.MaskKey("DB_PASSWORD")  // "DB***"
```

## Несколько сред

```go
goEnv := os.Getenv("GO_ENV")
if goEnv == "" { goEnv = "development" }
env.Load(".env", ".env."+goEnv, ".env.local")  // Один вызов, последующие перезаписывают предыдущие
```

## Несколько форматов

```go
// Загрузка
loader.LoadFiles("config.env", "config.json", "config.yaml")

// Обнаружение формата
format := env.DetectFormat("config.json")  // FormatJSON

// Сериализация
env.Marshal(data, env.FormatEnv)
env.Marshal(data, env.FormatJSON)
env.Marshal(data, env.FormatYAML)

// Десериализация
env.UnmarshalMap(data, env.FormatEnv)
env.UnmarshalMap(data, env.FormatAuto)  // Автоматическое обнаружение
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
KEY=${MISSING:?error}      # Сообщение об ошибке (ошибка если переменная не существует или пуста)
export KEY=value           # Стиль bash
KEY=$$                     # Экранированный знак доллара
```

## Логические значения

| Истинные | Ложные |
|----------|--------|
| `true`, `1`, `yes`, `on`, `enabled` | `false`, `0`, `no`, `off`, `disabled` |

## Форматы времени

```bash
TIMEOUT=30s
INTERVAL=5m
DURATION=1h30m
```

## Ограничения

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| Размер файла | 2 MB | 100 MB |
| Длина строки | 1 KB | 64 KB |
| Длина ключа | 64 | 1024 |
| Длина значения | 4 KB | 1 MB |
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

Следующие ключи запрещены к установке по умолчанию:

| Категория | Ключи |
|-----------|-------|
| Системные пути | `PATH` |
| Динамическая компоновка Linux | `LD_PRELOAD`, `LD_LIBRARY_PATH`, `LD_DEBUG`, `LD_AUDIT`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Среды выполнения языков | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

## Типы интерфейсов

```go
// Тонкогранулярные интерфейсы
// env.EnvFileLoader    // LoadFiles
// env.EnvGetter        // GetString, Lookup, Keys, All
// env.EnvSetter        // Set, Delete
// env.EnvApplicator    // Apply
// env.EnvCloser        // Close

// Композиционные интерфейсы
// env.EnvLoader        // Комбинация всех вышеперечисленных
```

## Связанная документация

- [Быстрый старт](/ru/env/getting-started) - полное руководство
- [Функции пакета](/ru/env/api-reference/functions) - подробный API
- [Loader API](/ru/env/api-reference/loader) - методы Loader
- [Config API](/ru/env/api-reference/config) - параметры конфигурации
- [Обработка ошибок](/ru/env/advanced/error-handling) - шаблоны обработки ошибок
