---
title: Функции пакета - CyberGo env | Глобальные удобные функции
description: Полная справочная документация API удобных функций уровня пакета библиотеки CyberGo env, предоставляющих лаконичный API для загрузки файлов конфигурации, чтения значений по типу, запроса списка ключей, экспорта сериализации и утилитарных функций, все на основе глобального Loader по умолчанию с ленивой инициализацией и потокобезопасным дизайном, подходящих для большинства стандартных сценариев использования Go.
---

# Функции пакета

Удобные функции уровня пакета предоставляют лаконичный API, подходящий для большинства сценариев использования. Эти функции используют глобальный загрузчик по умолчанию, все функции потокобезопасны.

::: tip Ленивая загрузка
Глобальный загрузчик по умолчанию использует механизм ленивой инициализации, автоматически создаваясь при первом вызове.
:::

## Функции загрузки

### Load

```go
func Load(filenames ...string) error
```

Загружает файлы переменных окружения и применяет их к системному окружению.

**Параметры:**
- `filenames` - список путей к файлам. Если не указан, файлы не загружаются; необходимо явно передать `".env"` для загрузки файла по умолчанию.

**Возвращаемое значение:**
- `error` - ошибка загрузки

**Поведение:**
- Создаёт новый экземпляр Loader и устанавливает его как загрузчик по умолчанию
- Автоматически применяет к системному окружению (`os.Environ`)
- Последующие файлы перезаписывают предыдущие
- Возвращает `ErrAlreadyInitialized`, если загрузчик по умолчанию уже инициализирован
- Поддерживает несколько форматов (.env, JSON, YAML)

```go
// Загрузить файл .env
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// Загрузить указанные файлы (по порядку, последующие перезаписывают предыдущие)
if err := env.Load(".env", ".env.local", "config.json"); err != nil {
    log.Fatal(err)
}

// Поддержка точечного пути для вложенных структур JSON
// config.json: {"database": {"host": "localhost", "port": 5432}}
env.Load("config.json")
host := env.GetString("database.host") // "localhost"
port := env.GetInt("database.port")    // 5432
```

---

## Разрешение ключей

Все функции получения поддерживают интеллектуальное разрешение ключей, обеспечивая гибкий доступ.

### Правила разрешения

**1. Точное совпадение (приоритет)**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. Преобразование в верхний регистр (простые ключи)**
```go
// Для ключей без точек автоматически пробуется верхний регистр
name := env.GetString("app_name")  // Поиск app_name -> APP_NAME
```

**3. Разрешение пути через точку (вложенные ключи)**
```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все следующие способы получат это значение
name := env.GetString("APP_NAME")   // Плоский ключ (рекомендуется)
name := env.GetString("app.name")   // Путь через точку (автоматическое преобразование)
name := env.GetString("APP.NAME")   // Путь через точку в верхнем регистре
```

### Таблица преобразования путей

| Входной ключ | Хранимый ключ |
|--------------|---------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"db.port"` | `"DB_PORT"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

### Индексный доступ

Элементы массива доступны по индексу или с откатом к значениям, разделённым запятыми:

```go
// JSON: {"servers": [{"host": "a.com"}, {"host": "b.com"}]}
// Хранится как: SERVERS_0_HOST=a.com, SERVERS_1_HOST=b.com

host0 := env.GetString("servers.0.host")  // "a.com"
host1 := env.GetString("servers.1.host")  // "b.com"

// Если ключ не существует, но есть базовое значение с запятыми
// HOSTS=localhost,example.com
host0 := env.GetString("hosts.0")  // "localhost" (из значения с запятыми)
```

---

## Функции получения значений

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

Получает строковое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает точное совпадение, преобразование в верхний регистр, путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `string` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается пустая строка)

```go
// Базовое использование
host := env.GetString("HOST", "localhost")

// Доступ через путь с точкой (вложенные структуры JSON/YAML)
dbHost := env.GetString("database.host", "localhost")
appName := env.GetString("app.name")

// Без значения по умолчанию возвращает пустую строку
value := env.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

Получает целочисленное значение. Автоматически преобразует строку в целое число. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию, тип `int64`

**Возвращаемое значение:**
- `int64` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается 0)

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)

// Без значения по умолчанию возвращает 0
value := env.GetInt("NON_EXISTENT")  // 0
```

