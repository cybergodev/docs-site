---
sidebar_label: "LoggerEntry"
title: "LoggerEntry - CyberGo DD | Логи с предустановленными полями"
description: "Полная документация API типа LoggerEntry CyberGo DD: используется для создания цепочного логгера с предустановленными полями (при передаче хотя бы одного поля возвращается новый неизменяемый экземпляр Entry, без полей — исходный Entry), поддерживая накопление и комбинацию полей, привязку и распространение контекста и механизм наследования уровня, подходит для сценариев отслеживания логов на уровне запроса и контекстной корреляции."
sidebar_position: 3
---

# LoggerEntry

`LoggerEntry` — логгер с предустановленными полями: при передаче хотя бы одного поля возвращается новый неизменяемый Entry.

## Создание

```go
// Из Logger
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.String("env", "prod"),
)

// Через глобальный Logger
entry := dd.Default().WithFields(
    dd.String("service", "api"),
)

// Быстрый способ с одним полем
entry := logger.WithField("request_id", "req-123")
```

## Цепочные вызовы

```go
// Добавление полей (возвращает новый Entry, оригинальный Entry не изменяется)
base := logger.WithFields(dd.String("svc", "api"))
enhanced := base.WithFields(dd.String("env", "prod"))

// Новые поля перекрывают одноимённые старые
entry := base.WithField("svc", "gateway")  // svc становится "gateway"
```

:::tip Неизменяемость
При передаче хотя бы одного поля `WithFields` / `WithField` возвращает новый `LoggerEntry`, оригинальный Entry не затрагивается и безопасен для конкурентного использования. Вызов `WithFields()` без полей является оптимизацией без действия (no-op) и напрямую возвращает исходный Entry.
:::

## Методы логирования

Все методы логирования Logger также доступны на Entry, выводимые логи автоматически несут предустановленные поля:

### Базовые логи

| Метод | Описание |
|-------|----------|
| `Debug(args ...any)` | Уровень Debug |
| `Info(args ...any)` | Уровень Info |
| `Warn(args ...any)` | Уровень Warn |
| `Error(args ...any)` | Уровень Error |
| `Fatal(args ...any)` | Уровень Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |
| `Log(level LogLevel, args ...any)` | С указанным уровнем |

### Форматированные логи

| Метод | Описание |
|-------|----------|
| `Debugf(format string, args ...any)` | Форматированный Debug |
| `Infof(format string, args ...any)` | Форматированный Info |
| `Warnf(format string, args ...any)` | Форматированный Warn |
| `Errorf(format string, args ...any)` | Форматированный Error |
| `Fatalf(format string, args ...any)` | Форматированный Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |
| `Logf(level LogLevel, format string, args ...any)` | Форматированный с указанным уровнем |

### Структурированные логи

| Метод | Описание |
|-------|----------|
| `DebugWith(msg string, fields ...Field)` | Структурированный Debug (объединяет предустановленные поля) |
| `InfoWith(msg string, fields ...Field)` | Структурированный Info |
| `WarnWith(msg string, fields ...Field)` | Структурированный Warn |
| `ErrorWith(msg string, fields ...Field)` | Структурированный Error |
| `FatalWith(msg string, fields ...Field)` | Структурированный Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Структурированный с указанным уровнем |

### Методы Print

| Метод | Описание |
|-------|----------|
| `Print(args ...any)` | Вывод в Writer (уровень Info, с фильтрацией безопасности) |
| `Println(args ...any)` | Аналогично Print |
| `Printf(format string, args ...any)` | Форматированный вывод (уровень Info, с фильтрацией безопасности) |

### Цепочки полей

| Метод | Описание |
|-------|----------|
| `WithFields(fields ...Field) *LoggerEntry` | Добавить поля, возвращает новый Entry |
| `WithField(key string, value any) *LoggerEntry` | Добавить одно поле, возвращает новый Entry |

## Примеры использования

### Логирование HTTP-запросов

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    reqLog := logger.WithFields(
        dd.String("method", r.Method),
        dd.String("path", r.URL.Path),
        dd.String("remote", r.RemoteAddr),
    )

    reqLog.Info("Запрос начат")

    // Логика обработки...

    reqLog.WithField("status", 200).Info("Запрос завершён")
}
```

### Логирование компонентов сервиса

```go
serviceLog := logger.WithFields(
    dd.String("service", "user-service"),
    dd.String("version", "2.1.0"),
)

serviceLog.Info("Сервис запущен")

dbLog := serviceLog.WithField("component", "database")
dbLog.Info("Соединение установлено")
dbLog.ErrorWith("Ошибка запроса", dd.Err(err))
```

## Следующие шаги

- [Logger](./logger) -- методы экземпляра Logger
- [Структурированные поля](../output-integration/fields) -- конструкторы Field
- [Пакетные функции](./functions) -- глобальные функции логирования
