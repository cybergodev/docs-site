---
title: "Определения типов - CyberGo JSON | Справочник API"
description: "Полный справочник основных типов CyberGo JSON: включает Result[T] обобщённый результат, AccessResult результат динамического доступа, BatchOperation, BatchResult, Schema схема валидации, Stats, HealthStatus, IterableValue и типы ошибок кодирования."
---

# Определения типов

Пакет json предоставляет множество типобезопасных типов для обработки результатов JSON операций.

## Result[T] - Унифицированный тип результата

`Result[T]` - обобщённый тип результата операции, обеспечивающий типобезопасную обработку ошибок и доступ к значениям.

### Определение структуры

```go
type Result[T any] struct {
    Value  T     // Значение результата
    Exists bool  // Было ли значение найдено
    Error  error // Ошибка (если есть)
}
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Ok()` | `func (r Result[T]) Ok() bool` | Проверяет, действителен ли результат (без ошибки и найден) |
| `Unwrap()` | `func (r Result[T]) Unwrap() T` | Возвращает значение, при неудаче возвращает нулевое значение |
| `UnwrapOr()` | `func (r Result[T]) UnwrapOr(defaultValue T) T` | Возвращает значение или значение по умолчанию |

### Пример использования

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // Получение типизированного значения с помощью GetTyped
    name := json.GetTyped[string](data, "user.name")
    fmt.Printf("Имя: %s\n", name)

    // Использование параметра defaultValue для предоставления значения по умолчанию
    nickname := json.GetTyped[string](data, "user.nickname", "Не задано")
    fmt.Printf("Псевдоним: %s\n", nickname)

    age := json.GetTyped[int](data, "user.age", 0)
    fmt.Printf("Возраст: %d\n", age)
}
```

::: tip Соглашение об именовании
- **GetTyped[T]** - Получение значения указанного типа, возвращает `T`, поддерживает параметр `defaultValue`
- **Result[T]** - Внутренний тип результата для сценариев, требующих детальной обработки ошибок
:::

---

## CompiledPath - Предкомпилированный путь

`CompiledPath` - псевдоним предкомпилированного типа JSON пути, используемый для избежания повторного разбора строки пути при частом обращении к одному и тому же пути, что повышает производительность.

### Определение типа

```go
type CompiledPath = internal.CompiledPath
```

### Сценарий использования

Когда необходимо выполнить большое количество повторяющихся операций с одним и тем же путём (например, пакетные запросы в цикле), можно предварительно скомпилировать путь, чтобы избежать повторного разбора строки пути при каждом вызове.

### Функция компиляции

#### Processor.CompilePath

Сигнатура: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Предкомпилирует JSON путь через Processor, возвращая экземпляр `*CompiledPath`, который можно использовать в последующих операциях.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

compiled, err := processor.CompilePath("user.profile.name")
if err != nil {
    panic(err)
}
// Можно повторно использовать compiled в последующих операциях
val, err := processor.GetCompiled(data, compiled)
```

::: tip Совет по производительности
Для высокочастотного повторного доступа к путям предкомпиляция пути может значительно сократить накладные расходы на разбор. Подходит для пакетных операций, циклических запросов и подобных сценариев.
:::

---

## AccessResult - Результат доступа к свойствам

`AccessResult` - результат безопасного доступа к свойствам, предоставляющий цепочечное преобразование типов.

### Определение структуры

```go
type AccessResult struct {
    Value  any    // Значение результата
    Exists bool   // Существует ли путь
    Type   string // Информация о типе во время выполнения (для отладки)
}
```

### Метод создания

#### Processor.SafeGet

Сигнатура: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Безопасное получение свойства, возвращает `AccessResult` для цепочечного преобразования типов.

Можно также использовать функцию уровня пакета `SafeGet`:

Сигнатура: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

result := processor.SafeGet(data, "user.age")

if !result.Exists {
    fmt.Println("Путь не существует")
    return
}

// Проверка типа
fmt.Println("Тип:", result.Type)
```

### Методы цепочечного преобразования типов

| Метод | Возвращаемый тип | Описание |
|-------|------------------|----------|
| `Unwrap()` | `any` | Возвращает значение, nil если не существует |
| `UnwrapOr(defaultValue)` | `any` | Возвращает значение или значение по умолчанию |
| `AsString()` | `(string, error)` | Преобразование в строку (строгая проверка типа) |
| `AsStringConverted()` | `(string, error)` | Форматированное преобразование в строку |
| `AsInt()` | `(int, error)` | Преобразование в целое число (bool не преобразуется) |
| `AsFloat64()` | `(float64, error)` | Преобразование в float64 (bool не преобразуется) |
| `AsBool()` | `(bool, error)` | Преобразование в логическое значение |

::: warning Внимание
Методы `AsInt64()`, `AsArray()`, `AsObject()` удалены. Используйте `GetTyped[T]` для получения этих типов.
:::

```go
result := processor.SafeGet(data, "user.profile")

