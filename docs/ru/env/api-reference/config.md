---
sidebar_label: "Config"
title: "Config API - CyberGo env | Подробно о конфигурации"
description: "Config в CyberGo env: пути поиска, лимиты, валидация ключей/значений, опции JSON/YAML, подстановка, аудит, пресеты Development/Production и два способа доступа."
sidebar_position: 4
---

# Config API

Полный справочник параметров конфигурации структуры `Config`.

## Определение структуры

Config использует вложенные структуры для организации конфигурации, при этом обеспечивая обратную совместимость через продвижение полей Go:

```go
type Config struct {
    FileConfig       // Поведение загрузки файлов
    ValidationConfig // Валидация ключей и значений
    LimitsConfig     // Ограничения размера и количества
    JSONConfig       // Параметры разбора JSON
    YAMLConfig       // Параметры разбора YAML
    ParsingConfig    // Общее поведение разбора
    ComponentConfig  // Пользовательские компоненты и расширенные настройки
}
```

**Два способа доступа:**

```go
// Старый способ (через продвижение полей, всё ещё действителен)
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// Новый способ (рекомендуется, более понятный)
cfg.FileConfig.Filenames = []string{".env"}
cfg.LimitsConfig.MaxFileSize = 1024
```

### Вложенные структуры

```go
// FileConfig управляет поведением загрузки файлов
type FileConfig struct {
    Filenames         []string // Список файлов для загрузки
    FailOnMissingFile bool     // Возвращать ли ошибку при отсутствии файла
    OverwriteExisting bool     // Перезаписывать ли существующие переменные окружения
    AutoApply         bool     // Автоматически применять к os.Environ
}

// ValidationConfig управляет валидацией ключей и значений
type ValidationConfig struct {
    RequiredKeys   []string       // Список обязательных имён ключей
    AllowedKeys    []string       // Белый список разрешённых ключей
    ForbiddenKeys  []string       // Дополнительный список запрещённых ключей
    KeyPattern     *regexp.Regexp // Шаблон соответствия имени ключа
    ValidateValues bool           // Проверять безопасность значений
    ValidateUTF8   bool           // Валидация значений как допустимый UTF-8
}

// LimitsConfig управляет ограничениями размера и количества
type LimitsConfig struct {
    MaxFileSize       int64 // Максимальное количество байт на файл
    MaxVariables      int   // Максимальное количество переменных на файл
    MaxLineLength     int   // Максимальная длина строки
    MaxKeyLength      int   // Максимальная длина имени ключа
    MaxValueLength    int   // Максимальная длина значения
    MaxExpansionDepth int   // Максимальная глубина подстановки переменных
}

// JSONConfig управляет поведением разбора JSON
type JSONConfig struct {
    JSONNullAsEmpty    bool // null преобразуется в пустую строку
    JSONNumberAsString bool // числа преобразуются в строки
    JSONBoolAsString   bool // логические значения преобразуются в строки
    JSONMaxDepth       int  // максимальная глубина вложенности
}

// YAMLConfig управляет поведением разбора YAML
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ преобразуется в пустую строку
    YAMLNumberAsString bool // числа преобразуются в строки
    YAMLBoolAsString   bool // логические значения преобразуются в строки
    YAMLMaxDepth       int  // максимальная глубина вложенности
}

// ParsingConfig управляет общим поведением разбора
type ParsingConfig struct {
    AllowExportPrefix bool // Разрешить синтаксис export KEY=value
    AllowYamlSyntax   bool // Разрешить значения в стиле YAML
    ExpandVariables   bool // Раскрывать ссылки ${VAR}
}

// ComponentConfig — пользовательские компоненты и расширенные настройки
type ComponentConfig struct {
    CustomValidator Validator        // Пользовательский валидатор ключей/значений
    CustomExpander  VariableExpander // Пользовательский раскрыватель переменных
    CustomAuditor   AuditLogger      // Пользовательский регистратор аудита
    FileSystem      FileSystem       // Пользовательская файловая система (для тестирования)
    AuditHandler    AuditHandler     // Пользовательский обработчик аудита
    AuditEnabled    bool             // Включить аудитный лог
    Prefix          string           // Обрабатывать только переменные с этим префиксом
}
```

## Поля конфигурации

### Обработка файлов

Эти поля управляют поведением загрузки файлов.

#### `Filenames` []string

Список путей к файлам для загрузки. **По умолчанию `[".env"]`**.

```go
cfg.Filenames = []string{".env", ".env.local"}
```

---

#### `FailOnMissingFile` bool

