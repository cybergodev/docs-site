---
title: "Функции пакета - CyberGo env | Глобальные удобные функции"
description: "Полный справочник API пакетных удобных функций библиотеки CyberGo env: Load для загрузки файлов, GetString и GetInt для чтения значений по типу, Keys для запроса имён ключей, Marshal для экспорта сериализации и ParseInto для маппинга структур. Основан на глобальном загрузчике по умолчанию с ленивой инициализацией и потокобезопасным дизайном."
---

# Функции пакета

Пакетные удобные функции предоставляют лаконичный API, подходящий для большинства сценариев использования. Эти функции используют глобальный загрузчик по умолчанию, все функции потокобезопасны.

:::tip Ленивая загрузка
Глобальный загрузчик по умолчанию использует механизм ленивой загрузки, автоматически создаваясь при первом вызове.
:::

## Функции загрузки

### Load

```go
func Load(filenames ...string) error
```

Загружает файлы переменных окружения и применяет к системному окружению.

**Параметры:**
- `filenames` - Список путей к файлам. Если не предоставлен, файлы не загружаются; необходимо явно передать `".env"` для загрузки файла по умолчанию.

**Возвращает:**
- `error` - Ошибка загрузки

**Поведение:**
- Создаёт новый экземпляр Loader и устанавливает его как загрузчик по умолчанию
- Автоматически применяется к системному окружению (`os.Environ`)
- Файлы, загруженные позже, перезаписывают загруженные ранее
- Возвращает `ErrAlreadyInitialized`, если загрузчик по умолчанию уже инициализирован
- Поддерживает несколько форматов (.env, JSON, YAML)

```go
// Загрузка файла .env
if err := env.Load(".env"); err != nil {
    log.Fatal(err)
}

// Загрузка указанных файлов (по порядку, поздние перезаписывают ранние)
if err := env.Load(".env", ".env.local", "config.json"); err != nil {
    log.Fatal(err)
}

// Вложенные структуры JSON/YAML поддерживают доступ через точку
// config.json: {"database": {"host": "localhost", "port": 5432}}
env.Load("config.json")
host := env.GetString("database.host") // "localhost"
port := env.GetInt("database.port")    // 5432
```

---

## Разрешение имён ключей

Все функции получения поддерживают интеллектуальное разрешение имён ключей, обеспечивая гибкий доступ.

### Правила разрешения

**1. Точное совпадение (приоритет)**
```go
// .env: APP_NAME=myapp
name := env.GetString("APP_NAME")  // "myapp"
```

**2. Преобразование в верхний регистр (простые ключи)**
```go
// Для ключей без точек автоматически пробуется версия в верхнем регистре
name := env.GetString("app_name")  // Поиск app_name -> APP_NAME
```

**3. Разрешение пути через точку (вложенные ключи)**
```go
// JSON: {"app": {"name": "myapp"}}
// Хранится как: APP_NAME=myapp

// Все следующие способы позволяют получить значение
name := env.GetString("APP_NAME")   // Плоское имя ключа (рекомендуется)
name := env.GetString("app.name")   // Путь через точку (автоматическое преобразование)
name := env.GetString("APP.NAME")   // Путь через точку в верхнем регистре
```

### Таблица преобразования путей

| Входное имя ключа | Имя ключа хранения |
|-------------------|-------------------|
| `"database.host"` | `"DATABASE_HOST"` |
| `"db.port"` | `"DB_PORT"` |
| `"servers.0.host"` | `"SERVERS_0_HOST"` |
| `"app.config.name"` | `"APP_CONFIG_NAME"` |

### Доступ по индексу

Элементы массива доступны по индексу, или откат к значениям, разделённым запятыми:

```go
// JSON: {"servers": [{"host": "a.com"}, {"host": "b.com"}]}
// Хранится как: SERVERS_0_HOST=a.com, SERVERS_1_HOST=b.com

host0 := env.GetString("servers.0.host")  // "a.com"
host1 := env.GetString("servers.1.host")  // "b.com"

// Если ключ не существует, но есть значение с разделителями-запятыми
// HOSTS=localhost,example.com
host0 := env.GetString("hosts.0")  // "localhost" (разобрано из значения с разделителями-запятыми)
```

---

## Функции получения значений

### GetString

```go
func GetString(key string, defaultValue ...string) string
```

Получает строковое значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает точное совпадение, преобразование регистра, путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `string` - Значение или значение по умолчанию (возвращает пустую строку, если не найдено и нет значения по умолчанию)

