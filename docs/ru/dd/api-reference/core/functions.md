---
sidebar_label: "Функции пакета"
title: "Пакетные функции - CyberGo DD | Глобальные функции"
description: "Полная документация пакетных функций CyberGo DD: функция создания логгера New, функции управления глобальным логгером Default/SetDefault/InitDefault, пресеты конфигураций DefaultConfig/DevelopmentConfig/JSONConfig и все фабричные конструкторы, поддерживающие прямой вызов через префикс dd."
sidebar_position: 1
---

# Пакетные функции

DD предоставляет богатый набор пакетных функций, доступных для прямого вызова через префикс `dd.`. Все эти функции выполняются через глобальный логгер (`Default()`).

## Создание логгера

### New

```go
func New(cfg ...Config) (*Logger, error)
```

Создаёт новый экземпляр Logger. Без передачи конфигурации используются настройки по умолчанию.

```go
// Конфигурация по умолчанию
logger, _ := dd.New()

// Пользовательская конфигурация
logger, _ := dd.New(dd.DefaultConfig())

// Примечание: принимается только 0 или 1 конфигурация, передача нескольких вернёт ошибку
// logger, _ := dd.New(cfg1, cfg2)  // Ошибка!
```

## Глобальный логгер

### Получение и установка

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Default` | `func Default() *Logger` | Получить глобальный логгер (ленивая инициализация) |
| `SetDefault` | `func SetDefault(logger *Logger)` | Установить глобальный логгер |
| `InitDefault` | `func InitDefault(cfg ...Config) error` | Инициализировать глобальный логгер конфигурацией |
| `DefaultWithErr` | `func DefaultWithErr() (*Logger, error)` | Получить глобальный логгер и ошибку инициализации |
| `DefaultInitError` | `func DefaultInitError() error` | Получить ошибку инициализации |

### Инициализация глобального логгера

```go
// Способ 1: Автоматическая инициализация (создаётся при первом вызове)
dd.Default().Info("Глобальный логгер автоматически создан")

// Способ 2: Явная инициализация
err := dd.InitDefault(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
dd.Default().Info("Глобальный логгер с JSON-конфигурацией")

// Способ 3: Замена глобального логгера
custom, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
})
dd.SetDefault(custom)

// Способ 4: Проверка ошибки инициализации
logger, err := dd.DefaultWithErr()
if err != nil {
    log.Printf("Ошибка инициализации глобального логгера: %v", err)
}
```

## Предустановки конфигурации

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `DefaultConfig` | `func DefaultConfig() Config` | Конфигурация по умолчанию (уровень Info, текстовый формат) |
| `DevelopmentConfig` | `func DevelopmentConfig() Config` | Конфигурация разработки (уровень Debug) |
| `JSONConfig` | `func JSONConfig() Config` | Конфигурация вывода JSON |

```go
cfg := dd.DefaultConfig()
cfg.Level = dd.LevelDebug
logger, _ := dd.New(cfg)
```

## Конструкторы целей вывода

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `ConsoleOutput` | `func ConsoleOutput() OutputTarget` | Вывод в консоль |
| `FileOutput` | `func FileOutput(path string) OutputTarget` | Вывод в файл (с ротацией) |
| `CustomOutput` | `func CustomOutput(w io.Writer) OutputTarget` | Вывод через пользовательский Writer |

```go
cfg := dd.DefaultConfig()
cfg.Targets = []dd.OutputTarget{
    dd.ConsoleOutput(),
    dd.FileOutput("logs/app.log"),
    dd.CustomOutput(customWriter),
}
logger, _ := dd.New(cfg)
```

## Базовое логирование (пакетный уровень)

Следующие функции выводят логи через глобальный логгер:

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Debug` | `func Debug(args ...any)` | Лог уровня Debug |
| `Info` | `func Info(args ...any)` | Лог уровня Info |
| `Warn` | `func Warn(args ...any)` | Лог уровня Warn |
| `Error` | `func Error(args ...any)` | Лог уровня Error |
| `Fatal` | `func Fatal(args ...any)` | Лог уровня Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |

```go
dd.Info("Приложение запущено")
dd.Errorf("Пользователь %s не смог войти", username)
dd.Warn("Недостаточно места на диске")
```

