---
title: "Loader API - CyberGo env | Подробно о загрузчике"
description: "Справочник API Loader в CyberGo env: загрузка файлов, типобезопасное чтение, операции с ключами, валидация, сериализация и Close — всё потокобезопасно."
---

# Loader API

Полный справочник методов типа `Loader`. Loader — основной тип библиотеки env, обеспечивающий загрузку, хранение и доступ к переменным окружения.

:::tip Потокобезопасность
Все методы Loader потокобезопасны и могут вызываться параллельно из нескольких goroutine.
:::

## Определение типа

```go
type Loader struct {
    // Содержит приватные поля
}

// Проверка реализации интерфейса во время компиляции
var _ EnvLoader = (*Loader)(nil)
var _ io.Closer = (*Loader)(nil)
```

---

## Создание

### New

```go
func New(cfg ...Config) (*Loader, error)
```

Создаёт новый экземпляр загрузчика.

**Параметры:**
- `cfg` - Необязательные параметры конфигурации. Если не предоставлен или передана нулевая Config, автоматически используется `DefaultConfig()`

**Возвращает:**
- `*Loader` - Экземпляр загрузчика
- `error` - Ошибка валидации конфигурации

**Поведение:**
- Проверяет валидность конфигурации
- Создаёт внутренние компоненты (валидатор, аудитор, раскрыватель)
- Если `cfg.Filenames` не пуст, автоматически загружает файлы
- Если `cfg.AutoApply` равно true, автоматически применяется к системному окружению

```go
// Использование конфигурации по умолчанию
loader, err := env.New()

// Использование пользовательской конфигурации
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env"}
cfg.AutoApply = true
loader, err := env.New(cfg)

if err != nil {
    panic(err)
}
defer loader.Close()
```

---

## Загрузка файлов

### LoadFiles

```go
func (l *Loader) LoadFiles(filenames ...string) error
```

Загружает один или несколько файлов конфигурации.

**Параметры:**
- `filenames` - Список путей к файлам; при пустом значении по умолчанию загружает `.env`

**Возвращает:**
- `error` - Ошибка загрузки

**Поведение:**
- Загружает по порядку; позже загруженные перезаписывают ранее загруженные (управляется параметром `OverwriteExisting`)
- Автоматически определяет формат файла (.env, JSON, YAML)
- Поведение при отсутствии файла определяется конфигурацией `FailOnMissingFile`
- Если `AutoApply` равно true, автоматически применяется после загрузки

```go
// Загрузка файла .env по умолчанию
err := loader.LoadFiles()

// Загрузка указанных файлов
err := loader.LoadFiles(".env", ".env.local")

// Смешанные форматы
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**Типы ошибок:**
- `ErrFileNotFound` - Файл не найден (когда `FailOnMissingFile=true`)
- `ErrFileTooLarge` - Файл превышает ограничение размера
- `ErrClosed` - Загрузчик закрыт
- `*ParseError` - Ошибка разбора
- `*JSONError` - Ошибка разбора JSON
- `*YAMLError` - Ошибка разбора YAML

**Правила определения формата:**

| Расширение | Формат |
|------------|--------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| Другие | FormatAuto (используется парсер .env) |

---

## Получение значений

### Разрешение имён ключей

Все методы получения поддерживают интеллектуальное разрешение имён ключей:

| Входной ключ | Результат разрешения |
|--------------|---------------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (точное совпадение) |
| `"database.host"` | `"DATABASE_HOST"` (точки в подчёркивания) |
| `"app.name"` | `"APP_NAME"` (верхний регистр + подчёркивания) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (индекс массива) |

**Порядок разбора:**
1. Точное совпадение - прямой поиск имени ключа
2. Преобразование в верхний регистр - для простых ключей пробуется версия в верхнем регистре
3. Разрешение пути - путь через точку преобразуется в формат с подчёркиваниями
4. Откат по индексу - при доступе по индексу откатывается к значениям, разделённым запятыми

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

Получает строковое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает точное совпадение, преобразование регистра, путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `string` - Значение или значение по умолчанию (возвращает пустую строку, если не найдено и нет значения по умолчанию)

```go
// Базовое использование
host := loader.GetString("HOST", "localhost")

// Доступ через путь с точкой (вложенные структуры JSON/YAML)
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")

// Возвращает пустую строку при отсутствии значения по умолчанию
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

Получает целочисленное значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `int64`

**Возвращает:**
- `int64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)

// Возвращает 0 при отсутствии значения по умолчанию
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

Получает логическое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `bool` - Значение или значение по умолчанию (возвращает false, если не найдено и нет значения по умолчанию)

**Поддерживаемые значения:**
- Истинные: `true`, `1`, `yes`, `on`, `enabled`
- Ложные: `false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)

