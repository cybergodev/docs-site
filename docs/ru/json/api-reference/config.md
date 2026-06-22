---
title: "Конфигурация Config - CyberGo JSON | Справочник API"
description: "Справочник Config CyberGo JSON: DefaultConfig, SecurityConfig, PrettyConfig, кэш, лимиты размеров и кодирование для настройки поведения JSON в Go."
---

# Config

Config используется для настройки поведения Processor и всех JSON операций.

## Структура Config

```go
type Config struct {
    // ===== Настройки кэша =====
    MaxCacheSize int           `json:"max_cache_size"` // Максимальное количество записей в кэше
    CacheTTL     time.Duration `json:"cache_ttl"`      // Время жизни кэша
    EnableCache  bool          `json:"enable_cache"`   // Включить ли кэширование
    CacheResults bool          `json:"cache_results"`  // Кэшировать ли результаты операций

    // ===== Ограничения размеров =====
    MaxJSONSize  int64 `json:"max_json_size"`  // Максимальный размер JSON (байты)
    MaxPathDepth int   `json:"max_path_depth"` // Максимальная глубина пути
    MaxBatchSize int   `json:"max_batch_size"` // Максимальное количество пакетных операций

    // ===== Ограничения безопасности =====
    MaxNestingDepthSecurity   int   `json:"max_nesting_depth"`           // Максимальная глубина вложенности
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"` // Максимальный размер для проверки безопасности
    MaxObjectKeys             int   `json:"max_object_keys"`             // Максимальное количество ключей в объекте
    MaxArrayElements          int   `json:"max_array_elements"`          // Максимальное количество элементов в массиве
    FullSecurityScan          bool  `json:"full_security_scan"`          // Включить полный сканирование безопасности

    // ===== Параллелизм =====
    MaxConcurrency    int `json:"max_concurrency"`    // Максимальный уровень параллелизма
    ParallelThreshold int `json:"parallel_threshold"` // Порог параллельной обработки

    // ===== Параметры обработки =====
    EnableValidation bool `json:"enable_validation"` // Включить валидацию
    StrictMode       bool `json:"strict_mode"`       // Строгий режим
    CreatePaths      bool `json:"create_paths"`      // Автоматическое создание путей
    CleanupNulls     bool `json:"cleanup_nulls"`     // Очистка null значений
    CompactArrays    bool `json:"compact_arrays"`    // Сжатие массивов
    ContinueOnError  bool `json:"continue_on_error"` // Продолжать при ошибке в пакетных операциях

    // ===== Параметры ввода/вывода =====
    AllowComments    bool `json:"allow_comments"`     // Разрешить комментарии
    PreserveNumbers  bool `json:"preserve_numbers"`   // Сохранить точность чисел
    ValidateInput    bool `json:"validate_input"`     // Валидация ввода
    ValidateFilePath bool `json:"validate_file_path"` // Валидация пути к файлу
    SkipValidation   bool `json:"skip_validation"`    // Пропустить валидацию (для доверенных входных данных)

    // ===== Параметры кодирования =====
    Pretty          bool            `json:"pretty"`           // Форматированный вывод
    Indent          string          `json:"indent"`           // Строка отступа
    Prefix          string          `json:"prefix"`           // Префикс
    EscapeHTML      bool            `json:"escape_html"`      // Экранирование HTML
    SortKeys        bool            `json:"sort_keys"`        // Сортировка ключей
    ValidateUTF8    bool            `json:"validate_utf8"`    // Проверка UTF-8
    MaxDepth        int             `json:"max_depth"`        // Максимальная глубина кодирования
    DisallowUnknown bool            `json:"disallow_unknown"` // Запретить неизвестные поля
    FloatPrecision  int             `json:"float_precision"`  // Точность чисел с плавающей точкой (-1 для авто)
    FloatTruncate   bool            `json:"float_truncate"`   // Усечение чисел с плавающей точкой
    DisableEscaping bool            `json:"disable_escaping"` // Отключить экранирование
    EscapeUnicode   bool            `json:"escape_unicode"`   // Экранирование Unicode
    EscapeSlash     bool            `json:"escape_slash"`     // Экранирование слешей
    EscapeNewlines  bool            `json:"escape_newlines"`  // Экранирование переносов строк
    EscapeTabs      bool            `json:"escape_tabs"`      // Экранирование табуляций
    IncludeNulls    bool            `json:"include_nulls"`    // Включать null значения
    CustomEscapes   map[rune]string `json:"custom_escapes,omitempty"` // Пользовательские правила экранирования

    // ===== Наблюдаемость =====
    EnableMetrics     bool `json:"enable_metrics"`      // Включить сбор метрик
    EnableHealthCheck bool `json:"enable_health_check"` // Включить проверку здоровья

    // ===== Обработка больших файлов =====
    ChunkSize       int64 `json:"chunk_size"`       // Размер чанка
    MaxMemory       int64 `json:"max_memory"`       // Максимальное использование памяти
    BufferSize      int   `json:"buffer_size"`      // Размер буфера
    SamplingEnabled bool  `json:"sampling_enabled"` // Включить выборку
    SampleSize      int   `json:"sample_size"`      // Количество выборок

    // ===== Конфигурация JSONL =====
    JSONLBufferSize    int   `json:"jsonl_buffer_size"`     // Размер буфера JSONL
    JSONLMaxLineSize   int   `json:"jsonl_max_line_size"`   // Максимальный размер строки JSONL
    JSONLSkipEmpty     bool  `json:"jsonl_skip_empty"`      // Пропускать пустые строки
    JSONLSkipComments  bool  `json:"jsonl_skip_comments"`   // Пропускать строки с комментариями
    JSONLContinueOnErr bool  `json:"jsonl_continue_on_err"` // Продолжать при ошибке
    JSONLWorkers       int   `json:"jsonl_workers"`         // Количество параллельных обработчиков JSONL
    JSONLChunkSize     int   `json:"jsonl_chunk_size"`      // Размер чанка JSONL
    JSONLMaxMemory     int64 `json:"jsonl_max_memory"`      // Максимальная память JSONL

    // ===== Параметры слияния =====
    MergeMode MergeMode `json:"merge_mode"` // Стратегия слияния

    // ===== Точки расширения (без JSON-тега, не сериализуются) =====
    CustomEncoder               CustomEncoder                // Пользовательский кодировщик
    CustomTypeEncoders          map[reflect.Type]TypeEncoder // Кодировщики пользовательских типов
    CustomValidators            []Validator                  // Пользовательские валидаторы
    AdditionalDangerousPatterns []DangerousPattern           // Дополнительные опасные паттерны
    DisableDefaultPatterns      bool                         // Отключить стандартные паттерны предупреждений
    Hooks                       []Hook                       // Перехватчики операций
    CustomPathParser            PathParser                   // Пользовательский парсер путей
}
```

## Предустановки конфигурации

### DefaultConfig

Сигнатура: `func DefaultConfig() Config`

Возвращает конфигурацию по умолчанию, подходящую для большинства сценариев.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Значения по умолчанию**

| Поле | Значение | Описание |
|------|-----|------|
| MaxJSONSize | 100MB | Ограничение размера JSON |
| MaxNestingDepthSecurity | 200 | Глубина вложенности |
| MaxPathDepth | 50 | Глубина пути |
| MaxSecurityValidationSize | 10MB | Максимальный размер проверки безопасности |
| MaxObjectKeys | 100000 | Максимальное количество ключей объекта |
| MaxArrayElements | 100000 | Максимальное количество элементов массива |
| MaxConcurrency | 50 | Уровень параллелизма |
| MaxBatchSize | 2000 | Количество пакетных операций |
| CacheTTL | 5 минут | Время жизни кэша |
| MaxCacheSize | 128 | Максимальное количество записей в кэше |
| EnableCache | true | Включить кэширование |
| CacheResults | true | Кэшировать результаты операций |
| EnableValidation | true | Включить валидацию |
| StrictMode | false | Нестрогий режим |
| FullSecurityScan | false | Выборочное сканирование безопасности (не полное) |
| ValidateInput | true | Валидация ввода |
| ValidateFilePath | true | Валидация пути к файлу |
| CreatePaths | true | Автоматическое создание путей |
| Pretty | false | Без форматирования вывода |
| EscapeHTML | true | Экранирование HTML |
| ValidateUTF8 | true | Проверка UTF-8 |
| IncludeNulls | true | Включать null |
| EscapeNewlines | true | Экранирование переносов строк |
| EscapeTabs | true | Экранирование табуляций |
| FloatPrecision | -1 | Автоматическая точность |
| MaxDepth | 100 | Глубина кодирования |
| Indent | "  " | Отступ по умолчанию |
| ChunkSize | 1MB | Размер чанка |
| MaxMemory | 100MB | Максимальная память |
| BufferSize | 64KB | Размер буфера |
| SamplingEnabled | true | Включить выборку |
| SampleSize | 1000 | Количество выборок |
| JSONLBufferSize | 64KB | Размер буфера JSONL |
| JSONLMaxLineSize | 1MB | Максимальный размер строки JSONL |
| JSONLSkipEmpty | true | Пропускать пустые строки |
| JSONLSkipComments | false | Не пропускать комментарии |
| JSONLContinueOnErr | false | Остановка при ошибке |
| JSONLWorkers | 4 | Количество параллельных обработчиков |
| JSONLChunkSize | 1000 | Размер чанка JSONL |
| JSONLMaxMemory | 100MB | Максимальная память JSONL |
| MergeMode | MergeUnion | Объединительное слияние |

### SecurityConfig

Сигнатура: `func SecurityConfig() Config`

Возвращает безопасную конфигурацию, подходящую для обработки недоверенных входных данных.

```go
// Рекомендуется для:
// - Публичных API и веб-сервисов
// - Пользовательских данных
// - Внешних вебхуков
// - Конечных точек аутентификации
// - Обработки финансовых данных
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Особенности безопасной конфигурации**