```go
// Базовое использование
host := env.GetString("HOST", "localhost")

// Доступ через путь с точкой (вложенные структуры JSON/YAML)
dbHost := env.GetString("database.host", "localhost")
appName := env.GetString("app.name")

// Возвращает пустую строку при отсутствии значения по умолчанию
value := env.GetString("NON_EXISTENT")  // ""
```

---

### GetInt

```go
func GetInt(key string, defaultValue ...int64) int64
```

Получает целочисленное значение. Автоматически преобразует строку в целое число. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `int64`

**Возвращает:**
- `int64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
port := env.GetInt("PORT", 8080)
maxConn := env.GetInt("database.max_connections", 10)

// Возвращает 0 при отсутствии значения по умолчанию
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
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `bool` - Значение или значение по умолчанию (возвращает false, если не найдено и нет значения по умолчанию)

```go
debug := env.GetBool("DEBUG", false)
cacheEnabled := env.GetBool("cache.enabled", true)

// Возвращает false при отсутствии значения по умолчанию
value := env.GetBool("NON_EXISTENT")  // false
```

---

### GetUint64

```go
func GetUint64(key string, defaultValue ...uint64) uint64
```

Получает беззнаковое целочисленное значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `uint64`

**Возвращает:**
- `uint64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
port := env.GetUint64("PORT", 8080)
maxSize := env.GetUint64("MAX_SIZE", 1024)

// Возвращает 0 при отсутствии значения по умолчанию
value := env.GetUint64("NON_EXISTENT")  // 0
```

---

### GetFloat64

```go
func GetFloat64(key string, defaultValue ...float64) float64
```

Получает значение с плавающей точкой. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию, тип `float64`

**Возвращает:**
- `float64` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
rate := env.GetFloat64("RATE", 0.5)
threshold := env.GetFloat64("THRESHOLD")

// Возвращает 0 при отсутствии значения по умолчанию
value := env.GetFloat64("NON_EXISTENT")  // 0
```

---

### GetDuration

```go
func GetDuration(key string, defaultValue ...time.Duration) time.Duration
```

Получает значение временного интервала. Поддерживает разрешение пути через точку.

**Поддерживаемые форматы:**
- `300ms` - Миллисекунды
- `1.5s` - Секунды
- `2m30s` - Минуты + секунды
- `1h30m` - Часы + минуты

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `time.Duration` - Значение или значение по умолчанию (возвращает 0, если не найдено и нет значения по умолчанию)

```go
timeout := env.GetDuration("TIMEOUT", 30*time.Second)
interval := env.GetDuration("INTERVAL", 5*time.Minute)

// Возвращает 0 при отсутствии значения по умолчанию
value := env.GetDuration("NON_EXISTENT")  // 0
```

---

### GetSecure

```go
func GetSecure(key string) *SecureValue
```

Получает безопасное значение (для конфиденциальных данных).

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `*SecureValue` - Обёртка безопасного значения; nil если ключ не существует или загрузчик недоступен

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    value := secret.String()
    masked := secret.Masked()  // для логов: [SECURE:32 bytes]
}
```

:::warning Важно
После использования необходимо вызвать `Release()` или `Close()` для освобождения ресурсов. Рекомендуется использовать `defer` для гарантии освобождения.
:::

:::tip Подробнее
[SecureValue API](/ru/env/api-reference/secure-value) - полная документация API.
:::

---

### GetSlice[T]

```go
func GetSlice[T sliceElement](key string, defaultValue ...[]T) []T
```

Универсальная функция, получает значение среза.

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

**Примечание:** Это универсальная функция, а не метод Loader. Для получения среза из указанного экземпляра Loader используйте `GetSliceFrom[T]`.

**Порядок разбора:**
1. Сначала поиск индексных ключей `KEY_0`, `KEY_1`, `KEY_2`...
2. Если индексных ключей нет, разбор значения `KEY` по запятым
3. Поддерживает разрешение пути через точку

**Параметры:**
- `key` - Имя ключа
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `[]T` - Значение среза

```go
// Формат индексных ключей (рекомендуется)
// HOSTS_0=localhost
// HOSTS_1=example.com
hosts := env.GetSlice[string]("HOSTS")  // ["localhost", "example.com"]

// Формат с запятыми
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

