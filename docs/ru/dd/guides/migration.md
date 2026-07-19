---
sidebar_label: "Руководство по миграции"
title: "Руководство по миграции - CyberGo DD | С других библиотек"
description: "Полное сравнительное руководство по миграции на CyberGo DD со стандартной библиотеки log/slog и популярных сторонних библиотек (zap, logrus, zerolog), содержащее подробные таблицы соответствия API, сравнение параметров конфигурации, распространённые шаблоны миграции и стратегии постепенной миграции, помогая разработчикам плавно переключить существующие системы логирования на библиотеку DD с низкими рисками."
sidebar_position: 8
---

# Руководство по миграции

Если вы используете другую библиотеку логирования, это руководство поможет вам быстро мигрировать проект на DD.

## Миграция со стандартной библиотеки log

### Сравнение API

| log | DD | Описание |
|-----|-----|----------|
| `log.Print(msg)` | `dd.Info(msg)` | Уровень Info |
| `log.Printf(format, args)` | `dd.Infof(format, args)` | Форматированный |
| `log.Println(msg)` | `dd.Info(msg)` | Уровень Info |
| `log.Fatal(msg)` | `dd.Fatal(msg)` | Fatal (вызывает os.Exit) |
| `log.Fatalf(format, args)` | `dd.Fatalf(format, args)` | Форматированный Fatal |
| `log.Panic(msg)` | `dd.Error(msg)` + `panic()` | DD не имеет встроенного Panic |
| — | `dd.InfoWith(msg, fields...)` | Структурированный лог (новое) |

### Базовая миграция

```go
// До: log
log.Printf("Пользователь %s не смог войти: %v", username, err)

// После: DD
dd.Infof("Пользователь %s не смог войти: %v", username, err)

// Или использование структурированного лога
dd.ErrorWith("Ошибка входа пользователя",
    dd.String("username", username),
    dd.Err(err),
)
```

### Замена глобального Logger

```go
// До: log
log.SetOutput(file)
log.SetFlags(log.LstdFlags | log.Lshortfile)

// После: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatText,
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/app.log"),
    },
})
if err != nil {
    log.Fatal(err)
}
dd.SetDefault(logger)
```

## Миграция с slog

### Сравнение API

| slog | DD | Описание |
|------|-----|----------|
| `slog.Info(msg)` | `dd.Info(msg)` | Уровень Info |
| `slog.Info(msg, "key", value)` | `dd.InfoWith(msg, dd.String("key", value))` | Структурированный |
| `slog.Debug(msg)` | `dd.Debug(msg)` | Уровень Debug |
| `slog.Error(msg, "err", err)` | `dd.ErrorWith(msg, dd.Err(err))` | Лог ошибки |
| `slog.Warn(msg)` | `dd.Warn(msg)` | Уровень Warn |
| `slog.With("key", value)` | `dd.WithFields(dd.String("key", value))` | Предустановленные поля |
| `slog.New(handler)` | `dd.New(cfg)` | Создание экземпляра |
| `slog.SetDefault(logger)` | `dd.SetDefault(logger)` | Установка глобального |

### Миграция структурированного логирования

```go
// До: slog
slog.Info("request completed",
    "method", "GET",
    "status", 200,
    "duration", 150*time.Millisecond,
)

// После: DD
dd.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("duration", 150*time.Millisecond),
)
```

:::tip Типобезопасность
slog использует пары ключ-значение `any`, DD использует типизированные конструкторы полей. Ошибки типов обнаруживаются на этапе компиляции.
:::

## Миграция с zap

### Сравнение API

| zap | DD | Описание |
|-----|-----|----------|
| `zap.L().Info(msg, zap.Field...)` | `dd.InfoWith(msg, dd.Field...)` | Структурированный |
| `zap.String(key, val)` | `dd.String(key, val)` | Строковое поле |
| `zap.Int(key, val)` | `dd.Int(key, val)` | Целочисленное поле |
| `zap.Error(err)` | `dd.Err(err)` | Поле ошибки |
| `zap.Any(key, val)` | `dd.Any(key, val)` | Произвольный тип |
| `zap.Sugar().Infof(...)` | `dd.Infof(...)` | Форматированный |
| `logger.With(zap.Field...)` | `logger.WithFields(dd.Field...)` | Предустановленные поля |
| `zapcore.NewCore(...)` | `dd.New(dd.Config{...})` | Создание экземпляра |

### Сравнение конфигурации

```go
// До: zap
cfg := zap.Config{
    Level:       zap.NewAtomicLevelAt(zap.InfoLevel),
    Encoding:    "json",
    OutputPaths: []string{"stdout", "logs/app.log"},
}
logger, _ := cfg.Build()

// После: DD
logger, err := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
```

### Сравнение полей

```go
// До: zap
logger.Info("request",
    zap.String("method", "GET"),
    zap.Int("status", 200),
    zap.Duration("elapsed", 150*time.Millisecond),
    zap.Error(err),
)

// После: DD
dd.InfoWith("request",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
    dd.Err(err),
)
```

## Миграция с logrus

### Сравнение API

| logrus | DD | Описание |
|--------|-----|----------|
| `logrus.Info(msg)` | `dd.Info(msg)` | Уровень Info |
| `logrus.WithField("k", v)` | `dd.WithField("k", v)` | Одно поле |
| `logrus.WithFields(logrus.Fields{...})` | `dd.WithFields(dd.String(...), ...)` | Несколько полей |
| `logrus.SetLevel(logrus.InfoLevel)` | `dd.SetLevel(dd.LevelInfo)` | Установка уровня |
| `logrus.SetFormatter(&logrus.JSONFormatter{})` | `dd.New(dd.Config{Format: dd.FormatJSON})` | Формат JSON |
| `logrus.SetOutput(file)` | `dd.Config{Targets: ...}` | Цель вывода |
| `logrus.Fatal(msg)` | `dd.Fatal(msg)` | Fatal |

### Миграция полей

```go
// До: logrus
logrus.WithFields(logrus.Fields{
    "method":  "GET",
    "status":  200,
    "elapsed": 150 * time.Millisecond,
}).Info("Request completed")

// После: DD
dd.WithFields(
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
).Info("Request completed")
```

## Уникальные возможности DD

После миграции вы можете воспользоваться уникальными возможностями DD:

| Возможность | Описание | Документация |
|-------------|----------|-------------|
| Фильтрация конфиденциальных данных | Автоматическое маскирование паролей, API-ключей и т.д. | [Фильтрация конфиденциальных данных](./sensitive-filtering) |
| Аудитные логи | Асинхронная запись событий безопасности | [Аудитные логи](./audit-logging) |
| HMAC-подписи | Защита логов от подделки | [Практика HMAC-подписей](../advanced/integrity) |
| Отраслевое соответствие | Предустановки HIPAA/PCI-DSS | [Конфигурация отраслевого соответствия](../security/compliance) |
| Хуки жизненного цикла | 6 типов событий Hook | [Система хуков](./hooks) |
| LoggerRecorder | Утилита тестирования | [Паттерны тестирования](../examples/testing-patterns) |

## Следующие шаги

- [Основные концепции](./core-concepts) -- обзор архитектуры DD
- [Структурированное логирование](./structured-logging) -- подробное описание использования полей
- [Шпаргалка](../getting-started/cheatsheet) -- краткий справочник API
