---
sidebar_label: "Паттерны тестирования"
title: "Паттерны тестирования - CyberGo DD | Примеры LoggerRecorder"
description: "Примеры паттернов тестирования CyberGo DD с подробным описанием полного использования LoggerRecorder в модульных и интеграционных тестах, включая утверждения сообщений логов, тестирование фильтрации по уровню, проверку значений полей, изоляцию тестовых случаев, проверку потокобезопасности и методы повышения покрытия тестами; применимо к тестированию логирования в различных проектах на Go."
sidebar_position: 4
---

# Паттерны тестирования

DD предоставляет `LoggerRecorder` как инструмент тестирования, позволяющий захватывать логи в модульных тестах и выполнять проверки без фактической записи в файл или консоль.

## Базовое использование

```go
package myapp_test

import (
    "testing"

    "github.com/cybergodev/dd"
)

func TestUserService_Create(t *testing.T) {
    // Создание тестового логгера
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    service := NewUserService(logger)

    err := service.Create("alice")
    if err != nil {
        t.Fatalf("Create failed: %v", err)
    }

    // Проверка содержимого логов
    if !rec.ContainsMessage("Создание пользователя") {
        t.Error("Expected log message 'Создание пользователя'")
    }

    if rec.GetFieldValue("name") != "alice" {
        t.Error("Expected field name=alice")
    }
}
```

## Методы LoggerRecorder

### Проверка сообщений

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.Info("Операция успешна")
logger.Error("Операция не удалась")

// Проверка наличия сообщения
rec.ContainsMessage("Операция успешна")  // true
rec.ContainsMessage("Операция не удалась")  // true

// Получение всех записей логов
entries := rec.Entries()
for _, entry := range entries {
    fmt.Printf("[%s] %s\n", entry.Level, entry.Message)
}
```

### Фильтрация по уровню

```go
// Проверка только логов определённого уровня
infoEntries := rec.EntriesAtLevel(dd.LevelInfo)
errorEntries := rec.EntriesAtLevel(dd.LevelError)

if len(errorEntries) > 0 {
    t.Error("Unexpected error logs")
}

// Использование уровня DEBUG для захвата всех уровней
// Примечание: Recorder разбирает уровень по временной метке ISO 8601,
// формат времени DevelopmentConfig с ним несовместим, поэтому используем
// DefaultConfig и вручную задаём уровень DEBUG.
rec2 := dd.NewLoggerRecorder()
devCfg := dd.DefaultConfig()
devCfg.Level = dd.LevelDebug
logger2, _ := rec2.NewLogger(devCfg)
logger2.Debug("Отладочная информация")
debugs := rec2.EntriesAtLevel(dd.LevelDebug)
```

### Проверка полей

```go
rec := dd.NewLoggerRecorder()
logger, _ := rec.NewLogger()

logger.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 50*time.Millisecond),
)

// Проверка значений полей
if rec.GetFieldValue("method") != "GET" {
    t.Error("Expected method=GET")
}

// Примечание: в текстовом формате значения полей имеют тип string
if rec.GetFieldValue("status") != "200" {
    t.Error("Expected status=200")
}
```

## Паттерны тестирования

### Тестирование сервисного слоя

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &OrderService{log: logger}

    // Счастливый путь
    order, err := svc.PlaceOrder(ctx, "user-1", []string{"item-1"})
    require.NoError(t, err)
    require.True(t, rec.ContainsMessage("Заказ создан"))
    require.True(t, rec.ContainsField("user_id"))
    require.Equal(t, "user-1", rec.GetFieldValue("user_id"))

    // Проверка отсутствия ошибочных логов
    errors := rec.EntriesAtLevel(dd.LevelError)
    require.Empty(t, errors)
}
```

### Тестирование обработки ошибок

```go
func TestService_DatabaseError(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    svc := &Service{
        log: logger,
        db:  &failingDB{}, // Имитация ошибки базы данных
    }

    err := svc.Process(ctx)
    require.Error(t, err)

    // Проверка записи ошибки
    require.True(t, rec.ContainsMessage("Ошибка обработки"))
    require.True(t, rec.ContainsField("error"))
    require.Contains(t, rec.GetFieldValue("error"), "database connection refused")

    // Проверка уровня Error
    errorEntries := rec.EntriesAtLevel(dd.LevelError)
    require.NotEmpty(t, errorEntries)
}
```

### Тестирование структурированных логов

```go
func TestMiddleware_LogsRequestFields(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    handler := LoggingMiddleware(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
    }))

    req := httptest.NewRequest("GET", "/api/users", nil)
    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    // Проверка всех ожидаемых полей
    entries := rec.EntriesAtLevel(dd.LevelInfo)
    require.Len(t, entries, 1)

    entry := entries[0]
    require.Equal(t, "Запрос завершён", entry.Message)
    // Проверка значений полей (примечание: в текстовом формате значения полей — string)
    require.Equal(t, "GET", rec.GetFieldValue("method"))
    require.Equal(t, "/api/users", rec.GetFieldValue("path"))
    require.Equal(t, "200", rec.GetFieldValue("status"))
}
```

### Изоляция тестов

```go
func TestSuite(t *testing.T) {
    t.Run("Сценарий A", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // Независимый recorder для каждого теста
        logger, _ := rec.NewLogger()
        // Тестовая логика...
    })

    t.Run("Сценарий B", func(t *testing.T) {
        rec := dd.NewLoggerRecorder() // Независимый recorder
        logger, _ := rec.NewLogger()
        // Тестовая логика...
    })
}
```

## Табличные тесты

```go
func TestLogLevel_Behavior(t *testing.T) {
    tests := []struct {
        name     string
        level    dd.LogLevel
        logFunc  func(*dd.Logger)
        expected string
    }{
        {
            name:     "Уровень Debug",
            level:    dd.LevelDebug,
            logFunc:  func(l *dd.Logger) { l.Debug("Отладочная информация") },
            expected: "Отладочная информация",
        },
        {
            name:     "Уровень Info",
            level:    dd.LevelInfo,
            logFunc:  func(l *dd.Logger) { l.Info("Общая информация") },
            expected: "Общая информация",
        },
        {
            name:     "Уровень Error",
            level:    dd.LevelError,
            logFunc:  func(l *dd.Logger) { l.Error("Информация об ошибке") },
            expected: "Информация об ошибке",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := dd.NewLoggerRecorder()
            cfg := dd.DefaultConfig()
            cfg.Level = tt.level
            logger, _ := rec.NewLogger(cfg)

            tt.logFunc(logger)

            if !rec.ContainsMessage(tt.expected) {
                t.Errorf("Expected message %q", tt.expected)
            }
        })
    }
}
```

## Следующие шаги

- [Интеграция с Web-сервисом](./web-service) -- интеграция логирования HTTP-сервиса
- [Справочник API - Recorder](../api-reference/dev-tools/recorder) -- полный API LoggerRecorder
- [Система хуков](../guides/hooks) -- хуки жизненного цикла
