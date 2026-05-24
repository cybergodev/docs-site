---
title: "Извлечение и группировка ссылок - HTML"
description: "Практическое руководство по извлечению и группировке ссылок CyberGo HTML, подробное описание использования ExtractAllLinks для извлечения всех ссылок на ресурсы страницы (CSS, JS, изображения, видео, аудио и др.), группировка по типам, настройка правил фильтрации Include, автоматическое разрешение относительных URL и лучшие практики сбора ресурсов в сценариях сканирования."
---

# Извлечение и группировка ссылок

Независимо от извлечения контента библиотека предоставляет специализированный API для извлечения ссылок, подходящий для сканеров и сбора ресурсов.

## Базовое использование

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}
```

Пример вывода:

```text
[link] Официальный сайт Go - https://go.dev
[image] Талисман Gopher - gopher.png
[css] style - https://example.com/style.css
[js] app - https://example.com/app.js
```

## Типы ссылок

Поле `Type` структуры `LinkResource` определяет тип ресурса:

| Тип | Исходный элемент | Описание |
|------|----------|------|
| `link` | `<a>` | Ссылки на страницы |
| `image` | `<img>` | Ресурсы изображений |
| `video` | `<video>`, `<iframe>`, `<embed>`, `<object>` | Видеоресурсы |
| `audio` | `<audio>` | Аудиоресурсы |
| `css` | `<link rel="stylesheet">` | Стили |
| `media` | `<source>` | Общие медиаресурсы (когда невозможно определить видео/аудио) |
| `js` | `<script>` | Скрипты |
| `icon` | `<link rel="icon">` | Иконки сайта |

## Группировка по типам

`GroupLinksByType` группирует ссылки по полю `Type`:

```go
links, _ := html.ExtractAllLinks(data)

groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("\n=== %s (%d) ===\n", typ, len(items))
    for _, item := range items {
        fmt.Printf("  %s\n", item.URL)
    }
}
```

Пример вывода:

```text
=== image (3) ===
  https://example.com/logo.png
  https://example.com/hero.jpg
  https://example.com/icon.svg

=== css (2) ===
  https://example.com/style.css
  https://example.com/theme.css

=== js (1) ===
  https://example.com/app.js
```

## Настройка правил фильтрации

Через поля `Config` можно управлять типами извлекаемых ссылок:

```go
cfg := html.DefaultConfig()

// Извлекать только изображения и CSS
cfg.IncludeImages = true
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = true
cfg.IncludeJS = false
cfg.IncludeContentLinks = false
cfg.IncludeExternalLinks = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

### Параметры фильтрации

| Поле конфигурации | По умолчанию | Область управления |
|----------|--------|----------|
| `IncludeImages` | `true` | Теги `<img>` |
| `IncludeVideos` | `true` | `<video>`, `<iframe>`, `<embed>`, `<object>` |
| `IncludeAudios` | `true` | Теги `<audio>` |
| `IncludeCSS` | `true` | `<link rel="stylesheet">` |
| `IncludeJS` | `true` | Теги `<script>` |
| `IncludeContentLinks` | `true` | `<a>` внутренние ссылки |
| `IncludeExternalLinks` | `true` | `<a>` внешние ссылки |
| `IncludeIcons` | `true` | `<link rel="icon">` |

## Разрешение URL

### Разрешение относительных URL

При включении `ResolveRelativeURLs` относительные пути автоматически конвертируются в абсолютные:

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com/docs/"

links, _ := html.ExtractAllLinks(data, cfg)
// /images/logo.png → https://example.com/images/logo.png
// ./style.css → https://example.com/docs/style.css
```

### Автоматическое определение Base URL

Если `ResolveRelativeURLs = true`, но `BaseURL` не задан, библиотека автоматически определит его из HTML:

1. Тег `<base href="...">`
2. `<meta property="og:url">` или `canonical`
3. `<link rel="canonical">`
4. Домен из первого абсолютного URL на странице

## Практика сканирования

### Сбор всех ресурсов страницы

```go
cfg := html.DefaultConfig()
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://target-site.com"

links, _ := html.ExtractAllLinks(pageData, cfg)

// Групповая обработка
groups := html.GroupLinksByType(links)

// Загрузка всех изображений
for _, img := range groups["image"] {
    downloadFile(img.URL)
}

// Сбор ссылок на подстраницы для продолжения сканирования
for _, link := range groups["link"] {
    if isSameDomain(link.URL) {
        addToQueue(link.URL)
    }
}
```

### Извлечение только навигационных ссылок

```go
cfg := html.DefaultConfig()
cfg.IncludeContentLinks = true
cfg.IncludeExternalLinks = true
cfg.IncludeImages = false
cfg.IncludeVideos = false
cfg.IncludeAudios = false
cfg.IncludeCSS = false
cfg.IncludeJS = false
cfg.IncludeIcons = false

links, _ := html.ExtractAllLinks(data, cfg)
```

## Извлечение из файла

```go
// Функция уровня пакета
links, err := html.ExtractAllLinksFromFile("page.html")

// Экземпляр Processor
p, _ := html.New()
defer p.Close()
links, err := p.ExtractAllLinksFromFile("page.html")
```

## Версия с контекстом

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

links, err := html.ExtractAllLinksWithContext(ctx, data)
```

## Следующие шаги

- [Справочник API: Извлечение ссылок](../api-reference/links) - Полные сигнатуры API
- [Пакетная обработка](../api-reference/batch) - Пакетное извлечение ссылок
- [Подробная конфигурация](../api-reference/config) - Конфигурация фильтрации ссылок
