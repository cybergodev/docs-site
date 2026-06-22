---
title: "Быстрый старт - CyberGo HTML | за 5 минут"
description: "Быстрый старт CyberGo HTML за 5 минут: установка, базовое извлечение, пресеты Config, вывод в текст, Markdown и JSON, тайм-ауты контекста."
---

# Быстрый старт

## Установка

```bash
go get github.com/cybergodev/html
```

Требуется Go 1.25+.

## Базовое извлечение

Извлечение контента из байтов HTML:

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html>
        <head><title>Руководство по Go</title></head>
        <body>
            <article>
                <h1>Введение в Go</h1>
                <p>Go — это статически типизированный компилируемый язык.</p>
                <img src="gopher.png" alt="Gopher" />
                <a href="https://go.dev">Официальный сайт Go</a>
            </article>
        </body>
    </html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Заголовок:", result.Title)
    fmt.Println("Текст:", result.Text)
    fmt.Println("Изображений:", len(result.Images))
    fmt.Println("Ссылок:", len(result.Links))
    fmt.Println("Слов:", result.WordCount)
}
```

Вывод:

```text
Заголовок: Руководство по Go
Текст: Введение в Go

Go — это статически типизированный компилируемый язык.

Официальный сайт Go
Изображений: 1
Ссылок: 1
Слов: 6
```

## Извлечение из файла

```go
result, err := html.ExtractFromFile("page.html")
if err != nil {
    log.Fatal(err)
}
```

## Использование конфигурации

Настройка поведения извлечения через `Config`:

```go
cfg := html.MarkdownConfig()
p, err := html.New(cfg)
if err != nil {
    log.Fatal(err)
}
defer p.Close()

result, err := p.Extract(data)
```

### Предустановки конфигурации

| Предустановка | Функция | Описание |
|------|------|------|
| По умолчанию | `DefaultConfig()` | Сбалансированная конфигурация для общих сценариев |
| Текст | `TextOnlyConfig()` | Извлечение только текста без медиа |
| Markdown | `MarkdownConfig()` | Оптимизация вывода в Markdown |
| Высокая безопасность | `HighSecurityConfig()` | Строгие ограничения, полный аудит |

## Форматы вывода

```go
// Простой текст
text, err := html.ExtractText(data)

// Markdown
md, err := html.ExtractToMarkdown(data)

// JSON
jsonBytes, err := html.ExtractToJSON(data)
```

## Поддержка контекста

Все функции имеют версии с `WithContext` для поддержки отмены и тайм-аута:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## Ключевые моменты

### Потокобезопасность

Экземпляр `Processor` потокобезопасен и может совместно использоваться несколькими горутинами:

```go
p, _ := html.New(html.DefaultConfig())
defer p.Close()

// Безопасный вызов из нескольких горутин
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) {
        defer wg.Done()
        result, err := p.Extract(fetchHTML(u))
        // ...
    }(url)
}
wg.Wait()
```

Функции уровня пакета также потокобезопасны (внутренне используют пул Processor).

### Определение кодировки

Библиотека автоматически определяет кодировку HTML, ручная обработка не требуется:

```go
// HTML в кодировке GBK — автоматическое определение и корректное извлечение
result, err := html.Extract(gbkData)

// Можно также указать кодировку вручную через Config.Encoding
cfg := html.DefaultConfig()
cfg.Encoding = "gbk"
```

Поддерживаются UTF-8, GBK, GB18030, Shift_JIS, EUC-JP, Windows-1252 и более 15 кодировок.

## Следующие шаги

- [Извлечение контента на практике](./guides/content-extraction) - Глубокое понимание процесса извлечения и распознавания статей
- [Выбор формата вывода](./guides/output-formats) - Выбор подходящего формата для вашего сценария
- [Повторное использование Processor и кэш](./guides/processor-cache) - Оптимизация производительности при высокочастотных вызовах
- [Шпаргалка](./cheatsheet) - Краткий справочник часто используемых API
