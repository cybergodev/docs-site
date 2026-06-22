---
title: "Извлечение ссылок - CyberGo HTML | ссылки ресурсов"
description: "API извлечения ссылок CyberGo HTML: ExtractAllLinks и GroupLinksByType для сбора и группировки ссылок на ресурсы с фильтрацией через Config."
---

# Извлечение ссылок

Независимый API извлечения ссылок, позволяющий извлекать все ссылочные ресурсы из HTML и группировать их по типам.

:::tip Ключевое отличие от Extract
`ExtractAllLinks` **не применяет HTML-санирование** (`EnableSanitization` здесь не действует), поэтому ссылки на ресурсы в тегах `<script src>`, `<iframe>`, `<link>` и `<embed>` также извлекаются полностью. Это сделано, чтобы такие ссылки можно было перечислить — в пути `Extract` они обычно удаляются при санировании.
:::

:::info Сортировка и дедупликация результатов
`ExtractAllLinks` возвращает результаты, **отсортированные по URL по возрастанию** и дедуплицированные по URL. Поэтому повторные вызовы для одного и того же входа дают идентичный результат (начиная с v1.4.2), что упрощает сравнение, повторное использование кэша и воспроизводимую последующую обработку. Если один URL встречается в нескольких тегах, сохраняется только одна запись.
:::

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
