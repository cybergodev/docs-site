---
sidebar_label: "Константы и ошибки"
title: "Константы и ошибки - CyberGo DD | LogLevel и ошибки"
description: "Полная документация констант и типов ошибок CyberGo DD, включающая константы уровней логирования LogLevel (Debug/Info/Warn/Error/Fatal), константы форматов вывода Format и определения сторожевых ошибок SentinelErrors, для точного управления поведением логирования и обработки ошибок, являясь основой для понимания системы конфигурации библиотеки логирования DD."
sidebar_position: 3
---

# Константы и ошибки

DD определяет богатый набор констант и типов ошибок для управления уровнями логирования, форматирования и обработки ошибок.

## Уровни логирования

```go
type LogLevel int8 // Тип уровня логирования
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `LevelDebug` | 0 | Уровень отладки |
| `LevelInfo` | 1 | Уровень информации (по умолчанию) |
| `LevelWarn` | 2 | Уровень предупреждения |
| `LevelError` | 3 | Уровень ошибки |
| `LevelFatal` | 4 | Фатальный уровень |

`LogLevel` реализует метод `String() string` (возвращает `"DEBUG"`/`"INFO"`/`"WARN"`/`"ERROR"`/`"FATAL"`, для неизвестных значений — `"UNKNOWN"`) и метод `IsValid() bool` (проверяет, находится ли уровень в допустимом диапазоне от `LevelDebug` до `LevelFatal`).

## Форматы логирования

```go
type LogFormat int8 // Тип формата вывода
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `FormatText` | 0 | Текстовый формат |
| `FormatJSON` | 1 | Формат JSON |

`LogFormat` реализует метод `String() string` (возвращает `"text"`/`"json"`, для неизвестных значений — `"unknown"`).

## Режимы валидации полей

```go
type FieldValidationMode int // Режим валидации ключей полей
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `FieldValidationNone` | 0 | Отключить валидацию (по умолчанию) |
| `FieldValidationWarn` | 1 | Предупреждать при ошибке валидации, но принимать |
| `FieldValidationStrict` | 2 | Строгий режим, записывать ошибку при ошибке валидации |

## Соглашения об именовании полей

```go
type FieldNamingConvention int // Соглашение об именовании ключей полей
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `NamingConventionAny` | 0 | Принимать любой формат (по умолчанию) |
| `NamingConventionSnakeCase` | 1 | snake_case (например, user_id) |
| `NamingConventionCamelCase` | 2 | camelCase (например, userId) |
| `NamingConventionPascalCase` | 3 | PascalCase (например, UserId) |
| `NamingConventionKebabCase` | 4 | kebab-case (например, user-id) |

## Алгоритмы хеширования

```go
type HashAlgorithm int // Алгоритм хеширования подписи целостности
```

| Константа | Значение | Описание |
|-----------|----------|----------|
| `HashAlgorithmSHA256` | 0 | Алгоритм SHA-256 (используется для [подписи целостности](../security-audit/integrity)) |

## Значения по умолчанию

| Константа | Значение | Описание |
|-----------|----------|----------|
| `DefaultTimeFormat` | `"2006-01-02T15:04:05Z07:00"` | Формат времени ISO 8601 |
| `DefaultLogPath` | `"logs/app.log"` | Путь к файлу логов по умолчанию |
| `DefaultMaxSizeMB` | `100` | Ограничение размера файла по умолчанию (МБ) |
| `DefaultMaxBackups` | `10` | Количество резервных копий по умолчанию |
| `DefaultMaxAge` | `30 * 24 * time.Hour` | Срок хранения по умолчанию (30 дней) |

## Ключи контекста

| Константа | Тип | Значение |
|-----------|-----|----------|
| `ContextKeyTraceID` | `ContextKey` | `"trace_id"` |
| `ContextKeySpanID` | `ContextKey` | `"span_id"` |
| `ContextKeyRequestID` | `ContextKey` | `"request_id"` |

