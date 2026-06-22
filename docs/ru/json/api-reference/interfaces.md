---
title: "Определения интерфейсов - CyberGo JSON | Справочник API"
description: "Интерфейсы CyberGo JSON: CustomEncoder, TypeEncoder, Validator, Hook, PathParser и DangerousPattern для расширения кодирования, валидации и безопасности."
---

# Определения интерфейсов

Пакет json предоставляет несколько расширяемых интерфейсов для пользовательского поведения обработки JSON.

## Интерфейсы кодировщика

### CustomEncoder

Интерфейс пользовательского JSON кодировщика.

```go
type CustomEncoder interface {
    // Encode преобразует значение Go в JSON строку
    Encode(value any) (string, error)
}
```

**Пример использования**

```go
import stdjson "encoding/json"

type UpperCaseEncoder struct{}

func (e *UpperCaseEncoder) Encode(value any) (string, error) {
    // Пользовательская логика кодирования
    switch v := value.(type) {
    case string:
        return fmt.Sprintf(`"%s"`, strings.ToUpper(v)), nil
    default:
        // Использование стандартного кодирования (избегание бесконечной рекурсии)
        data, err := stdjson.Marshal(v)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}

// Конфигурация использования
cfg := json.DefaultConfig()
cfg.CustomEncoder = &UpperCaseEncoder{}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### TypeEncoder

Интерфейс кодировщика для определённого типа.

```go
type TypeEncoder interface {
    // Encode кодирует значение определённого типа в JSON строку
    Encode(v reflect.Value) (string, error)
}
```

**Пример использования**

```go
type TimeEncoder struct{}

func (e *TimeEncoder) Encode(v reflect.Value) (string, error) {
    if v.Type() == reflect.TypeOf(time.Time{}) {
        t := v.Interface().(time.Time)
        return fmt.Sprintf(`"%s"`, t.Format(time.RFC3339)), nil
    }
    return "", fmt.Errorf("неподдерживаемый тип: %v", v.Type())
}

// Регистрация кодировщика типа
cfg := json.DefaultConfig()
cfg.CustomTypeEncoders = map[reflect.Type]json.TypeEncoder{
    reflect.TypeOf(time.Time{}): &TimeEncoder{},
}
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Интерфейс валидатора

### Validator

Интерфейс JSON валидатора.

```go
type Validator interface {
    // Validate проверяет, есть ли проблемы в JSON строке
    // Возвращает nil, если валидно, иначе ошибку, описывающую проблему
    Validate(jsonStr string) error
}
```

**Пример использования**

```go
type SizeValidator struct {
    MaxSize int64
}

func (v *SizeValidator) Validate(jsonStr string) error {
    // Проверка размера входных данных
    if int64(len(jsonStr)) > v.MaxSize {
        return fmt.Errorf("JSON превышает максимальный размер: %d", v.MaxSize)
    }
    return nil
}

// Установка валидатора
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&SizeValidator{MaxSize: 1024 * 1024}} // 1MB
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Интерфейс перехватчика

### Hook

Интерфейс перехвата операций с поддержкой предварительной/последующей обработки.

```go
type Hook interface {
    // Before вызывается перед операцией
    // Возврат ошибки прерывает операцию
    Before(ctx HookContext) error

    // After вызывается после завершения операции
    // Может модифицировать результат или проверить ошибку
    After(ctx HookContext, result any, err error) (any, error)
}
```

### HookContext

Контекст перехватчика, предоставляющий информацию об операции.

```go
type HookContext struct {
    Operation string        // Тип операции: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string        // Входная JSON строка (может быть пустой при marshal). Предупреждение безопасности: может содержать конфиденциальные данные
    Path      string        // Целевой путь (может быть пустым при marshal/unmarshal)
    Value     any           // Значение операции set
    Config    *Config       // Активная конфигурация
    StartTime time.Time     // Время начала операции
}
```

**Пример использования**

```go
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("Операция начата",
        "operation", ctx.Operation,
        "path", ctx.Path,
    )
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("Операция завершена",
        "operation", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err,
    )
    return result, err
}

// Добавление перехватчика
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{&LoggingHook{logger: slog.Default()}}
```

### HookFunc

Адаптер структуры, позволяющий использовать функции в качестве перехватчиков.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

**Пример использования**

```go
// Нужен только After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Нужен только Before
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

### Предопределённые перехватчики

#### LoggingHook

Сигнатура: `func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook`

Создаёт перехватчик для логирования.

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

#### TimingHook

Сигнатура: `func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook`

Создаёт перехватчик для замеров времени.

```go
type MetricsRecorder struct{}

func (r *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.RecordDuration(op, duration)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

#### ValidationHook

Сигнатура: `func ValidationHook(validator func(jsonStr, path string) error) Hook`

Создаёт перехватчик для валидации входных данных.

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON слишком большой")
    }
    return nil
}))
```

#### ErrorHook

Сигнатура: `func ErrorHook(handler func(ctx HookContext, err error) error) Hook`

