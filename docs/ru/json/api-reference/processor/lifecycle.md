---
title: "Processor - Жизненный цикл - CyberGo JSON | Справочник API"
description: "Справочник управления жизненным циклом Processor: New, Close, IsClosed, ClearCache, WarmupCache, GetStats, GetHealthStatus, AddHook, SetLogger, GetConfig."
---

# Жизненный цикл и статистика

Processor обеспечивает полное управление жизненным циклом, контроль кэша и мониторинг работоспособности.

## Жизненный цикл

### Close

Сигнатура: `func (p *Processor) Close() error`

Закрывает процессор и освобождает ресурсы. Следует вызывать после завершения работы с Processor.

```go
processor, _ := json.New(json.DefaultConfig())
defer processor.Close()
```

### IsClosed

Сигнатура: `func (p *Processor) IsClosed() bool`

Проверяет, закрыт ли процессор.

```go
if processor.IsClosed() {
    // Процессор закрыт, больше нельзя использовать
}
```

## Управление кэшем

### ClearCache

Сигнатура: `func (p *Processor) ClearCache()`

Очищает внутренний кэш процессора.

```go
processor.ClearCache()
```

Применимо для:
- Изменение источника данных
- Слишком высокое использование памяти
- Необходимость принудительного обновления

### WarmupCache

Сигнатура: `func (p *Processor) WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Прогревает кэш для повышения производительности последующих операций.

```go
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := processor.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Успешно прогрето %d путей\n", result.Successful)
```

**Структура WarmupResult**:

```go
type WarmupResult struct {
    TotalPaths   int      // Общее количество путей
    Successful   int      // Количество успешно прогретых путей
    Failed       int      // Количество путей с ошибками
    SuccessRate  float64  // Процент успешности
    FailedPaths  []string // Список путей с ошибками
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `TotalPaths` | `int` | Общее количество путей |
| `Successful` | `int` | Количество успешно прогретых путей |
| `Failed` | `int` | Количество путей с ошибками |
| `SuccessRate` | `float64` | Процент успешности (0-100) |
| `FailedPaths` | `[]string` | Список путей с ошибками |

## Статистика

### GetStats

Сигнатура: `func (p *Processor) GetStats() Stats`

Получает статистическую информацию о процессоре.

```go
stats := processor.GetStats()
fmt.Printf("Процент попаданий в кэш: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Размер кэша: %d\n", stats.CacheSize)
```

**Структура Stats**:

```go
type Stats struct {
    CacheSize        int64         // Количество записей в кэше
    CacheMemory      int64         // Использование памяти кэшем (байты)
    MaxCacheSize     int           // Максимальный размер кэша
    HitCount         int64         // Количество попаданий в кэш
    MissCount        int64         // Количество промахов кэша
    HitRatio         float64       // Процент попаданий в кэш
    CacheTTL         time.Duration // TTL кэша
    CacheEnabled     bool          // Включён ли кэш
    IsClosed         bool          // Закрыт ли процессор
    MemoryEfficiency float64       // Эффективность памяти
    OperationCount   int64         // Общее количество операций
    ErrorCount       int64         // Общее количество ошибок
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `CacheSize` | `int64` | Текущее количество записей в кэше |
| `CacheMemory` | `int64` | Использование памяти кэшем (байты) |
| `MaxCacheSize` | `int` | Максимальный предел размера кэша |
| `HitCount` | `int64` | Количество попаданий в кэш |
| `MissCount` | `int64` | Количество промахов кэша |
| `HitRatio` | `float64` | Процент попаданий в кэш (0-1) |
| `CacheTTL` | `time.Duration` | Время жизни кэша |
| `CacheEnabled` | `bool` | Включён ли кэш |
| `IsClosed` | `bool` | Закрыт ли процессор |
| `MemoryEfficiency` | `float64` | Эффективность памяти |
| `OperationCount` | `int64` | Общее количество операций |
| `ErrorCount` | `int64` | Общее количество ошибок |

## Проверка работоспособности

### GetHealthStatus

Сигнатура: `func (p *Processor) GetHealthStatus() HealthStatus`

Получает состояние работоспособности процессора.

```go
status := processor.GetHealthStatus()
if status.Healthy {
    fmt.Println("Процессор работоспособен")
} else {
    for name, check := range status.Checks {
        if !check.Healthy {
            fmt.Printf("Проверка %s не пройдена: %s\n", name, check.Message)
        }
    }
}
```

**Структура HealthStatus**:

```go
type HealthStatus struct {
    Timestamp time.Time              // Время проверки
    Healthy   bool                   // Общее состояние работоспособности
    Checks    map[string]CheckResult // Результаты отдельных проверок
}

type CheckResult struct {
    Healthy  bool   // Работоспособен ли
    Message  string // Сообщение о состоянии
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `Timestamp` | `time.Time` | Время проверки |
| `Healthy` | `bool` | Общее состояние работоспособности |
| `Checks` | `map[string]CheckResult` | Детали отдельных проверок |

## Расширение хуками

### AddHook

Сигнатура: `func (p *Processor) AddHook(hook Hook)`

Добавляет хук операции к процессору.

```go
processor.AddHook(&LoggingHook{})
processor.AddHook(json.TimingHook(&MetricsRecorder{}))
```

Хуки вызываются до и после каждой операции, могут использоваться для:
- Ведения журнала
- Мониторинга производительности
- Сбора метрик
- Аудиторского следа

### SetLogger

Сигнатура: `func (p *Processor) SetLogger(logger *slog.Logger)`

Устанавливает регистратор логов для процессора. Используется для отладки и диагностики во время выполнения.

```go
processor, _ := json.New()
defer processor.Close()

processor.SetLogger(slog.Default().With("component", "json-processor"))
```

### GetConfig

Сигнатура: `func (p *Processor) GetConfig() Config`

Получает копию текущей конфигурации процессора. Возвращённую конфигурацию можно безопасно изменять без влияния на процессор.

```go
processor, _ := json.New()
defer processor.Close()

cfg := processor.GetConfig()
fmt.Printf("Кэш включён: %v\n", cfg.EnableCache)
fmt.Printf("Максимальный размер JSON: %d\n", cfg.MaxJSONSize)
```

## Рекомендации по использованию

### Управление ресурсами

```go
processor, _ := json.New()
defer processor.Close()  // Обеспечить освобождение ресурсов

// Использование processor...
```

### Оптимизация производительности

```go
// Прогрев часто используемых путей
processor.WarmupCache(data, []string{
    "user.name",
    "user.email",
    "items[*].id",
})

// Регулярная проверка статистики
stats := processor.GetStats()
if stats.HitRatio < 0.5 {
    // Низкий процент попаданий, рассмотрите изменение конфигурации кэша
}
```

### Интеграция мониторинга

```go
// Регулярная проверка работоспособности
go func() {
    ticker := time.NewTicker(30 * time.Second)
    for range ticker.C {
        status := processor.GetHealthStatus()
        if !status.Healthy {
            log.Printf("Processor неработоспособен: %+v", status.Checks)
        }
    }
}()
```

## Связанные разделы

- [Config](../config) - Параметры конфигурации (размер кэша, TTL и др.)
- [Система хуков](../hooks) - Подробное руководство по использованию хуков
- [Определения интерфейсов](../interfaces) - Интерфейсы Hook
