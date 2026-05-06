---
title: Loader API - CyberGo env | Подробно о загрузчике
description: Полная справочная документация API типа Loader библиотеки CyberGo env. Loader — это основной тип, предоставляющий методы для многоформатной загрузки файлов, типобезопасного чтения, операций с наборами ключ-значение, обработки подстановки переменных, экспорта сериализации и управления жизненным циклом, все методы потокобезопасны и подходят для стабильного использования в высококонкурентной среде Go.
---

# Loader API

Полный справочник методов типа `Loader`. Loader — основной тип библиотеки env, предоставляющий функции загрузки, хранения и доступа к переменным окружения.

::: tip Совет Потокобезопасность
Все методы Loader потокобезопасны и могут вызываться параллельно из нескольких goroutine.
:::

## Определение типа

```go
type Loader struct {
    // Содержит приватные поля
}

// Проверка реализации интерфейсов при компиляции
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
- `cfg` - необязательные параметры конфигурации. Если не указаны или передана нулевая Config, автоматически используется `DefaultConfig()`

**Возвращаемое значение:**
- `*Loader` - экземпляр загрузчика
- `error` - ошибка валидации конфигурации

**Поведение:**
- Проверяет валидность конфигурации
- Создаёт внутренние компоненты (валидатор, аудитор, расширитель)
- Если `cfg.Filenames` не пуст, автоматически загружает файлы
- Если `cfg.AutoApply` равно true, автоматически применяет к системному окружению

```go
// С конфигурацией по умолчанию
loader, err := env.New()

// С пользовательской конфигурацией
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
- `filenames` - список путей к файлам, если пусто, по умолчанию загружается `.env`

**Возвращаемое значение:**
- `error` - ошибка загрузки

**Поведение:**
- Загружает по порядку, последующие перезаписывают предыдущие (управляется параметром `OverwriteExisting`)
- Автоматически обнаруживает формат файла (.env, JSON, YAML)
- Поведение при отсутствии файла определяется параметром `FailOnMissingFile`
- Если `AutoApply` равно true, автоматически применяет после загрузки

```go
// Загрузить файл .env по умолчанию
err := loader.LoadFiles()

// Загрузить указанные файлы
err := loader.LoadFiles(".env", ".env.local")

// Смешанные форматы
err := loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
```

**Типы ошибок:**
- `ErrFileNotFound` - файл не найден (когда `FailOnMissingFile=true`)
- `ErrFileTooLarge` - файл превышает ограничение размера
- `ErrClosed` - загрузчик закрыт
- `*ParseError` - ошибка разбора
- `*JSONError` - ошибка разбора JSON
- `*YAMLError` - ошибка разбора YAML

**Правила обнаружения формата:**

| Расширение | Формат |
|------------|--------|
| `.env` | FormatEnv |
| `.json` | FormatJSON |
| `.yaml`, `.yml` | FormatYAML |
| Другие | FormatAuto (используется парсер .env) |

---

## Получение значений

### Разрешение ключей

Все методы получения поддерживают интеллектуальное разрешение ключей:

| Входной ключ | Результат разрешения |
|--------------|---------------------|
| `"DATABASE_HOST"` | `"DATABASE_HOST"` (точное совпадение) |
| `"database.host"` | `"DATABASE_HOST"` (точка в подчёркивание) |
| `"app.name"` | `"APP_NAME"` (верхний регистр + подчёркивание) |
| `"servers.0.host"` | `"SERVERS_0_HOST"` (индекс массива) |

**Порядок разрешения:**
1. Точное совпадение - прямой поиск ключа
2. Преобразование в верхний регистр - для простых ключей пробуется верхний регистр
3. Разрешение пути - путь через точку преобразуется в формат с подчёркиваниями
4. Откат к индексу - при индексном доступе откат к значениям через запятую

---

### GetString

```go
func (l *Loader) GetString(key string, defaultValue ...string) string
```

Получает строковое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает точное совпадение, преобразование в верхний регистр, путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `string` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается пустая строка)

```go
host := loader.GetString("HOST", "localhost")
dbHost := loader.GetString("database.host", "localhost")
appName := loader.GetString("app.name")
value := loader.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func (l *Loader) GetInt(key string, defaultValue ...int64) int64
```