## Форматированное логирование (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Debugf` | `func Debugf(format string, args ...any)` | Форматированный лог уровня Debug |
| `Infof` | `func Infof(format string, args ...any)` | Форматированный лог уровня Info |
| `Warnf` | `func Warnf(format string, args ...any)` | Форматированный лог уровня Warn |
| `Errorf` | `func Errorf(format string, args ...any)` | Форматированный лог уровня Error |
| `Fatalf` | `func Fatalf(format string, args ...any)` | Форматированный лог уровня Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |

## Логирование с указанием уровня (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Log` | `func Log(level LogLevel, args ...any)` | Лог с указанным уровнем |
| `Logf` | `func Logf(level LogLevel, format string, args ...any)` | Форматированный лог с указанным уровнем |
| `LogWith` | `func LogWith(level LogLevel, msg string, fields ...Field)` | Структурированный лог с указанным уровнем |

```go
dd.Log(dd.LevelDebug, "Отладочная информация")
dd.Logf(dd.LevelWarn, "Предупреждение: %s", reason)
dd.LogWith(dd.LevelError, "Ошибка запроса",
    dd.String("path", "/api/users"),
    dd.Int("status", 500),
)
```

## Структурированное логирование (пакетный уровень)

Следующие функции выводят структурированные логи через глобальный логгер:

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `DebugWith` | `func DebugWith(msg string, fields ...Field)` | Структурированный лог уровня Debug |
| `InfoWith` | `func InfoWith(msg string, fields ...Field)` | Структурированный лог уровня Info |
| `WarnWith` | `func WarnWith(msg string, fields ...Field)` | Структурированный лог уровня Warn |
| `ErrorWith` | `func ErrorWith(msg string, fields ...Field)` | Структурированный лог уровня Error |
| `FatalWith` | `func FatalWith(msg string, fields ...Field)` | Структурированный лог уровня Fatal (по умолчанию вызывает os.Exit(1), **defer не выполняется**; можно настроить через FatalHandler) |

```go
dd.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)

dd.ErrorWith("Ошибка базы данных",
    dd.Err(err),
    dd.String("query", sql),
)
```

## Управление уровнями (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `SetLevel` | `func SetLevel(level LogLevel) error` | Установить глобальный уровень логирования |
| `GetLevel` | `func GetLevel() LogLevel` | Получить глобальный уровень логирования |
| `IsLevelEnabled` | `func IsLevelEnabled(level LogLevel) bool` | Проверить, включён ли указанный уровень |
| `IsDebugEnabled` | `func IsDebugEnabled() bool` | Проверить, включён ли уровень Debug |
| `IsInfoEnabled` | `func IsInfoEnabled() bool` | Проверить, включён ли уровень Info |
| `IsWarnEnabled` | `func IsWarnEnabled() bool` | Проверить, включён ли уровень Warn |
| `IsErrorEnabled` | `func IsErrorEnabled() bool` | Проверить, включён ли уровень Error |
| `IsFatalEnabled` | `func IsFatalEnabled() bool` | Проверить, включён ли уровень Fatal |

```go
// Динамическая регулировка уровня логирования
dd.SetLevel(dd.LevelDebug)

// Условное логирование (избегание ненужных вычислений)
if dd.IsDebugEnabled() {
    dd.Debug(computeExpensiveDebugInfo())
}
```

## Цепочки полей (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `WithFields` | `func WithFields(fields ...Field) *LoggerEntry` | Создать Entry с предустановленными полями |
| `WithField` | `func WithField(key string, value any) *LoggerEntry` | Создать Entry с одним предустановленным полем |

```go
dd.WithFields(dd.String("service", "api"), dd.String("version", "1.0")).
    Info("Запрос обработан")

dd.WithField("request_id", "abc123").Info("Обработка запроса")
```

## Жизненный цикл (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Flush` | `func Flush() error` | Сбросить буфер глобального логгера |

## Управление Writer (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `AddWriter` | `func AddWriter(writer io.Writer) error` | Добавить writer вывода |
| `RemoveWriter` | `func RemoveWriter(writer io.Writer) error` | Удалить writer вывода |
| `WriterCount` | `func WriterCount() int` | Получить количество writer'ов |

## Управление сэмплированием (пакетный уровень)

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `SetSampling` | `func SetSampling(config *SamplingConfig)` | Установить конфигурацию сэмплирования |
| `GetSampling` | `func GetSampling() *SamplingConfig` | Получить конфигурацию сэмплирования |