Создаёт перехватчик для перехвата ошибок.

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Возвращает исходную или преобразованную ошибку
}))
```

## Интерфейсы паттернов безопасности

### PatternLevel

Уровень серьёзности опасного паттерна.

```go
type PatternLevel int

const (
    // PatternLevelCritical - всегда блокирует операцию
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - блокирует в строгом режиме, записывает предупреждение в мягком режиме
    PatternLevelWarning

    // PatternLevelInfo - только запись в журнал, никогда не блокирует
    PatternLevelInfo
)
```

### DangerousPattern

Структура опасного паттерна для определения пользовательских правил безопасности.

```go
type DangerousPattern struct {
    // Pattern - подстрока для обнаружения во входных данных
    Pattern string

    // Name - описательное имя паттерна
    Name string

    // Level - уровень серьёзности, определяющий способ обработки
    Level PatternLevel
}
```

**Пример использования**

```go
// Создание пользовательского опасного паттерна с помощью литерала структуры
customPattern := json.DangerousPattern{
    Pattern: "eval(",
    Name:    "Вызов JavaScript eval",
    Level:   json.PatternLevelCritical,
}

// Добавление через конфигурацию
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(customPattern)
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "internal_api",
    Name:    "Ссылка на внутренний API",
    Level:   json.PatternLevelWarning,
})
```

## Интерфейс парсера путей

### PathParser

Интерфейс парсера путей.

```go
type PathParser interface {
    // ParsePath разбирает строку пути в сегменты пути
    ParsePath(path string) ([]PathSegment, error)
}
```

**Пример использования**

```go
type CustomPathParser struct{}

func (p *CustomPathParser) ParsePath(path string) ([]json.PathSegment, error) {
    // Пользовательская логика разбора пути
    return nil, nil // реализация пользовательского разбора
}
```

## Базовые типы

### Number

Тип JSON числа для сохранения точности чисел. Используется при обработке больших чисел или когда требуется точность десятичных дробей.

```go
type Number string
```

::: tip Примечание о совместимости
Тип `Number` библиотеки на 100% совместим с `encoding/json.Number`, может использоваться как прямая замена.
:::

**Методы**:

```go
func (n Number) String() string              // Возвращает литеральный текст числа
func (n Number) Float64() (float64, error)   // Преобразует в float64
func (n Number) Int64() (int64, error)       // Преобразует в int64
```

**Пример использования**:

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Получение типа Number (через метод Get с последующим приведением типа)
val, err := processor.Get(data, "large_number")
if err != nil {
    panic(err)
}

// Приведение типа к Number
if num, ok := val.(json.Number); ok {
    // Number сохраняет исходную точность
    fmt.Println(num.String()) // "9007199254740993" (полная точность)

    // Преобразование в другие типы
    f, _ := num.Float64()
    i, _ := num.Int64()
}
```

## Совместимые интерфейсы стандартной библиотеки

Пакет `json` экспортирует следующие стандартные интерфейсы, совместимые с `encoding/json`, для настройки поведения кодирования и декодирования пользовательских типов.

### Marshaler

```go
type Marshaler interface {
    MarshalJSON() ([]byte, error)
}
```

### Unmarshaler

```go
type Unmarshaler interface {
    UnmarshalJSON(data []byte) error
}
```

### TextMarshaler

```go
type TextMarshaler interface {
    MarshalText() ([]byte, error)
}
```

### TextUnmarshaler

```go
type TextUnmarshaler interface {
    UnmarshalText(text []byte) error
}
```

**Пример использования**

```go
type Person struct {
    Name string
}

// Реализация интерфейса Marshaler
func (p Person) MarshalJSON() ([]byte, error) {
    return []byte(`{"name":"` + p.Name + `"}`), nil
}

// Реализация интерфейса Unmarshaler
func (p *Person) UnmarshalJSON(data []byte) error {
    var v struct{ Name string `json:"name"` }
    if err := json.Unmarshal(data, &v); err != nil {
        return err
    }
    p.Name = v.Name
    return nil
}
```