Получает целочисленное значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию, тип `int64`

**Возвращаемое значение:**
- `int64` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается 0)

```go
port := loader.GetInt("PORT", 8080)
maxConn := loader.GetInt("database.max_connections", 10)
value := loader.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func (l *Loader) GetBool(key string, defaultValue ...bool) bool
```

Получает логическое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `bool` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается false)

**Поддерживаемые значения:**
- Истинные: `true`, `1`, `yes`, `on`, `enabled`
- Ложные: `false`, `0`, `no`, `off`, `disabled`

```go
debug := loader.GetBool("DEBUG", false)
cacheEnabled := loader.GetBool("cache.enabled", true)
value := loader.GetBool("NON_EXISTENT")  // false
```

---

### GetDuration

```go
func (l *Loader) GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Получает значение временного интервала. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `time.Duration` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается 0)

**Поддерживаемые форматы:** `ns`, `us`, `ms`, `s`, `m`, `h` (например, `30s`, `5m`, `1h30m`)

```go
timeout := loader.GetDuration("TIMEOUT", 30*time.Second)
ttl := loader.GetDuration("cache.ttl", 5*time.Minute)
value := loader.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Получает безопасное значение (защита конфиденциальных данных).

**Параметры:**
- `key` - имя ключа

**Возвращаемое значение:**
- `*SecureValue` - **защитная копия** безопасного значения, вызывающий отвечает за освобождение; возвращает nil если ключ не существует или загрузчик закрыт

```go
secret := loader.GetSecure("API_SECRET")
if secret != nil {
    defer secret.Release()
    value := secret.String()
    masked := secret.Masked()  // [SECURE:32 bytes]
}
```

::: warning Внимание Важно
После использования необходимо вызвать `Release()` или `Close()` для освобождения ресурсов.
:::

::: tip Совет Защитная копия
`GetSecure` возвращает копию исходного значения, независимую от родительского Loader. Вызывающий отвечает за вызов `Release()` или `Close()`.
:::

::: tip Совет Подробнее
[SecureValue API](/ru/env/api-reference/secure-value) для полной документации.
:::

---

### Получение значений срезов

Loader не предоставляет методов получения срезов (Go не поддерживает обобщённые методы). Используйте независимую обобщённую функцию `GetSliceFrom[T]`:

```go
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})
portsInt := env.GetSliceFrom[int](loader, "PORTS")
```

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

::: tip Совет Подробнее
[Функции пакета - GetSliceFrom](/ru/env/api-reference/functions#getslicefrom-t) для полной документации.
:::

---

### Lookup

```go
func (l *Loader) Lookup(key string) (string, bool)
```

Проверяет существование ключа и получает значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)

**Возвращаемое значение:**
- `string` - значение (пробелы по краям удалены)
- `bool` - существует ли

