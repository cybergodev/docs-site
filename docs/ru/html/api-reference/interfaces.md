---
title: "Интерфейсы - CyberGo HTML | ключевые интерфейсы"
description: "Ключевые интерфейсы CyberGo HTML: Extractor, StatsProvider, ContentNode, Scorer и AuditSink — для расширения, тестирования и понимания архитектуры."
---

# Определение интерфейсов

Библиотека HTML определяет следующие ключевые интерфейсы:

## Extractor

Основной интерфейс извлечения HTML-контента, `Processor` реализует этот интерфейс.

```go
type Extractor interface {
    // Основное извлечение
    Extract(htmlBytes []byte) (*Result, error)
    ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
    ExtractFromFile(filePath string) (*Result, error)
    ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)

    // Извлечение текста
    ExtractText(htmlBytes []byte) (string, error)
    ExtractTextFromFile(filePath string) (string, error)
    ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)

    // Форматированный вывод
    ExtractToMarkdown(htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFile(filePath string) (string, error)
    ExtractToJSON(htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFile(filePath string) ([]byte, error)
    ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
    ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
    ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
    ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)

    // Пакетная обработка
    ExtractBatch(htmlContents [][]byte) *BatchResult
    ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
    ExtractBatchFiles(filePaths []string) *BatchResult
    ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult

    // Извлечение ссылок
    ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
    ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
    ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)

    // Жизненный цикл
    Close() error
}
```

## StatsProvider

Интерфейс управления статистикой и кэшем.

```go
type StatsProvider interface {
    GetStatistics() Statistics
    ClearCache()
    ResetStatistics()
}
```

## ContentNode

Интерфейс абстракции HTML-узла для алгоритмов скоринга контента.

```go
type ContentNode interface {
    Type() string                    // Тип узла ("element", "text", "comment" и др.)
    Data() string                    // Имя тега или текстовое содержимое
    AttrValue(key string) string     // Значение атрибута
    Attrs() []NodeAttr               // Все атрибуты
    FirstChild() ContentNode         // Первый дочерний узел
    NextSibling() ContentNode        // Следующий родственный узел
    Parent() ContentNode             // Родительский узел
}
```

## Scorer

Интерфейс алгоритма скоринга контента для пользовательской стратегии распознавания статей.

```go
type Scorer interface {
    Score(node ContentNode) int          // Вычисление оценки релевантности узла
    ShouldRemove(node ContentNode) bool  // Определение, следует ли удалить узел
}
```

Внедрение пользовательского скорера через поле `Config.Scorer`:

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

## AuditSink

Интерфейс вывода журнала аудита.

```go
type AuditSink interface {
    Write(entry AuditEntry)
    Close() error
}
```

Встроенные реализации Sink описаны в [Система аудита](./audit).