Типы кодирования/декодирования `Encoder`, `Decoder`, `Token`, `Delim`, `Number` и другие подробно описаны в разделе [Определения типов](./types#encoder-json-кодировщик).

## Определения типов

### Result[T]

Типобезопасный результат операции, предоставляющий обобщённую обработку результата.

```go
type Result[T any] struct {
    Value  T     // Значение результата
    Exists bool  // Существует ли путь
    Error  error // Информация об ошибке (если есть)
}
```

**Методы**:

| Метод | Сигнатура | Описание |
|------|------|------|
| `Ok` | `func (r Result[T]) Ok() bool` | Действителен ли результат (без ошибок и существует) |
| `Unwrap` | `func (r Result[T]) Unwrap() T` | Возвращает значение, при недействительности возвращает нулевое значение |
| `UnwrapOr` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Возвращает значение или значение по умолчанию |

**Пример использования**:

```go
// Получение значения с помощью обобщённого метода
name := json.GetTyped[string](data, "user.name")
fmt.Println(name)

// Получение со значением по умолчанию
name = json.GetTyped[string](data, "user.name", "unknown")
```

---

### AccessResult

Результат динамического доступа к типу, возвращается Processor.SafeGet.

```go
type AccessResult struct {
    Value  any    // Значение результата
    Exists bool   // Существует ли путь
    Type   string // Информация о типе во время выполнения
}

// Методы
func (r AccessResult) Ok() bool                           // Существует ли
func (r AccessResult) Unwrap() any                        // Получить значение
func (r AccessResult) UnwrapOr(defaultValue any) any      // Получить значение или значение по умолчанию
func (r AccessResult) AsString() (string, error)          // Строгое преобразование
func (r AccessResult) AsStringConverted() (string, error) // Преобразование с форматированием
func (r AccessResult) AsInt() (int, error)                // Строгое преобразование
func (r AccessResult) AsFloat64() (float64, error)        // Строгое преобразование
func (r AccessResult) AsBool() (bool, error)              // Строгое преобразование
```

**Описание методов преобразования типов**:

| Метод | Поведение преобразования | Описание |
|------|----------|------|
| `AsString()` | Строгое | Принимает только тип string, для нестроковых значений возвращает ошибку |
| `AsStringConverted()` | Форматирование | Использует fmt.Sprintf для преобразования любого значения в строковое представление |
| `AsInt()` | Строгое | Не преобразует bool в int, принимает только целые числа и разборчивые числа |
| `AsFloat64()` | Строгое | Не преобразует bool в float, принимает только числа с плавающей точкой и разборчивые числа |
| `AsBool()` | Строгое | Принимает только bool и строки, допустимые `strconv.ParseBool` ("1"/"t"/"T"/"TRUE"/"true"/"True", "0"/"f"/"F"/"FALSE"/"false"/"False") |

```go
result := p.SafeGet(data, "user.age")

// Строгое преобразование - возвращает ошибку, если значение не является целым числом
age, err := result.AsInt()

// Преобразование с форматированием - преобразует любое значение в строку
str, err := result.AsStringConverted() // например 30 -> "30"
```

## Тип Schema

### Schema

JSON Schema определяется как структура, поддерживает типобезопасное определение Schema.

```go
type Schema struct {
    Type                 string            `json:"type,omitempty"`
    Properties           map[string]*Schema `json:"properties,omitempty"`
    Items                *Schema           `json:"items,omitempty"`
    Required             []string          `json:"required,omitempty"`
    MinLength            int               `json:"minLength,omitempty"`
    MaxLength            int               `json:"maxLength,omitempty"`
    Minimum              float64           `json:"minimum,omitempty"`
    Maximum              float64           `json:"maximum,omitempty"`
    Pattern              string            `json:"pattern,omitempty"`
    Format               string            `json:"format,omitempty"`
    AdditionalProperties bool              `json:"additionalProperties,omitempty"`
    MinItems             int               `json:"minItems,omitempty"`
    MaxItems             int               `json:"maxItems,omitempty"`
    UniqueItems          bool              `json:"uniqueItems,omitempty"`
    Enum                 []any             `json:"enum,omitempty"`
    Const                any               `json:"const,omitempty"`
    MultipleOf           float64           `json:"multipleOf,omitempty"`
    ExclusiveMinimum     bool              `json:"exclusiveMinimum,omitempty"`
    ExclusiveMaximum     bool              `json:"exclusiveMaximum,omitempty"`
    Title                string            `json:"title,omitempty"`
    Description          string            `json:"description,omitempty"`
    Default              any               `json:"default,omitempty"`
    Examples             []any             `json:"examples,omitempty"`
}
```

**Пример использования**:

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
```

### SchemaConfig

Конфигурация валидации Schema. Используется для создания экземпляра Schema через `NewSchemaWithConfig`.

```go
type SchemaConfig struct {
    Type                 string
    Properties           map[string]*Schema
    Items                *Schema
    Required             []string
    MinLength            *int
    MaxLength            *int
    Minimum              *float64
    Maximum              *float64
    Pattern              string
    Format               string
    AdditionalProperties *bool
    MinItems             *int
    MaxItems             *int
    UniqueItems          bool
    Enum                 []any
    Const                any
    MultipleOf           *float64
    ExclusiveMinimum     *bool
    ExclusiveMaximum     *bool
    Title                string
    Description          string
    Default              any
    Examples             []any
}
```

**Пример использования**:

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
additionalProperties := false
cfg.AdditionalProperties = &additionalProperties
schema := json.NewSchemaWithConfig(cfg)
```

### ValidationError

Ошибка валидации Schema.

```go
type ValidationError struct {
    Path    string `json:"path"`    // Путь ошибки
    Message string `json:"message"` // Сообщение об ошибке
}

func (ve *ValidationError) Error() string
```

## Смотрите также

- [Система перехватчиков Hook](./hooks) - Подробное руководство по перехватчикам
- [Validator](./validator) - Подробное руководство по валидаторам
- [CustomEncoder](./custom-encoder) - Руководство по пользовательскому кодировщику
