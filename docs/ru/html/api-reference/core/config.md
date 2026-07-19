---
sidebar_label: "Конфигурация"
title: "Конфигурация - CyberGo html | поля Config"
description: "Подробно о Config CyberGo html: управление ресурсами, безопасность, извлечение контента, форматы вывода, фильтры ссылок и метод Validate."
sidebar_position: 3
---

# Конфигурация

## Структура Config

`Config` — это единая структура конфигурации библиотеки HTML, охватывающая управление ресурсами, безопасность, извлечение контента, форматы вывода и фильтрацию ссылок.

### Управление ресурсами

| Поле | Тип | По умолчанию | Описание |
|------|------|--------|------|
| `MaxInputSize` | `int` | `52428800` (50 МБ) | Максимальный размер ввода (байты) |
| `MaxCacheEntries` | `int` | `2000` | Максимальное количество записей в кэше |
| `CacheTTL` | `time.Duration` | `1ч` | Время жизни записей в кэше |
| `CacheCleanup` | `time.Duration` | `5м` | Интервал очистки кэша |
| `WorkerPoolSize` | `int` | `4` | Размер пула воркеров |
| `ProcessingTimeout` | `time.Duration` | `30с` | Тайм-аут обработки |

:::tip Подсказка
Установка `MaxCacheEntries`, `CacheCleanup` или `ProcessingTimeout` в `0` — это не ошибка, а значения с определённой семантикой (отключить кэш, отключить фоновую очистку и без тайм-аута соответственно). `MaxInputSize`, `WorkerPoolSize` и `MaxDepth` должны быть положительными, иначе возвращается `ConfigError`.
:::

### Безопасность

| Поле | Тип | По умолчанию | Описание |
|------|------|--------|------|
| `EnableSanitization` | `bool` | `true` | Включить очистку контента, можно отключить только для доверенного ввода |
| `MaxDepth` | `int` | `500` | Максимальная глубина DOM |
| `AllowedBaseDir` | `string` | `""` | Ограничивает файловые операции этим каталогом; пустое значение (по умолчанию) означает отсутствие ограничений. Используйте при работе с путями файлов из ненадёжных источников |
| `Audit` | `AuditConfig` | `DefaultAuditConfig()` | Конфигурация аудита |

### Извлечение контента

| Поле | Тип | По умолчанию | Описание |
|------|------|--------|------|
| `ExtractArticle` | `bool` | `true` | Включить интеллектуальное распознавание статей |
| `PreserveImages` | `bool` | `true` | Сохранять информацию об изображениях |
| `PreserveLinks` | `bool` | `true` | Сохранять информацию о ссылках |
| `PreserveVideos` | `bool` | `true` | Сохранять информацию о видео |
| `PreserveAudios` | `bool` | `true` | Сохранять информацию об аудио |

### Форматы вывода

| Поле | Тип | По умолчанию | Возможные значения | Описание |
|------|------|--------|--------|------|
| `InlineImageFormat` | `string` | `none` | `none`, `markdown`, `html`, `placeholder` | Формат встроенных изображений |
| `InlineLinkFormat` | `string` | `none` | `none`, `markdown`, `html` | Формат встроенных ссылок |
| `TableFormat` | `string` | `markdown` | `markdown`, `html` | Формат таблиц |
| `Encoding` | `string` | `""` | - | Указание кодировки (пустое значение — автоопределение) |

### Извлечение ссылок

| Поле | Тип | По умолчанию | Описание |
|------|------|--------|------|
| `ResolveRelativeURLs` | `bool` | `true` | Разрешение относительных URL, необходимо задать BaseURL |
| `BaseURL` | `string` | `""` | Базовый URL (для разрешения относительных путей) |
| `IncludeImages` | `bool` | `true` | Включить ссылки на изображения |
| `IncludeVideos` | `bool` | `true` | Включить ссылки на видео |
| `IncludeAudios` | `bool` | `true` | Включить ссылки на аудио |
| `IncludeCSS` | `bool` | `true` | Включить ссылки на CSS |
| `IncludeJS` | `bool` | `true` | Включить ссылки на JS |
| `IncludeContentLinks` | `bool` | `true` | Включить контентные ссылки |
| `IncludeExternalLinks` | `bool` | `true` | Включить внешние ссылки |
| `IncludeIcons` | `bool` | `true` | Включить ссылки на иконки |

