---
title: "Константы и ошибки - CyberGo JSON | Справочник API"
description: "Константы и ошибки CyberGo JSON: DefaultMaxJSONSize, DefaultMaxNestingDepth, переменные ErrPathNotFound и MergeMode для настройки и обработки ошибок в Go."
---

# Константы и ошибки

## Переменные ошибок

### Основные ошибки

```go
var (
    // Базовые ошибки
    ErrInvalidJSON     = errors.New("invalid JSON format")
    ErrPathNotFound    = errors.New("path not found")
    ErrTypeMismatch    = errors.New("type mismatch")
    ErrInvalidPath     = errors.New("invalid path format")
    ErrProcessorClosed = errors.New("processor is closed")

    // Ошибки ограничений
    ErrSizeLimit        = errors.New("size limit exceeded")
    ErrDepthLimit       = errors.New("depth limit exceeded")
    ErrConcurrencyLimit = errors.New("concurrency limit exceeded")

    // Ошибки безопасности и валидации
    ErrSecurityViolation = errors.New("security violation detected")
    ErrUnsupportedPath   = errors.New("unsupported path operation")

    // Ошибки ресурсов и производительности
    ErrOperationTimeout  = errors.New("operation timeout")
    ErrResourceExhausted = errors.New("system resources exhausted")
)
```

### Проверка ошибок

Используйте `errors.Is` для проверки типа ошибки:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Путь не найден
        fmt.Println("Путь не найден")
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Несовпадение типов
        fmt.Println("Несовпадение типов")
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // Ошибка формата JSON
        fmt.Println("Недопустимый JSON")
    }
}
```

## Тип JsonsError

### Определение структуры

```go
type JsonsError struct {
    Op      string `json:"op"`      // Название операции
    Path    string `json:"path"`    // Путь, где произошла ошибка
    Message string `json:"message"` // Читаемое сообщение об ошибке
    Err     error  `json:"err"`     // Базовая ошибка
}
```

### Методы

```go
func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### Пример использования

```go
val, err := json.Get(data, "complex.path[0]")
if err != nil {
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("Операция: %s\n", jsonErr.Op)
        fmt.Printf("Путь: %s\n", jsonErr.Path)
        fmt.Printf("Сообщение: %s\n", jsonErr.Message)
        if jsonErr.Err != nil {
            fmt.Printf("Причина: %v\n", jsonErr.Err)
        }
    }
}
```

## Вспомогательные функции ошибок

