---
title: Обработка ошибок - CyberGo JSON | Лучшие практики
description: "Лучшие практики обработки ошибок CyberGo JSON: определение типа ошибки JsonsError, сопоставление ошибок через errors.Is/As, 12 стандартных переменных ошибок, стратегии восстановления, безопасный вывод SafeError и логирование для построения надёжных приложений обработки JSON на Go."
---

# Обработка ошибок

Правильная обработка ошибок при операциях с JSON.

## Типы ошибок

### Стандартные ошибки

```go
var (
    ErrPathNotFound       = errors.New("path not found")
    ErrInvalidPath        = errors.New("invalid path format")
    ErrTypeMismatch       = errors.New("type mismatch")
    ErrInvalidJSON        = errors.New("invalid JSON format")
    ErrDepthLimit         = errors.New("depth limit exceeded")
    ErrSizeLimit          = errors.New("size limit exceeded")
    ErrSecurityViolation  = errors.New("security violation detected")
    ErrProcessorClosed    = errors.New("processor is closed")
    ErrConcurrencyLimit   = errors.New("concurrency limit exceeded")
    ErrUnsupportedPath    = errors.New("unsupported path operation")
    ErrOperationTimeout   = errors.New("operation timeout")
    ErrResourceExhausted  = errors.New("system resources exhausted")
)
```

### Проверка ошибок

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Путь не найден
        return defaultName
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // Несоответствие типов
        return "", fmt.Errorf("Ошибка типа поля: %w", err)
    }
    return "", err
}
```

## JsonsError

### Структура

`JsonsError` — основной тип ошибок библиотеки, содержащий контекстную информацию об операции:

```go
type JsonsError struct {
    Op      string `json:"op"`      // Тип операции: "get", "set", "delete", "marshal" и т.д.
    Path    string `json:"path"`    // JSON путь (если есть)
    Message string `json:"message"` // Читаемое сообщение об ошибке
    Err     error  `json:"err"`     // Базовая ошибка
}

func (e *JsonsError) Error() string
func (e *JsonsError) Unwrap() error
func (e *JsonsError) Is(target error) bool
```

### Использование

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // Используйте errors.Is для проверки типа ошибки
    if errors.Is(err, json.ErrPathNotFound) {
        // Путь не найден
    }
    if errors.Is(err, json.ErrTypeMismatch) {
        // Несоответствие типов
    }

    // Используйте errors.As для получения подробного контекста
    var jsonErr *json.JsonsError
    if errors.As(err, &jsonErr) {
        fmt.Printf("Операция: %s\n", jsonErr.Op)
        fmt.Printf("Путь: %s\n", jsonErr.Path)
        fmt.Printf("Сообщение: %s\n", jsonErr.Message)
    }
}
```

## Паттерны обработки ошибок

### Предоставление значений по умолчанию

```go
// Типобезопасные функции получения со встроенной поддержкой значений по умолчанию
name := json.GetString(data, "user.name", "Аноним")
age := json.GetInt(data, "user.age", 0)
active := json.GetBool(data, "user.active", false)
```

### Сбор нескольких ошибок

```go
type MultiError struct {
    Errors []error
}

func (e *MultiError) Add(err error) {
    e.Errors = append(e.Errors, err)
}

func (e *MultiError) HasError() bool {
    return len(e.Errors) > 0
}

func (e *MultiError) Error() string {
    msgs := make([]string, len(e.Errors))
    for i, err := range e.Errors {
        msgs[i] = err.Error()
    }
    return strings.Join(msgs, "; ")
}

// Использование
var multiErr MultiError
for _, path := range requiredPaths {
    if _, err := json.Get(data, path); err != nil {
        multiErr.Add(fmt.Errorf("%s: %w", path, err))
    }
}
if multiErr.HasError() {
    return multiErr.Error()
}
```

### Обёртывание ошибок

```go
val, err := json.Get(data, "config.api_key")
if err != nil {
    return fmt.Errorf("Ошибка чтения API ключа: %w", err)
}
```

## Пользовательские ошибки

### Бизнес-ошибки

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("Ошибка валидации %s: %s", e.Field, e.Message)
}

// Использование
func validateUser(data string) error {
    name := json.GetString(data, "name")
    if name == "" {
        return &ValidationError{Field: "name", Message: "Обязательное поле"}
    }
    if len(name) < 2 {
        return &ValidationError{Field: "name", Message: "Минимум 2 символа"}
    }
    return nil
}
```

## Логирование

### Структурированное логирование

```go
val, err := json.Get(data, path)
if err != nil {
    log.Error("Ошибка JSON операции",
        "path", path,
        "error", err,
        "error_type", fmt.Sprintf("%T", err),
    )
    return err
}
```

### Журналы аудита

```go
func auditLog(op string, path string, err error) {
    if err != nil {
        log.Warn("Операция не удалась",
            "operation", op,
            "path", path,
            "error", err,
        )
    } else {
        log.Info("Операция выполнена успешно",
            "operation", op,
            "path", path,
        )
    }
}
```

## Стратегии восстановления

### Безопасный вывод SafeError

`SafeError` возвращает безопасное для клиента сообщение об ошибке, удаляя внутреннюю контекстную информацию:

```go
// Сигнатура: func SafeError(err error) string

val, err := json.Get(untrustedInput, "data")
if err != nil {
    // SafeError удаляет внутренние детали, такие как пути и контекст операции
    safeMsg := json.SafeError(err)
    http.Error(w, safeMsg, http.StatusBadRequest)
    return
}
```

### Повторные попытки

```go
func withRetry(fn func() error, maxRetries int) error {
    var err error
    for i := 0; i < maxRetries; i++ {
        if err = fn(); err == nil {
            return nil
        }
        time.Sleep(time.Second * time.Duration(i+1))
    }
    return err
}