---

### GetBool

```go
func GetBool(key string, defaultValue ...bool) bool
```

Получает логическое значение. Поддерживает разрешение пути через точку.

- **Истинные значения (без учёта регистра):** `true`, `1`, `yes`, `on`, `enabled`
- **Ложные значения (без учёта регистра):** `false`, `0`, `no`, `off`, `disabled`

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `bool` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается false)

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)

// Без значения по умолчанию возвращает false
value := env.GetBool("NON_EXISTENT")  // false
```

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Получает значение временного интервала. Поддерживает разрешение пути через точку.

**Поддерживаемые форматы:**
- `300ms` - миллисекунды
- `1.5s` - секунды
- `2m30s` - минуты + секунды
- `1h30m` - часы + минуты

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `time.Duration` - значение или значение по умолчанию (если не найдено и нет значения по умолчанию, возвращается 0)

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)

// Без значения по умолчанию возвращает 0
value := env.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

Получает безопасное значение (для конфиденциальных данных).

**Параметры:**
- `key` - имя ключа

**Возвращаемое значение:**
- `*SecureValue` - обёртка безопасного значения, возвращает nil если ключ не существует или загрузчик недоступен

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.String()
    masked := secret.Masked()  // Для логов: [SECURE:32 bytes]
}
```

::: warning Важно
После использования необходимо вызвать `Release()` или `Close()` для освобождения ресурсов. Рекомендуется использовать `defer` для гарантии освобождения.
:::

::: tip Подробнее
[SecureValue API](/ru/env/api-reference/secure-value) для полной документации API.
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

Обобщённая функция для получения значения среза.

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**Примечание:** Это обобщённая функция, а не метод Loader. Для получения среза из указанного экземпляра Loader используйте `GetSliceFrom[T]`.

**Порядок разбора:**
1. Сначала поиск индексных ключей `KEY_0`, `KEY_1`, `KEY_2`...
2. Если индексных ключей нет, разбор значения `KEY` по запятым
3. Поддерживает разрешение пути через точку

**Параметры:**
- `key` - имя ключа
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `[]T` - значение среза

```go
// Формат индексных ключей (рекомендуется)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Формат с разделением запятыми
// PORTS=80,443,8080
ports := env.GetSlice[int64]("PORTS", []int64{80})  // [80, 443, 8080]

// Срез чисел с плавающей точкой
rates := env.GetSlice[float64]("RATES", []float64{0.1, 0.2})

// Срез логических значений
flags := env.GetSlice[bool]("FLAGS")

// Срез Duration
timeouts := env.GetSlice[time.Duration]("TIMEOUTS")

// Срез беззнаковых целых
ports := env.GetSlice[uint]("PORTS")
port64s := env.GetSlice[uint64]("PORTS")

// Тип int
portInts := env.GetSlice[int]("PORTS")

// Без значения по умолчанию возвращает nil
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

Получает значение среза из указанного экземпляра Loader. Это независимая обобщённая функция (не метод Loader).

**Параметры:**
- `loader` - указатель на экземпляр Loader (если nil, возвращается значение по умолчанию)
- `key` - имя ключа
- `defaultValue` - необязательное значение по умолчанию

**Возвращаемое значение:**
- `[]T` - значение среза

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Получение среза из экземпляра loader
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})

// Также поддерживаются типы int, uint, uint64
portsInt := env.GetSliceFrom[int](loader, "PORTS")
portsUint := env.GetSliceFrom[uint](loader, "PORTS")
portsUint64 := env.GetSliceFrom[uint64](loader, "PORTS")
```

::: tip Различие
- `GetSlice[T]` - функция уровня пакета, использует загрузчик по умолчанию
- `GetSliceFrom[T]` - обобщённая функция для указанного экземпляра Loader (Go не поддерживает обобщённые методы)
:::

---

## Функции запросов

### Lookup

```go
func Lookup(key string) (string, bool)
```

