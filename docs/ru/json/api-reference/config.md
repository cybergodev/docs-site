---
title: "Конфигурация Config - CyberGo JSON | Справочник API"
description: "Полный справочник параметров конфигурации CyberGo JSON Config: подробное описание DefaultConfig по умолчанию, SecurityConfig настроек безопасности, PrettyConfig форматирования, настроек кэша, ограничений размеров, параметров безопасности и кодирования для настройки поведения Processor и всех JSON операций."
---

# Config

Config используется для настройки поведения Processor и всех JSON операций.

## Структура Config

```go
type Config struct {
    // ===== Настройки кэша =====
    MaxCacheSize int           // Максимальное количество записей в кэше
    CacheTTL     time.Duration // Время жизни записи в кэше
    EnableCache  bool          // Включить ли кэширование
    CacheResults bool          // Кэшировать ли результаты операций

    // ===== Ограничения размеров =====
    MaxJSONSize  int64 // Максимальный размер JSON (байты)
    MaxPathDepth int   // Максимальная глубина пути
    MaxBatchSize int   // Максимальное количество пакетных операций

    // ===== Ограничения безопасности =====
    MaxNestingDepthSecurity   int   // Максимальная глубина вложенности
    MaxSecurityValidationSize int64 // Максимальный размер для проверки безопасности
    MaxObjectKeys             int   // Максимальное количество ключей объекта
    MaxArrayElements          int   // Максимальное количество элементов массива
    FullSecurityScan          bool  // Включить полную проверку безопасности

    // ===== Параллелизм =====
    MaxConcurrency    int // Максимальное количество параллельных операций
    ParallelThreshold int // Порог параллельной обработки

    // ===== Параметры обработки =====
    EnableValidation bool // Включить валидацию
    StrictMode       bool // Строгий режим
    CreatePaths      bool // Автоматическое создание путей
    CleanupNulls     bool // Очистка null значений
    CompactArrays    bool // Сжатие массивов
    ContinueOnError  bool // Продолжать при ошибке в пакетных операциях

    // ===== Параметры ввода/вывода =====
    AllowComments    bool // Разрешить комментарии
    PreserveNumbers  bool // Сохранить точность чисел
    ValidateInput    bool // Валидировать ввод
    ValidateFilePath bool // Валидировать пути к файлам
    SkipValidation   bool // Пропустить валидацию (для доверенных данных)

    // ===== Параметры кодирования =====
    Pretty          bool            // Форматированный вывод
    Indent          string          // Строка отступа
    Prefix          string          // Префикс
    EscapeHTML      bool            // Экранирование HTML
    SortKeys        bool            // Сортировка ключей
    ValidateUTF8    bool            // Проверка UTF-8
    MaxDepth        int             // Максимальная глубина кодирования
    DisallowUnknown bool            // Запретить неизвестные поля
    FloatPrecision  int             // Точность чисел с плавающей точкой (-1 для авто)
    FloatTruncate   bool            // Усечение чисел с плавающей точкой
    DisableEscaping bool            // Отключить экранирование
    EscapeUnicode   bool            // Экранирование Unicode
    EscapeSlash     bool            // Экранирование слешей
    EscapeNewlines  bool            // Экранирование символов новой строки
    EscapeTabs      bool            // Экранирование табуляций
    IncludeNulls    bool            // Включать null значения
    CustomEscapes   map[rune]string // Пользовательское экранирование

    // ===== Наблюдаемость =====
    EnableMetrics     bool // Включить сбор метрик
    EnableHealthCheck bool // Включить проверку здоровья

    // ===== Обработка больших файлов =====
    ChunkSize       int64 // Размер чанка
    MaxMemory       int64 // Максимальное использование памяти
    BufferSize      int   // Размер буфера
    SamplingEnabled bool  // Включить выборку
    SampleSize      int   // Количество образцов

    // ===== Конфигурация JSONL =====
    JSONLBufferSize    int   // Размер буфера JSONL
    JSONLMaxLineSize   int   // Максимальный размер строки JSONL
    JSONLSkipEmpty     bool  // Пропускать пустые строки
    JSONLSkipComments  bool  // Пропускать строки с комментариями
    JSONLContinueOnErr bool  // Продолжать при ошибке
    JSONLWorkers       int   // Количество параллельных обработчиков JSONL
    JSONLChunkSize     int   // Размер чанка JSONL
    JSONLMaxMemory     int64 // Максимальная память JSONL

    // ===== Параметры слияния =====
    MergeMode MergeMode // Стратегия слияния

    // ===== Контекст =====
    Context context.Context // Контекст операции

    // ===== Точки расширения =====
    CustomEncoder              CustomEncoder                // Пользовательский кодировщик
    CustomTypeEncoders         map[reflect.Type]TypeEncoder // Кодировщики пользовательских типов
    CustomValidators           []Validator                  // Пользовательские валидаторы
    AdditionalDangerousPatterns []DangerousPattern           // Дополнительные опасные шаблоны
    DisableDefaultPatterns     bool                         // Отключить стандартные шаблоны предупреждений
    Hooks                      []Hook                       // Перехватчики операций
    CustomPathParser           PathParser                   // Пользовательский парсер путей
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
|------|----------|----------|
| MaxJSONSize | 100MB | Ограничение размера JSON |
| MaxNestingDepthSecurity | 200 | Глубина вложенности |
| MaxPathDepth | 50 | Глубина пути |
| MaxConcurrency | 50 | Уровень параллелизма |
| MaxBatchSize | 2000 | Количество пакетных операций |
| CacheTTL | 5 минут | Время жизни кэша |
| MaxCacheSize | 128 | Максимальное количество записей в кэше |
| EnableCache | true | Включить кэширование |
| CacheResults | true | Кэшировать результаты операций |
| EnableValidation | true | Включить валидацию |
| ValidateInput | true | Валидировать ввод |
| ValidateFilePath | true | Валидировать пути к файлам |
| CreatePaths | true | Автоматическое создание путей |
| Pretty | false | Без форматирования вывода |
| EscapeHTML | true | Экранирование HTML |
| ValidateUTF8 | true | Проверка UTF-8 |
| IncludeNulls | true | Включать null |
| EscapeNewlines | true | Экранирование символов новой строки |
| EscapeTabs | true | Экранирование табуляций |
| FloatPrecision | -1 | Автоматическая точность |
| MaxDepth | 100 | Глубина кодирования |
| Indent | "  " | Отступ по умолчанию |
| ChunkSize | 1MB | Размер чанка |
| MaxMemory | 100MB | Максимальная память |
| BufferSize | 64KB | Размер буфера |
| SamplingEnabled | true | Включить выборку |
| SampleSize | 1000 | Количество образцов |
| JSONLBufferSize | 64KB | Размер буфера JSONL |
| JSONLMaxLineSize | 1MB | Максимальный размер строки JSONL |
| JSONLSkipEmpty | true | Пропускать пустые строки |
| JSONLSkipComments | false | Не пропускать комментарии |
| JSONLContinueOnErr | false | Останавливаться при ошибке |
| JSONLWorkers | 4 | Количество параллельных обработчиков |
| JSONLChunkSize | 1000 | Размер чанка JSONL |
| JSONLMaxMemory | 100MB | Максимальная память JSONL |
| MergeMode | MergeUnion | Объединяющее слияние |

### SecurityConfig

Сигнатура: `func SecurityConfig() Config`

Возвращает конфигурацию безопасности, подходящую для обработки недоверенных входных данных.

```go
// Рекомендуется для:
// - Публичных API и веб-сервисов
// - Пользовательских данных
// - Внешних вебхуков
// - Точек аутентификации
// - Обработки финансовых данных
cfg := json.SecurityConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

