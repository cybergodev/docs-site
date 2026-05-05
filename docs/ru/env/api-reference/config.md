---
title: Config API - CyberGo env | Подробности конфигурации
description: CyberGo env библиотека Config полная справочная документация API структуры конфигурации, Config управляет всем поведением Loader, включая пути поиска файлов, параметры безопасности, параметры валидации ключей и значений, настройки подстановки переменных, конфигурацию аудитного журнала и предопределённые шаблоны конфигурации Development и Production.
---

# Config API

Полный справочник параметров конфигурации структуры `Config`.

## Определение структуры

Config использует вложенные структуры для организации конфигурации, сохраняя обратную совместимость через механизм продвижения полей Go:

```go
type Config struct {
    FileConfig       // Поведение загрузки файлов
    ValidationConfig // Валидация ключей и значений
    LimitsConfig     // Ограничения размера и количества
    JSONConfig       // Параметры парсинга JSON
    YAMLConfig       // Параметры парсинга YAML
    ParsingConfig    // Общее поведение парсинга
    ComponentConfig  // Пользовательские компоненты и расширенные настройки
}
```

**Два способа доступа:**

```go
// Старый способ (через продвижение полей, всё ещё работает)
cfg.Filenames = []string{".env"}
cfg.MaxFileSize = 1024

// Новый способ (рекомендуется, более наглядный)
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
    AutoApply         bool     // Автоматически ли применять к os.Environ
}

// ValidationConfig управляет валидацией ключей и значений
type ValidationConfig struct {
    RequiredKeys   []string       // Список обязательных ключей
    AllowedKeys    []string       // Белый список разрешённых ключей
    ForbiddenKeys  []string       // Дополнительный список запрещённых ключей
    KeyPattern     *regexp.Regexp // Шаблон соответствия имени ключа
    ValidateValues bool           // Проверять ли безопасность значений
    ValidateUTF8   bool           // Проверять ли валидность UTF-8 значений
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

// JSONConfig управляет поведением парсинга JSON
type JSONConfig struct {
    JSONNullAsEmpty    bool // null преобразуется в пустую строку
    JSONNumberAsString bool // число преобразуется в строку
    JSONBoolAsString   bool // булево значение преобразуется в строку
    JSONMaxDepth       int  // Максимальная глубина вложенности
}

// YAMLConfig управляет поведением парсинга YAML
type YAMLConfig struct {
    YAMLNullAsEmpty    bool // null/~ преобразуется в пустую строку
    YAMLNumberAsString bool // число преобразуется в строку
    YAMLBoolAsString   bool // булево значение преобразуется в строку
    YAMLMaxDepth       int  // Максимальная глубина вложенности
}

// ParsingConfig управляет общим поведением парсинга
type ParsingConfig struct {
    AllowExportPrefix bool // Разрешить синтаксис export KEY=value
    AllowYamlSyntax   bool // Разрешить значения в стиле YAML
    ExpandVariables   bool // Развернуть ли ссылки ${VAR}
}

// ComponentConfig пользовательские компоненты и расширенные настройки
type ComponentConfig struct {
    CustomValidator Validator        // Пользовательский валидатор ключей/значений
    CustomExpander  VariableExpander // Пользовательский расширитель переменных
    CustomAuditor   AuditLogger      // Пользовательский аудитный логгер
    FileSystem      FileSystem       // Пользовательская файловая система (для тестирования)
    AuditHandler    AuditHandler     // Пользовательский обработчик аудита
    AuditEnabled    bool             // Включить аудитный журнал
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
cfg.FailOnMissingFile = true  // Ошибка при отсутствии файла
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

::: tip Примечание
Пакетная функция `Load()` автоматически устанавливает `AutoApply = true`. При создании Loader через `New()` необходимо устанавливать вручную.
:::

### Подстановка переменных

#### `ExpandVariables` bool

Включить подстановку переменных с синтаксисом `${VAR}`. **По умолчанию `true`**.

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

Максимальное количество байт на файл. **По умолчанию 2 МБ**, жёсткий предел 100 МБ.

```go
cfg.MaxFileSize = 10 * 1024 * 1024 // 10 МБ
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxFileSize` | 2MB (2097152) | 100MB |

---

#### `MaxLineLength` int

Максимальная длина строки. **По умолчанию 1024**, жёсткий предел 64 КБ.

```go
cfg.MaxLineLength = 2048
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxLineLength` | 1024 | 65536 (64 КБ) |

---

#### `MaxKeyLength` int

Максимальная длина имени ключа. **По умолчанию 64**, жёсткий предел 1024.

```go
cfg.MaxKeyLength = 128
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxKeyLength` | 64 | 1024 |

---

#### `MaxValueLength` int

Максимальная длина значения. **По умолчанию 4096**, жёсткий предел 1 МБ.

```go
cfg.MaxValueLength = 8192
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxValueLength` | 4096 | 1048576 (1 МБ) |

---

#### `MaxVariables` int

Максимальное количество переменных на файл. **По умолчанию 500**, жёсткий предел 10000.

```go
cfg.MaxVariables = 1000
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxVariables` | 500 | 10000 |

---

#### `MaxExpansionDepth` int

Максимальная глубина подстановки переменных. **По умолчанию 5**, жёсткий предел 20.

```go
cfg.MaxExpansionDepth = 10
```

| Параметр | Значение по умолчанию | Жёсткий предел |
|----------|----------------------|----------------|
| `MaxExpansionDepth` | 5 | 20 |

### Валидация ключей

#### `KeyPattern` *regexp.Regexp

Пользовательский шаблон соответствия имени ключа. **По умолчанию `nil`** (используется быстрая побайтовая валидация).

::: tip Оптимизация производительности
Значение `nil` включает быструю побайтовую валидацию (примерно в 10 раз быстрее). Правило валидации по умолчанию: начинается с буквы, содержит только буквы, цифры и подчёркивания.
:::

```go
import "regexp"