| Поле | Значение | Описание |
|------|-----|------|
| MaxNestingDepthSecurity | 30 | Консервативная глубина вложенности |
| MaxSecurityValidationSize | 10MB | Размер проверки безопасности |
| MaxObjectKeys | 5000 | Консервативный предел ключей |
| MaxArrayElements | 5000 | Консервативный предел элементов |
| MaxJSONSize | 10MB | Консервативный предел размера |
| MaxPathDepth | 30 | Консервативная глубина пути |
| FullSecurityScan | true | Полный сканирование безопасности |
| StrictMode | true | Строгий режим |
| EnableValidation | true | Включить валидацию |
| EnableCache | true | Включить кэширование |
| MaxCacheSize | 256 | Размер кэша |
| CacheTTL | 3 минуты | Короткий TTL |

### PrettyConfig

Сигнатура: `func PrettyConfig() Config`

Возвращает конфигурацию форматированного вывода.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## Методы конфигурации

### Clone

Сигнатура: `func (c *Config) Clone() *Config`

Глубокое копирование конфигурации.

```go
cfg := json.DefaultConfig()
cfgCopy := cfg.Clone()
cfgCopy.EnableValidation = true // Не влияет на исходную конфигурацию
```

### Validate

Сигнатура: `func (c *Config) Validate() error`

