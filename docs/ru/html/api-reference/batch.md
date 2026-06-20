---
title: "Пакетная обработка - HTML"
description: "Справочник API параллельного пакетного извлечения CyberGo HTML: охватывает семейства ExtractBatch и ExtractBatchFiles и их контекстные версии, с управлением параллелизмом WorkerPoolSize, до 10000 элементов на пакет, и BatchResult со счётчиками успеха, ошибки и отмены — для крупномасштабного параллельного извлечения HTML."
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
    Results   []*Result  // результат для каждого элемента ввода, индексируется по порядку ввода; nil при ошибке или отмене
    Errors    []error    // ошибка для каждого элемента ввода; индекс соответствует Results один к одному
    Success   int        // количество успешных
    Failed    int        // количество неудачных
    Cancelled int        // количество элементов, оставшихся необработанными из-за отмены контекста
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
