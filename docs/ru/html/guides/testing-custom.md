---
title: "Тестирование и расширения - CyberGo HTML | руководство"
description: "Тестирование и расширения CyberGo HTML: свой Scorer, обход ContentNode, тестовый режим, mock-данные, mock Extractor и примеры кода для типичных сценариев."
---

# Тестирование и пользовательские расширения

Это руководство описывает, как настроить алгоритм скоринга контента и писать тесты для кода, использующего библиотеку HTML.

## Пользовательский Scorer

Интерфейс `Scorer` управляет двумя ключевыми решениями: как распознать основной контент и какие узлы следует удалить.

### Определение интерфейса

```go
type Scorer interface {
    Score(node ContentNode) int
    ShouldRemove(node ContentNode) bool
}
```

- `Score`: оценка узла, чем выше балл, тем вероятнее, что узел будет выбран как контейнер основного контента
- `ShouldRemove`: возврат `true` означает удаление узла перед извлечением

### Поведение по умолчанию

Если `Scorer` не настроен, используется встроенный скорер по умолчанию. Он вычисляет оценку на основе характеристик узла (плотность текста, пропорция абзацев, семантика тегов и т.д.).

### Реализация пользовательского Scorer

```go
package main

import (
    "fmt"
    "log"
    "strings"

    "github.com/cybergodev/html"
)

// blogScorer — скорер, оптимизированный для блогов
type blogScorer struct{}

func (s blogScorer) Score(node html.ContentNode) int {
    if node == nil {
        return 0
    }

    score := 0
    class := strings.ToLower(node.AttrValue("class"))
    id := strings.ToLower(node.AttrValue("id"))
    tag := node.Data()

    // Позитивные сигналы: классы/id, связанные со статьёй
    if containsAny(class, "article", "post", "content", "entry") {
        score += 50
    }
    if containsAny(id, "article", "post", "content") {
        score += 60
    }

    // Бонус за семантические теги
    switch tag {
    case "article":
        score += 80
    case "main":
        score += 70
    case "section":
        score += 30
    }

    // Негативные сигналы
    if containsAny(class, "sidebar", "comment", "footer", "nav", "menu") {
        score -= 50
    }
    if containsAny(id, "sidebar", "comments", "footer") {
        score -= 60
    }

    return score
}

func (s blogScorer) ShouldRemove(node html.ContentNode) bool {
    if node == nil {
        return false
    }

    // Удаление навигации и подвала
    switch node.Data() {
    case "nav", "footer", "header":
        return true
    }

    // Удаление рекламы и области комментариев
    class := strings.ToLower(node.AttrValue("class"))
    return containsAny(class, "ad", "advertisement", "comment", "social-share")
}

func containsAny(s string, keywords ...string) bool {
    for _, kw := range keywords {
        if strings.Contains(s, kw) {
            return true
        }
    }
    return false
}

func main() {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}

    p, err := html.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer p.Close()

    data := []byte(`<html><body>
        <article class="post"><h1>Тестовая статья</h1><p>Основной контент</p></article>
    </body></html>`)

    result, err := p.Extract(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(result.Text)
}
```

## Интерфейс ContentNode

`ContentNode` — это абстракция узла, используемая в интерфейсе `Scorer`, скрывающая конкретные типы базового HTML-парсера:

```go
type ContentNode interface {
    Type() string                        // "element", "text", "comment" и др.
    Data() string                        // Имя тега или текстовое содержимое
    AttrValue(key string) string         // Получение значения атрибута
    Attrs() []NodeAttr                   // Получение всех атрибутов
    FirstChild() ContentNode             // Первый дочерний узел
    NextSibling() ContentNode            // Следующий родственный узел
    Parent() ContentNode                 // Родительский узел
}
```

### Обход узлов

```go
func (s myScorer) Score(root html.ContentNode) int {
    score := 0
    // Обход дочерних узлов
    for child := root.FirstChild(); child != nil; child = child.NextSibling() {
        if child.Type() == "element" {
            // Проверка плотности вложенного текста
            textLen := countTextLength(child)
            if textLen > 200 {
                score += 10
            }
        }
    }
    return score
}
```