Проверяет существование ключа и получает значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - имя ключа (поддерживает путь через точку)

**Возвращаемое значение:**
- `string` - значение (пробелы по краям удалены)
- `bool` - существует ли

```go
value, exists := env.Lookup("API_KEY")
if !exists {
    // Ключ не существует
}

// Путь через точку
if value, exists := env.Lookup("database.host"); exists {
    fmt.Println(value)
}
```

---

### Keys

```go
func Keys() []string
```

Получает все имена ключей.

**Возвращаемое значение:**
- `[]string` - список ключей, возвращает nil если загрузчик недоступен

```go
keys := env.Keys()
for _, key := range keys {
    fmt.Println(key)
}
```

---

### All

```go
func All() map[string]string
```

Получает все пары ключ-значение.

**Возвращаемое значение:**
- `map[string]string` - отображение ключей и значений, возвращает nil если загрузчик недоступен

```go
all := env.All()
for key, value := range all {
    fmt.Printf("%s=%s\n", key, value)
}
```

---

### Len

```go
func Len() int
```

Получает количество переменных.

**Возвращаемое значение:**
- `int` - количество переменных, возвращает 0 если загрузчик недоступен

```go
count := env.Len()
fmt.Printf("Загружено %d переменных окружения\n", count)
```

---

## Установка и удаление

### Set

```go
func Set(key, value string) error
```

Устанавливает переменную окружения.

**Параметры:**
- `key` - имя ключа
- `value` - значение

**Возвращаемое значение:**
- `error` - ошибка установки

**Типы ошибок:**
- `ErrInvalidKey` - недопустимое имя ключа
- `ErrForbiddenKey` - ключ запрещён
- `ErrClosed` - загрузчик закрыт

```go
if err := env.Set("CUSTOM_KEY", "value"); err != nil {
    // Может быть ErrForbiddenKey или ErrInvalidKey
}
```

---

### Delete

```go
func Delete(key string) error
```

Удаляет переменную окружения.

**Параметры:**
- `key` - имя ключа

**Возвращаемое значение:**
- `error` - ошибка удаления

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

---

## Валидация и отображение

### Validate

```go
func Validate() error
```

Проверяет наличие обязательных ключей. Требует установки RequiredKeys в Config.

**Возвращаемое значение:**
- `error` - ошибка валидации

```go
// Необходимо сначала настроить RequiredKeys (через пользовательский загрузчик)
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

loader, _ := env.New(cfg)
loader.LoadFiles(".env")

if err := loader.Validate(); err != nil {
    // Отсутствует обязательный ключ
}
```

---

### ParseInto

```go
func ParseInto(v interface{}) error
```

Отображает переменные окружения в структуру.

**Параметры:**
- `v` - указатель на структуру

**Возвращаемое значение:**
- `error` - ошибка отображения

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int64  `env:"PORT" envDefault:"8080"`
}

var cfg Config
if err := env.ParseInto(&cfg); err != nil {
    panic(err)
}
```

**Теги структуры:**
| Тег | Описание |
|-----|----------|
| `env:"KEY"` | Отображение на указанный ключ |
| `env:"-"` | Игнорировать это поле |
| `envDefault:"value"` | Значение по умолчанию |
| `envSeparator:","` | Разделитель среза |

::: tip Подробнее
[Отображение в структуру](/ru/env/guides/struct-mapping) для полного руководства.
:::

---

## Утилитарные функции

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Сбрасывает глобальный загрузчик по умолчанию. В основном используется в сценариях тестирования.

**Возвращаемое значение:**
- `error` - ошибка закрытия старого загрузчика (если он существует); nil если предыдущего загрузчика не было или закрытие прошло успешно

**Поведение:**
- Атомарно заменяет загрузчик по умолчанию на nil
- Закрывает старый загрузчик (вне блокировки, чтобы избежать блокировки)
- Позволяет создать новый загрузчик по умолчанию

```go
func TestMain(m *testing.M) {
    if err := env.ResetDefaultLoader(); err != nil {
        log.Printf("warning: failed to reset loader: %v", err)
    }
    os.Exit(m.Run())
}

