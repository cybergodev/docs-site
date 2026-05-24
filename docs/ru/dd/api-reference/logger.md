---
title: "Logger - CyberGo DD | Основной логгер"
description: "Полная документация API основного логгера CyberGo DD Logger, охватывающая методы вывода логов (Info/Warn/Error/Fatal), динамическое управление уровнями, динамическое добавление и замену Writer, управление жизненным циклом (Close/Flush), глобальные функции логирования и настройку цепочек полей, являющуюся основным входным типом для использования библиотеки логирования DD."
---

# Logger

`Logger` — основной тип DD, предоставляющий потокобезопасные функции логирования.

## Создание

```go
// Через New
logger, _ := dd.New(dd.DefaultConfig())

// С пользовательской конфигурацией
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{
        dd.ConsoleOutput(),
        dd.FileOutput("logs/app.log"),
    },
})
```

## Методы логирования

### Базовые логи

| Метод | Описание |
|-------|----------|
| `Debug(args ...any)` | Лог уровня Debug |
| `Info(args ...any)` | Лог уровня Info |
| `Warn(args ...any)` | Лог уровня Warn |
| `Error(args ...any)` | Лог уровня Error |
| `Fatal(args ...any)` | Лог уровня Fatal (по умолчанию вызывает os.Exit(1), настраивается через FatalHandler) |
| `Log(level LogLevel, args ...any)` | Лог с указанным уровнем |

### Форматированные логи

| Метод | Описание |
|-------|----------|
| `Debugf(format string, args ...any)` | Форматированный Debug |
| `Infof(format string, args ...any)` | Форматированный Info |
| `Warnf(format string, args ...any)` | Форматированный Warn |
| `Errorf(format string, args ...any)` | Форматированный Error |
| `Fatalf(format string, args ...any)` | Форматированный Fatal |
| `Logf(level LogLevel, format string, args ...any)` | Форматированный с указанным уровнем |

### Структурированные логи

| Метод | Описание |
|-------|----------|
| `DebugWith(msg string, fields ...Field)` | Структурированный Debug |
| `InfoWith(msg string, fields ...Field)` | Структурированный Info |
| `WarnWith(msg string, fields ...Field)` | Структурированный Warn |
| `ErrorWith(msg string, fields ...Field)` | Структурированный Error |
| `FatalWith(msg string, fields ...Field)` | Структурированный Fatal |
| `LogWith(level LogLevel, msg string, fields ...Field)` | Структурированный с указанным уровнем |

```go
logger.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
)
```

## Управление уровнями

```go
level := logger.GetLevel()                    // Получить текущий уровень
_ = logger.SetLevel(dd.LevelDebug)            // Установить уровень
enabled := logger.IsLevelEnabled(dd.LevelInfo)// Проверить уровень

// Быстрые проверки
logger.IsDebugEnabled()
logger.IsInfoEnabled()
logger.IsWarnEnabled()
logger.IsErrorEnabled()
logger.IsFatalEnabled()

// Динамический ресолвер уровня
logger.SetLevelResolver(func(ctx context.Context) dd.LogLevel {
    if isDebug {
        return dd.LevelDebug
    }
    return dd.LevelInfo
})
resolver := logger.GetLevelResolver()
```

## Цепочки полей

```go
// Предустановленные поля, возвращает LoggerEntry
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("version", 2),
)

// Одно поле
entry := logger.WithField("env", "prod")
```

## Управление целями вывода

```go
// Добавление Writer
_ = logger.AddWriter(os.Stderr)

// Удаление Writer
_ = logger.RemoveWriter(os.Stderr)

// Получение количества Writer
count := logger.WriterCount()

// Установка обработчика ошибок записи
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    fmt.Fprintf(os.Stderr, "Ошибка записи: %v\n", err)
})
```

## Интеграция с контекстом

```go
// Добавление экстрактора контекста
_ = logger.AddContextExtractor(func(ctx context.Context) []dd.Field {
    return []dd.Field{
        dd.String("trace_id", dd.GetTraceID(ctx)),
    }
})

// Замена всех экстракторов
_ = logger.SetContextExtractors(extractor1, extractor2)

// Получение текущих экстракторов
extractors := logger.GetContextExtractors()
```

## Управление хуками

```go
// Регистрация хука
_ = logger.AddHook(dd.HookBeforeLog, func(ctx context.Context, hc *dd.HookContext) error {
    // Предобработка лога
    return nil
})

// Замена реестра хуков
_ = logger.SetHooks(registry)

// Получение реестра хуков
hooks := logger.GetHooks()
```

## Управление сэмплированием

```go
// Установка конфигурации сэмплирования
logger.SetSampling(&dd.SamplingConfig{
    // Параметры сэмплирования
})

// Получение конфигурации сэмплирования
cfg := logger.GetSampling()
```

## Конфигурация безопасности

```go
// Установка конфигурации безопасности
logger.SetSecurityConfig(dd.DefaultSecurityConfig())

// Получение конфигурации безопасности
sec := logger.GetSecurityConfig()
```

## Валидация полей

```go
// Установка валидации полей
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// Получение конфигурации валидации
validation := logger.GetFieldValidation()
```

## Жизненный цикл

```go
// Сброс буфера
_ = logger.Flush()

// Закрытие логгера
_ = logger.Close()

// Изящное завершение (с таймаутом)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = logger.Shutdown(ctx)

// Проверка закрытия
closed := logger.IsClosed()

// Ожидание завершения фильтрующих горутин
ok := logger.WaitForFilterGoroutines(3 * time.Second)
active := logger.ActiveFilterGoroutines()
```

## Отладочный вывод

| Метод | Описание |
|-------|----------|
| `Print(args ...any)` | Вывод в настроенный Writer (уровень Info, с фильтрацией безопасности) |
| `Println(args ...any)` | Аналогично Print (базовый Log() уже добавляет перенос строки) |
| `Printf(format string, args ...any)` | Форматированный вывод (уровень Info, с фильтрацией безопасности) |
| `JSON(data ...any)` | Отладочный вывод JSON в stdout (без фильтрации безопасности) |
| `JSONF(format string, args ...any)` | Форматированный отладочный вывод JSON в stdout (без фильтрации безопасности) |
| `Text(data ...any)` | Отладочный текстовый вывод в stdout (без фильтрации безопасности) |
| `Textf(format string, args ...any)` | Форматированный текстовый отладочный вывод в stdout (без фильтрации безопасности) |

## Следующие шаги

- [LoggerEntry](./entry) -- цепочные вызовы с предустановленными полями
- [Конфигурация](./config) -- подробное описание Config
- [Цели вывода](./writers) -- подробное описание FileWriter
