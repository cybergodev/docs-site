---
sidebar_label: "Конфигурация"
title: "Конфигурация - CyberGo DD | Подробное описание Config"
description: "Полная документация API структуры Config CyberGo DD: пресеты DefaultConfig/DevelopmentConfig/JSONConfig, настройка целей вывода OutputTarget, правила валидации полей, управление сэмплированием, параметры форматирования и метод Validate, обеспечивающие гибкую и типобезопасную настройку поведения логгера."
sidebar_position: 4
---

# Конфигурация

DD настраивает поведение логгера через структуру `Config` и предоставляет несколько фабричных функций предустановленных конфигураций.

## Фабрики предустановленных конфигураций

```go
// Конфигурация по умолчанию: уровень INFO, текстовый формат
cfg := dd.DefaultConfig()
```

```go
// Конфигурация разработки: уровень DEBUG, динамический caller
cfgDev := dd.DevelopmentConfig()
```

```go
// Конфигурация JSON: вывод в формате JSON
cfgJSON := dd.JSONConfig()
```

| Фабричная функция | Возвращаемый тип | Уровень | Формат | Сценарий |
|-------------------|-----------------|---------|--------|----------|
| `DefaultConfig()` | `Config` | Info | Text | Производственная среда |
| `DevelopmentConfig()` | `Config` | Debug | Text | Среда разработки |
| `JSONConfig()` | `Config` | Debug | JSON | Сбор логов |

:::tip Фильтрация безопасности включена по умолчанию
Все предустановленные конфигурации (`DefaultConfig`, `DevelopmentConfig`, `JSONConfig`) по умолчанию включают фильтрацию безопасности, автоматически маскируя пароли, API-ключи, номера кредитных карт и другую конфиденциальную информацию.
:::

## Структура Config

```go
type Config struct {
    // Уровень логирования
    Level          LogLevel         // Уровень логирования (по умолчанию LevelInfo)
    Format         LogFormat        // Формат вывода (FormatText / FormatJSON)

    // Конфигурация времени
    TimeFormat     string           // Формат времени (по умолчанию ISO 8601)
    IncludeTime    bool             // Включать ли время (по умолчанию true)
    IncludeLevel   bool             // Включать ли уровень (по умолчанию true)

    // Информация о вызывающем
    DynamicCaller  bool             // Динамическое определение вызывающего (по умолчанию true)
    FullPath       bool             // Показывать ли полный путь (по умолчанию false)

    // Цели вывода
    Targets        []OutputTarget   // Список целей вывода

    // Конфигурация JSON
    JSON           *JSONOptions     // Параметры вывода JSON

    // Конфигурация безопасности
    Security       *SecurityConfig  // Конфигурация безопасности

    // Валидация полей
    FieldValidation *FieldValidationConfig

    // Обработчики жизненного цикла
    FatalHandler      FatalHandler       // Пользовательская функция обработки уровня Fatal
    WriteErrorHandler WriteErrorHandler  // Обратный вызов ошибки записи

    // Расширяемость
    ContextExtractors []ContextExtractor // Список экстракторов контекста
    Hooks             *HookRegistry      // Реестр хуков
    Sampling          *SamplingConfig    // Конфигурация сэмплирования

    // Конфигурация аудита
    Audit             *AuditConfig       // Конфигурация журнала аудита (события безопасности)
}
```

:::tip Поле Audit
Если задано `Audit`, события маскирования конфиденциальных данных, ограничения скорости и нарушения безопасности записываются как события аудита через [AuditLogger](../security-audit/audit). См. [Журнал аудита](../security-audit/audit).
:::

### Clone

```go
func (c *Config) Clone() Config
```

Создаёт копию конфигурации, которую можно безопасно изменять, не затрагивая оригинал. Для nil-приёмника возвращает нулевое значение `Config{}`.

Стратегия копирования (согласована с комментариями к `Clone` в исходниках):

- **Глубокое копирование**: `Targets` (срез), `JSON` (включая `JSONFieldNames`), `Security`, `Hooks`, `Sampling`, `Audit`
- **Поверхностное копирование**: `FatalHandler`, `WriteErrorHandler`, `FieldValidation` (функции/указатели разделяются)
- **Смешанное**: срез `ContextExtractors` копируется, но сами экземпляры экстракторов разделяются

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

