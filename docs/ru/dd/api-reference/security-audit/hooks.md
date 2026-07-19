---
sidebar_label: "HookRegistry"
title: "Система хуков - CyberGo DD | HookRegistry"
description: "Полная документация API системы хуков жизненного цикла CyberGo DD: регистрация пользовательских callback'ов на ключевые события — запись лога до/после (BeforeLog/AfterLog), ротация файлов (OnRotate), возникновение ошибок (OnError) и др., предоставляя реестр HookRegistry и гибкий механизм расширения обработки логов."
sidebar_position: 1
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

## Типы функций хуков

### Hook

```go
type Hook func(ctx context.Context, hookCtx *HookContext) error
```

Сигнатура функции хука. Вызывается при срабатывании события жизненного цикла лога.

- Когда хук `BeforeLog` возвращает ошибку, **запись лога не производится**.
- Ошибка, возвращённая из других событий, по умолчанию прерывает выполнение последующих хуков; если задан обработчик ошибок (см. `HookErrorHandler`), ошибка передаётся обработчику, и все хуки всё равно выполняются.
- Паника, возникшая внутри хука, перехватывается `HookRegistry` и преобразуется в ошибку, не обрушивая всё приложение.

### HookErrorHandler

```go
type HookErrorHandler func(event HookEvent, hookCtx *HookContext, err error)
```

Сигнатура обработчика ошибок хука.

Параметры:

- `event`: тип события хука, в котором возникла ошибка
- `hookCtx`: контекст, переданный в хук
- `err`: ошибка, возвращённая хуком (или полученная из паники)

После установки обработчика ошибок (через `HookRegistry.SetErrorHandler` или `HooksConfig.ErrorHandler`) `Trigger` выполняет все хуки, не останавливаясь на первой ошибке; каждая ошибка передаётся обработчику. **Исключение**: для события `BeforeLog` возвращённая ошибка, даже при наличии обработчика, всё равно блокирует запись лога. Внутри обработчика не должна возникать паника; при панике она будет восстановлена и выведена в stderr.

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
        dd.String("path", hc.Metadata["path"].(string)),
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

- [Logger](../core/logger) -- методы AddHook / SetHooks
- [Конфигурация](../core/config) -- конфигурация HooksConfig
- [Определения интерфейсов](../core/interfaces) -- определение типа Hook