func TestSomething(t *testing.T) {
    if err := env.ResetDefaultLoader(); err != nil {
        t.Logf("warning: %v", err)
    }
    defer env.ResetDefaultLoader()
    // ... код теста
}
```

::: warning Внимание
Эта функция потокобезопасна, но вызывайте её только в тестах или при запуске, чтобы избежать непредвиденного поведения.
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

Инициализирует загрузчик по умолчанию с пользовательской конфигурацией.

**Параметры:**
- `cfg` - пользовательская конфигурация

**Возвращаемое значение:**
- `error` - ошибка инициализации

**Поведение:**
- Устанавливает загрузчик по умолчанию на уровне пакета (используется функциями `GetString`, `GetInt` и т.д.)
- **Принудительно** `AutoApply = true` (независимо от настройки в cfg)
- Возвращает `ErrAlreadyInitialized`, если загрузчик по умолчанию уже инициализирован

**Отличие от Load:**
- `Load()` - принимает только список имён файлов, использует конфигурацию по умолчанию
- `LoadWithConfig()` - принимает полную Config, поддерживает все параметры конфигурации

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}
cfg.OverwriteExisting = true
if err := env.LoadWithConfig(cfg); err != nil {
    log.Fatal(err)
}
// Теперь можно использовать функции уровня пакета
port := env.GetInt("PORT", 8080)
```

::: warning Внимание
Эта функция принудительно устанавливает `cfg.AutoApply` в `true`, гарантируя применение переменных к системному окружению. Для контроля момента применения используйте `New()` для создания независимого экземпляра.
:::

---

## Функции сериализации

### Marshal

```go
func Marshal(data interface{}, format ...FileFormat) (string, error)
```

Сериализует данные в строку указанного формата. Поддерживает `map[string]string` или структуру в качестве входных данных.

**Интеграция интерфейсов:** Если входной тип реализует интерфейс `Marshaler`, приоритет отдаётся вызову метода `MarshalEnv()`.

**Параметры:**
- `data` - данные для сериализации (map или структура)
- `format` - необязательный формат, по умолчанию `FormatEnv`

**Возвращаемое значение:**
- `string` - сериализованная строка (ключи отсортированы)
- `error` - ошибка сериализации

**Поддерживаемые форматы:**
- `FormatEnv` (по умолчанию) - формат .env
- `FormatJSON` - формат JSON
- `FormatYAML` - формат YAML

```go
// map в формат .env
mapData := map[string]string{"HOST": "localhost", "PORT": "8080"}
envStr, _ := env.Marshal(mapData)
// HOST=localhost
// PORT=8080

// map в формат JSON
jsonStr, _ := env.Marshal(mapData, env.FormatJSON)
// {"HOST":"localhost","PORT":"8080"}

// Структура в формат .env
type Config struct {
    Host string `env:"HOST"`
    Port string `env:"PORT"`
}
envStr, _ := env.Marshal(Config{Host: "localhost", Port: "8080"})
```

---

### UnmarshalMap

```go
func UnmarshalMap(data string, format ...FileFormat) (map[string]string, error)
```

Разбирает форматированную строку в map. Поддерживает автоматическое обнаружение формата.

**Параметры:**
- `data` - форматированная строка
- `format` - необязательный формат, по умолчанию `FormatEnv`; используйте `FormatAuto` для автоматического обнаружения

**Возвращаемое значение:**
- `map[string]string` - разобранные пары ключ-значение
- `error` - ошибка разбора

```go
// Формат .env
m, _ := env.UnmarshalMap("HOST=localhost\nPORT=8080")

// Формат JSON (вложенные структуры будут плоскими)
m, _ := env.UnmarshalMap(`{"database": {"host": "localhost"}}`, env.FormatJSON)
// m["DATABASE_HOST"] = "localhost"

// Автоматическое обнаружение формата
m, _ := env.UnmarshalMap(jsonString, env.FormatAuto)
```