```go
value, exists := loader.Lookup("API_KEY")
if !exists {
    // Ключ не существует
}

if value, exists := loader.Lookup("database.host"); exists {
    fmt.Println(value)
}

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
- `key` - имя ключа
- `value` - значение

**Возвращаемое значение:**
- `error` - ошибка установки

**Поведение:**
- Проверяет валидность имени ключа
- Если `ValidateValues` равно true, проверяет безопасность значения
- Если `OverwriteExisting` равно false и ключ уже существует, пропускает (возвращает nil)
- Если `AutoApply` равно true, одновременно устанавливает в системное окружение

**Типы ошибок:**
- `ErrInvalidKey` - недопустимое имя ключа
- `ErrForbiddenKey` - ключ запрещён
- `ErrClosed` - загрузчик закрыт

---

### Delete

```go
func (l *Loader) Delete(key string) error
```

Удаляет переменную окружения.

**Параметры:**
- `key` - имя ключа

**Возвращаемое значение:**
- `error` - ошибка удаления

**Поведение:**
- Если переменная была применена к системному окружению, также удаляется из него

---

## Операции с коллекциями

### Keys

```go
func (l *Loader) Keys() []string
```

Получает все имена ключей. Возвращает nil если загрузчик закрыт.

### All

```go
func (l *Loader) All() map[string]string
```

Получает все пары ключ-значение. Возвращает nil если загрузчик закрыт.

### Len

```go
func (l *Loader) Len() int
```

Получает количество переменных. Возвращает 0 если загрузчик закрыт.

---

## Применение к системе

### Apply

```go
func (l *Loader) Apply() error
```

Применяет переменные к системному окружению (`os.Environ`).

**Поведение:**
- Перебирает все загруженные переменные
- В зависимости от `OverwriteExisting` решает, перезаписывать ли существующие системные переменные
- После применения доступно через `os.Getenv()`

### IsApplied

```go
func (l *Loader) IsApplied() bool
```

Проверяет, применены ли переменные к системному окружению.

---

## Запрос состояния

### LoadTime

```go
func (l *Loader) LoadTime() time.Time
```

Возвращает время последней загрузки файла. Нулевое значение если загрузки не было.

### Config

```go
func (l *Loader) Config() Config
```

Возвращает конфигурацию загрузчика (следует считать только для чтения).

::: warning Внимание
Возвращаемую Config следует считать только для чтения. Изменение полей `KeyPattern`, `AllowedKeys`, `ForbiddenKeys`, `RequiredKeys` может повлиять на поведение загрузчика.
:::

---

## Валидация и отображение

### Validate

```go
func (l *Loader) Validate() error
```

Проверяет наличие всех обязательных ключей, указанных в `Config.RequiredKeys`.

**Возвращает:**
- `error` - ошибка валидации

**Поведение:**
- Проверяет наличие всех ключей, указанных в `Config.RequiredKeys`

```go
cfg := env.DefaultConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // Отсутствует обязательный ключ
    var missingErr *env.ValidationError
    if errors.As(err, &missingErr) {
        fmt.Printf("Отсутствует: %s\n", missingErr.Field)
    }
}
```

---

### ParseInto

```go
func (l *Loader) ParseInto(v interface{}) error
```

Отображает переменные окружения в структуру.

**Параметры:**
- `v` - указатель на структуру

**Возвращает:**
- `error` - ошибка отображения

**Поддерживаемые теги:**
- `env:"KEY"` - указывает имя переменной окружения
- `env:"-"` - игнорировать это поле
- `envDefault:"value"` - указывает значение по умолчанию
- `envSeparator:","` - указывает разделитель для срезов

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
- `error` - ошибка закрытия

**Поведение:**
- Безопасно обнуляет все хранимые конфиденциальные данные
- Если загрузчик владеет ComponentFactory, также закрывает фабрику
- Безопасное закрытие, многократный вызов возвращает nil

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Использование загрузчика...
```

::: warning Поведение после закрытия
После закрытия все операции возвращают ошибки или нулевые значения:
- `LoadFiles` → `ErrClosed`
- `GetString` → возвращает пустое значение
- `Set` → `ErrClosed`
- `Keys` → возвращает nil
- `Len` → возвращает 0
:::

---

### IsClosed

```go
func (l *Loader) IsClosed() bool
```

Проверяет, закрыт ли загрузчик.

**Возвращает:**
- `bool` - закрыт ли загрузчик

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
    // Создать конфигурацию продакшена
    cfg := env.ProductionConfig()
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
    cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

    // Создать загрузчик
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Загрузить файлы
    if err := loader.LoadFiles(".env", ".env.production"); err != nil {
        if errors.Is(err, env.ErrFileNotFound) {
            log.Fatal("Файл конфигурации не найден")
        }
        log.Fatal(err)
    }

    // Валидация обязательных ключей
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

    // Применить к системному окружению
    if err := loader.Apply(); err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Loaded %d variables\n", loader.Len())
    fmt.Printf("Load time: %v\n", loader.LoadTime())
}
```

## Связанная документация

- [Функции пакета](/ru/env/api-reference/functions) - удобные функции уровня пакета
- [Config API](/ru/env/api-reference/config) - параметры конфигурации
- [SecureValue API](/ru/env/api-reference/secure-value) - обработка безопасных значений
- [Определения интерфейсов](/ru/env/api-reference/interfaces) - все определения интерфейсов