Помимо описанных выше типов ошибок, библиотека предоставляет две вспомогательные функции обработки ошибок (подробности см. в разделе [Вспомогательные утилиты](./helpers#safeerror)):

| Функция | Сигнатура | Описание |
|---------|-----------|-------------|
| `SafeError` | `func SafeError(err error) string` | Возвращает безопасное для клиента сообщение об ошибке, опуская внутренние детали, такие как имена путей (CWE-209) |
| `RedactedPath` | `func RedactedPath(path string) string` | Возвращает путь с маскированием (непустые пути заменяются на `"***"`) для использования в логах и ответах об ошибках |

## Предустановки конфигурации

### Константы значений по умолчанию

```go
const (
    // Ограничения размеров
    DefaultMaxJSONSize     = 100 * 1024 * 1024  // 100MB
    DefaultMaxNestingDepth = 200
    DefaultMaxPathDepth    = 50
    DefaultMaxDepth        = 100                 // Глубина вложенности кодирования/декодирования по умолчанию (Config.MaxDepth)
    DefaultMaxConcurrency  = 50

    // Ограничения безопасности
    DefaultMaxSecuritySize   = 10 * 1024 * 1024  // 10MB
    DefaultMaxObjectKeys     = 100000
    DefaultMaxArrayElements  = 100000
    DefaultMaxBatchSize      = 2000
    DefaultParallelThreshold = 10

    // Кэш
    DefaultCacheTTL = 5 * time.Minute
)
```

## Функции предустановок конфигурации

### DefaultConfig

Сигнатура: `func DefaultConfig() Config`

Возвращает конфигурацию по умолчанию.

```go
cfg := json.DefaultConfig()
processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

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

**Особенности конфигурации безопасности**:

- Полная проверка безопасности
- Строгий режим
- Консервативные ограничительные значения
- Включённый кэш

### PrettyConfig

Сигнатура: `func PrettyConfig() Config`

Возвращает конфигурацию для форматированного вывода.

```go
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
```

## Константы режимов слияния

```go
// MergeMode - тип режима слияния (экспортируется из внутреннего пакета)
type MergeMode = internal.MergeMode

const (
    // MergeUnion - объединяющее слияние (по умолчанию)
    // Объекты: объединяются все ключи, при конфликте берётся перезаписывающее значение
    // Массивы: объединяются все элементы с удалением дубликатов
    MergeUnion = internal.MergeUnion

    // MergeIntersection - пересечение
    // Объекты: сохраняются только общие ключи
    // Массивы: сохраняются только общие элементы
    MergeIntersection = internal.MergeIntersection

    // MergeDifference - разность
    // Объекты: сохраняются только ключи, существующие в базовом, но отсутствующие в перезаписывающем
    // Массивы: сохраняются только элементы, существующие в базовом, но отсутствующие в перезаписывающем
    MergeDifference = internal.MergeDifference
)
```

## Тип сегмента пути

`PathSegment` - тип сегмента пути, экспортируемый из внутреннего пакета `internal`, для представления компонентов разобранного пути.

```go
type PathSegment = internal.PathSegment
```

::: warning Псевдоним внутренней реализации
`PathSegment` — это псевдоним типа `internal.PathSegment`. Его конкретные поля, типы полей (например, `PathSegmentType`, `PathSegmentFlags`) и методы принадлежат пакету `internal`, **не экспортируются как публичный API** и могут меняться между версиями — не полагайтесь на его внутреннюю структуру напрямую в бизнес-коде.

- При реализации пользовательского синтаксиса путей возвращайте `[]PathSegment` через метод `ParsePath` интерфейса [`PathParser`](./interfaces#pathparser).
- Для предкомпилированных путей используйте [`Processor.CompilePath`](./processor/query#compilepath), который возвращает `*CompiledPath`.
:::

## Уровни шаблонов безопасности

```go
type PatternLevel int

const (
    // PatternLevelCritical - критический риск, всегда блокирует операцию
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning - уровень предупреждения, блокирует в строгом режиме
    PatternLevelWarning

    // PatternLevelInfo - информационный уровень, только запись в лог
    PatternLevelInfo
)
```

### Структура DangerousPattern

```go
type DangerousPattern struct {
    Pattern string       // Подстрока для обнаружения
    Name    string       // Читаемое описание риска безопасности
    Level   PatternLevel // Уровень обработки
}
```

## Лучшие практики обработки ошибок

### Использование errors.Is для проверки типа

```go
result, err := json.Get(data, path)
if errors.Is(err, json.ErrPathNotFound) {
    return defaultValue
}
if errors.Is(err, json.ErrTypeMismatch) {
    return defaultValue
}
```

### Использование errors.As для получения подробностей

```go
var jsonErr *json.JsonsError
if errors.As(err, &jsonErr) {
    log.Printf("Операция %s failed по пути %s: %s",
        jsonErr.Op, jsonErr.Path, jsonErr.Message)
}
```

### Обёртывание ошибок

```go
val := json.GetString(data, path)
if val == "" {
    return fmt.Errorf("получение конфигурации %s вернуло пустое значение", path)
}
```

## Связанные разделы

- [Обработка ошибок](../advanced/error-handling) - Руководство по продвинутой обработке ошибок
- [Config](./config) - Параметры конфигурации
- [Обзор безопасности](../security/) - Лучшие практики безопасности
