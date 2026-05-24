---
title: "Пакетная обработка - HTML"
description: "Справочник API параллельной пакетной обработки библиотеки CyberGo HTML, включая семейство функций ExtractBatch и ExtractBatchFiles с версиями с контекстом, управление параллелизмом через WorkerPoolSize, максимум 10 000 элементов на пакет, BatchResult содержит счётчики успешных, неудачных и отменённых операций, подходит для массового параллельного извлечения HTML-контента."
---

# Пакетная обработка

Пакетное извлечение поддерживает параллельную обработку нескольких HTML-документов, максимум 10 000 элементов на пакет.

## Функции пакета

```go
func ExtractBatch(htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult
func ExtractBatchFiles(filePaths []string, cfg ...Config) *BatchResult
func ExtractBatchFilesWithContext(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult
```

## Методы Processor

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## BatchResult

```go
type BatchResult struct {
    Results   []*Result  // Успешные результаты извлечения
    Errors    []error    // Ошибки неудачных операций
    Success   int        // Количество успешных
    Failed    int        // Количество неудачных
    Cancelled int        // Количество отменённых из-за контекста
}
```

## Пример

```go
pages := [][]byte{page1, page2, page3}
batch := html.ExtractBatch(pages)

fmt.Printf("Успешно: %d, Неудачно: %d\n", batch.Success, batch.Failed)

for i, result := range batch.Results {
    fmt.Printf("Страница %d: %s\n", i, result.Title)
}

for i, err := range batch.Errors {
    if err != nil {
        fmt.Printf("Ошибка на странице %d: %v\n", i, err)
    }
}
```

:::warning Ограничение пакетной обработки
Максимум 10 000 элементов за один вызов, превышение вызовет ошибку.
:::