## Режим тестирования

### Отключение кэша

В тестах кэш обычно не нужен, после отключения каждый вызов будет «чистым»:

```go
cfg := html.DefaultConfig()
cfg.MaxCacheEntries = 0 // Отключить кэш
```

### Отключение очистки

Для доверенного ввода можно отключить очистку безопасности, чтобы тестовый HTML не изменялся:

```go
cfg := html.DefaultConfig()
cfg.EnableSanitization = false
```

:::warning Только для тестирования
В производственной среде обязательно сохраняйте `EnableSanitization = true`.
:::

### Использование TextOnlyConfig

При тестировании логики извлечения текста используйте `TextOnlyConfig` для уменьшения шума:

```go
result, err := html.Extract(data, html.TextOnlyConfig())
```

## Написание тестов

### Тестирование результата извлечения

```go
func TestExtractTitle(t *testing.T) {
    data := []byte(`<html><head><title>Тестовый заголовок</title></head>
        <body><p>Основной контент</p></body></html>`)

    result, err := html.Extract(data)
    require.NoError(t, err)
    assert.Equal(t, "Тестовый заголовок", result.Title)
    assert.Contains(t, result.Text, "Основной контент")
}
```

### Тестирование пользовательского Scorer

```go
func TestBlogScorer(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Scorer = blogScorer{}
    cfg.MaxCacheEntries = 0 // Отключить кэш

    p, err := html.New(cfg)
    require.NoError(t, err)
    defer p.Close()

    data := []byte(`<html><body>
        <nav><a href="/">Главная</a></nav>
        <article class="post">
            <h1>Заголовок блога</h1>
            <p>Основной текст блога</p>
        </article>
        <aside class="sidebar">Боковая панель</aside>
    </body></html>`)

    result, err := p.Extract(data)
    require.NoError(t, err)
    assert.Contains(t, result.Text, "Основной текст блога")
    assert.NotContains(t, result.Text, "Боковая панель")
    assert.NotContains(t, result.Text, "Главная")
}
```

### Тестирование обработки ошибок

```go
func TestInputTooLarge(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.MaxInputSize = 100 // Экстремально малый лимит

    largeData := make([]byte, 200)
    _, err := html.Extract(largeData, cfg)

    assert.ErrorIs(t, err, html.ErrInputTooLarge)
}
```

### Тестирование журнала аудита

```go
func TestAuditLog(t *testing.T) {
    cfg := html.DefaultConfig()
    cfg.Audit = html.DefaultAuditConfig()
    cfg.Audit.Enabled = true
    cfg.MaxCacheEntries = 0

    p, _ := html.New(cfg)
    defer p.Close()

    data := []byte(`<html><body><script>alert(1)</script><p>Текст</p></body></html>`)
    p.Extract(data)

    entries := p.GetAuditLog()
    t.Logf("Событий аудита: %d", len(entries))
    for _, e := range entries {
        t.Logf("  [%s] %s", e.EventType, e.Message)
    }
}
```

## Распространённые сценарии расширения

### Настройка извлечения для конкретного сайта

```go
func newSiteScorer(site string) html.Scorer {
    switch site {
    case "github.com":
        return githubScorer{}
    case "medium.com":
        return mediumScorer{}
    default:
        return nil // Использовать скорер по умолчанию
    }
}
```

### Статистика распределения атрибутов узлов

```go
func analyzeStructure(node html.ContentNode) map[string]int {
    counts := make(map[string]int)
    walk(node, counts)
    return counts
}

func walk(node html.ContentNode, counts map[string]int) {
    if node == nil {
        return
    }
    if node.Type() == "element" {
        counts[node.Data()]++
    }
    walk(node.FirstChild(), counts)
    walk(node.NextSibling(), counts)
}
```

## Следующие шаги

- [Справочник API: Интерфейсы](../api-reference/interfaces) - Полные определения Scorer и ContentNode
- [Справочник API: Конфигурация](../api-reference/config) - Поле конфигурации Scorer
- [FAQ](../faq) - Часто задаваемые вопросы