// Цепочечные вызовы
name, _ := result.AsString()
email, _ := result.AsString()
age, _ := result.AsInt()
price, _ := result.AsFloat64()
active, _ := result.AsBool()

// Для типов массива или объекта используйте GetTyped
arr := json.GetTyped[[]any](data, "items")
obj := json.GetTyped[map[string]any](data, "user.profile")
```

### Пример использования

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    data := `{"user": {"name": "Alice", "age": 30, "active": true}}`

    // Безопасное получение и преобразование
    result := processor.SafeGet(data, "user.age")

    // Прямое использование методов AccessResult
    age, err := result.AsInt()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Возраст: %d\n", age)

    // Получение несуществующего пути
    missing := processor.SafeGet(data, "user.nickname")
    if !missing.Exists {
        fmt.Println("Псевдоним не существует")
    }
}
```

---

## Schema - Тип JSON Schema

`Schema` используется для определения правил структурной валидации JSON данных, поддерживает подмножество JSON Schema Draft 7.

### Определение структуры

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

### Создание Schema

#### Прямая конструция

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "integer", Minimum: 0},
    },
}
```

#### Использование NewSchemaWithConfig

```go
cfg := json.DefaultSchemaConfig()
cfg.Type = "object"
cfg.Required = []string{"name", "email"}
schema := json.NewSchemaWithConfig(cfg)
```

### Структура SchemaConfig

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

### Пример использования

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Определение Schema с помощью литерала структуры
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name": {
                Type:      "string",
                MinLength: 1,
                MaxLength: 100,
            },
            "email": {
                Type:   "string",
                Format: "email",
            },
            "age": {
                Type:    "integer",
                Minimum: 0,
                Maximum: 150,
            },
        },
        AdditionalProperties: false,
    }

    // Валидация JSON
    data := `{"name": "Alice", "email": "alice@example.com", "age": 30}`
    errors, err := json.ValidateSchema(data, schema)
    if err != nil {
        panic(err)
    }

    if len(errors) > 0 {
        for _, e := range errors {
            fmt.Printf("Ошибка валидации [%s]: %s\n", e.Path, e.Message)
        }
    } else {
        fmt.Println("Валидация пройдена")
    }
}
```

---

## ValidationError

Тип ошибки валидации Schema.

### Определение структуры

```go
type ValidationError struct {
    Path    string // Путь, где произошла ошибка
    Message string // Сообщение об ошибке
}
```

### Методы

#### Error

Сигнатура: `func (ve *ValidationError) Error() string`

Реализует интерфейс error.

```go
for _, e := range errors {
    fmt.Println(e.Error())
}
```

---

## BatchOperation

Определение пакетной операции.

### Определение структуры

```go
type BatchOperation struct {
    Type    string // Тип операции: "get", "set", "delete", "validate"
    JSONStr string // Строка JSON данных
    Path    string // Целевой путь
    Value   any    // Значение для операции Set
    ID      string // Идентификатор операции
}
```

---

## BatchResult

Результат пакетной операции.

### Определение структуры

```go
type BatchResult struct {
    ID     string // Идентификатор операции (соответствует BatchOperation.ID)
    Result any    // Результат операции
    Error  error  // Ошибка (если есть)
}
```

---

## WarmupResult

Результат прогрева кэша.

### Определение структуры

```go
type WarmupResult struct {
    TotalPaths  int      // Общее количество путей
    Successful  int      // Количество успешных прогревов
    Failed      int      // Количество неудачных
    SuccessRate float64  // Процент успешных
    FailedPaths []string // Список неудачных путей
}
```

---

## ParsedJSON

Предварительно разобранный JSON документ, может повторно использоваться для множественных операций запроса.

### Определение структуры

Внутренние поля `ParsedJSON` не экспортируются, доступ осуществляется через методы.

```go
type ParsedJSON struct {
    // Внутренние поля (не экспортируются)
    // Используйте метод Data() для получения разобранных данных
}
```