Проверяет корректность конфигурации и возвращает первую обнаруженную ошибку. `dd.New(cfg)` автоматически вызывает этот метод внутри; его можно вызвать вручную до передачи в `New`, чтобы выявить проблемы заранее.

Пункты проверки:

- `Level` должен попадать в диапазон `[LevelDebug, LevelFatal]`
- `Format` должен быть `FormatText` или `FormatJSON`
- При `IncludeTime=true` и непустом `TimeFormat` проверяется эталонный шаблон времени Go (например, `time.RFC3339`)
- Общее число `Targets` не превышает 100 (при превышении возвращается `ErrMaxWritersExceeded`)
- Каждый элемент `Targets`: для `OutputCustom` требуется не-nil `Writer`, для `OutputFile` требуется непустой `Path`

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}
```

## Цели вывода

### OutputType

Перечисление типов целей вывода.

```go
type OutputType int
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `OutputConsole` | `0` | Вывод в консоль (stdout) |
| `OutputFile` | `1` | Вывод в файл |
| `OutputCustom` | `2` | Пользовательский Writer |

### OutputTarget

Конфигурация цели вывода, описывающая одну цель.

```go
type OutputTarget struct {
    Type       OutputType     // Тип вывода
    Path       string         // Путь к файлу (действительно для OutputFile)
    MaxSizeMB  int            // Макс. размер файла МБ (действительно для OutputFile)
    MaxBackups int            // Количество резервных копий (действительно для OutputFile)
    MaxAge     time.Duration  // Время хранения старых файлов (действительно для OutputFile)
    Compress   bool           // gzip сжатие (действительно для OutputFile)
    Writer     io.Writer      // Пользовательский Writer (действительно для OutputCustom)
}
```

### Конструкторы целей вывода

```go
func ConsoleOutput() OutputTarget
func FileOutput(path string) OutputTarget
func CustomOutput(w io.Writer) OutputTarget
```

:::tip Параметры ротации по умолчанию FileOutput
`OutputTarget`, возвращаемый `FileOutput`, предзаполнен значениями ротации по умолчанию: `MaxSizeMB=100`, `MaxBackups=10`, `MaxAge=30 * 24 * time.Hour` (30 дней), `Compress=false`. Для пользовательской настройки просто измените соответствующие поля возвращаемого значения:

```go
target := dd.FileOutput("logs/app.log")
target.MaxSizeMB = 50               // Срезка по 50 МБ
target.MaxBackups = 5               // Хранить 5 резервных копий
target.MaxAge = 7 * 24 * time.Hour  // Хранить 7 дней
target.Compress = true              // gzip-сжатие старых логов
```

:::

```go
// Вывод в консоль
cfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// Вывод в файл
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}

// Пользовательский Writer
cfg.Targets = []dd.OutputTarget{dd.CustomOutput(customWriter)}

// Многоцелевой вывод
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
}
```

## Параметры конфигурации JSON

### JSONOptions

Конфигурация формата вывода JSON.

```go
type JSONOptions struct {
    PrettyPrint bool           // Красивый вывод (по умолчанию false)
    Indent      string         // Строка отступа (по умолчанию "  ")
    FieldNames  *JSONFieldNames // Пользовательские имена JSON-полей
}
```

### JSONFieldNames

Пользовательские имена полей в выводе JSON. Используется для адаптации к различным системам сбора логов.

```go
type JSONFieldNames struct {
    Timestamp string  // Имя поля временной метки (по умолчанию "timestamp")
    Level     string  // Имя поля уровня (по умолчанию "level")
    Caller    string  // Имя поля вызывающего (по умолчанию "caller")
    Message   string  // Имя поля сообщения (по умолчанию "message")
    Fields    string  // Имя контейнера полей (по умолчанию "fields")
}
```

Реализует метод с указателем-приёмником `(*JSONFieldNames).IsComplete() bool`: возвращает `true`, когда все 5 имён полей не пусты, что полезно для проверки полной настройки всех имён полей.

Пример использования:

```go
cfg := dd.DefaultJSONOptions()
cfg.FieldNames = &dd.JSONFieldNames{
    Timestamp: "ts",
    Level:     "lvl",
    Message:   "msg",
}
```

### DefaultJSONOptions

```go
func DefaultJSONOptions() *JSONOptions
```

Возвращает параметры `JSONOptions` по умолчанию: по умолчанию без красивого вывода (отступ — два пробела), имена полей используются по умолчанию.

```go
opts := dd.DefaultJSONOptions()
opts.PrettyPrint = true

logger, _ := dd.New(dd.Config{
    Format: dd.FormatJSON,
    JSON:   opts,
})
```

## SamplingConfig

Конфигурация сэмплирования для уменьшения объёма логов в сценариях с высокой пропускной способностью.

```go
type SamplingConfig struct {
    Enabled    bool          // Включить сэмплирование
    Initial    int           // Количество сообщений, всегда записываемых перед сэмплированием
    Thereafter int           // Частота сэмплирования (10 = записывать 1 из 10)
    Tick       time.Duration // Интервал сброса счётчика (0 = без сброса)
}
```

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,
    Thereafter: 10,
    Tick:       time.Minute,
}
logger, _ := dd.New(cfg)
```

## FieldValidationConfig

Конфигурация валидации полей, управляющая соглашениями об именовании ключей.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode      // Режим валидации
    Convention               FieldNamingConvention    // Соглашение об именовании
    AllowCommonAbbreviations bool                      // Разрешить распространённые сокращения (ID, URL и т.д.)
    EnableSecurityValidation bool                      // Включить валидацию безопасности (Log4Shell, атаки гомоглифами и т.д.)
}
```

### FieldValidationMode

| Константа | Описание |
|-----------|----------|
| `FieldValidationNone` | Отключить валидацию (по умолчанию) |
| `FieldValidationWarn` | Предупреждать о некорректных полях, но принимать |
| `FieldValidationStrict` | При несоответствии выводить ошибку в stderr (запись лога не отклоняется и записывается как есть) |

Реализует метод `String()`, возвращающий имя режима.

### FieldNamingConvention

| Константа | Описание | Пример |
|-----------|----------|--------|
| `NamingConventionAny` | Принимать любой формат (по умолчанию) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | UserId, CreatedAt |
| `NamingConventionKebabCase` | kebab-case | `user-id`, `created-at` |

Реализует метод `String()`, возвращающий имя соглашения об именовании.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

Проверяет, соответствует ли ключ поля настроенному соглашению об именовании.

## Конфигурация валидации полей

### DefaultFieldValidationConfig

```go
func DefaultFieldValidationConfig() *FieldValidationConfig
```

Конфигурация по умолчанию: валидация отключена.

### StrictSnakeCaseConfig

```go
func StrictSnakeCaseConfig() *FieldValidationConfig
```

Строгая валидация snake_case, имена полей должны быть в формате `snake_case`.

### StrictCamelCaseConfig

```go
func StrictCamelCaseConfig() *FieldValidationConfig
```

Строгая валидация camelCase, имена полей должны быть в формате `camelCase`.

### Использование

```go
logger, _ := dd.New(dd.Config{
    Level:           dd.LevelInfo,
    FieldValidation: dd.StrictSnakeCaseConfig(),
})

// Корректно
logger.InfoWith("ok", dd.String("user_name", "admin"))

// Некорректно (не snake_case, лог всё равно пишется, ошибка выводится в stderr)
logger.InfoWith("fail", dd.String("userName", "admin"))
```

## Примеры конфигурации

### Производственная среда

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
    Security: dd.DefaultSecurityConfig(),
})
```

### Среда разработки

```go
logger, _ := dd.New(dd.DevelopmentConfig())
```

### Многоцелевой вывод

```go
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## Следующие шаги

- [Logger](./logger) -- создание логгера с конфигурацией
- [Цели вывода](../output-integration/writers) -- FileWriter, BufferedWriter, MultiWriter
- [Фильтрация безопасности](../security-audit/security) -- подробное описание SecurityConfig
- [Система хуков](../security-audit/hooks) -- подробное описание HooksConfig
- [Журнал аудита](../security-audit/audit) -- подробное описание AuditConfig