// Пользовательский шаблон
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
```

---

#### `AllowedKeys` []string

Белый список разрешённых ключей. Если пусто, разрешены все ключи (кроме запрещённых).

```go
cfg.AllowedKeys = []string{"APP_NAME", "APP_VERSION", "PORT"}
```

---

#### `ForbiddenKeys` []string

Дополнительный список запрещённых ключей (добавляется к встроенным запрещённым ключам).

```go
cfg.ForbiddenKeys = []string{"CUSTOM_DANGEROUS_VAR"}
```

::: tip Встроенные запрещённые ключи
Библиотека по умолчанию запрещает `PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES` и другие системные переменные. Подробнее в [Константы и ошибки](/ru/env/api-reference/constants#defaultforbiddenkeys).
:::

---

#### `RequiredKeys` []string

Список обязательных ключей. Проверяется при вызове `Validate()`.

```go
cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}
```

---

#### `ValidateValues` bool

Валидация безопасности значений (управляющие символы, нулевые байты и т.д.). **По умолчанию `true`**.

::: warning Рекомендация по безопасности
Рекомендуется всегда держать включённым. Отключайте только в особых сценариях (например, когда нужно хранить значения с управляющими символами).
:::

```go
cfg.ValidateValues = true  // Включено по умолчанию
```

---

#### `ValidateUTF8` bool

Проверять, что значения являются валидной кодировкой UTF-8. **По умолчанию `false`**.

```go
cfg.ValidateUTF8 = true  // Включить валидацию UTF-8
```

### Параметры парсинга

#### `AllowExportPrefix` bool

Разрешить синтаксис `export KEY=value`. **По умолчанию `true`**.

```go
cfg.AllowExportPrefix = false  // Запретить префикс export
```

---

#### `AllowYamlSyntax` bool

Разрешить синтаксис в стиле YAML (`KEY: value`). **По умолчанию `false`**.

```go
cfg.AllowYamlSyntax = true
```

### Параметры JSON

#### `JSONNullAsEmpty` bool

Значения JSON `null` преобразуются в пустую строку. **По умолчанию `true`**.

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

Булевы значения JSON преобразуются в строки. **По умолчанию `true`**.

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

Булевы значения YAML преобразуются в строки. **По умолчанию `true`**.

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

Включить аудитный журнал. **По умолчанию `false`**.

```go
cfg.AuditEnabled = true
```

---

#### `AuditHandler` AuditHandler

Пользовательский обработчик аудита.

```go
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

::: tip Подробнее
См. [Аудитный журнал](/ru/env/guides/audit-logging) для полного описания конфигурации аудита.
:::

### Расширенные настройки

#### `Prefix` string

Обрабатывать только переменные с указанным префиксом. **По умолчанию `""`** (обрабатывать все переменные).

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