### Метод Data

Сигнатура: `func (p *ParsedJSON) Data() any`

Возвращает базовые разобранные данные.

```go
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Предварительный разбор JSON
parsed, err := processor.PreParse(`{"user": {"name": "Alice", "age": 30}}`)
if err != nil {
    panic(err)
}

// Множественные запросы к предразобранному результату
name, _ := processor.GetFromParsed(parsed, "user.name")
age, _ := processor.GetFromParsed(parsed, "user.age")
```

### Сценарии использования

| Сценарий | Описание |
|----------|----------|
| Высокочастотные запросы | Избегание повторного разбора при множественных запросах к одному JSON |
| Пакетное получение путей | Использование `GetMultiple` для получения нескольких путей |
| Оптимизация производительности | Значительное повышение производительности запросов после предразбора |

::: tip Совет по производительности
Для сценариев, требующих множественных запросов к одной и той же JSON строке, использование `PreParse` для предразбора может значительно повысить производительность, избегая накладных расходов на повторный разбор.
:::

---

## Stats

Статистическая информация обработчика.

### Определение структуры

```go
type Stats struct {
    CacheSize        int64         // Текущий размер кэша
    CacheMemory      int64         // Использование памяти кэшем (байты)
    MaxCacheSize     int           // Максимальный размер кэша
    HitCount         int64         // Количество попаданий в кэш
    MissCount        int64         // Количество промахов кэша
    HitRatio         float64       // Процент попаданий в кэш
    CacheTTL         time.Duration // Время жизни записи в кэше
    CacheEnabled     bool          // Включён ли кэш
    IsClosed         bool          // Закрыт ли обработчик
    MemoryEfficiency float64       // Эффективность памяти
    OperationCount   int64         // Общее количество операций
    ErrorCount       int64         // Общее количество ошибок
}
```

---

## HealthStatus

Информация о состоянии здоровья.

### Определение структуры

```go
type HealthStatus struct {
    Timestamp time.Time              // Метка времени проверки
    Healthy   bool                   // Является ли система здоровой
    Checks    map[string]CheckResult // Результаты отдельных проверок
}
```

### Структура CheckResult

```go
type CheckResult struct {
    Healthy bool   // Является ли проверка успешной
    Message string // Сообщение проверки
}
```

---

## IterableValue

Обёртка итерируемого значения.

### Обзор методов

**Базовый доступ**

| Метод | Описание |
|-------|----------|
| `Get(path)` | Получение значения по пути |
| `GetString(path)` | Получение строки |
| `GetInt(path)` | Получение целого числа |
| `GetFloat64(path)` | Получение числа с плавающей точкой |
| `GetBool(path)` | Получение логического значения |
| `GetArray(path)` | Получение массива |
| `GetObject(path)` | Получение объекта |

**Проверка и обход**

| Метод | Описание |
|-------|----------|
| `Exists(path)` | Проверка существования поля |
| `IsNull(path)` | Проверка, является ли значение по указанному пути null |
| `IsEmpty(path)` | Проверка, является ли значение по указанному пути пустым |
| `Break()` | Возвращает сигнал прерывания для остановки итерации |

Подробнее в документации [Итератор](./iterator).

---

## Типы ошибок кодирования

Пакет json экспортирует следующие типы ошибок кодирования/декодирования для детальной обработки ошибок.

### SyntaxError - Синтаксическая ошибка

Ошибка разбора JSON синтаксиса, указывающая на то, что входные данные не являются допустимым форматом JSON.

#### Определение структуры

```go
type SyntaxError struct {
    Offset int64 // Позиция ошибки (смещение в байтах)
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *SyntaxError) Error() string` | Возвращает описание ошибки, включая смещение |

```go
data := `{invalid json}`
_, err := json.ParseAny(data)
if syntaxErr, ok := err.(*json.SyntaxError); ok {
    fmt.Printf("Синтаксическая ошибка, смещение: %d\n", syntaxErr.Offset)
}
```

---

### UnmarshalTypeError - Ошибка типа при десериализации

Возвращается, когда значение JSON не может быть преобразовано к целевому типу Go.

#### Определение структуры

```go
type UnmarshalTypeError struct {
    Value  string       // Описание значения JSON (например, "string", "number")
    Type   reflect.Type // Целевой тип Go
    Offset int64        // Позиция ошибки (смещение в байтах)
    Struct string       // Имя структуры, содержащей поле (если есть)
    Field  string       // Имя поля (если есть)
    Err    error        // Внутренняя ошибка (если есть)
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *UnmarshalTypeError) Error() string` | Возвращает описание ошибки несовпадения типов |
| `Unwrap` | `func (e *UnmarshalTypeError) Unwrap() error` | Возвращает внутреннюю ошибку |