// Возвращает nil при отсутствии значения по умолчанию
value := env.GetSlice[string]("NON_EXISTENT")  // nil
```

---

### GetSliceFrom[T]

```go
func GetSliceFrom[T sliceElement](loader *Loader, key string, defaultValue ...[]T) []T
```

Получает значение среза из указанного экземпляра Loader. Это отдельная универсальная функция (не метод Loader).

**Параметры:**
- `loader` - Указатель на экземпляр Loader (если nil, возвращает значение по умолчанию)
- `key` - Имя ключа
- `defaultValue` - Необязательное значение по умолчанию

**Возвращает:**
- `[]T` - Значение среза

**Поддерживаемые типы:** `string`, `int`, `int64`, `uint`, `uint64`, `bool`, `float64`, `time.Duration`

```go
loader, _ := env.New(cfg)
defer loader.Close()

// Получение среза из экземпляра loader
hosts := env.GetSliceFrom[string](loader, "HOSTS")
ports := env.GetSliceFrom[int64](loader, "PORTS", []int64{80})

// Также поддерживает типы int, uint, uint64
portsInt := env.GetSliceFrom[int](loader, "PORTS")
portsUint := env.GetSliceFrom[uint](loader, "PORTS")
portsUint64 := env.GetSliceFrom[uint64](loader, "PORTS")
```

:::tip Разница
- `GetSlice[T]` - Пакетная функция, использующая загрузчик по умолчанию
- `GetSliceFrom[T]` - Универсальная функция для указанного экземпляра Loader (Go не поддерживает универсальные методы)
:::

---

## Функции запросов

### Lookup

```go
func Lookup(key string) (string, bool)
```

Проверяет существование ключа и получает значение. Поддерживает разрешение пути через точку.

**Параметры:**
- `key` - Имя ключа (поддерживает путь через точку)

**Возвращает:**
- `string` - Значение (начальные и конечные пробелы удалены)
- `bool` - Существует ли

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

**Возвращает:**
- `[]string` - Список ключей; nil если загрузчик недоступен

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

**Возвращает:**
- `map[string]string` - Маппинг ключ-значение; nil если загрузчик недоступен

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

**Возвращает:**
- `int` - Количество переменных; 0 если загрузчик недоступен

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
- `key` - Имя ключа
- `value` - Значение

**Возвращает:**
- `error` - Ошибка установки

**Типы ошибок:**
- `ErrInvalidKey` - Имя ключа недействительно
- `ErrForbiddenKey` - Ключ запрещён
- `ErrClosed` - Загрузчик закрыт

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
- `key` - Имя ключа

**Возвращает:**
- `error` - Ошибка удаления

```go
if err := env.Delete("TEMP_KEY"); err != nil {
    panic(err)
}
```

---

## Валидация и маппинг

### Validate

```go
func Validate() error
```

Проверяет наличие обязательных ключей. Необходимо установить RequiredKeys в Config.

**Возвращает:**
- `error` - Ошибка валидации

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
func ParseInto(v any) error
```

Маппит переменные окружения в структуру.

**Параметры:**
- `v` - Указатель на структуру

**Возвращает:**
- `error` - Ошибка маппинга

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
| `env:"KEY"` | Маппинг на указанный ключ |
| `env:"-"` | Игнорировать это поле |
| `envDefault:"value"` | Значение по умолчанию |
| `envSeparator:","` | Разделитель срезов |

:::tip Подробнее
[Маппинг структур](/ru/env/guides/struct-mapping) - полное руководство.
:::

---

## Служебные функции

### ResetDefaultLoader

```go
func ResetDefaultLoader() error
```

Сбрасывает глобальный загрузчик по умолчанию. В основном используется в сценариях тестирования.

**Возвращает:**
- `error` - Ошибка закрытия старого загрузчика (если он существует); nil если загрузчика не было или закрытие успешно

**Поведение:**
- Атомарно заменяет загрузчик по умолчанию на nil
- Закрывает старый загрузчик (выполняется вне блокировки, чтобы избежать блокировки)
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

:::warning Внимание
Эта функция потокобезопасна, но вызывайте её только при тестировании или запуске, чтобы избежать непредвиденного поведения.
:::

---

### LoadWithConfig

```go
func LoadWithConfig(cfg Config) error
```

Инициализирует загрузчик по умолчанию с пользовательской конфигурацией.

**Параметры:**
- `cfg` - Пользовательская конфигурация

**Возвращает:**
- `error` - Ошибка инициализации

**Поведение:**
- Устанавливает пакетный загрузчик по умолчанию (используемый функциями `GetString`, `GetInt` и др.)
- **Принудительно** `AutoApply = true` (независимо от настройки в cfg)
- Возвращает `ErrAlreadyInitialized`, если загрузчик по умолчанию уже инициализирован

