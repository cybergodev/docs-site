---
title: "Определения интерфейсов - CyberGo DD | Иерархия интерфейсов Logger"
description: "Полная документация иерархии интерфейсов библиотеки логирования CyberGo DD, включая базовый интерфейс логирования CoreLogger, интерфейс логирования с уровнями LevelLogger, настраиваемый интерфейс логирования ConfigurableLogger и интерфейс поставщика логирования LogProvider, поддерживающий многоуровневую абстракцию логирования от простого к сложному, удобный для пользовательских реализаций и внедрения зависимостей."
---

# Определения интерфейсов

DD определяет иерархию интерфейсов логирования, поддерживающих различные уровни абстракции.

## Иерархия интерфейсов

```text
CoreLogger                  Базовые методы логирования
├── LevelLogger             + Управление уровнями
└── ConfigurableLogger      + Конфигурация/Жизненный цикл/Writer/Hook
    └── LogProvider         + Все возможности
```

## CoreLogger

Самый базовый интерфейс логирования, содержит только методы вывода логов.

```go
type CoreLogger interface {
    // Базовые логи
    Debug(args ...any)
    Info(args ...any)
    Warn(args ...any)
    Error(args ...any)
    Fatal(args ...any)

    // Форматированные логи
    Debugf(format string, args ...any)
    Infof(format string, args ...any)
    Warnf(format string, args ...any)
    Errorf(format string, args ...any)
    Fatalf(format string, args ...any)

    // Структурированные логи
    DebugWith(msg string, fields ...Field)
    InfoWith(msg string, fields ...Field)
    WarnWith(msg string, fields ...Field)
    ErrorWith(msg string, fields ...Field)
    FatalWith(msg string, fields ...Field)

    // Цепочки полей
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry
}
```

## LevelLogger

Расширяет `CoreLogger`, добавляя управление уровнями.

```go
type LevelLogger interface {
    CoreLogger

    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool
}
```

## ConfigurableLogger

Расширяет `CoreLogger`, добавляя управление конфигурацией, жизненным циклом, Writer, экстракторами контекста, хуками и сэмплированием.

```go
type ConfigurableLogger interface {
    CoreLogger

    // Управление уровнями
    GetLevel() LogLevel
    SetLevel(level LogLevel) error

    // Цели вывода
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // Жизненный цикл
    Flush() error
    Close() error
    IsClosed() bool

    // Конфигурация
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // Экстракторы контекста
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // Хуки
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // Сэмплирование
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig
}
```

## LogProvider

Полный интерфейс логирования, объединяющий все возможности. Тип `Logger` реализует этот интерфейс.