```go
type User struct {
    Age int `json:"age"`
}
var user User
err := json.Unmarshal([]byte(`{"age": "not_a_number"}`), &user)
if typeErr, ok := err.(*json.UnmarshalTypeError); ok {
    fmt.Printf("Ошибка типа: значение JSON %s не может быть преобразовано в %v\n", typeErr.Value, typeErr.Type)
}
```

---

### UnsupportedTypeError - Ошибка неподдерживаемого типа

Возвращается при попытке кодировать неподдерживаемый тип в Go.

#### Определение структуры

```go
type UnsupportedTypeError struct {
    Type reflect.Type // Неподдерживаемый тип Go
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *UnsupportedTypeError) Error() string` | Возвращает описание неподдерживаемого типа |

```go
type Chan chan int
data := Chan(make(chan int))
_, err := json.Marshal(data)
if unsupportedErr, ok := err.(*json.UnsupportedTypeError); ok {
    fmt.Printf("Неподдерживаемый тип: %v\n", unsupportedErr.Type)
}
```

---

### UnsupportedValueError - Ошибка неподдерживаемого значения

Возвращается при попытке кодировать неподдерживаемое значение (например, NaN, Infinity).

#### Определение структуры

```go
type UnsupportedValueError struct {
    Value reflect.Value // Неподдерживаемое значение
    Str   string        // Описание ошибки
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *UnsupportedValueError) Error() string` | Возвращает описание неподдерживаемого значения |

```go
val := math.NaN()
_, err := json.Marshal(val)
if valErr, ok := err.(*json.UnsupportedValueError); ok {
    fmt.Printf("Неподдерживаемое значение: %s\n", valErr.Str)
}
```

---

### InvalidUnmarshalError - Ошибка недействительной цели десериализации

Возвращается, когда целевой аргумент `Unmarshal` не является указателем или nil.

#### Определение структуры

```go
type InvalidUnmarshalError struct {
    Type reflect.Type // Тип целевого аргумента
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *InvalidUnmarshalError) Error() string` | Возвращает описание ошибки недействительной цели |

```go
var target string // Следует передать указатель
err := json.Unmarshal([]byte(`"hello"`), target) // Ошибка: указатель не передан
if invalidErr, ok := err.(*json.InvalidUnmarshalError); ok {
    fmt.Printf("Недействительная цель десериализации: %v\n", invalidErr.Type)
}
```

---

### MarshalerError - Ошибка кодировщика

Оборачивает ошибку, возвращённую методом `MarshalJSON` или `MarshalText` типа.

#### Определение структуры

```go
type MarshalerError struct {
    Type reflect.Type // Тип, реализующий MarshalJSON или MarshalText
    Err  error        // Ошибка, возвращённая MarshalJSON или MarshalText
}
```

#### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Error` | `func (e *MarshalerError) Error() string` | Возвращает описание ошибки кодировщика |
| `Unwrap` | `func (e *MarshalerError) Unwrap() error` | Возвращает внутреннюю ошибку |

```go
type BadMarshaler struct{}

func (BadMarshaler) MarshalJSON() ([]byte, error) {
    return nil, errors.New("marshal failed")
}

_, err := json.Marshal(BadMarshaler{})
if marshalErr, ok := err.(*json.MarshalerError); ok {
    fmt.Printf("Ошибка кодировщика (тип: %v): %v\n", marshalErr.Type, marshalErr.Err)
}
```

---

## Encoder - JSON кодировщик

`Encoder` записывает JSON значения в выходной поток. 100% совместим с `encoding/json.Encoder`.

### Создание

Сигнатура: `func NewEncoder(w io.Writer, cfg ...Config) *Encoder`

Создаёт кодировщик, записывающий в `w`. Поддерживает необязательный параметр `Config` для настройки поведения кодирования.

```go
file, _ := os.Create("output.json")
defer file.Close()

encoder := json.NewEncoder(file)
err := encoder.Encode(map[string]any{"name": "Alice"})
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Encode` | `func (enc *Encoder) Encode(v any) error` | Кодирует значение Go в JSON и записывает в поток |
| `SetEscapeHTML` | `func (enc *Encoder) SetEscapeHTML(on bool)` | Устанавливает, следует ли экранировать специальные символы HTML |
| `SetIndent` | `func (enc *Encoder) SetIndent(prefix, indent string)` | Устанавливает формат отступа |