Пользовательский валидатор ключей/значений. Заменяет встроенный валидатор.

```go
cfg.CustomValidator = &MyValidator{}
```

---

#### `CustomExpander` VariableExpander

Пользовательский расширитель переменных. Заменяет встроенный расширитель.

```go
cfg.CustomExpander = &MyExpander{}
```

---

#### `CustomAuditor` AuditLogger

Пользовательский аудитный логгер. Заменяет встроенный аудитор.

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

**Отличия от конфигурации по умолчанию:**
- `OverwriteExisting`: `true`
- `AllowYamlSyntax`: `true`
- `MaxFileSize`: 10MB

::: tip Гарантия безопасности
`ValidateValues` остаётся `true` во всех предустановленных конфигурациях (как в значении по умолчанию), обеспечивая безопасность независимо от среды.
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

Возвращает конфигурацию для тестовой среды.

**Отличия от конфигурации по умолчанию:**
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

Возвращает конфигурацию для продакшена (строгая валидация + аудит).

**Отличия от конфигурации по умолчанию:**
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
| Перезапись существующих переменных | ✗ | ✓ | ✓ | ✗ |
| Ошибка при отсутствии файла | ✗ | ✗ | ✗ | ✓ |
| Аудитный журнал | ✗ | ✗ | ✗ | ✓ |
| Синтаксис YAML | ✗ | ✓ | ✗ | ✗ |
| Ограничение размера файла | 2MB | 10MB | 64KB | 64KB |
| Максимальное количество переменных | 500 | 500 | 50 | 50 |
| Проверка запрещённых ключей | ✓ | ✓ | ✓ | ✓ |
| Валидация значений | ✓ | ✓ | ✓ | ✓ |

::: tip Рекомендации по выбору
- **Среда разработки**: используйте `DevelopmentConfig()`, мягкие ограничения для быстрой итерации
- **Тестовая среда**: используйте `TestingConfig()`, разрешена перезапись для изоляции тестов
- **Продакшен**: используйте `ProductionConfig()`, включены аудит и строгая валидация
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
- Все ограничения должны быть положительными числами
- Все ограничения не должны превышать жёсткие пределы
- `KeyPattern`, если не nil, должен соответствовать валидному ключу (например, `TEST_KEY`), не соответствовать пустой строке и не соответствовать ключу, начинающемуся с цифры
- `JSONMaxDepth` и `YAMLMaxDepth` должны быть в диапазоне 1-100

---

### IsZero

```go
func (c *Config) IsZero() bool
```

Проверяет, является ли Config неинициализированным нулевым значением. Используется для определения, следует ли использовать `DefaultConfig()`.

**Возвращает:**
- `bool` - является ли конфигурация нулевым значением

**Область проверки:**
- Числовые ограничения (MaxFileSize, MaxVariables и т.д.)
- Булевы поля (ValidateValues, AutoApply и т.д.)
- Поля-указатели/интерфейсы (KeyPattern, FileSystem и т.д.)
- Поля-срезы (Filenames, RequiredKeys и т.д.)

::: warning Внимание
Частично инициализированный Config может не определяться как нулевое значение. Рекомендуется всегда начинать настройку с `DefaultConfig()`:

```go
// Рекомендуется
cfg := env.DefaultConfig()
cfg.Filenames = []string{".env.production"}

// Не рекомендуется (некоторые поля будут нулевыми значениями)
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

### Конфигурация продакшена

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

### Фильтрация по префиксу

```go
cfg := env.DefaultConfig()
cfg.Prefix = "MYAPP_"  // Загружать только MYAPP_KEY1, MYAPP_KEY2 и т.д.
cfg.Filenames = []string{".env"}

loader, _ := env.New(cfg)
// loader содержит только переменные, начинающиеся с MYAPP_
```

### Пользовательская валидация

```go
import "regexp"

cfg := env.DefaultConfig()
// Разрешить только ключи, начинающиеся с заглавной буквы
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
// Добавить пользовательские запрещённые ключи
cfg.ForbiddenKeys = []string{"DEBUG", "TRACE"}

loader, _ := env.New(cfg)
```

---

## Связанная документация

- [Loader API](/ru/env/api-reference/loader) - Методы загрузчика
- [Константы и ошибки](/ru/env/api-reference/constants) - Константы ограничений и типы ошибок
- [Аудитный журнал](/ru/env/guides/audit-logging) - Руководство по конфигурации аудита
