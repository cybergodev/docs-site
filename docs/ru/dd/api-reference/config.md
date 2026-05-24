---
title: "Конфигурация - CyberGo DD | Подробное описание Config"
description: "Полная документация API структуры Config CyberGo DD, включая предустановленные конфигурации DefaultConfig/DevelopmentConfig/JSONConfig, настройку целей вывода OutputTarget, правила валидации полей, управление сэмплированием, параметры форматирования и метод Validate, предоставляющая гибкую и типобезопасную настройку поведения логгера."
---

# Конфигурация

DD настраивает поведение логгера через структуру `Config` и предоставляет несколько фабричных функций предустановленных конфигураций.

## Фабрики предустановленных конфигураций

```go
// Конфигурация по умолчанию: уровень INFO, текстовый формат
cfg := dd.DefaultConfig()

// Конфигурация разработки: уровень DEBUG, динамический caller
cfg := dd.DevelopmentConfig()

// Конфигурация JSON: вывод в формате JSON
cfg := dd.JSONConfig()
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
}
```

### Clone

```go
func (c *Config) Clone() Config
```

Создаёт глубокую копию конфигурации, которую можно безопасно изменять, не затрагивая оригинал.

```go
base := dd.DefaultConfig()
custom := base.Clone()
custom.Level = dd.LevelDebug
```

### Validate

```go
func (c Config) Validate() error
```

Проверяет корректность конфигурации, проверяет цели вывода, уровень, формат и т.д.

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

Возвращает параметры вывода JSON по умолчанию.

```go
cfg := dd.JSONConfig()
// Включает JSONOptions по умолчанию
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
| `FieldValidationStrict` | Отклонять некорректные поля, выводить ошибку |

Реализует метод `String()`, возвращающий имя режима.

### FieldNamingConvention

| Константа | Описание | Пример |
|-----------|----------|--------|
| `NamingConventionAny` | Принимать любой формат (по умолчанию) | - |
| `NamingConventionSnakeCase` | snake_case | `user_id`, `created_at` |
| `NamingConventionCamelCase` | camelCase | `userId`, `createdAt` |
| `NamingConventionPascalCase` | PascalCase | `UserId`, `CreatedAt` |
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

// Некорректно (не snake_case)
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
- [Цели вывода](./writers) -- FileWriter, BufferedWriter, MultiWriter
- [Фильтрация безопасности](./security) -- подробное описание SecurityConfig
- [Система хуков](./hooks) -- подробное описание HooksConfig