## Конструкторы Writer

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewFileWriter` | `func NewFileWriter(path string, cfg FileWriterConfig) (*FileWriter, error)` | Создать файловый writer |
| `DefaultFileWriterConfig` | `func DefaultFileWriterConfig() FileWriterConfig` | Конфигурация файлового writer по умолчанию |
| `NewBufferedWriter` | `func NewBufferedWriter(w io.Writer, cfg BufferedWriterConfig) (*BufferedWriter, error)` | Создать буферизованный writer |
| `DefaultBufferedWriterConfig` | `func DefaultBufferedWriterConfig() BufferedWriterConfig` | Конфигурация буферизованного writer по умолчанию |
| `NewMultiWriter` | `func NewMultiWriter(writers ...io.Writer) *MultiWriter` | Создать многоцелевой writer |

## Конструкторы конфигурации безопасности

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `DefaultSecurityConfig` | `func DefaultSecurityConfig() *SecurityConfig` | Конфигурация безопасности по умолчанию (базовая фильтрация) |
| `DefaultSecureConfig` | `func DefaultSecureConfig() *SecurityConfig` | Полная конфигурация безопасности |
| `HealthcareConfig` | `func HealthcareConfig() *SecurityConfig` | Конфигурация соответствия HIPAA |
| `FinancialConfig` | `func FinancialConfig() *SecurityConfig` | Конфигурация соответствия PCI-DSS |
| `GovernmentConfig` | `func GovernmentConfig() *SecurityConfig` | Конфигурация правительственного стандарта |
| `SecurityConfigForLevel` | `func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig` | Получить конфигурацию безопасности по уровню |

## Конструкторы фильтрации конфиденциальных данных

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewSensitiveDataFilter` | `func NewSensitiveDataFilter() *SensitiveDataFilter` | Фильтр с полным набором шаблонов |
| `NewEmptySensitiveDataFilter` | `func NewEmptySensitiveDataFilter() *SensitiveDataFilter` | Пустой фильтр |
| `NewCustomSensitiveDataFilter` | `func NewCustomSensitiveDataFilter(patterns ...string) (*SensitiveDataFilter, error)` | Фильтр с пользовательскими шаблонами |

## Конструкторы хуков

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewHookRegistry` | `func NewHookRegistry() *HookRegistry` | Создать реестр хуков |
| `NewHooksFromConfig` | `func NewHooksFromConfig(cfg HooksConfig) *HookRegistry` | Создать реестр хуков из конфигурации |

## Конструкторы аудитных логов

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewAuditLogger` | `func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)` | Создать аудитный логгер |
| `DefaultAuditConfig` | `func DefaultAuditConfig() AuditConfig` | Конфигурация аудита по умолчанию |
| `VerifyAuditEvent` | `func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult` | Проверить целостность аудитного события |

## Конструкторы подписей целостности

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewIntegritySigner` | `func NewIntegritySigner(cfg IntegrityConfig) (*IntegritySigner, error)` | Создать подписывающее устройство целостности |
| `DefaultIntegrityConfigSafe` | `func DefaultIntegrityConfigSafe() (IntegrityConfig, error)` | Конфигурация со случайным ключом |

## Конструкторы тестовых утилит

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewLoggerRecorder` | `func NewLoggerRecorder() *LoggerRecorder` | Создать регистратор логов (для тестирования) |

## Функции контекста

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `WithTraceID` | `func WithTraceID(ctx context.Context, traceID string) context.Context` | Установить Trace ID |
| `WithSpanID` | `func WithSpanID(ctx context.Context, spanID string) context.Context` | Установить Span ID |
| `WithRequestID` | `func WithRequestID(ctx context.Context, requestID string) context.Context` | Установить Request ID |
| `GetTraceID` | `func GetTraceID(ctx context.Context) string` | Получить Trace ID |
| `GetSpanID` | `func GetSpanID(ctx context.Context) string` | Получить Span ID |
| `GetRequestID` | `func GetRequestID(ctx context.Context) string` | Получить Request ID |

## Конфигурация JSON

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `DefaultJSONOptions` | `func DefaultJSONOptions() *JSONOptions` | Параметры вывода JSON по умолчанию |

## Конструкторы полей

