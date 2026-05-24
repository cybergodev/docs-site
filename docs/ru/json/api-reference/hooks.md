---
title: "Система перехватчиков Hook - CyberGo JSON | Справочник API"
description: "Полный справочник системы перехватчиков CyberGo JSON: подробное описание интерфейса Hook, LoggingHook для логирования, TimingHook для замеров производительности, ValidationHook для валидации данных, ErrorHook для обработки ошибок и реализации пользовательских перехватчиков, поддерживающих вставку пользовательской логики до и после операций JSON."
---

# Система перехватчиков Hook

Hook позволяет вставлять пользовательскую логику до и после JSON операций, реализуя логирование, мониторинг производительности, валидацию и другие функции.

## Интерфейс Hook

```go
type Hook interface {
    Before(ctx HookContext) error
    After(ctx HookContext, result any, err error) (any, error)
}
```

### Описание методов

| Метод | Описание |
|------|------|
| `Before(ctx HookContext) error` | Вызывается перед операцией, возврат ошибки прерывает операцию |
| `After(ctx HookContext, result any, err error) (any, error)` | Вызывается после операции, может модифицировать результат или вернуть ошибку |

---

## Структура HookContext

HookContext предоставляет контекстную информацию об операции.

```go
type HookContext struct {
    Operation string      // Тип операции: "get", "set", "delete", "marshal", "unmarshal"
    JSONStr   string      // Входная JSON строка (может быть пустой при marshal)
    Path      string      // Целевой путь (может быть пустым при marshal/unmarshal)
    Value     any         // Значение операции set
    Config    *Config     // Активная конфигурация
    StartTime time.Time   // Время начала операции
}
```

### Описание полей

| Поле | Тип | Описание |
|------|------|------|
| `Operation` | `string` | Тип операции, значения: `get`, `set`, `delete`, `marshal`, `unmarshal` |
| `JSONStr` | `string` | Входная JSON строка |
| `Path` | `string` | Целевое выражение пути |
| `Value` | `any` | Значение операции set |
| `Config` | `*Config` | Текущая конфигурация |
| `StartTime` | `time.Time` | Время начала операции |

---

## Адаптер HookFunc

HookFunc -- это адаптер структуры, позволяющий использовать функции в качестве Hook. Подходит для сценариев, когда нужен только Before или After.

```go
type HookFunc struct {
    BeforeFn func(ctx HookContext) error
    AfterFn  func(ctx HookContext, result any, err error) (any, error)
}
```

### Пример

```go
// Требуется только After
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        log.Printf("%s completed in %v", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})

// Требуется только Before
p.AddHook(&json.HookFunc{
    BeforeFn: func(ctx json.HookContext) error {
        log.Printf("starting %s on path %s", ctx.Operation, ctx.Path)
        return nil
    },
})
```

---

## Фабричные функции Hook

### LoggingHook

Создаёт перехватчик для логирования.

```go
func LoggingHook(logger interface{ Info(msg string, args ...any) }) Hook
```

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### TimingHook

Создаёт перехватчик для замеров времени, записывающий длительность операций.

```go
func TimingHook(recorder interface{ Record(op string, duration time.Duration) }) Hook
```

```go
p.AddHook(json.TimingHook(myMetricsRecorder))
```

### ValidationHook

Создаёт перехватчик для валидации входных данных перед операцией.

```go
func ValidationHook(validator func(jsonStr, path string) error) Hook
```

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 1_000_000 {
        return errors.New("JSON too large")
    }
    return nil
}))
```

### ErrorHook

Создаёт перехватчик для обработки ошибок, перехватывающий и обрабатывающий ошибки.

```go
func ErrorHook(handler func(ctx HookContext, err error) error) Hook
```

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    sentry.CaptureException(err)
    return err // Возвращает исходную или преобразованную ошибку
}))
```

---

## Реализация пользовательского Hook

### Полный пример

```go
package main

import (
    "fmt"
    "log/slog"
    "time"
    "github.com/cybergodev/json"
)

// Перехватчик логирования
type LoggingHook struct {
    logger *slog.Logger
}

func (h *LoggingHook) Before(ctx json.HookContext) error {
    h.logger.Info("operation starting", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *LoggingHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("operation completed",
        "op", ctx.Operation,
        "path", ctx.Path,
        "duration", time.Since(ctx.StartTime),
        "error", err)
    return result, err
}

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Добавление пользовательского Hook
    p.AddHook(&LoggingHook{logger: slog.Default()})

    // Использование processor...
    val, err := p.Get(`{"name": "test"}`, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val)
}
```

### Упрощение с помощью HookFunc

```go
// Нужно только записать время завершения
p.AddHook(&json.HookFunc{
    AfterFn: func(ctx json.HookContext, result any, err error) (any, error) {
        fmt.Printf("%s took %v\n", ctx.Operation, time.Since(ctx.StartTime))
        return result, err
    },
})
```

---

## Настройка Hook

### Через Config

```go
cfg := json.DefaultConfig()
cfg.Hooks = []json.Hook{
    json.LoggingHook(slog.Default()),
    json.TimingHook(myRecorder),
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

### Через Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
p.AddHook(json.LoggingHook(slog.Default()))
p.AddHook(json.TimingHook(myRecorder))
```

---

## Порядок выполнения

### Перехватчики Before

- Выполняются в **порядке добавления**
- Любой Hook, возвращающий ошибку, прерывает операцию

### Перехватчики After

- Выполняются в **обратном порядке добавления**
- Каждый Hook выполняется (даже если предыдущий вернул ошибку)

```go
// Порядок добавления: A, B, C
p.AddHook(hookA)
p.AddHook(hookB)
p.AddHook(hookC)

// Порядок выполнения:
// Before: A.Before -> B.Before -> C.Before
// After:  C.After -> B.After -> A.After
```

---

## Лучшие практики

### 1. Логирование

```go
p.AddHook(json.LoggingHook(slog.Default()))
```

### 2. Мониторинг производительности

```go
type MetricsRecorder struct{}

func (m *MetricsRecorder) Record(op string, duration time.Duration) {
    metrics.Histogram("json_operation_duration", duration, "op", op)
}

p.AddHook(json.TimingHook(&MetricsRecorder{}))
```

### 3. Валидация входных данных

```go
p.AddHook(json.ValidationHook(func(jsonStr, path string) error {
    if len(jsonStr) > 10*1024*1024 { // 10MB
        return errors.New("JSON payload too large")
    }
    return nil
}))
```

### 4. Отслеживание ошибок

```go
p.AddHook(json.ErrorHook(func(ctx json.HookContext, err error) error {
    if err != nil {
        sentry.WithTags(map[string]string{
            "operation": ctx.Operation,
            "path":      ctx.Path,
        }).CaptureException(err)
    }
    return err
}))
```

### 5. Аудиторский журнал

```go
type AuditHook struct {
    auditLogger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if ctx.Operation == "set" || ctx.Operation == "delete" {
        h.auditLogger.Info("data modification",
            "operation", ctx.Operation,
            "path", ctx.Path,
            "success", err == nil)
    }
    return result, err
}
```

---

## Смотрите также

- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
- [Validator](./validator) - Валидаторы
- [Config](./config) - Параметры конфигурации
