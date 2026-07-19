---
sidebar_label: "Обработка ошибок"
title: "Обработка ошибок - CyberGo DD | Управление ошибками"
description: "Полное руководство по обработке ошибок библиотеки логирования CyberGo DD с подробным описанием структурированных типов ошибок и иерархии, дизайна кодов ошибок, определения и проверки сторожевых ошибок, обёртки и распаковки ошибок через errors.Is/As, реализации пользовательских стратегий обработки ошибок, механизмов восстановления и конфигурации callback'ов ошибок хуков, помогая разработчикам точно идентифицировать и обрабатывать различные ошибки, связанные с логированием."
sidebar_position: 2
---

# Обработка ошибок

DD определяет структурированную систему ошибок для точной идентификации и обработки различных ошибок.

## Типы ошибок

### LoggerError

Структурированная ошибка, содержащая код ошибки, сообщение, причину и контекст:

```go
type LoggerError struct { ... }

// Создание (использование полей структуры LoggerError напрямую)
err := &dd.LoggerError{
    Code:    "CUSTOM_CODE",
    Message: "Описание ошибки",
}

// Обёртка (использование полей структуры LoggerError)
err := &dd.LoggerError{
    Code:    "WRAP_CODE",
    Message: "Описание обёртки",
    Cause:   originalErr,
}
```

Методы:

| Метод | Описание |
|-------|----------|
| `Error() string` | Сообщение ошибки |
| `Unwrap() error` | Получить внутреннюю ошибку |
| `Is(target error) bool` | Сравнение ошибок |
| `WithContext(key, value)` | Добавить контекстную информацию |
| `WithField(key, value)` | Добавить информацию о поле |

```go
err := &dd.LoggerError{
    Code:    "DB_ERROR",
    Message: "Ошибка запроса",
    Cause:   dbErr,
}
err = err.WithContext("query", "SELECT * FROM users")
err = err.WithField("retry_count", 3)
```

### WriterError

Ошибка writer'а, содержащая индекс Writer и оригинальную ошибку.

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

### MultiWriterError

Агрегированная ошибка нескольких writer'ов.

```go
type MultiWriterError struct { ... }
```

Методы: `HasErrors()`, `ErrorCount()`, `FirstError()`

## Паттерны обработки ошибок

### Сопоставление через errors.Is

```go
logger, err := dd.New(config)
if err != nil {
    if errors.Is(err, dd.ErrNilConfig) {
        // Обработка нулевой конфигурации
    }
    if errors.Is(err, dd.ErrInvalidLevel) {
        // Обработка недопустимого уровня
    }
}
```

### Обработка ошибок записи

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    // Пользовательская обработка ошибок записи
    // Примечание: этот колбэк срабатывает только при сбое writer.Write(), в него передаётся
    // собственная ошибка writer; dd.ErrWriterNotFound возвращается напрямую из RemoveWriter и
    // через этот колбэк не проходит.
    if errors.Is(err, io.ErrShortWrite) {
        // Записано меньше байт, чем предоставлено
        return
    }
    // Запись метрик ошибок
    metrics.WriteErrors.Inc()
})
```

### Обработка ошибок во время выполнения

```go
// Добавление Writer
if err := logger.AddWriter(w); err != nil {
    if errors.Is(err, dd.ErrLoggerClosed) {
        // Логгер закрыт
        return
    }
    if errors.Is(err, dd.ErrNilWriter) {
        // Writer равен nil
        return
    }
}

// Установка уровня
if err := logger.SetLevel(dd.LevelDebug); err != nil {
    if errors.Is(err, dd.ErrInvalidLevel) {
        // Недопустимый уровень
    }
}
```

### Ошибки безопасности

```go
fw, err := dd.NewFileWriter(userPath, dd.DefaultFileWriterConfig())
if err != nil {
    if errors.Is(err, dd.ErrPathTraversal) {
        // Атака обхода пути
        log.Fatal("Обнаружена атака обхода пути")
    }
    if errors.Is(err, dd.ErrNullByte) {
        // Инъекция null-байта
        log.Fatal("Обнаружена инъекция null-байта")
    }
    if errors.Is(err, dd.ErrSymlinkNotAllowed) {
        // Символические ссылки запрещены
    }
}
```

### Ошибки шаблонов

```go
filter, err := dd.NewCustomSensitiveDataFilter(pattern)
if err != nil {
    if errors.Is(err, dd.ErrReDoSPattern) {
        // Шаблон с риском ReDoS
        log.Fatal("Regex-шаблон имеет риск ReDoS")
    }
    if errors.Is(err, dd.ErrInvalidPattern) {
        // Недопустимый regex
    }
    if errors.Is(err, dd.ErrPatternTooLong) {
        // Слишком длинный шаблон
    }
}
```

## Ошибки хуков

При использовании хуков можно перехватывать и обрабатывать ошибки выполнения хуков через обратный вызов `OnError` в конфигурации хуков:

```go
// Настройка обработки ошибок хуков через HooksConfig
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    ErrorHandler: func(event dd.HookEvent, hc *dd.HookContext, err error) {
        // Пользовательская обработка ошибок хуков
        handleHookError(event.String(), err)
    },
})
logger, _ := dd.New(dd.Config{
    Hooks: registry,
})
```

## Ошибки глобального логгера

```go
// Проверка при инициализации
err := dd.InitDefault(cfg)
if err != nil {
    log.Fatal(err)
}

// Проверка во время выполнения
if err := dd.DefaultInitError(); err != nil {
    fmt.Println("Ошибка инициализации глобального логгера:", err)
}
```

## Следующие шаги

- [Константы и ошибки](../api-reference/dev-tools/constants) -- полный список кодов ошибок
- [Система хуков](../api-reference/security-audit/hooks) -- HookRegistry
- [Фильтрация безопасности](../api-reference/security-audit/security) -- ошибки, связанные с безопасностью