Проверяет конфигурацию и автоматически исправляет недопустимые значения. Этот метод **изменяет Config на месте**, корректируя недопустимые поля до соответствующих минимальных допустимых значений.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // Недопустимое значение
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize будет исправлено на минимальное значение
```

### ValidateWithWarnings

Сигнатура: `func (c *Config) ValidateWithWarnings() []ConfigWarning`

Проверяет конфигурацию и возвращает список предупреждений об исправлениях.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1
warnings := cfg.ValidateWithWarnings()
for _, w := range warnings {
    fmt.Printf("%s: %s\n", w.Field, w.Reason)
}
```

### Тип ConfigWarning

`ConfigWarning` представляет информацию об автоматическом исправлении при валидации конфигурации.

```go
type ConfigWarning struct {
    Field    string // Имя исправленного поля
    OldValue any    // Исходное значение (недопустимое значение может быть nil)
    NewValue any    // Исправленное значение
    Reason   string // Причина исправления
}
```

### Тип SecurityLimits

`SecurityLimits` суммирует поля ограничений безопасности в Config.

```go
type SecurityLimits struct {
    MaxNestingDepth           int   `json:"max_nesting_depth"`
    MaxSecurityValidationSize int64 `json:"max_security_validation_size"`
    MaxObjectKeys             int   `json:"max_object_keys"`
    MaxArrayElements          int   `json:"max_array_elements"`
    MaxJSONSize               int64 `json:"max_json_size"`
    MaxPathDepth              int   `json:"max_path_depth"`
}
```