// Возвращает false при отсутствии значения по умолчанию
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func (l *Loader) GetUint64(key string, defaultValue ...uint64) uint64
```

Получает беззнаковое целочисленное значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `uint64`

**Возвращает:**
- `uint64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
port := loader.GetUint64("PORT", 8080)
maxSize := loader.GetUint64("MAX_SIZE", 1024)

// Возвращает 0 при отсутствии значения по умолчанию
value := loader.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func (l *Loader) GetFloat64(key string, defaultValue ...float64) float64
```

Получает значение с плавающей точкой. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `float64`

**Возвращает:**
- `float64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
rate := loader.GetFloat64("RATE", 0.5)
threshold := loader.GetFloat64("THRESHOLD")

// Возвращает 0 при отсутствии значения по умолчанию
value := loader.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Получает значение временного интервала. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `time.Duration` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

**Поддерживаемые форматы:** `ns`, `us`, `ms`, `s`, `m`, `h` (например, `30s`, `5m`, `1h30m`)

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)

// Возвращает 0 при отсутствии значения по умолчанию
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Получает безопасное значение (защита конфиденциальных данных).

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `*SecureValue` - **Защитная копия** безопасного значения; вызывающий ответственен за освобождение; nil если ключ не существует или загрузчик закрыт

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()

    value := secret.Reveal()
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

:::warning Важно
После использования необходимо вызвать `Release()` или `Close()` для освобождения ресурсов.
:::

:::tip Защитная копия
`GetSecure` возвращает копию исходного значения, независимую от родительского Loader. Вызывающий ответственен за вызов `Release()` или `Close()` для освобождения.
:::

:::tip Подробнее
[SecureValue API](/ru/env/api-reference/secure-value) - полная документация.
:::

---

### Получение значений среза

Loader не предоставляет методов получения срезов (Go не поддерживает универсальные методы). Используйте отдельную универсальную функцию `GetSliceFrom[T]` для получения среза из экземпляра Loader:

```go
// Использование отдельной универсальной функции
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")  // Также поддерживает int
```

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

:::tip Подробнее
[Функции пакета - GetSliceFrom](/ru/env/api-reference/functions#getslicefrom-t) - полная документация.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

Проверяет существование ключа и получает значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)

**Возвращает:**
- `string` - Значение (начальные и конечные пробелы удалены)
- `bool` - Существует ли

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // Ключ не существует
}

// Путь через точку
if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

// Доступ по индексу (откат к значениям, разделённым запятыми)
// HOSTS=localhost,example.com
if value, exists := loader.Lookup("hosts.0"); exists {
    fmt.Println(value)  // "localhost"
}
```

---

## Установка и удаление

### Set

```go
func (l *Loader) Set(key, value string) error
```

Устанавливает переменную окружения.

**Параметры:**
- `key` - Имя ключа
- `value` - Значение

**Возвращает:**
- `error` - Ошибка установки

**Поведение:**
- Проверяет валидность имени ключа
- Если `ValidateValues` равно true, проверяет безопасность значения
- Если `OverwriteExisting` равно false и ключ уже существует, пропускает (возвращает nil)
- Если `AutoApply` равно true, также устанавливает в системное окружение

```go
err := loader.Set("CUSTOM_KEY", "value")
if err != nil {
    // Обработка ошибки
}
```

**Типы ошибок:**
- `ErrInvalidKey` - Имя ключа недействительно
- `ErrForbiddenKey` - Ключ запрещён
- `ErrClosed` - Загрузчик закрыт

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

Удаляет переменную окружения.

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `error` - Ошибка удаления

**Поведение:**
- Если переменная применена к системному окружению, также удаляется из системного окружения

```go
err := loader.Delete("TEMP_KEY")
if err != nil {
    panic(err)
}
```

---

## Операции с коллекциями

### Keys

```go
func (l *Loader) Keys() []string
```

Получает все имена ключей.

**Возвращает:**
- `[]string` - Список ключей; возвращает nil если загрузчик закрыт

```go
keys := loader.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func (l *Loader) All() map[string]string
```

Получает все пары ключ-значение.

**Возвращает:**
- `map[string]string` - Отображение ключ-значение; возвращает nil если загрузчик закрыт

```go
all := loader.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func (l *Loader) Len() int
```

Получает количество переменных.

**Возвращает:**
- `int` - Количество переменных; возвращает 0 если загрузчик закрыт

```go
count := loader.Len()
fmt.Printf("Загружено %d переменных\n", count)
```

---

## Применение к системе

### Apply

```go
func (l *Loader) Apply() error
```

Применяет переменные к системному окружению (`os.Environ`).

**Возвращает:**
- `error` - Ошибка применения

**Поведение:**
- Перебирает все загруженные переменные
- Перезапись существующих системных переменных окружения определяется конфигурацией `OverwriteExisting`
- После применения доступно через `os.Getenv()`

```go
err := loader.Apply()
if err != nil {
    panic(err)
}