// Использование
err := withRetry(func() error {
    return processData(data)
}, 3)
```

### Деградация

```go
func getConfig(data string) Config {
    cfg := DefaultConfig()

    // Использование типобезопасной функции получения со встроенным значением по умолчанию
    strict := json.GetBool(data, "config.strict", true)

    return cfg
}
```

## Классификация ошибок

### Ошибки пользовательского ввода

Вызваны JSON данными или путями, предоставленными пользователем:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    switch {
    case errors.Is(err, json.ErrInvalidJSON):
        // Неверный формат JSON
        return fmt.Errorf("Ошибка формата данных: %w", err)
    case errors.Is(err, json.ErrPathNotFound):
        // Путь не найден
        return fmt.Errorf("Поле не найдено: %w", err)
    case errors.Is(err, json.ErrTypeMismatch):
        // Несоответствие типов
        return fmt.Errorf("Ошибка типа: %w", err)
    case errors.Is(err, json.ErrInvalidPath):
        // Синтаксическая ошибка пути
        return fmt.Errorf("Синтаксическая ошибка пути: %w", err)
    case errors.Is(err, json.ErrUnsupportedPath):
        // Неподдерживаемая операция с путём
        return fmt.Errorf("Неподдерживаемая операция: %w", err)
    }
}
```

### Ошибки, связанные с безопасностью

Обнаружены потенциальные угрозы безопасности:

```go
val, err := json.Get(untrustedInput, "data")
if err != nil {
    if errors.Is(err, json.ErrSecurityViolation) {
        // Нарушение безопасности, запись в журнал и отклонение
        log.Warn("Нарушение безопасности", "error", err)
        return errors.New("Недопустимый ввод")
    }
    if errors.Is(err, json.ErrSizeLimit) {
        return fmt.Errorf("Данные превышают размер: %w", err)
    }
    if errors.Is(err, json.ErrDepthLimit) {
        return fmt.Errorf("Превышена глубина вложенности: %w", err)
    }
    return err
}
```

### Системные ошибки

Системные ошибки временного характера:

```go
val, err := json.Get(data, "user.name")
if err != nil {
    if errors.Is(err, json.ErrOperationTimeout) {
        // Таймаут операции, можно повторить
        return fmt.Errorf("Временная ошибка, повторите попытку: %w", err)
    }
    if errors.Is(err, json.ErrConcurrencyLimit) {
        // Ограничение параллелизма
        return fmt.Errorf("Система перегружена, попробуйте позже: %w", err)
    }
    if errors.Is(err, json.ErrResourceExhausted) {
        // Исчерпание ресурсов
        return fmt.Errorf("Недостаточно системных ресурсов: %w", err)
    }
    if errors.Is(err, json.ErrProcessorClosed) {
        // Процессор закрыт
        return fmt.Errorf("Процессор недоступен: %w", err)
    }
    return err
}
```

## Лучшие практики обработки ошибок

### 1. Различайте типы ошибок

```go
func processJSON(data string) error {
    val, err := json.Get(data, "user.name")
    if err != nil {
        // Используйте errors.Is для различения типов ошибок
        switch {
        case errors.Is(err, json.ErrInvalidJSON),
            errors.Is(err, json.ErrPathNotFound),
            errors.Is(err, json.ErrTypeMismatch),
            errors.Is(err, json.ErrInvalidPath):
            // Ошибка пользовательского ввода, вернуть понятное сообщение
            return fmt.Errorf("Ошибка формата данных: %w", err)
        case errors.Is(err, json.ErrSecurityViolation):
            // Ошибка безопасности, записать и отклонить
            log.Warn("Нарушение безопасности", "error", err)
            return errors.New("Недопустимый ввод")
        case errors.Is(err, json.ErrOperationTimeout),
            errors.Is(err, json.ErrConcurrencyLimit):
            // Ошибка, допускающая повторную попытку
            return fmt.Errorf("Временная ошибка, повторите попытку: %w", err)
        default:
            // Системная ошибка
            log.Error("Системная ошибка", "error", err)
            return errors.New("Внутренняя ошибка")
        }
    }
    return nil
}
```

### 2. Используйте errors.As для получения контекста

```go
func handleWithDetail(data string, path string) error {
    val, err := json.Get(data, path)
    if err != nil {
        var jsonErr *json.JsonsError
        if errors.As(err, &jsonErr) {
            return fmt.Errorf("Операция %s не удалась (путь: %s): %w",
                jsonErr.Op, jsonErr.Path, jsonErr.Err)
        }
        return fmt.Errorf("Операция не удалась: %w", err)
    }
    return nil
}
```

### 3. Отслеживание цепочки ошибок

```go
func deepProcess(data string) error {
    if err := processLevel1(data); err != nil {
        return fmt.Errorf("Ошибка глубокой обработки: %w", err)
    }
    return nil
}

func processLevel1(data string) error {
    if err := processLevel2(data); err != nil {
        return fmt.Errorf("Ошибка обработки уровня 1 (путь data.field): %w", err)
    }
    return nil
}

func processLevel2(data string) error {
    _, err := json.Get(data, "data.field")
    return err
}

// Пример цепочки ошибок:
// Ошибка глубокой обработки: Ошибка обработки уровня 1 (путь data.field): path not found
```

## Смотрите также

- [Константы и ошибки](../api-reference/constants)
- [Обзор безопасности](../security/)
- [Оптимизация производительности](./performance)
