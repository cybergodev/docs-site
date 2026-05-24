---
title: "Шпаргалка - HTML"
description: "Шпаргалка по часто используемым API библиотеки CyberGo HTML — на одной странице все функции пакета (Extract, ExtractText, ExtractToMarkdown и др.), методы Processor, четыре предустановки конфигурации, часто используемые параметры конфигурации, определение типов ошибок и настройка системы аудита, для быстрого поиска нужных сигнатур функций и способов использования."
---

# Шпаргалка

## Функции пакета

### Извлечение контента

```go
// Извлечение полного результата из байтов
result, err := html.Extract(data)

// Извлечение из файла
result, err := html.ExtractFromFile("page.html")

// Извлечение только текста
text, err := html.ExtractText(data)
text, err := html.ExtractTextFromFile("page.html")
```

### Форматы вывода

```go
md, err := html.ExtractToMarkdown(data)
jsonBytes, err := html.ExtractToJSON(data)
```

### Извлечение ссылок

```go
links, err := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)
```

### Пакетная обработка

```go
batch := html.ExtractBatch(pages)
// или
batch := html.ExtractBatchFiles(paths)
```

### Версии с контекстом

Все функции имеют варианты с `WithContext`:

```go
result, err := html.ExtractWithContext(ctx, data)
result, err = html.ExtractFromFileWithContext(ctx, path)
text, err := html.ExtractTextWithContext(ctx, data)
md, err := html.ExtractToMarkdownWithContext(ctx, data)
links, err := html.ExtractAllLinksWithContext(ctx, data)
batch := html.ExtractBatchWithContext(ctx, pages)
```

## Processor

```go
// Создание
p, err := html.New(html.DefaultConfig())
defer p.Close()

// Извлечение
result, err := p.Extract(data)
result, err = p.ExtractFromFile(path)
text, err := p.ExtractText(data)

// Вывод
md, err := p.ExtractToMarkdown(data)
jsonBytes, err := p.ExtractToJSON(data)

// Ссылки
links, err := p.ExtractAllLinks(data)

// Пакетная обработка
batch := p.ExtractBatch(pages)

// Статистика
stats := p.GetStatistics()
p.ClearCache()
p.ResetStatistics()

// Аудит
entries := p.GetAuditLog()
p.ClearAuditLog()
```

## Предустановки конфигурации

```go
html.DefaultConfig()       // Конфигурация по умолчанию
html.TextOnlyConfig()      // Только текст
html.MarkdownConfig()      // Вывод в Markdown
html.HighSecurityConfig()  // Высокая безопасность
```

## Часто используемые параметры конфигурации

```go
cfg := html.DefaultConfig()

// Ограничения ресурсов
cfg.MaxInputSize = 10 * 1024 * 1024  // Максимальный размер ввода 10 МБ
cfg.ProcessingTimeout = time.Minute   // Тайм-аут обработки
cfg.MaxDepth = 200                    // Максимальная глубина DOM

// Управление контентом
cfg.ExtractArticle = true             // Интеллектуальное распознавание статей
cfg.PreserveImages = true             // Сохранять изображения
cfg.PreserveLinks = true              // Сохранять ссылки
cfg.PreserveVideos = false            // Не сохранять видео
cfg.PreserveAudios = false            // Не сохранять аудио

// Форматы вывода
cfg.InlineImageFormat = "markdown"    // none/markdown/html/placeholder
cfg.InlineLinkFormat = "markdown"     // none/markdown/html
cfg.TableFormat = "markdown"          // markdown/html

// Фильтрация ссылок
cfg.IncludeImages = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"

// Кэширование
cfg.MaxCacheEntries = 1000
cfg.CacheTTL = 30 * time.Minute
```

## Обработка ошибок

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // Ввод слишком большой
    case errors.Is(err, html.ErrInvalidHTML):
        // Некорректный HTML
    case errors.Is(err, html.ErrProcessingTimeout):
        // Тайм-аут обработки
    case errors.Is(err, html.ErrFileNotFound):
        // Файл не найден
    case errors.Is(err, html.ErrInvalidConfig):
        // Некорректная конфигурация
    case errors.Is(err, html.ErrProcessorClosed):
        // Процессор закрыт
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // Превышена глубина DOM
    case errors.Is(err, html.ErrInvalidFilePath):
        // Некорректный путь к файлу
    default:
        // Другая ошибка
    }
}
```

## Система аудита

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

// Использование пользовательского Sink
sink := html.NewWriterAuditSink(os.Stdout)
cfg.Audit.Sink = sink

p, _ := html.New(cfg)
defer p.Close()

// Получение журнала аудита после обработки
entries := p.GetAuditLog()
```