### Расширения

| Поле | Тип | По умолчанию | Описание |
|------|------|--------|------|
| `Scorer` | `Scorer` | `nil` | Пользовательский скорер контента, при пустом значении используется скорер по умолчанию |

## Предустановки конфигурации

### DefaultConfig

Сбалансированная конфигурация для общих сценариев.

```go
cfg := html.DefaultConfig()
```

### TextOnlyConfig

Извлечение только текста, отключено сохранение всех медиа и ссылок (`PreserveImages`, `PreserveLinks`, `PreserveVideos`, `PreserveAudios` установлены в `false`).

```go
cfg := html.TextOnlyConfig()
```

### MarkdownConfig

Оптимизация вывода в Markdown, встроенные изображения и ссылки используют формат Markdown.

```go
cfg := html.MarkdownConfig()
```

### HighSecurityConfig

Конфигурация высокой безопасности: ужесточённые ограничения, более короткие тайм-ауты, полный аудит.

```go
cfg := html.HighSecurityConfig()
```

Значения, переопределяющие `DefaultConfig()`:

| Поле | По умолчанию | Высокая безопасность |
|------|--------|----------|
| `MaxInputSize` | `52428800` (50 МБ) | `10485760` (10 МБ) |
| `MaxCacheEntries` | `2000` | `500` |
| `CacheTTL` | `1ч` | `30м` |
| `CacheCleanup` | `5м` | `1м` |
| `WorkerPoolSize` | `4` | `2` |
| `ProcessingTimeout` | `30с` | `10с` |
| `MaxDepth` | `500` | `100` |
| `Audit` | `DefaultAuditConfig()` | `HighSecurityAuditConfig()` |

## Validate

Проверка валидности конфигурации.

```go
func (c Config) Validate() error
```

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = -1
err := cfg.Validate() // Возвращает ConfigError
```

### Ограничения валидации

`Validate()` применяет следующие диапазоны значений к числовым полям (при нарушении возвращается `ConfigError`, который можно проверить через `errors.Is(err, html.ErrInvalidConfig)`):

| Поле | Ограничение | Недопустимый пример |
|------|-------------|---------------------|
| `MaxInputSize` | Положительное и ≤ `52428800` (50 МБ) | `0`, `-1`, `100000000` |
| `MaxCacheEntries` | ≥ `0` и ≤ `100000` | `-1`, `200000` |
| `CacheTTL` | ≥ `0` | `-1 * time.Second` |
| `CacheCleanup` | ≥ `0` | `-1 * time.Minute` |
| `WorkerPoolSize` | Положительное и ≤ `256` | `0`, `512` |
| `MaxDepth` | Положительное и ≤ `500` | `0`, `1000` |
| `ProcessingTimeout` | ≥ `0` | `-1 * time.Second` |
| `InlineImageFormat` | Пусто / `none` / `markdown` / `html` / `placeholder` | `"pdf"` |
| `InlineLinkFormat` | Пусто / `none` / `markdown` / `html` | `"pdf"` |
| `TableFormat` | Пусто / `markdown` / `html` | `"csv"` |

Строки формата нечувствительны к регистру, а пустое значение воспринимается как значение по умолчанию (`InlineImageFormat`/`InlineLinkFormat` → `none`, `TableFormat` → `markdown`). `New()` вызывает `Validate()` перед созданием Processor, поэтому недопустимая конфигурация никогда не создаёт пригодный к использованию Processor.