Возвращать ли ошибку при отсутствии файла. **По умолчанию `false`** (тихий пропуск).

```go
cfg.FailOnMissingFile = true  // Возвращать ошибку при отсутствии файла
```

---

#### `OverwriteExisting` bool

Перезаписывать ли существующие переменные окружения. **По умолчанию `false`**.

```go
cfg.OverwriteExisting = true  // Разрешить перезапись
```

---

#### `AutoApply` bool

Автоматически применять к системному окружению (`os.Environ`) после загрузки. **По умолчанию `false`**.

```go
cfg.AutoApply = true  // Автоматически применять после загрузки
```

:::tip Внимание
Пакетная функция `Load()` автоматически устанавливает `AutoApply = true`. При создании Loader через `New()` необходимо установить вручную.
:::

### Подстановка переменных

#### `ExpandVariables` bool

Включает подстановку переменных с синтаксисом `${VAR}`. **По умолчанию `true`**.

```go
cfg.ExpandVariables = true
```

Поддерживаемый синтаксис подстановки:

| Синтаксис | Описание |
|-----------|----------|
| `${VAR}` | Ссылка на переменную |
| `${VAR:-default}` | Использовать значение по умолчанию, если переменная не существует или пуста |
| `${VAR:=default}` | Установить значение по умолчанию, если переменная не существует или пуста |
| `${VAR:?error}` | Вернуть ошибку, если переменная не существует или пуста |

### Ограничения безопасности

#### `MaxFileSize` int64

Максимальное количество байт на файл. **По умолчанию 2MB**, жёсткий предел 100MB.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 MB
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

Максимальная длина строки. **По умолчанию 1024**, жёсткий предел 64KB.

```go
cfg.MaxLineLength = 2048
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxLineLength` | 1024 | 65536 (64KB) |

---

#### `MaxKeyLength` int

Максимальная длина имени ключа. **По умолчанию 64**, жёсткий предел 1024.

```go
cfg.MaxKeyLength = 128
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

Максимальная длина значения. **По умолчанию 4096**, жёсткий предел 1MB.

```go
cfg.MaxValueLength = 8192
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxValueLength` | 4096 | 1048576 (1MB) |

---

#### `MaxVariables` int

Максимальное количество переменных на файл. **По умолчанию 500**, жёсткий предел 10000.

```go
cfg.MaxVariables = 1000
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

Максимальная глубина подстановки переменных. **По умолчанию 5**, жёсткий предел 20.

```go
cfg.MaxExpansionDepth = 10
```

| Параметр | По умолчанию | Жёсткий предел |
|----------|--------------|----------------|
| `MaxExpansionDepth` | 5 | 20 |

### Валидация ключей

#### `KeyPattern` *regexp.Regexp

Пользовательский шаблон соответствия имени ключа. **По умолчанию `nil`** (используется быстрая побайтовая валидация).

:::tip Оптимизация производительности
Значение `nil` включает быструю побайтовую валидацию (примерно 10-кратное повышение производительности). Правило валидации по умолчанию: начинается с буквы, содержит только буквы, цифры и подчёркивания.
:::