// Теперь os.Getenv() также может получить доступ
host := os.Getenv("HOST")
```

---

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

Проверяет, применены ли переменные к системному окружению.

**Возвращает:**
- `bool` - Применено ли

```go
if loader.IsApplied() {
    // Переменные применены к os.Environ
}
```

---

## Запрос состояния

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

Возвращает время последней загрузки файла.

**Возвращает:**
- `time.Time` - Время загрузки; возвращает нулевое значение если не загружен

```go
loadTime := loader.LoadTime()
if !loadTime.IsZero() {
    fmt.Printf("Время последней загрузки: %v\n", loadTime)
}
```

---

### Config

```go
func (l *Loader) Config() Config
```

Возвращает конфигурацию загрузчика.

**Возвращает:**
- `Config` - Конфигурация (следует рассматривать как только для чтения)

:::warning Внимание
Возвращённая Config должна рассматриваться как только для чтения. Изменение полей `KeyPattern`, `AllowedKeys`, `ForbiddenKeys`, `RequiredKeys` и других может повлиять на поведение загрузчика. Для безопасной изменяемой копии вручную скопируйте нужные поля.
:::

```go
cfg := loader.Config()
fmt.Printf("Максимальный размер файла: %d\n", cfg.MaxFileSize)
```

---

## Валидация и маппинг

### Validate

```go
func (l *Loader) Validate() error
```

Проверяет наличие обязательных ключей.

**Возвращает:**
- `error` - Ошибка валидации

**Поведение:**
- Проверяет, существуют ли все ключи, указанные в `Config.RequiredKeys`

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // Отсутствуют обязательные ключи
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("Отсутствует: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v any) error
```

Маппит переменные окружения в структуру.

**Параметры:**
- `v` - Указатель на структуру

**Возвращает:**
- `error` - Ошибка маппинга

**Поддерживаемые теги:**
- `env:"KEY"` - Указывает имя переменной окружения
- `env:"-"` - Игнорирует это поле
- `envDefault:"value"` - Указывает значение по умолчанию
- `envSeparator:","` - Указывает разделитель срезов

```go
type Config struct {
    Host    string   `env:"HOST" envDefault:"localhost"`
    Port    int64    `env:"PORT" envDefault:"8080"`
    Debug   bool     `env:"DEBUG" envDefault:"false"`
    Hosts   []string `env:"HOSTS" envSeparator:","`
    Ignored string   `env:"-"`
}

var cfg Config
err := loader.ParseInto(&cfg)
if err != nil {
    panic(err)
}
```

---

## Освобождение ресурсов

### Close

```go
func (l *Loader) Close() error
```

Освобождает ресурсы и очищает хранилище.

**Возвращает:**
- `error` - Ошибка закрытия

**Поведение:**
- Безопасно обнуляет все хранимые конфиденциальные данные
- Если загрузчик владеет ComponentFactory, также закрывает фабрику
- Безопасное закрытие; повторные вызовы возвращают nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Использование loader...
```

:::warning Поведение после закрытия
После закрытия все операции возвращают ошибку или нулевые значения:
- `LoadFiles` -> `ErrClosed`
- `GetString` -> Возвращает пустое значение
- `Set` -> `ErrClosed`
- `Keys` -> Возвращает nil
- `Len` -> Возвращает 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

Проверяет, закрыт ли загрузчик.

**Возвращает:**
- `bool` - Закрыт ли

```go
if loader.IsClosed() {
    // Загрузчик закрыт
}
```

---

## Полный пример

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/cybergodev/env"
)

func main() {
    // Создание конфигурации для производственной среды
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
    cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

    // Создание загрузчика
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Загрузка файлов
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Fatal("Конфигурационный файл не найден")
        }
        log.Fatal(err)
    }

    // Проверка обязательных ключей
    if err := loader.Validate(); err != nil {
        log.Fatal("Отсутствует обязательная конфигурация:", err)
    }

    // Чтение конфигурации
    host := loader.GetString("DB_HOST")
    port := loader.GetInt("DB_PORT", 5432)
    debug := loader.GetBool("DEBUG", false)
    timeout := loader.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // Конфиденциальные данные
    secret := loader.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // Применение к системному окружению
    if err := loader.Apply(); err != nil {
        log.Fatal(err)
    }

    // Все переменные
    fmt.Printf("Loaded %d variables\n", loader.Len())
    fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## Связанная документация

- [Функции пакета](/ru/env/api-reference/functions) - Пакетные удобные функции
- [Config API](/ru/env/api-reference/config) - Параметры конфигурации
- [SecureValue API](/ru/env/api-reference/secure-value) - Обработка безопасных значений
- [Определения интерфейсов](/ru/env/api-reference/interfaces) - Все определения интерфейсов