```go
type LogProvider interface {
    // Управление уровнями
    GetLevel() LogLevel
    SetLevel(level LogLevel) error
    IsLevelEnabled(level LogLevel) bool
    IsDebugEnabled() bool
    IsInfoEnabled() bool
    IsWarnEnabled() bool
    IsErrorEnabled() bool
    IsFatalEnabled() bool

    // Логирование с указанием уровня
    Log(level LogLevel, args ...any)
    Logf(level LogLevel, format string, args ...any)
    LogWith(level LogLevel, msg string, fields ...Field)

    // Удобное логирование - Debug
    Debug(args ...any)
    Debugf(format string, args ...any)
    DebugWith(msg string, fields ...Field)

    // Удобное логирование - Info
    Info(args ...any)
    Infof(format string, args ...any)
    InfoWith(msg string, fields ...Field)

    // Удобное логирование - Warn
    Warn(args ...any)
    Warnf(format string, args ...any)
    WarnWith(msg string, fields ...Field)

    // Удобное логирование - Error
    Error(args ...any)
    Errorf(format string, args ...any)
    ErrorWith(msg string, fields ...Field)

    // Удобное логирование - Fatal
    Fatal(args ...any)
    Fatalf(format string, args ...any)
    FatalWith(msg string, fields ...Field)

    // Цепочки полей
    WithFields(fields ...Field) *LoggerEntry
    WithField(key string, value any) *LoggerEntry

    // Цели вывода
    AddWriter(writer io.Writer) error
    RemoveWriter(writer io.Writer) error
    WriterCount() int

    // Жизненный цикл
    Flush() error
    Close() error
    IsClosed() bool

    // Конфигурация
    SetSecurityConfig(config *SecurityConfig)
    GetSecurityConfig() *SecurityConfig
    SetWriteErrorHandler(handler WriteErrorHandler)

    // Экстракторы контекста
    AddContextExtractor(extractor ContextExtractor) error
    SetContextExtractors(extractors ...ContextExtractor) error
    GetContextExtractors() []ContextExtractor

    // Хуки
    AddHook(event HookEvent, hook Hook) error
    SetHooks(registry *HookRegistry) error
    GetHooks() *HookRegistry

    // Сэмплирование
    SetSampling(config *SamplingConfig)
    GetSampling() *SamplingConfig

    // Отладочный вывод
    Print(args ...any)
    Println(args ...any)
    Printf(format string, args ...any)
    Text(data ...any)
    Textf(format string, args ...any)
    JSON(data ...any)
    JSONF(format string, args ...any)

    // Управление горутинами
    ActiveFilterGoroutines() int32
    WaitForFilterGoroutines(timeout time.Duration) bool
}
```

:::tip Дополнительные методы Logger
Конкретный тип `Logger` реализует интерфейс `LogProvider` и также предоставляет следующие методы, не включённые в интерфейс:

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Shutdown` | `(ctx context.Context) error` | Изящное завершение с таймаутом |
| `SetLevelResolver` | `(resolver LevelResolver)` | Динамический ресолвер уровня |
| `GetLevelResolver` | `() LevelResolver` | Получить ресолвер уровня |
| `SetFieldValidation` | `(config *FieldValidationConfig)` | Конфигурация валидации полей |
| `GetFieldValidation` | `() *FieldValidationConfig` | Получить конфигурацию валидации |

Эти методы подробно описаны на странице [Logger](./logger).
:::

## Flusher

Интерфейс сброса Writer. Writer'ы, реализующие этот интерфейс, вызываются при `Logger.Flush()`.

```go
type Flusher interface {
    Flush() error
}
```

`BufferedWriter` реализует этот интерфейс.

## Типы функций

| Тип | Сигнатура | Описание |
|-----|-----------|----------|
| `FatalHandler` | `func()` | Пользовательская функция обработки уровня Fatal |
| `WriteErrorHandler` | `func(writer io.Writer, err error)` | Обратный вызов ошибки записи |
| `LevelResolver` | `func(ctx context.Context) LogLevel` | Динамическое определение уровня |
| `ContextExtractor` | `func(ctx context.Context) []Field` | Извлечение полей из контекста |
| `Hook` | `func(ctx context.Context, hookCtx *HookContext) error` | Функция хука |
| `HookErrorHandler` | `func(event HookEvent, hookCtx *HookContext, err error)` | Обработка ошибок хука |

## Сценарии использования

### Внедрение зависимостей

```go
type Service struct {
    logger dd.CoreLogger  // Зависимость только от базового интерфейса
}

func NewService(logger dd.CoreLogger) *Service {
    return &Service{logger: logger}
}

// Можно передать *Logger или *LoggerEntry
svc := NewService(logger)
svc.logger.Info("Сервис запущен")
```

### Адаптация интерфейсов

```go
// Принимает любой тип, реализующий CoreLogger
func process(logger dd.CoreLogger) {
    logger.InfoWith("Начало обработки", dd.String("item", "data"))
}
```

## Следующие шаги

- [Logger](./logger) -- конкретный тип, реализующий LogProvider
- [LoggerEntry](./entry) -- тип Entry, реализующий CoreLogger
- [Пакетные функции](./functions) -- глобальные функции
