---
title: "Продвинутые примеры - CyberGo HTML | сценарии"
description: "Продвинутые примеры CyberGo HTML: свой Scorer, конвейер аудита с несколькими Sink, пакетная обработка, пул Processor и мониторинг через ChannelAuditSink."
---

# Продвинутые примеры

## Пользовательский Scorer

Настройка логики распознавания контента под структуру конкретного сайта. Полную реализацию см. в [Тестирование и пользовательские расширения](../guides/testing-custom), ниже показано базовое использование:

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// Реализация пользовательского Scorer (полный пример см. в guides/testing-custom)
type myScorer struct{}

func (s myScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }
    class := node.AttrValue("class")
    if strings.Contains(class, "article") || strings.Contains(class, "post") {
        return 100
    }
    if strings.Contains(class, "sidebar") || strings.Contains(class, "comment") {
        return -50
    }
    return 0
}

func (s myScorer) ShouldRemove(node html.ContentNode) bool {
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = myScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">Главная</a></nav>
        <article class="post-content">
            <h1>Глубокое понимание параллелизма в Go</h1>
            <p>goroutine — это легковесный поток Go.</p>
        </article>
        <aside class="sidebar">Рекомендуемое чтение</aside>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Текст:", result.Text)
    // Текст: Глубокое понимание параллелизма в Go
    //
    // goroutine — это легковесный поток Go.
}
```

## Конвейер аудита с несколькими Sink

Построение многоуровневого конвейера аудита: события critical записываются в отдельный файл, все события одновременно выводятся в журнал.

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/html"
)

func main() {
    // Создание целей вывода
    allFile, _ := os.Create("audit-all.jsonl")
    criticalFile, _ := os.Create("audit-critical.jsonl")
    defer allFile.Close()
    defer criticalFile.Close()

    // Построение многоуровневого конвейера
    allSink := html.NewWriterAuditSink(allFile)
    criticalSink := html.NewFilteredSink(
        html.NewWriterAuditSink(criticalFile),
        func(e html.AuditEntry) bool {
            return e.Level == html.AuditLevelCritical
        },
    )
    loggerSink := html.NewLoggerAuditSink()

    pipeline := html.NewMultiSink(allSink, criticalSink, loggerSink)

    // Конфигурация
    cfg := html.HighSecurityConfig()
    cfg.Audit = html.HighSecurityAuditConfig()
    cfg.Audit.Sink = pipeline

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    // Обработка контента
    data := []byte(`<html><body>
        <script>alert('xss')</script>
        <article><p>Безопасный контент</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Текст:", result.Text)
    // Журнал аудита автоматически записывается в файлы и stderr
}
```

## Пакетная обработка файлов

Пакетная обработка HTML-файлов в каталоге, сбор результатов и ошибок:

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/cybergodev/html"
)

func main() {
    // Сбор путей к файлам
    var files []string
    filepath.Walk("./pages", func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return nil
        }
        if filepath.Ext(path) == ".html" || filepath.Ext(path) == ".htm" {
            files = append(files, path)
        }
        return nil
    })

    fmt.Printf("Обнаружено файлов: %d\n", len(files))

    // Пакетная обработка
    p, _ := html.New(html.TextOnlyConfig())
    defer p.Close()

    // Максимум 10 000 файлов на пакет
    batch := p.ExtractBatchFiles(files)

    fmt.Printf("Успешно: %d, Неудачно: %d, Отменено: %d\n",
        batch.Success, batch.Failed, batch.Cancelled)

    // Обработка результатов
    for i, result := range batch.Results {
        if result != nil {
            fmt.Printf("[%d] %s (слов: %d)\n", i, result.Title, result.WordCount)
        }
    }

    // Проверка ошибок
    for i, err := range batch.Errors {
        if err != nil {
            fmt.Printf("[%d] Ошибка: %v\n", i, err)
        }
    }
}
```

## Повторное использование Processor с тайм-аутом

Паттерн Singleton Processor в сценарии веб-сервиса:

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"

    "github.com/cybergodev/html"
)

var processor *html.Processor

func init() {
    cfg := html.DefaultConfig()
    cfg.MaxCacheEntries = 5000
    cfg.CacheTTL = 30 * time.Minute
    cfg.ProcessingTimeout = 10 * time.Second

    var err error
    processor, err = html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
}

func extractHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    data := []byte(r.FormValue("html"))
    if len(data) == 0 {
        http.Error(w, "html field required", http.StatusBadRequest)
        return
    }

    result, err := processor.ExtractWithContext(ctx, data)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
    stats := processor.GetStatistics()
    fmt.Fprintf(w, "Обработано: %d\nПопаданий в кэш: %d\nОшибок: %d\n",
        stats.TotalProcessed, stats.CacheHits, stats.ErrorCount)
}

func main() {
    defer processor.Close()

    http.HandleFunc("/extract", extractHandler)
    http.HandleFunc("/stats", statsHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## Извлечение и генерация Markdown-файлов

Извлечение контента из HTML-страниц и сохранение в виде Markdown-файлов:

```go
package main

import (
    "fmt"
    "log"
    "os"
    "strings"

    "github.com/cybergodev/html"
)

func main() {
    p, err := html.New(html.MarkdownConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    urls := []string{
        "downloaded/page1.html",
        "downloaded/page2.html",
        "downloaded/page3.html",
    }

    for _, path := range urls {
        md, err := p.ExtractToMarkdownFromFile(path)
        if err != nil {
            log.Printf("Ошибка обработки %s: %v", path, err)
            continue
        }

        // Генерация имени выходного файла
        outPath := strings.Replace(path, ".html", ".md", 1)
        if err := os.WriteFile(outPath, []byte(md), 0644); err != nil {
            log.Printf("Ошибка записи %s: %v", outPath, err)
            continue
        }
        fmt.Printf("%s -> %s\n", path, outPath)
    }
}
```