**Отличие от Load:**
- `Load()` - принимает только список имён файлов, использует конфигурацию по умолчанию
- `LoadWithConfig()` - принимает полную Config, поддерживает все параметры

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

:::warning Внимание
Эта функция принудительно устанавливает `cfg.AutoApply` в `true`, обеспечивая применение переменных к системному окружению. Для контроля момента применения используйте `New()` для создания независимого экземпляра.
:::

---

## Функции сериализации

### Marshal

```go
func Marshal(data any, format ...FileFormat) (string, error)
```

Сериализует данные в строку указанного формата. Поддерживает `map[string]string` или структуры в качестве входных данных.

**Интеграция интерфейсов:** Если входной тип реализует интерфейс `Marshaler`, приоритет отдаётся вызову метода `MarshalEnv()` для сериализации.

**Параметры:**
- `data` - Данные для сериализации (map или структура)
- `format` - Необязательный формат, по умолчанию `FormatEnv`

**Возвращает:**
- `string` - Сериализованная строка (ключи отсортированы)
- `error` - Ошибка сериализации

**Поддерживаемые форматы:**
- `FormatEnv` (по умолчанию) - Формат .env
- `FormatJSON` - Формат JSON
- `FormatYAML` - Формат YAML

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

Разбирает форматированную строку в map. Поддерживает автоматическое определение формата.

**Параметры:**
- `data` - Форматированная строка
- `format` - Необязательный формат, по умолчанию `FormatEnv`; используйте `FormatAuto` для автоматического определения

**Возвращает:**
- `map[string]string` - Разобранные пары ключ-значение
- `error` - Ошибка разбора

```go
// Формат .env
m, _ := env.UnmarshalMap("HOST=localhost\nPORT=8080")

// Формат JSON (вложенные структуры будут плоскими)
m, _ := env.UnmarshalMap(`{"database": {"host": "localhost"}}`, env.FormatJSON)
// m["DATABASE_HOST"] = "localhost"

// Автоматическое определение формата
m, _ := env.UnmarshalMap(jsonString, env.FormatAuto)
```

---

### UnmarshalStruct

```go
func UnmarshalStruct(data string, v any, format ...FileFormat) error
```

Разбирает форматированную строку и заполняет структуру.

**Параметры:**
- `data` - Форматированная строка
- `v` - Указатель на структуру
- `format` - Необязательный формат, по умолчанию `FormatEnv`

**Возвращает:**
- `error` - Ошибка разбора

```go
type Config struct {
    Host string `env:"SERVER_HOST"`
    Port int    `env:"SERVER_PORT"`
}

var cfg Config
err := env.UnmarshalStruct("SERVER_HOST=localhost\nSERVER_PORT=8080", &cfg)
// cfg.Host = "localhost", cfg.Port = 8080

// Разбор из JSON
err = env.UnmarshalStruct(`{"server": {"host": "localhost"}}`, &cfg, env.FormatJSON)
```

---

### UnmarshalInto

```go
func UnmarshalInto(data map[string]string, v any) error
```

Заполняет структуру из map. Поддерживает теги `env` и `envDefault`.

**Интеграция интерфейсов:** Если целевой тип реализует интерфейс `Unmarshaler`, приоритет отдаётся вызову метода `UnmarshalEnv(data)`.

**Параметры:**
- `data` - Отображение пар ключ-значение
- `v` - Указатель на структуру

**Возвращает:**
- `error` - Ошибка заполнения

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
func MarshalStruct(v any) (map[string]string, error)
```

Преобразует структуру в map. Поддерживает тег `env` для указания имени ключа.

**Интеграция интерфейсов:** Если входной тип реализует интерфейс `Marshaler`, приоритет отдаётся вызову метода `MarshalEnv()`.

**Параметры:**
- `v` - Структура или указатель на структуру

**Возвращает:**
- `map[string]string` - Отображение пар ключ-значение
- `error` - Ошибка преобразования

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
- `err` - Проверяемая ошибка

**Возвращает:**
- `bool` - Является ли ошибкой типа MarshalError

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
    // Загрузка файла конфигурации
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // Чтение отдельных значений
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

    // Маппинг структур
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

- [Loader API](/ru/env/api-reference/loader) - Методы экземпляра Loader
- [Config API](/ru/env/api-reference/config) - Параметры конфигурации
- [SecureValue API](/ru/env/api-reference/secure-value) - Обработка безопасных значений
- [Маппинг структур](/ru/env/guides/struct-mapping) - Руководство по маппингу структур