**Особенности конфигурации безопасности**

| Поле | Значение | Описание |
|------|----------|----------|
| MaxNestingDepthSecurity | 30 | Консервативная глубина вложенности |
| MaxSecurityValidationSize | 10MB | Размер проверки безопасности |
| MaxObjectKeys | 5000 | Консервативное ограничение ключей |
| MaxArrayElements | 5000 | Консервативное ограничение элементов |
| MaxJSONSize | 10MB | Консервативное ограничение размера |
| MaxPathDepth | 30 | Консервативная глубина пути |
| FullSecurityScan | true | Полная проверка безопасности |
| StrictMode | true | Строгий режим |
| EnableValidation | true | Включить валидацию |
| EnableCache | true | Включить кэширование |
| MaxCacheSize | 256 | Размер кэша |
| CacheTTL | 3 минуты | Короткий TTL |

### PrettyConfig

Сигнатура: `func PrettyConfig() Config`

Возвращает конфигурацию для форматированного вывода.

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

Проверяет конфигурацию и автоматически исправляет недопустимые значения.

```go
cfg := json.DefaultConfig()
cfg.MaxJSONSize = -1 // Недопустимое значение
if err := cfg.Validate(); err != nil {
    panic(err)
}
// MaxJSONSize будет автоматически исправлено на минимальное значение
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
    OldValue any    // Исходное значение (может быть nil для недопустимых значений)
    NewValue any    // Исправленное значение
    Reason   string // Причина исправления
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

Добавляет дополнительный шаблон безопасности.

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

### Конфигурация безопасности

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

### Клонирование и модификация

```go
// Создание вариантов на основе конфигурации по умолчанию
base := json.DefaultConfig()

// Вариант 1: Конфигурация для разработки
devCfg := base.Clone()
devCfg.EnableMetrics = true

// Вариант 2: Продакшен конфигурация
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
Константы ограничения длины пути (`maxPathLength`), ограничения длины ключа кэша (`maxCacheKeyLength`) и другие были переведены во внутреннюю реализацию и больше не экспортируются как публичный API. Соответствующие значения по умолчанию отражены в полях структуры `Config`.
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

Сохраняет только ключи, существующие в базовом объекте, но отсутствующие в перезаписывающем объекте.

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
|----------|------------------------|----------|
| MaxJSONSize | 10-100MB | Настройте в зависимости от памяти сервера |
| MaxNestingDepthSecurity | 30-50 | Защита от атак с глубокой вложенностью |
| MaxPathDepth | 30-50 | Ограничение сложности путей |
| EnableValidation | true | Всегда включать |
| FullSecurityScan | true (для недоверенных данных) | Полная проверка безопасности |

## Связанные разделы

- [Processor](./processor/) - Методы обработчика
- [Константы и ошибки](./constants) - Константы конфигурации
- [Обзор безопасности](../security/) - Лучшие практики безопасности
- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
