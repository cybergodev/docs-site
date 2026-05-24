---
title: "Тестовые утилиты - CyberGo DD | LoggerRecorder"
description: "Полная документация API инструмента тестирования CyberGo DD LoggerRecorder, специально разработанного для сценарного модульного тестирования, для захвата и проверки содержимого вывода логов, поддерживает фильтрацию записей логов по уровню, проверку значений структурированных полей, подсчёт записей и последовательные проверки, значительно повышая эффективность написания и читаемость модульных тестов, связанных с логированием."
---

# Тестовые утилиты

DD предоставляет `LoggerRecorder` для сценария тестирования, позволяющий захватывать записи логов для проверок.

## LoggerRecorder

Потокобезопасный регистратор логов, используемый в тестах для захвата и проверки вывода логов.

:::warning Ограничение парсинга текстового формата
Парсер текстового режима предполагает использование формата времени по умолчанию (ISO 8601) и строк уровня по умолчанию (DEBUG/INFO/WARN/ERROR/FATAL). Если вы настроили `TimeFormat`, текстовый режим может не корректно извлечь уровень и временную метку. Для пользовательских форматов рекомендуется использовать формат JSON (`FormatJSON`), настраиваемый через `SetFormat`.
:::

### Создание

```go
recorder := dd.NewLoggerRecorder()
```

### Основные методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Writer` | `() io.Writer` | Получить io.Writer |
| `SetFormat` | `(format LogFormat)` | Установить формат логов (для парсинга) |
| `NewLogger` | `(cfg ...Config) (*Logger, error)` | Создать Logger, записывающий в этот рекордер |
| `Entries` | `() []LogEntry` | Получить все записи логов |
| `Count` | `() int` | Количество записей |
| `Clear` | `()` | Очистить все записи |
| `HasEntries` | `() bool` | Есть ли записи |
| `LastEntry` | `() *LogEntry` | Последняя запись (nil-безопасный) |

### Методы проверки

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `EntriesAtLevel` | `(level LogLevel) []LogEntry` | Фильтрация записей по уровню |
| `ContainsMessage` | `(msg string) bool` | Содержит ли указанное сообщение (точное совпадение или подстрока) |
| `ContainsField` | `(key string) bool` | Содержит ли указанное поле |
| `GetFieldValue` | `(key string) any` | Получить значение первого совпадающего поля |

### Примеры использования

#### Базовый тест

```go
func TestLogger(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("hello")
    logger.Warn("warning")

    if rec.Count() != 2 {
        t.Errorf("expected 2 entries, got %d", rec.Count())
    }

    if !rec.ContainsMessage("hello") {
        t.Error("should contain 'hello'")
    }
}
```

#### Проверка уровня

```go
func TestLogLevel(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger(dd.DevelopmentConfig())

    logger.Debug("debug")
    logger.Info("info")
    logger.Error("error")

    errors := rec.EntriesAtLevel(dd.LevelError)
    if len(errors) != 1 {
        t.Errorf("expected 1 error, got %d", len(errors))
    }

    debugs := rec.EntriesAtLevel(dd.LevelDebug)
    if len(debugs) != 1 {
        t.Errorf("expected 1 debug, got %d", len(debugs))
    }
}
```

#### Проверка структурированных полей

```go
func TestStructuredLog(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.InfoWith("user login",
        dd.String("user", "admin"),
        dd.String("ip", "192.168.1.1"),
    )

    if !rec.ContainsField("user") {
        t.Error("should contain 'user' field")
    }

    user := rec.GetFieldValue("user")
    if user != "admin" {
        t.Errorf("expected user=admin, got %v", user)
    }
}
```

#### Последняя запись лога

```go
func TestLastEntry(t *testing.T) {
    rec := dd.NewLoggerRecorder()
    logger, _ := rec.NewLogger()

    logger.Info("first")
    logger.Error("second")

    last := rec.LastEntry()
    if last.Level != dd.LevelError {
        t.Errorf("expected Error level, got %v", last.Level)
    }
    if last.Message != "second" {
        t.Errorf("expected 'second', got %s", last.Message)
    }
}
```

## LogEntry

Структура захваченной записи лога.

```go
type LogEntry struct {
    Level     LogLevel
    Message   string
    Fields    []Field
    Timestamp time.Time
    Format    LogFormat
    RawOutput string
}
```

## Следующие шаги

- [Logger](./logger) -- полные методы Logger
- [Структурированные поля](./fields) -- конструкторы Field
- [Константы и ошибки](./constants) -- константы LogLevel