```go
import "regexp"

// Пользовательский шаблон
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

Белый список разрешённых ключей. Если пуст, разрешены все ключи (кроме запрещённых).

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

Дополнительный список запрещённых ключей (добавляется к встроенным).

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

:::tip Встроенные запрещённые ключи
Библиотека встроенно запрещает `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES` и другие системно-важные переменные. Подробнее в [Константы и ошибки](/ru/env/api-reference/constants#defaultforbiddenkeys).
:::

---

#### `RequiredKeys` []string

Список обязательных ключей. Проверяется при вызове `Validate()`.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

Проверка безопасности значений (управляющие символы, нулевые байты и т.д.). **По умолчанию `true`**.

:::warning Рекомендация по безопасности
Рекомендуется всегда держать включённым. Отключайте только в особых случаях (например, при необходимости хранения значений с управляющими символами).
:::

```go
cfg.ValidateValues = true  // Включено по умолчанию
```

---

#### `ValidateUTF8` bool

Проверяет, является ли значение допустимым UTF-8. **По умолчанию `false`**.

```go
cfg.ValidateUTF8 = true  // Включить UTF-8 валидацию
```

### Параметры разбора

#### `AllowExportPrefix` bool

Разрешает синтаксис `export KEY=value`. **По умолчанию `true`**.

```go
cfg.AllowExportPrefix = false  // Запретить префикс export
```

---

#### `AllowYamlSyntax` bool

Разрешает синтаксис в стиле YAML (`KEY: value`). **По умолчанию `false`**.

```go
cfg.AllowYamlSyntax = true
```

### Параметры JSON

#### `JSONNullAsEmpty` bool

Значение JSON `null` преобразуется в пустую строку. **По умолчанию `true`**.

```go
cfg.JSONNullAsEmpty = true
```

---

#### `JSONNumberAsString` bool

Числа JSON преобразуются в строки. **По умолчанию `true`**.

```go
cfg.JSONNumberAsString = true
```

---

#### `JSONBoolAsString` bool

Логические значения JSON преобразуются в строки. **По умолчанию `true`**.

```go
cfg.JSONBoolAsString = true
```

---

#### `JSONMaxDepth` int

Максимальная глубина вложенности JSON. **По умолчанию 10**.

```go
cfg.JSONMaxDepth = 20
```

### Параметры YAML

#### `YAMLNullAsEmpty` bool

Значения YAML `null`/`~` преобразуются в пустую строку. **По умолчанию `true`**.

```go
cfg.YAMLNullAsEmpty = true
```

---

#### `YAMLNumberAsString` bool

Числа YAML преобразуются в строки. **По умолчанию `true`**.

```go
cfg.YAMLNumberAsString = true
```

---

#### `YAMLBoolAsString` bool

Логические значения YAML преобразуются в строки. **По умолчанию `true`**.

```go
cfg.YAMLBoolAsString = true
```

---

#### `YAMLMaxDepth` int

Максимальная глубина вложенности YAML. **По умолчанию 10**.

```go
cfg.YAMLMaxDepth = 15
```

### Аудит

#### `AuditEnabled` bool

Включает аудитный лог. **По умолчанию `false`**.

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

Пользовательский обработчик аудита.

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

:::tip Подробнее
[Аудитный лог](/ru/env/guides/audit-logging) - полное описание конфигурации аудита.
:::

### Дополнительные параметры

#### `Prefix` string

Обрабатывать только переменные с этим префиксом. **По умолчанию `""`** (обрабатывать все переменные).

```go
cfg.Prefix = "MYAPP_"  // Загружать только переменные, начинающиеся с MYAPP_
```

---

#### `FileSystem` FileSystem

Пользовательский интерфейс файловой системы (для тестирования).

```go
cfg.FileSystem = &MockFileSystem{}
```

---

#### `CustomValidator` Validator

Пользовательский валидатор ключей/значений. Переопределяет встроенный валидатор.

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

Пользовательский раскрыватель переменных. Переопределяет встроенный раскрыватель.

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

Пользовательский регистратор аудита. Переопределяет встроенный регистратор.

```go
cfg.CustomAuditor = &MyAuditLogger{}
```

---

## Фабричные функции

### DefaultConfig

```go
func DefaultConfig() Config
```

Возвращает безопасную конфигурацию по умолчанию.

**Значения по умолчанию:**

| Поле | Значение |
|------|----------|
| `Filenames` | `[".env"]` |
| `FailOnMissingFile` | `false` |
| `OverwriteExisting` | `false` |
| `AutoApply` | `false` |
| `ExpandVariables` | `true` |
| `MaxFileSize` | 2MB |
| `MaxLineLength` | 1024 |
| `MaxKeyLength` | 64 |
| `MaxValueLength` | 4096 |
| `MaxVariables` | 500 |
| `MaxExpansionDepth` | 5 |
| `ValidateValues` | `true` |
| `KeyPattern` | `nil` (быстрая валидация) |
| `AllowExportPrefix` | `true` |
| `AllowYamlSyntax` | `false` |
| `JSONNullAsEmpty` | `true` |
| `JSONNumberAsString` | `true` |
| `JSONBoolAsString` | `true` |
| `JSONMaxDepth` | 10 |
| `YAMLNullAsEmpty` | `true` |
| `YAMLNumberAsString` | `true` |
| `YAMLBoolAsString` | `true` |
| `YAMLMaxDepth` | 10 |
| `ValidateUTF8` | `false` |
| `AuditEnabled` | `false` |
| `Prefix` | `""` |

---

### DevelopmentConfig

```go
func DevelopmentConfig() Config
```

Возвращает конфигурацию для среды разработки (мягкие ограничения).

**Различия от конфигурации по умолчанию:**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

:::tip Гарантия безопасности
`ValidateValues` остаётся `true` во всех предустановках (как значение по умолчанию), обеспечивая безопасность независимо от среды.
:::

```go
cfg := env.DevelopmentConfig()
cfg.Filenames = []string{".env.development"}
loader, _ := env.New(cfg)
```

---

### TestingConfig

```go
func TestingConfig() Config
```

Возвращает конфигурацию для среды тестирования.

**Различия от конфигурации по умолчанию:**
- `OverwriteExisting`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
func TestSomething(t *testing.T) {
    cfg := env.TestingConfig()
    cfg.Filenames = []string{".env.test"}
    loader, _ := env.New(cfg)
    defer loader.Close()
}
```