### Пример использования

```go
package main

import (
    "bytes"
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var buf bytes.Buffer
    encoder := json.NewEncoder(&buf)
    encoder.SetIndent("", "  ")
    encoder.SetEscapeHTML(true)

    err := encoder.Encode(map[string]any{
        "name":  "Alice",
        "email": "alice@example.com",
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(buf.String())
}
```

---

## Decoder - JSON декодер

`Decoder` читает и декодирует JSON значения из входного потока. 100% совместим с `encoding/json.Decoder`.

### Создание

Сигнатура: `func NewDecoder(r io.Reader, cfg ...Config) *Decoder`

Создаёт декодер, читающий из `r`. Поддерживает необязательный параметр `Config`.

```go
file, _ := os.Open("data.json")
defer file.Close()

decoder := json.NewDecoder(file)
for decoder.More() {
    var obj map[string]any
    if err := decoder.Decode(&obj); err != nil {
        break
    }
    fmt.Println(obj)
}
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Decode` | `func (dec *Decoder) Decode(v any) error` | Читает следующее JSON значение из потока и декодирует его |
| `UseNumber` | `func (dec *Decoder) UseNumber()` | Заставляет декодер разбирать числа как `Number`, а не `float64` |
| `DisallowUnknownFields` | `func (dec *Decoder) DisallowUnknownFields()` | Возвращает ошибку при обнаружении неизвестных полей при декодировании |
| `Buffered` | `func (dec *Decoder) Buffered() io.Reader` | Возвращает Reader с оставшимися данными в буфере декодера |
| `InputOffset` | `func (dec *Decoder) InputOffset() int64` | Возвращает смещение текущей позиции ввода |
| `More` | `func (dec *Decoder) More() bool` | Проверяет, есть ли ещё JSON значения в потоке |
| `Token` | `func (dec *Decoder) Token() (Token, error)` | Читает следующий JSON token |

### Пример использования

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    input := `{"name":"Alice","age":30}{"name":"Bob","age":25}`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var person map[string]any
        if err := decoder.Decode(&person); err != nil {
            break
        }
        fmt.Printf("Имя: %s, Возраст: %v\n", person["name"], person["age"])
    }
}
```

### Пример потокового декодирования

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    // Декодирование нескольких значений из JSON потока
    input := `[1,2,3][4,5,6]`
    decoder := json.NewDecoder(strings.NewReader(input))

    for decoder.More() {
        var arr []any
        if err := decoder.Decode(&arr); err != nil {
            panic(err)
        }
        fmt.Println(arr)
    }
}
```

### Пример чтения Token

```go
decoder := json.NewDecoder(strings.NewReader(`{"name":"Alice"}`))
for {
    token, err := decoder.Token()
    if err != nil {
        break
    }
    switch v := token.(type) {
    case json.Delim:
        fmt.Printf("Разделитель: %s\n", string(v))
    case string:
        fmt.Printf("Строка: %s\n", v)
    case float64:
        fmt.Printf("Число: %v\n", v)
    case bool:
        fmt.Printf("Логическое: %v\n", v)
    case nil:
        fmt.Println("null")
    }
}
```

---

## Token - JSON Token

`Token` - значение JSON token, содержащее один из следующих типов:

- `Delim`, представляющий четыре JSON разделителя `[ ] { }`
- `bool`, представляющий JSON логическое значение
- `float64`, представляющий JSON число
- `Number`, представляющий JSON число при включённом `UseNumber`
- `string`, представляющий JSON строку
- `nil`, представляющий JSON null

```go
type Token any
```

Получается через `Decoder.Token()`.

---

## Delim - JSON разделитель

`Delim` - тип JSON разделителя, соответствующий четырём символам `[`, `]`, `{`, `}`.

```go
type Delim rune
```

### Методы

#### String

Сигнатура: `func (d Delim) String() string`

Возвращает строковое представление разделителя.

```go
token, _ := decoder.Token()
if delim, ok := token.(json.Delim); ok {
    fmt.Println(delim.String()) // "[" или "{" и т.д.
}
```

---

## Связанные разделы

- [Функции пакета](./functions) - Справочник функций уровня пакета
- [Config](./config) - Параметры конфигурации
- [Processor](./processor/) - Методы обработчика
- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
