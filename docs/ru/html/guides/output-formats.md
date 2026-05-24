---
title: "Выбор формата вывода - HTML"
description: "Руководство по выбору формата вывода CyberGo HTML с подробным сравнением трёх форматов: простой текст, Markdown и JSON, их особенностей и применимых сценариев, включая настройку форматов (InlineImageFormat, InlineLinkFormat), поддержку контекста и чтение из файлов, помогает выбрать оптимальный формат вывода."
---

# Выбор формата вывода

Это руководство поможет вам сделать правильный выбор между тремя форматами вывода: простой текст, Markdown и JSON.

## Сравнение форматов

| Особенность | Простой текст | Markdown | JSON |
|------|--------|----------|------|
| Читаемость | Высокая | Высокая | Низкая (удобно для машин) |
| Сохранение структуры | Нет | Заголовки/списки/ссылки/изображения | Полные метаданные |
| Обработка изображ | Удаление | `![alt](url)` | Список ImageInfo |
| Обработка ссылок | Только текст | `[text](url)` | Список LinkInfo |
| Поддержка таблиц | Нет | Markdown-таблицы | Исходные данные |
| Применимые сценарии | Поисковые индексы/анализ текста | Блоги/документация/ридеры | API-передача/хранение данных |

## Простой текст

Самый лёгкий способ вывода, сохраняется только текстовое содержимое, удаляются все HTML-теги и форматирование.

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

### Применимые сценарии

- Построение поисковых индексов
- Анализ текста и обработка NLP
- Генерация сводок и предпросмотров
- Подсчёт слов и времени чтения

### Особенности

- Текст изображений и ссылок удаляется
- Между заголовками и абзацами сохраняются переносы строк
- Содержимое списков представлено в виде простого текста

## Markdown

Сохраняет структуру документа с хорошей читаемостью, подходит для миграции контента и чтения.

```go
// Способ 1: функция уровня пакета
md, err := html.ExtractToMarkdown(data)

// Способ 2: использование Processor
p, _ := html.New()
defer p.Close()
md2, err := p.ExtractToMarkdown(data)
```

### Пример вывода

Входной HTML:

```html
<article>
    <h1>Введение в Go</h1>
    <p>Go — это компилируемый язык.</p>
    <img src="gopher.png" alt="Gopher" />
    <a href="https://go.dev">Официальный сайт Go</a>
</article>
```

Вывод Markdown:

```markdown
Введение в Go

Go — это компилируемый язык.

![Gopher](gopher.png)
[Официальный сайт Go](https://go.dev)
```

### Параметры формата

Формат Markdown управляется двумя полями конфигурации:

```go
cfg := html.DefaultConfig()
cfg.InlineImageFormat = "markdown"  // "none" | "markdown" | "html" | "placeholder"
cfg.InlineLinkFormat = "markdown"   // "none" | "markdown" | "html"
```

| Значение | Вывод изображений (InlineImageFormat) | Вывод ссылок (InlineLinkFormat) |
|--------|----------|----------|
| `none` | Удаление | Только текст |
| `markdown` | `![alt](url)` | `[text](url)` |
| `html` | `<img src="..." alt="...">` | `<a href="...">text</a>` |
| `placeholder` | `[IMAGE:N]` | - (не поддерживается) |

:::tip Используйте MarkdownConfig()
Предустановка `MarkdownConfig()` уже устанавливает форматы изображений и ссылок в `markdown`, используйте её напрямую без ручной настройки.
:::

:::info Формат placeholder
`placeholder` применяется только к `InlineImageFormat` и сохраняет заполнители `[IMAGE:N]` в тексте. `InlineLinkFormat` не поддерживает это значение, доступны только `none`, `markdown`, `html`.
:::

### Применимые сценарии

- Миграция контента в Markdown-блоги/статические сайты
- Генерация тела писем
- Конвертация форматов документов
- Генерация контента для RSS / Newsletter

## JSON

Структурированный вывод, сохраняющий полные метаданные, подходит для межпрограммной передачи и постоянного хранения.

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

### Структура вывода

```json
{
  "text": "Введение в Go\n\nGo — это компилируемый язык.\n\nОфициальный сайт Go",
  "title": "Введение в Go",
  "images": [
    {"url": "gopher.png", "alt": "Gopher", "title": "", "width": "", "height": "", "is_decorative": false, "position": 1}
  ],
  "links": [
    {"url": "https://go.dev", "text": "Официальный сайт Go", "title": "", "is_external": true, "is_no_follow": false, "position": 1}
  ],
  "processing_time_ms": 2,
  "word_count": 6,
  "reading_time_ms": 1800
}
```

:::tip Поля времени
В JSON-выводе `ProcessingTime` и `ReadingTime` автоматически конвертируются в миллисекунды (`processing_time_ms`, `reading_time_ms`), что удобно для потребления фронтендом и API.
:::

### Применимые сценарии

- Данные ответов API
- Хранение в базе данных
- Передача между микросервисами
- Интеграция с фронтенд-приложениями

## Извлечение из файлов в различных форматах

Каждый формат поддерживает чтение из файлов:

```go
// Простой текст
text, err := html.ExtractTextFromFile("page.html")

// Markdown
md, err := html.ExtractToMarkdownFromFile("page.html")

// JSON
jsonBytes, err := html.ExtractToJSONFromFile("page.html")
```

## Версии с контекстом

Все функции форматирования имеют варианты `WithContext` с поддержкой тайм-аута и отмены:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

md, err := html.ExtractToMarkdownWithContext(ctx, data)
```

## Решение о выборе

```text
Нужен для потребления программой?── Да ──→ JSON
        │
        Нет
        │
Нужно сохранить форматирование?── Да ──→ Markdown
        │
        Нет
        │
        └──→ Простой текст
```

## Следующие шаги

- [Справочник API: Форматы вывода](../api-reference/output) - Полные сигнатуры API
- [Извлечение и группировка ссылок](../guides/link-extraction) - Извлечение ссылок на ресурсы страницы
- [Подробная конфигурация](../api-reference/config) - Все параметры конфигурации