---

### ProductionConfig

```go
func ProductionConfig() Config
```

Возвращает конфигурацию для производственной среды (строгая валидация + аудит).

**Различия от конфигурации по умолчанию:**
- `FailOnMissingFile`: `true`
- `AuditEnabled`: `true`
- `MaxFileSize`: 64KB
- `MaxVariables`: 50

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
loader, _ := env.New(cfg)
```

---

### Подробное сравнение предустановок

| Функция | Default | Development | Testing | Production |
|---------|---------|-------------|---------|------------|
| Перезапись существующих переменных | Нет | Да | Да | Нет |
| Ошибка при отсутствии файла | Нет | Нет | Нет | Да |
| Аудитный лог | Нет | Нет | Нет | Да |
| YAML синтаксис | Нет | Да | Нет | Нет |
| Ограничение размера файла | 2MB | 10MB | 64KB | 64KB |
| Максимальное количество переменных | 500 | 500 | 50 | 50 |
| Проверка запрещённых ключей | Да | Да | Да | Да |
| Валидация значений | Да | Да | Да | Да |

:::tip Рекомендации по выбору
- **Среда разработки**: Используйте `DevelopmentConfig()` с мягкими ограничениями для быстрой итерации
- **Среда тестирования**: Используйте `TestingConfig()` с разрешённой перезаписью для изоляции тестов
- **Производственная среда**: Используйте `ProductionConfig()` с включённым аудитом и строгой валидацией
:::

---

## Методы

### Validate

```go
func (c *Config) Validate() error
```

Проверяет валидность конфигурации. Проверяет, что все ограничения находятся в допустимых пределах.

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 1000

if err := cfg.Validate(); err != nil {
    // Конфигурация недействительна
}
```

**Правила валидации:**
- Все ограничения должны иметь положительные значения
- Все ограничения не могут превышать жёсткий предел
- `KeyPattern` если не nil, должно соответствовать допустимому имени ключа (например, `TEST_KEY`), не должно соответствовать пустой строке или ключам, начинающимся с цифры
- `JSONMaxDepth` и `YAMLMaxDepth` должно быть от 1 до 100

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Проверяет, является ли Config неинициализированным нулевым значением. Используется для определения, следует ли использовать `DefaultConfig()`.

**Возвращает:**
- `bool` - Является ли нулевой конфигурацией

**Область обнаружения:**
- Числовые ограничения (MaxFileSize, MaxVariables и т.д.)
- Логические поля (ValidateValues, AutoApply и т.д.)
- Поля указателей/интерфейсов (KeyPattern, FileSystem и т.д.)
- Поля срезов (Filenames, RequiredKeys и т.д.)

:::warning Внимание
Частично инициализированный Config может не быть обнаружен как нулевое значение. Рекомендуется всегда начинать с `DefaultConfig()` для пользовательской конфигурации:

```go
// Рекомендуется
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// Не рекомендуется (некоторые поля — нулевые значения)
var cfg env.Config
cfg.Filenames = []string{".env.production"}
```
:::

---

## Примеры использования

### Базовая конфигурация

```go
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env", ".env.local"}
cfg.OverwriteExisting = true

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()
```

### Конфигурация производственной среды

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{"DB_HOST", "DB_PORT", "API_KEY"}
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, err := env.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer loader.Close()

if err := loader.LoadFiles(".env"); err != nil {
    log.Fatal(err)
}

if err := loader.Validate(); err != nil {
    log.Fatal("Отсутствует обязательная конфигурация:", err)
}
```

### Использование фильтрации по префиксу

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // Загружать только MYAPP_KEY1, MYAPP_KEY2 и т.д.
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// Loader содержит только переменные, начинающиеся с MYAPP_
```

### Пользовательская валидация

```go
import "regexp"

cfg := env.DefaultConfig()
// Разрешить только ключи, начинающиеся с заглавной буквы
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// Добавить пользовательский запрещённый ключ
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## Связанная документация

- [Loader API](/ru/env/api-reference/loader) - Методы загрузчика
- [Константы и ошибки](/ru/env/api-reference/constants) - Ограничивающие константы и типы ошибок
- [Аудитный лог](/ru/env/guides/audit-logging) - Руководство по конфигурации аудита