Используются для создания структурированных полей логов (`Field`), в сочетании с методами серии `*With` или `WithFields`.

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Any` | `func Any(key string, value any) Field` | Поле произвольного типа |
| `String` | `func String(key, value string) Field` | Строковое поле |
| `Bool` | `func Bool(key string, value bool) Field` | Логическое поле |
| `Int` | `func Int(key string, value int) Field` | Поле int |
| `Int8` | `func Int8(key string, value int8) Field` | Поле int8 |
| `Int16` | `func Int16(key string, value int16) Field` | Поле int16 |
| `Int32` | `func Int32(key string, value int32) Field` | Поле int32 |
| `Int64` | `func Int64(key string, value int64) Field` | Поле int64 |
| `Uint` | `func Uint(key string, value uint) Field` | Поле uint |
| `Uint8` | `func Uint8(key string, value uint8) Field` | Поле uint8 |
| `Uint16` | `func Uint16(key string, value uint16) Field` | Поле uint16 |
| `Uint32` | `func Uint32(key string, value uint32) Field` | Поле uint32 |
| `Uint64` | `func Uint64(key string, value uint64) Field` | Поле uint64 |
| `Float32` | `func Float32(key string, value float32) Field` | Поле float32 |
| `Float64` | `func Float64(key string, value float64) Field` | Поле float64 |
| `Duration` | `func Duration(key string, value time.Duration) Field` | Поле временного интервала |
| `Time` | `func Time(key string, value time.Time) Field` | Поле времени |
| `Err` | `func Err(err error) Field` | Поле ошибки (ключ "error") |
| `ErrWithKey` | `func ErrWithKey(key string, err error) Field` | Поле ошибки с пользовательским ключом |
| `ErrWithStack` | `func ErrWithStack(err error) Field` | Поле ошибки со стеком вызовов |

```go
dd.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 100*time.Millisecond),
    dd.Err(err),
)
```

:::tip Типобезопасность
Предпочитайте типизированные конструкторы (такие как `Int`, `String`) вместо `Any` — это позволяет выявлять несоответствие типов на этапе компиляции и избегать ошибок времени выполнения, вызванных неверным типом.
:::

## Конфигурация валидации полей

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `DefaultFieldValidationConfig` | `func DefaultFieldValidationConfig() *FieldValidationConfig` | Валидация полей по умолчанию (без валидации) |
| `StrictSnakeCaseConfig` | `func StrictSnakeCaseConfig() *FieldValidationConfig` | Строгая валидация snake_case |
| `StrictCamelCaseConfig` | `func StrictCamelCaseConfig() *FieldValidationConfig` | Строгая валидация camelCase |

## Функции отладочного вывода

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `Print` | `func Print(args ...any)` | Вывод в Writer глобального логгера (уровень Info, с фильтрацией безопасности) |
| `Println` | `func Println(args ...any)` | Аналогично Print (базовый Log() уже добавляет перенос строки, с фильтрацией безопасности) |
| `Printf` | `func Printf(format string, args ...any)` | Форматированный вывод (уровень Info, с фильтрацией безопасности) |
| `JSON` | `func JSON(data ...any)` | Компактный вывод JSON в stdout (с информацией о вызывающем, без фильтрации безопасности) |
| `JSONF` | `func JSONF(format string, args ...any)` | Форматированная строка как компактный JSON в stdout (с информацией о вызывающем, без фильтрации безопасности) |
| `Text` | `func Text(data ...any)` | Красивый вывод в stdout (без фильтрации безопасности) |
| `Textf` | `func Textf(format string, args ...any)` | Форматированный текстовый вывод в stdout (без фильтрации безопасности) |
| `Exit` | `func Exit(data ...any)` | Текстовый вывод с информацией о вызывающем и выход (exit code 0), сложные типы автоматически красиво печатаются, без фильтрации безопасности |
| `Exitf` | `func Exitf(format string, args ...any)` | Форматированный вывод с информацией о вызывающем и выход (exit code 0, без фильтрации безопасности) |

:::warning Предупреждение о безопасности функций отладки
`Print`/`Println`/`Printf` проходят через фильтрацию безопасности, но `JSON`/`JSONF`/`Text`/`Textf`/`Exit`/`Exitf` выводят исходные данные напрямую, **без фильтрации безопасности**.
:::

## Следующие шаги

- [Logger](./logger) -- подробное описание методов экземпляра Logger
- [LoggerEntry](./entry) -- запись лога с предустановленными полями
- [Конфигурация](./config) -- структура Config
- [Отладочный вывод](../dev-tools/debug-visual) -- функции отладочной визуализации
