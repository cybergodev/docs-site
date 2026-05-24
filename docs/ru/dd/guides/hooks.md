---
title: "Система хуков - CyberGo DD | Практическое руководство по хукам жизненного цикла"
description: "Практическое руководство по системе хуков CyberGo DD, подробно описывающее 6 типов событий хуков жизненного цикла (BeforeLog, AfterLog, OnFilter, OnRotate, OnClose, OnError), регистрацию и управление HookRegistry, контекстные данные HookContext, стратегии обработки ошибок и распространённые сценарии использования хуков, помогающее разработчикам расширять поведение библиотеки логирования."
---

# Система хуков

Хуки (Hooks) позволяют внедрять пользовательскую логику в ключевые моменты жизненного цикла логов, такие как моменты до и после записи лога, ротации файлов, возникновения ошибок и т.д.

## События хуков

DD предоставляет 6 типов событий хуков жизненного цикла:

| Событие | Момент срабатывания | Типичное использование |
|---------|-------------------|----------------------|
| `HookBeforeLog` | Перед форматированием лога (поля уже отфильтрованы) | Условный пропуск, управление сэмплированием |
| `HookAfterLog` | После завершения записи лога | Обновление метрик, отправка уведомлений |
| `HookOnFilter` | Срабатывание фильтрации безопасности | Запись событий маскирования, аудит |
| `HookOnRotate` | Завершение ротации файла | Уведомление эксплуатации, загрузка старых файлов |
| `HookOnClose` | Закрытие Logger | Очистка ресурсов, отправка финального отчёта |
| `HookOnError` | Возникновение ошибки записи | Оповещения, деградация |

## Быстрый старт

### Использование HooksConfig

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        fmt.Printf("Будет записано: %s\n", hCtx.Message)
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
})

logger, _ := dd.New(dd.Config{
    Hooks: hooks,
})
```

### Использование HookRegistry

```go
registry := dd.NewHookRegistry()

// Регистрация хука BeforeLog
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Пропуск определённой обработки для отладочного уровня
    if hCtx.Level == dd.LevelDebug {
        return nil
    }
    return nil
})

// Регистрация хука OnRotate
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    fmt.Printf("Ротация файла: %s\n", hCtx.Metadata)
    return nil
})

logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## Контекст HookContext

Каждый хук получает `HookContext`, содержащий полную информацию о текущем логе:

```go
type HookContext struct {
    Event          HookEvent    // Тип сработавшего события
    Level          LogLevel     // Уровень лога
    Message        string       // Сообщение лога
    Fields         []Field      // Обработанные поля
    OriginalFields []Field      // Оригинальные поля (до фильтрации)
    Error          error        // Связанная ошибка (при OnError)
    Timestamp      time.Time    // Временная метка
    Writer         io.Writer    // Целевой Writer
    Metadata       map[string]any // Дополнительные метаданные
}
```

## Распространённые сценарии

### Сбор метрик

```go
var (
    logCounter   atomic.Int64
    errorCounter atomic.Int64
)

registry := dd.NewHookRegistry()

registry.Add(dd.HookAfterLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    logCounter.Add(1)
    if hCtx.Level >= dd.LevelError {
        errorCounter.Add(1)
    }
    return nil
})

logger, _ := dd.New(dd.Config{Hooks: registry})
```

### Сэмплирование логов

```go
var requestCount atomic.Int64

registry := dd.NewHookRegistry()
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    if hCtx.Level == dd.LevelInfo {
        count := requestCount.Add(1)
        // Записывать только 1 из каждых 100
        if count%100 != 0 {
            return fmt.Errorf("sampled out") // Возврат ошибки предотвращает запись лога
        }
    }
    return nil
})
```

### Уведомление о ротации файлов

```go
registry.Add(dd.HookOnRotate, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Уведомление системы мониторинга
    monitoring.Alert("log_rotated", map[string]any{
        "file":     hCtx.Metadata["file"],
        "new_file": hCtx.Metadata["new_file"],
    })
    return nil
})
```

### Оповещение об ошибках

```go
registry.Add(dd.HookOnError, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Отправка оповещения
    alerting.Send(fmt.Sprintf("Ошибка записи лога: %v", hCtx.Error))
    return nil
})
```

## Обработка ошибок

### Глобальный обработчик ошибок

```go
hooks := dd.NewHooksFromConfig(dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hCtx *dd.HookContext) error {
        // Может вернуть ошибку
        return someOperation()
    }},
    ErrorHandler: func(event dd.HookEvent, hCtx *dd.HookContext, err error) {
        log.Printf("Хук %s не выполнен: %v", event, err)
    },
})
```

### Прерывание лога в BeforeLog

Когда хук `BeforeLog` возвращает ошибку, данный лог не записывается:

```go
registry.Add(dd.HookBeforeLog, func(ctx context.Context, hCtx *dd.HookContext) error {
    // Проверка условия, пропуск если не соответствует
    if shouldSkip(hCtx.Message) {
        return fmt.Errorf("skipped") // Предотвращает запись
    }
    return nil // Разрешает запись
})
```

:::warning Panic в хуках
Если в функции хука происходит panic, DD автоматически восстановится и не повлияет на основной поток. Информация о panic будет передана в ErrorHandler.
:::

## Динамическая регистрация

```go
// Регистрация нового хука во время выполнения
registry.Add(dd.HookAfterLog, newHookFunc)

// Удаление во время выполнения (через методы HookRegistry)
```

## Следующие шаги

- [Аудитные логи](./audit-logging) -- интеграция аудита безопасности
- [Распределённая трассировка](./context-tracing) -- интеграция с контекстом
- [Справочник API - Хуки](../api-reference/hooks) -- полный API хуков
