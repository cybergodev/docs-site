---
sidebar_label: "Базовые примеры"
title: "Базовые примеры - CyberGo html | исполняемый код"
description: "Базовые примеры CyberGo html: извлечение контента и файлов, текст, Markdown, группировка ссылок, переиспользование Processor и пакетная обработка."
sidebar_position: 1
---

# Базовые примеры

## Базовое извлечение

Извлечение заголовка, текста и медиа-информации из байтов HTML:

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
                <p>Go — это язык программирования с открытым исходным кодом, разработанный Google.</p>
                <img src="gopher.png" alt="Талисман Gopher" />
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
    fmt.Println("Слов:", result.WordCount)
    fmt.Println("Время чтения:", result.ReadingTime)
    // Вывод:
    // Заголовок: Руководство по Go
    // Текст: Введение в Go
    //
    //       Go — это язык программирования с открытым исходным кодом, разработанный Google.
    //
    //       Официальный сайт Go
    // Слов: 8
    // Время чтения: 2.4с
}
```

## Извлечение из файла

```go
result, err := html.ExtractFromFile("article.html")
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title)
```

## Извлечение только текста

```go
text, err := html.ExtractText(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(text)
```

## Вывод в Markdown

```go
md, err := html.ExtractToMarkdown(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## Извлечение ссылок

```go
links, err := html.ExtractAllLinks(data)
if err != nil {
    log.Fatal(err)
}

for _, link := range links {
    fmt.Printf("[%s] %s - %s\n", link.Type, link.Title, link.URL)
}

// Группировка по типам
groups := html.GroupLinksByType(links)
for typ, items := range groups {
    fmt.Printf("%s: %d шт.\n", typ, len(items))
}
```

## Использование Processor

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()

// Повторное использование Processor для обработки нескольких страниц
for _, page := range pages {
    result, err := p.Extract(page)
    if err != nil {
        log.Printf("Ошибка обработки: %v", err)
        continue
    }
    fmt.Println(result.Title)
}

// Просмотр статистики
stats := p.GetStatistics()
fmt.Printf("Обработано: %d, Попаданий в кэш: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

## С тайм-аутом

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
if err != nil {
    log.Fatal(err)
}
```

## Пакетная обработка

```go
pages := [][]byte{page1, page2, page3}

p, _ := html.New(html.DefaultConfig())
defer p.Close()

batch := p.ExtractBatch(pages)
fmt.Printf("Успешно: %d, Неудачно: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    if result != nil {
        fmt.Printf("Страница %d: %s\n", i, result.Title)
    }
}
```

## Вывод в JSON

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```