## Коды ошибок

Поле `LoggerError.Code` содержит машинно-читаемую строку кода ошибки для точного сопоставления типов ошибок. Коды ошибок являются деталями реализации, рекомендуется использовать сторожевые ошибки для сопоставления.

## Сторожевые ошибки

Каждому коду ошибки соответствует переменная сторожевой ошибки:

```go
var (
    ErrNilConfig          = errors.New("config cannot be nil")
    ErrNilWriter          = errors.New("writer cannot be nil")
    ErrNilFilter          = errors.New("filter cannot be nil")
    ErrNilHook            = errors.New("hook cannot be nil")
    ErrNilExtractor       = errors.New("context extractor cannot be nil")
    ErrLoggerClosed       = errors.New("logger is closed")
    ErrWriterNotFound     = errors.New("writer not found")
    ErrInvalidLevel       = errors.New("invalid log level")
    ErrInvalidFormat      = errors.New("invalid log format")
    ErrMaxWritersExceeded = errors.New("maximum writer count exceeded")
    ErrEmptyFilePath      = errors.New("file path cannot be empty")
    ErrPathTooLong        = errors.New("file path too long")
    ErrPathTraversal      = errors.New("path traversal detected")
    ErrNullByte           = errors.New("null byte in input")
    ErrInvalidPath        = errors.New("invalid file path")
    ErrSymlinkNotAllowed  = errors.New("symlinks not allowed")
    ErrHardlinkNotAllowed = errors.New("hardlinks not allowed")
    ErrOverlongEncoding   = errors.New("UTF-8 overlong encoding detected")
    ErrMaxSizeExceeded    = errors.New("maximum size exceeded")
    ErrMaxBackupsExceeded = errors.New("maximum backup count exceeded")
    ErrBufferSizeTooLarge = errors.New("buffer size too large")
    ErrInvalidPattern     = errors.New("invalid regex pattern")
    ErrEmptyPattern       = errors.New("pattern cannot be empty")
    ErrPatternTooLong     = errors.New("pattern length exceeds maximum")
    ErrReDoSPattern       = errors.New("pattern contains dangerous nested quantifiers that may cause ReDoS")
    ErrPatternFailed      = errors.New("failed to add pattern")
    ErrConfigValidation   = errors.New("configuration validation failed")
    ErrWriterAdd          = errors.New("failed to add writer")
    ErrMultipleConfigs    = errors.New("multiple configs provided, expected 0 or 1")
    ErrNilMultiWriter     = errors.New("multiwriter is nil")
)
```

### Проверка ошибок

```go
if errors.Is(err, dd.ErrLoggerClosed) {
    // Логгер закрыт
}

if errors.Is(err, dd.ErrPathTraversal) {
    // Обнаружена атака обхода пути
}
```

## Типы ошибок

### LoggerError

```go
type LoggerError struct {
    Code    string
    Message string
    Cause   error
    Context map[string]any
}
```

Методы: `Error()`, `Unwrap()`, `Is(target)`, `WithContext(key, value)`, `WithField(key, value)`

```go
// LoggerError содержит код ошибки, сообщение, причину и контекст
// Проверка через errors.Is со сторожевыми ошибками
if errors.Is(err, dd.ErrLoggerClosed) {
    // Логгер закрыт
}
```

### WriterError

```go
type WriterError struct {
    Index  int
    Writer io.Writer
    Err    error
}
```

Методы: `Error()`, `Unwrap()`

### MultiWriterError

```go
type MultiWriterError struct {
    Errors []WriterError
}
```

Методы: `Error()`, `Unwrap()`, `HasErrors()`, `ErrorCount()`, `FirstError()`

## Следующие шаги

- [Пакетные функции](../core/functions) -- функции обработки ошибок
- [Фильтрация безопасности](../security-audit/security) -- валидация безопасности путей
- [Система хуков](../security-audit/hooks) -- хук OnError
