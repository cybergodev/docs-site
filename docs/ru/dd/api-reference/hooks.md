---
title: "Система хуков - CyberGo DD | HookRegistry"
description: "Полная документация API системы хуков жизненного цикла CyberGo DD, поддерживает регистрацию пользовательских функций обратного вызова на ключевых событиях: до и после записи логов (BeforeLog/AfterLog), при ротации файлов (OnRotate), при возникновении ошибок (OnError) и др., предоставляет реестр HookRegistry и гибкий механизм расширения обработки логов."
---

# Система хуков

DD предоставляет систему хуков на основе событий, позволяющую вставлять пользовательскую логику в ключевые моменты жизненного цикла логов.

## События хуков

| Константа | String() | Момент срабатывания |
|-----------|----------|-------------------|
| `HookBeforeLog` | `"BeforeLog"` | Перед записью лога |
| `HookAfterLog` | `"AfterLog"` | После записи лога |
| `HookOnFilter` | `"OnFilter"` | При фильтрации конфиденциальных данных |
| `HookOnRotate` | `"OnRotate"` | При ротации файлов |
| `HookOnClose` | `"OnClose"` | При закрытии логгера |
| `HookOnError` | `"OnError"` | При возникновении ошибки |

## HookRegistry

Реестр хуков, управляющий регистрацией и срабатыванием всех хуков. Потокобезопасный.

### Создание

```go
// Пустой реестр
reg := dd.NewHookRegistry()

// Из конфигурации
reg := dd.NewHooksFromConfig(hooksConfig)
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Add` | `(event HookEvent, hook Hook)` | Зарегистрировать хук |
| `Remove` | `(event HookEvent)` | Удалить все хуки события |
| `Trigger` | `(ctx, event, hookCtx) error` | Сработать все хуки события |
| `Clear` | `()` | Очистить все хуки |
| `ClearFor` | `(event HookEvent)` | Очистить хуки указанного события |
| `SetErrorHandler` | `(handler HookErrorHandler)` | Установить обработчик ошибок |

### Регистрация хуков

```go
reg := dd.NewHookRegistry()

// Хук BeforeLog
reg.Add(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    fmt.Println("Будет записан лог:", hc.Message)
    return nil
})

// Хук AfterLog
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    metrics.LogCount.Inc()
    return nil
})

// Хук OnRotate
reg.Add(dd.HookOnRotate, func(ctx context.Context, hc *dd.HookContext) error {
    dd.InfoWith("Ротация файла завершена",
        dd.String("new_file", hc.Message),
    )
    return nil
})
```

### Управление через Logger

```go
// Добавление одного хука
_ = logger.AddHook(dd.HookBeforeLog, myHook)

// Замена всего реестра
_ = logger.SetHooks(reg)

// Получение текущего реестра
hooks := logger.GetHooks()
```

## HookContext

Контекст хука, предоставляющий подробную информацию о событии.

```go
type HookContext struct {
    Event          HookEvent      // Тип события
    Level          LogLevel       // Уровень лога
    Message        string         // Сообщение лога
    Fields         []Field        // Структурированные поля (после фильтрации)
    OriginalFields []Field        // Оригинальные поля (до фильтрации)
    Error          error          // Информация об ошибке (событие OnError)
    Timestamp      time.Time      // Время события
    Writer         io.Writer      // Целевой Writer (события, связанные с записью)
    Metadata       map[string]any // Дополнительные метаданные
}
```

## HooksConfig

Структурированная конфигурация хуков, рекомендуется для массовой регистрации.

```go
type HooksConfig struct {
    BeforeLog    []Hook              // Хуки перед записью лога
    AfterLog     []Hook              // Хуки после записи лога
    OnFilter     []Hook              // Хуки при фильтрации конфиденциальных данных
    OnRotate     []Hook              // Хуки при ротации файлов
    OnClose      []Hook              // Хуки при закрытии логгера
    OnError      []Hook              // Хуки при ошибке записи
    ErrorHandler HookErrorHandler    // Обработчик ошибок
}
```

```go
cfg := dd.HooksConfig{
    BeforeLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // Предобработка лога
        return nil
    }},
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        metrics.LogCount.Inc()
        return nil
    }},
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        log.Printf("Ошибка хука: %v\n", err)
    },
}
registry := dd.NewHooksFromConfig(cfg)
```

## Полный пример

### Сбор метрик

```go
reg := dd.NewHookRegistry()
reg.Add(dd.HookAfterLog, func(ctx context.Context, hc *dd.HookContext) error {
    logCount.Inc()
    logLevelCounter.WithLabelValues(hc.Level.String()).Inc()
    return nil
})
reg.Add(dd.HookOnError, func(ctx context.Context, hc *dd.HookContext) error {
    errorCount.Inc()
    return nil
})
_ = logger.SetHooks(reg)
```

## Следующие шаги

- [Logger](./logger) -- методы AddHook / SetHooks
- [Конфигурация](./config) -- конфигурация HooksConfig
- [Определения интерфейсов](./interfaces) -- определение типа Hook