### AddHook

Сигнатура: `func (c *Config) AddHook(hook Hook)`

Добавляет перехватчик операций.

```go
cfg := json.DefaultConfig()
cfg.AddHook(json.LoggingHook(slog.Default()))
```

### AddValidator

Сигнатура: `func (c *Config) AddValidator(validator Validator)`

Добавляет пользовательский валидатор.

```go
cfg := json.DefaultConfig()
cfg.AddValidator(&MyValidator{})
```

### AddDangerousPattern

Сигнатура: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

Добавляет дополнительный паттерн безопасности.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

## Примеры использования

### Базовое использование

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Безопасная конфигурация

```go
// Обработка недоверенных входных данных
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Форматированный вывод

```go
// Форматирование JSON
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

### Пользовательская конфигурация

```go
cfg := json.DefaultConfig()

// Настройки безопасности
cfg.MaxJSONSize = 10 * 1024 * 1024 // 10MB
cfg.MaxNestingDepthSecurity = 50
cfg.EnableValidation = true

// Перехватчики
cfg.Hooks = []json.Hook{json.LoggingHook(slog.Default())}

// Валидаторы
cfg.CustomValidators = []json.Validator{&MyValidator{}}

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Клонирование и изменение

```go
// Создание вариантов на основе конфигурации по умолчанию
base := json.DefaultConfig()

// Вариант 1: Конфигурация для разработки
devCfg := base.Clone()
devCfg.EnableMetrics = true

// Вариант 2: Конфигурация для продакшена
prodCfg := base.Clone()
prodCfg.EnableValidation = true
```

## Константы конфигурации

```go
const (
    // Ограничения размеров
    DefaultMaxJSONSize       = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth   = 200
    DefaultMaxPathDepth      = 50
    DefaultMaxDepth          = 100                 // Глубина вложенности по умолчанию для кодирования/декодирования (Config.MaxDepth)
    DefaultMaxConcurrency    = 50
    DefaultMaxBatchSize      = 2000
    DefaultMaxSecuritySize   = 10 * 1024 * 1024   // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultParallelThreshold = 10

    // Кэш
    DefaultCacheTTL = 5 * time.Minute
)
```

::: info Внутренние константы
Константы ограничения длины пути (`maxPathLength`) и другие стали внутренней реализацией и больше не экспортируются как публичный API. Соответствующие значения по умолчанию отражены в значениях полей структуры `Config` по умолчанию.
:::

---

## Режимы слияния

`MergeMode` управляет стратегией слияния функций `MergeJSON` и `MergeMany`.

### MergeUnion (по умолчанию)

Объединяет все ключи/элементы, при конфликте использует перезаписывающее значение.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeUnion
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Результат: {"a": 1, "b": 3, "c": 4}
```

### MergeIntersection

Сохраняет только ключи, существующие в обоих объектах.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Результат: {"b": 3}
```

### MergeDifference

Сохраняет только ключи, которые существуют в базовом объекте, но отсутствуют в перезаписывающем объекте.

```go
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, err := json.MergeJSON(
    `{"a": 1, "b": 2}`,
    `{"b": 3, "c": 4}`,
    cfg,
)
// Результат: {"a": 1}
```

---

## Рекомендации по безопасности

| Параметр | Рекомендуемое значение | Описание |
|--------|--------|------|
| MaxJSONSize | 10-100MB | Настройте в зависимости от памяти сервера |
| MaxNestingDepthSecurity | 30-50 | Предотвращает атаки глубокой вложенности |
| MaxPathDepth | 30-50 | Ограничивает сложность путей |
| EnableValidation | true | Всегда включать |
| FullSecurityScan | true (для недоверенных входных данных) | Полный сканирование безопасности |

## Смотрите также

- [Processor](./processor/) - Методы процессора
- [Константы и ошибки](./constants) - Константы конфигурации
- [Обзор безопасности](../security/) - Лучшие практики безопасности
- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
