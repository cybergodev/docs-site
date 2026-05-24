---
title: "Извлечение ссылок - HTML"
description: "Справочник API независимого извлечения ссылок библиотеки CyberGo HTML, включая семейство функций ExtractAllLinks и инструмент группировки GroupLinksByType, поддержка извлечения всех ссылочных ресурсов из HTML (CSS, JS, изображения, видео, аудио) с группировкой по типам, настраиваемая фильтрация ссылок через Config, для сканеров и сбора ресурсов."
---

# Извлечение ссылок

Независимый API извлечения ссылок, позволяющий извлекать все ссылочные ресурсы из HTML и группировать их по типам.

## Функции пакета

```go
func ExtractAllLinks(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFile(filePath string, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)
func ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)
```

## Методы Processor

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## Инструмент группировки

### GroupLinksByType

Группировка ссылок по типу.

```go
func GroupLinksByType(links []LinkResource) map[string][]LinkResource
```

```go
links, _ := html.ExtractAllLinks(data)
groups := html.GroupLinksByType(links)

for typ, items := range groups {
    fmt.Printf("Тип %s: %d шт.\n", typ, len(items))
}
```

## LinkResource

```go
type LinkResource struct {
    URL   string // Адрес ссылки
    Title string // Заголовок ссылки
    Type  string // Тип ссылки (link, image, video, audio, media, css, js, icon)
}
```

## Конфигурация

Поведение извлечения ссылок настраивается через поля фильтрации ссылок в `Config`:

```go
cfg := html.DefaultConfig()
cfg.IncludeImages = true
cfg.IncludeCSS = true
cfg.IncludeJS = true
cfg.IncludeExternalLinks = true
cfg.ResolveRelativeURLs = true
cfg.BaseURL = "https://example.com"
```
