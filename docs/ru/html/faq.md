---
title: "Часто задаваемые вопросы - HTML"
description: "Сборник часто задаваемых вопросов о библиотеке CyberGo HTML с подробными ответами о различиях между функциями пакета и Processor, автоматическом определении и ручном указании кодировок, настройке лимита размера ввода, выводе в Markdown, ограничениях пакетной обработки, диагностике пустого текста, использовании статистики и мониторинга, настройке аудита и реализации пользовательского скорера."
---

# Часто задаваемые вопросы

## В чём разница между функциями пакета и Processor?

**Функции пакета** (например, `html.Extract`) внутри используют `sync.Pool` для повторного использования Processor и подходят для редких, однократных вызовов. После каждого вызова Processor возвращается в пул.

**Processor** (например, `p := html.New()`) подходит для высокочастотных вызовов, повторно используя кэш и внутренние ресурсы. Также поддерживает сбор статистики и журнал аудита.

```go
// Редкие вызовы: функции пакета
result, _ := html.Extract(data)

// Высокочастотные вызовы: Processor
p, _ := html.New(html.DefaultConfig())
defer p.Close()
for _, page := range pages {
    p.Extract(page)
}
```

## Как обрабатывать проблемы с кодировкой?

Библиотека HTML автоматически определяет 15+ кодировок (UTF-8, GBK, Shift_JIS, Windows-1252 и др.), обычно ручное указание не требуется.

Если необходимо принудительно указать кодировку:

```go
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

## Каков лимит размера ввода?

По умолчанию максимум 50 МБ (`DefaultMaxInputSize = 52428800`). Можно изменить через конфигурацию:

```go
cfg.MaxInputSize = 100 * 1024 * 1024 // 100 МБ
```

## Как получить вывод в формате Markdown?

```go
md, err := html.ExtractToMarkdown(data)
```

Или с использованием Processor:

```go
p, _ := html.New()
md, _ := p.ExtractToMarkdown(data)
```

## Сколько элементов можно обработать в пакетном режиме?

Максимум 10 000 элементов за один вызов. Для больших наборов данных обрабатывайте пакетами.

## Почему извлечённый текст пуст?

Возможные причины:

1. **Проблемы структуры HTML** — содержимое находится в тегах `<script>` или `<style>`
2. **Превышена глубина** — вложенность DOM превышает лимит `MaxDepth`
3. **Пустой ввод** — проверьте, что входной массив байтов не пуст
4. **Распознавание статьи** — попробуйте отключить `ExtractArticle`, чтобы проверить, поможет ли извлечение

```go
cfg := html.DefaultConfig()
cfg.ExtractArticle = false // Отключить распознавание статьи
```

## Как отслеживать статистику обработки?

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// После обработки некоторого контента
stats := p.GetStatistics()
fmt.Printf("Обработано: %d\n", stats.TotalProcessed)
fmt.Printf("Попаданий в кэш: %d\n", stats.CacheHits)
fmt.Printf("Среднее время: %v\n", stats.AverageProcessTime)
fmt.Printf("Ошибок: %d\n", stats.ErrorCount)
```

## Как включить аудит?

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = html.NewLoggerAuditSink()
```

Подробнее в [Система аудита](./api-reference/audit).

## Безопасны ли пути к файлам?

`FileError` автоматически усекает полный путь, предотвращая утечку серверных путей в сообщениях об ошибках:

```go
var fileErr *html.FileError
if errors.As(err, &fileErr) {
    fmt.Println(fileErr.SafePath()) // Только имя файла, без полного пути
}
```

## Как реализовать пользовательский скоринг контента?

Реализуйте интерфейс `Scorer`:

```go
type MyScorer struct{}

func (s *MyScorer) Score(node html.ContentNode) int {
    // Пользовательская логика скоринга
    return 0
}

func (s *MyScorer) ShouldRemove(node html.ContentNode) bool {
    // Пользовательская логика удаления
    return false
}

cfg := html.DefaultConfig()
cfg.Scorer = &MyScorer{}
```

Подробнее в [Определение интерфейсов](./api-reference/interfaces).
