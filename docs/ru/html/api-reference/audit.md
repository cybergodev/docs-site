---
title: "Система аудита - CyberGo HTML | подключаемый аудит"
description: "API аудита CyberGo HTML: AuditConfig, 8 типов событий, 3 уровня, AuditEntry и шесть встроенных Sink (Logger, Channel, Writer, Multi, Filtered, LevelFiltered)."
---

# Система аудита

Библиотека HTML имеет встроенный подключаемый конвейер аудита для записи событий безопасности и аномалий обработки.

## AuditConfig

```go
type AuditConfig struct {
    Enabled            bool       `json:"enabled"`             // Включить аудит
    LogBlockedTags     bool       `json:"log_blocked_tags"`    // Записывать заблокированные теги
    LogBlockedAttrs    bool       `json:"log_blocked_attrs"`   // Записывать заблокированные атрибуты
    LogBlockedURLs     bool       `json:"log_blocked_urls"`    // Записывать заблокированные URL
    LogInputViolations bool       `json:"log_input_violations"` // Записывать нарушения ввода
    LogDepthViolations bool       `json:"log_depth_violations"` // Записывать нарушения глубины
    LogTimeouts        bool       `json:"log_timeouts"`        // Записывать тайм-ауты
    LogEncodingIssues  bool       `json:"log_encoding_issues"` // Записывать проблемы кодировки
    LogPathTraversal   bool       `json:"log_path_traversal"`  // Записывать попытки обхода пути
    Sink               AuditSink  `json:"-"`                   // Цель вывода аудита (не участвует в JSON-сериализации)
    IncludeRawValues   bool       `json:"include_raw_values"`  // Включать исходные значения
    MaxRawValueLength  int        `json:"max_raw_value_length"` // Максимальная длина исходного значения
}
```

## Предустановки аудита

### DefaultAuditConfig

Конфигурация аудита по умолчанию (по умолчанию отключена, все флаги журналирования установлены в true).

```go
func DefaultAuditConfig() AuditConfig
```

| Поле | По умолчанию |
|------|--------|
| `Enabled` | `false` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `false` |
| `MaxRawValueLength` | `200` |

### HighSecurityAuditConfig

Конфигурация аудита высокой безопасности, включает все журналы и запись исходных значений.

```go
func HighSecurityAuditConfig() AuditConfig
```

| Поле | По умолчанию |
|------|--------|
| `Enabled` | `true` |
| `LogBlockedTags` | `true` |
| `LogBlockedAttrs` | `true` |
| `LogBlockedURLs` | `true` |
| `LogInputViolations` | `true` |
| `LogDepthViolations` | `true` |
| `LogTimeouts` | `true` |
| `LogEncodingIssues` | `true` |
| `LogPathTraversal` | `true` |
| `IncludeRawValues` | `true` |
| `MaxRawValueLength` | `500` |

## Определения типов

```go
type AuditEventType string  // Тип события аудита
type AuditLevel string      // Уровень серьёзности аудита
```

## Типы событий аудита

| Константа | Значение | Описание |
|------|------|------|
| `AuditEventBlockedTag` | `"blocked_tag"` | Заблокированный тег |
| `AuditEventBlockedAttr` | `"blocked_attr"` | Заблокированный атрибут |
| `AuditEventBlockedURL` | `"blocked_url"` | Заблокированный URL |
| `AuditEventInputViolation` | `"input_violation"` | Нарушение ввода |
| `AuditEventDepthViolation` | `"depth_violation"` | Нарушение глубины |
| `AuditEventTimeout` | `"timeout"` | Тайм-аут обработки |
| `AuditEventEncodingIssue` | `"encoding_issue"` | Проблема кодировки |
| `AuditEventPathTraversal` | `"path_traversal"` | Попытка обхода пути |

## Уровни аудита

| Константа | Значение | Описание |
|------|------|------|
| `AuditLevelInfo` | `"info"` | Информационный уровень |
| `AuditLevelWarning` | `"warning"` | Уровень предупреждения |
| `AuditLevelCritical` | `"critical"` | Критический уровень |

## AuditEntry

Запись журнала аудита.

```go
type AuditEntry struct {
    Timestamp time.Time      `json:"timestamp"`          // Время события
    EventType AuditEventType `json:"event_type"`         // Тип события
    Level     AuditLevel     `json:"level"`              // Уровень аудита
    Message   string         `json:"message"`            // Описание события
    Tag       string         `json:"tag,omitempty"`      // Связанный тег
    Attribute string         `json:"attribute,omitempty"` // Связанный атрибут
    URL       string         `json:"url,omitempty"`      // Связанный URL
    InputSize int            `json:"input_size,omitempty"` // Размер ввода
    MaxSize   int            `json:"max_size,omitempty"` // Лимит размера
    Depth     int            `json:"depth,omitempty"`    // Глубина DOM
    MaxDepth  int            `json:"max_depth,omitempty"` // Лимит глубины
    Path      string         `json:"path,omitempty"`     // Путь к файлу
    RawValue  string         `json:"raw_value,omitempty"` // Исходное значение
    Metadata  map[string]any `json:"metadata,omitempty"` // Дополнительные метаданные
}
```

## Интерфейс AuditSink

Все типы Sink реализуют этот интерфейс.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

## Типы Sink

### LoggerAuditSink

Вывод в стандартный поток ошибок с префиксом `[AUDIT]`.

```go
func NewLoggerAuditSink() *LoggerAuditSink
func NewLoggerAuditSinkWithWriter(w io.Writer) *LoggerAuditSink
```

### ChannelAuditSink

Отправка в буферизованный канал, подходит для асинхронной обработки.

```go
func NewChannelAuditSink(bufferSize int) *ChannelAuditSink

func (s *ChannelAuditSink) Channel() <-chan AuditEntry
func (s *ChannelAuditSink) DroppedCount() int64
```

```go
sink := html.NewChannelAuditSink(100)
go func() {
    for entry := range sink.Channel() {
        log.Println(entry.Message)
    }
}()
```

### WriterAuditSink

Запись в формате JSON Lines в `io.Writer`.

```go
func NewWriterAuditSink(w io.Writer) *WriterAuditSink
```

### MultiSink

Разветвление на несколько Sink.

```go
func NewMultiSink(sinks ...AuditSink) *MultiSink
```

### FilteredSink

Фильтрация записей с использованием функции-предиката.

```go
func NewFilteredSink(sink AuditSink, filter func(AuditEntry) bool) *FilteredSink
```

### LevelFilteredSink

Фильтрация по минимальному уровню.

```go
func NewLevelFilteredSink(sink AuditSink, minLevel AuditLevel) *LevelFilteredSink
```

## Пример

```go
// Создание многоуровневого конвейера аудита
writerSink := html.NewWriterAuditSink(auditFile)
levelSink := html.NewLevelFilteredSink(writerSink, html.AuditLevelWarning)
multiSink := html.NewMultiSink(levelSink, html.NewLoggerAuditSink())

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = multiSink

p, _ := html.New(cfg)
defer p.Close()

// Получение журнала аудита после обработки
entries := p.GetAuditLog()
for _, e := range entries {
    fmt.Printf("[%s] %s: %s\n", e.Level, e.EventType, e.Message)
}
```