---

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v interface{}, format ...FileFormat) error
```

Разбирает форматированную строку и заполняет структуру.

**Параметры:**
- `data` - форматированная строка
- `v` - указатель на структуру
- `format` - необязательный формат, по умолчанию `FormatEnv`

**Возвращаемое значение:**
- `error` - ошибка разбора

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

var cfg Config
err := env.UnmarshalStruct("SERVER_HOST=localhost\nSERVER_PORT=8080", &cfg)
// cfg.Host = "localhost", cfg.Port = 8080

// Из JSON
err = env.UnmarshalStruct(`{"server": {"host": "localhost"}}`, &cfg, env.FormatJSON)
```

---

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v interface{}) error
```

Заполняет структуру из map. Поддерживает теги `env` и `envDefault`.

**Интеграция интерфейсов:** Если целевой тип реализует интерфейс `Unmarshaler`, приоритет отдаётся вызову метода `UnmarshalEnv(data)`.

**Параметры:**
- `data` - отображение пар ключ-значение
- `v` - указатель на структуру

**Возвращаемое значение:**
- `error` - ошибка заполнения

```go
type Config struct {
    Host string `env:"HOST" envDefault:"localhost"`
    Port int    `env:"PORT" envDefault:"8080"`
}

data := map[string]string{"HOST": "example.com"}
var cfg Config
err := env.UnmarshalInto(data, &cfg)
// cfg.Host = "example.com", cfg.Port = 8080 (используется значение по умолчанию)
```

---

### MarshalStruct

```go
func MarshalStruct(v interface{}) (map[string]string, error)
```

Преобразует структуру в map. Поддерживает теги `env` для указания имён ключей.

**Интеграция интерфейсов:** Если входной тип реализует интерфейс `Marshaler`, приоритет отдаётся вызову метода `MarshalEnv()`.

**Параметры:**
- `v` - структура или указатель на структуру

**Возвращаемое значение:**
- `map[string]string` - отображение пар ключ-значение
- `error` - ошибка преобразования

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

cfg := Config{Host: "localhost", Port: 8080}
m, _ := env.MarshalStruct(cfg)
// m["SERVER_HOST"] = "localhost"
// m["SERVER_PORT"] = "8080"
```

---

### IsMarshalError

```go
func IsMarshalError(err error) bool
```

Проверяет, является ли ошибка ошибкой сериализации/десериализации.

**Параметры:**
- `err` - ошибка для проверки

**Возвращаемое значение:**
- `bool` - является ли ошибкой типа MarshalError

```go
_, err := env.MarshalStruct(invalidData)
if env.IsMarshalError(err) {
    // Обработка ошибки сериализации
}
```

---

## Полный пример

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/env"
)

type AppConfig struct {
    Host     string        `env:"APP_HOST" envDefault:"0.0.0.0"`
    Port     int64         `env:"APP_PORT" envDefault:"8080"`
    Debug    bool          `env:"DEBUG" envDefault:"false"`
    Timeout  time.Duration `env:"TIMEOUT" envDefault:"30s"`
    Hosts    []string      `env:"HOSTS" envSeparator:","`
}

func main() {
    // Загрузить файл конфигурации
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // Прочитать отдельные значения
    host := env.GetString("APP_HOST", "localhost")
    port := env.GetInt("APP_PORT", 8080)
    debug := env.GetBool("DEBUG", false)
    timeout := env.GetDuration("TIMEOUT", 30*time.Second)

    fmt.Printf("Server: %s:%d\n", host, port)
    fmt.Printf("Debug: %v, Timeout: %v\n", debug, timeout)

    // Конфиденциальные данные
    secret := env.GetSecure("API_KEY")
    if secret != nil {
        defer secret.Release()
        fmt.Printf("API Key length: %d\n", secret.Length())
    }

    // Отображение в структуру
    var cfg AppConfig
    if err := env.ParseInto(&cfg); err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Config: %+v\n", cfg)

    // Все переменные
    fmt.Printf("Loaded %d variables\n", env.Len())
}
```

## Связанная документация

- [Loader API](/ru/env/api-reference/loader) - методы экземпляра Loader
- [Config API](/ru/env/api-reference/config) - параметры конфигурации
- [SecureValue API](/ru/env/api-reference/secure-value) - обработка безопасных значений
- [Отображение в структуру](/ru/env/guides/struct-mapping) - руководство по отображению в структуру
