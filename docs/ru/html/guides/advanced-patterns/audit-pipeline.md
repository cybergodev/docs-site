---
sidebar_label: "Система аудита на практике"
title: "Система аудита - CyberGo html | конвейер аудита"
description: "Система аудита CyberGo html на практике: от включения до многоуровневого конвейера — события, Sink, фильтры уровней и мониторинг."
sidebar_position: 2
---

# Система аудита на практике

Система аудита записывает события безопасности в процессе обработки HTML, помогая отслеживать и выявлять потенциальные риски.

## Быстрое включение

Минимальная конфигурация — 3 строки кода для включения аудита:

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

p, _ := html.New(cfg)
defer p.Close()
```

После включения события безопасности будут выводиться в стандартный поток ошибок в формате `[AUDIT] JSON`.

## Типы событий аудита

| Событие | Константа | Уровень | Условие срабатывания |
|------|------|------|----------|
| Заблокированный тег | `blocked_tag` | warning | Удалён опасный тег (например, `<script>`) |
| Заблокированный атрибут | `blocked_attr` | warning | Удалён опасный атрибут (например, `onclick`) |
| Заблокированный URL | `blocked_url` | warning | Перехвачен опасный URL |
| Нарушение ввода | `input_violation` | critical | Ввод превышает лимит размера |
| Нарушение глубины | `depth_violation` | warning | Вложенность DOM превышает лимит |
| Тайм-аут обработки | `timeout` | warning | Тайм-аут одной обработки |
| Проблема кодировки | `encoding_issue` | info | Ошибка определения кодировки |
| Обход пути | `path_traversal` | critical | Путь содержит `..`, либо в режиме `AllowedBaseDir` путь выходит за базу после разрешения через дескриптор ОС (защита от symlink/junction) |

## Уровни аудита

```text
info < warning < critical
```

- **info**: информационные события (проблемы кодировки), не требуют оповещений
- **warning**: аномалии, требующие внимания (тайм-ауты, нарушения глубины)
- **critical**: угрозы безопасности (нарушения ввода, обход пути)

## Встроенные типы Sink

### LoggerAuditSink (по умолчанию)

Вывод в стандартный поток ошибок с префиксом `[AUDIT]`:

```go
// По умолчанию вывод в stderr
sink := html.NewLoggerAuditSink()

// Вывод в пользовательский Writer
sink := html.NewLoggerAuditSinkWithWriter(os.Stdout)
```

### WriterAuditSink

Запись JSON Lines в `io.Writer`, подходит для постоянного хранения в файл:

```go
file, _ := os.Create("audit.jsonl")
defer file.Close()

sink := html.NewWriterAuditSink(file)
```

Формат вывода (по одной записи JSON на строку):

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

### ChannelAuditSink

Неблокирующе помещает события в буферизованный channel; отдельная goroutine-потребитель обрабатывает их асинхронно — подходит для интеграции с внешними системами:

```go
sink := html.NewChannelAuditSink(100)

// Потребление событий аудита
go func() {
    for entry := range sink.Channel() {
        sendToSIEM(entry)
    }
}()

// Проверка потерянных событий (автоматически отбрасываются при заполнении канала)
fmt.Printf("Потеряно: %d\n", sink.DroppedCount())
```

### MultiSink

Разветвление на несколько Sink:

```go
sink := html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)
```

### FilteredSink

Фильтрация событий по условию:

```go
// Запись только событий уровня critical
sink := html.NewFilteredSink(
    fileSink,
    func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    },
)
```

### LevelFilteredSink

Фильтрация по минимальному уровню:

```go
// Запись только warning и выше
sink := html.NewLevelFilteredSink(fileSink, html.AuditLevelWarning)
```

## Построение конвейера аудита

### Сценарий 1: Постоянное хранение в файл

```go
func newAuditPipeline() html.AuditSink {
    file, _ := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    return html.NewWriterAuditSink(file)
}

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = newAuditPipeline()
```

### Сценарий 2: Маршрутизация по уровням

События уровня critical отправляются в систему оповещений, остальные записываются в файл:

```go
func newTieredPipeline() html.AuditSink {
    file, _ := os.Create("audit.jsonl")

    return html.NewMultiSink(
        // Все события записываются в файл
        html.NewWriterAuditSink(file),
        // События critical дополнительно отправляются как оповещения
        html.NewFilteredSink(
            html.NewChannelAuditSink(50),
            func(e html.AuditEntry) bool {
                return e.Level == html.AuditLevelCritical
            },
        ),
    )
}
```

### Сценарий 3: Режим высокой безопасности

Использование `HighSecurityConfig` и `HighSecurityAuditConfig`:

```go
cfg := html.HighSecurityConfig()
cfg.Audit = html.HighSecurityAuditConfig()
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)

p, _ := html.New(cfg)
```

Особенности аудита в режиме высокой безопасности:
- Автоматическое включение аудита
- Запись всех типов событий
- Включение исходных значений (`IncludeRawValues = true`) для криминалистического анализа
- Максимальная длина исходного значения — 500 символов

## Запрос журнала аудита

Просмотр собранных событий через методы Processor:

```go
p, _ := html.New(cfg)
defer p.Close()

// Обработка контента
p.Extract(data)

// Получение журнала аудита
entries := p.GetAuditLog()
for _, entry := range entries {
    fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

// Очистка журнала
p.ClearAuditLog()
```

:::tip Журнал в памяти доступен только для экземпляра Processor
`GetAuditLog()` возвращает события, собранные в памяти Processor. Для постоянного хранения настройте Sink.
:::

## Пользовательский Sink

Реализация интерфейса `AuditSink` для отправки событий аудита в любую цель:

```go
type slackSink struct {
    webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
    if entry.Level != html.AuditLevelCritical {
        return // Отправлять только critical
    }
    msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
    http.Post(s.webhook, "text/plain", strings.NewReader(msg))
}

func (s *slackSink) Close() error {
    return nil
}
```

## Следующие шаги

- [Справочник API: Система аудита](../../api-reference/modules/audit) - Полные сигнатуры API
- [Безопасность](../../security/) - Обзор функций безопасности
- [Контрольный список для продакшена](../../security/production-checklist) - Проверка перед развёртыванием
