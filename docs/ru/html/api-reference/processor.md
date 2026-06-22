---
title: "Processor - CyberGo HTML | ядро обработки"
description: "API Processor CyberGo HTML: New, семейство Extract, GetStatistics, GetAuditLog, ClearCache, Close — управление жизненным циклом для частого переиспользования."
---

# Processor

`Processor` — это основной движок обработки библиотеки HTML. По сравнению с функциями пакета Processor повторно использует внутренние ресурсы (кэш, детекторы кодировок), что подходит для высокочастотных вызовов.

## Создание

### New

Создание экземпляра Processor с необязательной передачей конфигурации.

```go
func New(cfg ...Config) (*Processor, error)
```

**Параметры**: максимум один `Config`, при отсутствии используется `DefaultConfig()`.

```go
p, err := html.New(html.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## Извлечение контента

### Extract

```go
func (p *Processor) Extract(htmlBytes []byte) (*Result, error)
```

Извлечение контента из байтов HTML с автоматическим определением кодировки.

### ExtractFromFile

```go
func (p *Processor) ExtractFromFile(filePath string) (*Result, error)
```

Извлечение контента из файла.

### ExtractText

```go
func (p *Processor) ExtractText(htmlBytes []byte) (string, error)
```

Возврат только текста.

### ExtractTextFromFile

```go
func (p *Processor) ExtractTextFromFile(filePath string) (string, error)
```

Извлечение текста из файла.

## Версии с контекстом

Все методы извлечения имеют версии с `WithContext`:

```go
func (p *Processor) ExtractWithContext(ctx context.Context, htmlBytes []byte) (*Result, error)
func (p *Processor) ExtractFromFileWithContext(ctx context.Context, filePath string) (*Result, error)
func (p *Processor) ExtractTextWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractTextFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

## Форматы вывода

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
```

Версии с контекстом:

```go
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

## Извлечение ссылок

```go
func (p *Processor) ExtractAllLinks(htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFile(filePath string) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksWithContext(ctx context.Context, htmlBytes []byte) ([]LinkResource, error)
func (p *Processor) ExtractAllLinksFromFileWithContext(ctx context.Context, filePath string) ([]LinkResource, error)
```

## Пакетная обработка

```go
func (p *Processor) ExtractBatch(htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchWithContext(ctx context.Context, htmlContents [][]byte) *BatchResult
func (p *Processor) ExtractBatchFiles(filePaths []string) *BatchResult
func (p *Processor) ExtractBatchFilesWithContext(ctx context.Context, filePaths []string) *BatchResult
```

## Статистика и кэш

### GetStatistics

Возврат текущей статистики обработки.

```go
func (p *Processor) GetStatistics() Statistics
```

```go
stats := p.GetStatistics()
fmt.Printf("Обработано: %d, Попаданий в кэш: %d\n",
    stats.TotalProcessed, stats.CacheHits)
```

### ClearCache

Очистка кэша с сохранением накопленной статистики.

```go
func (p *Processor) ClearCache()
```

### ResetStatistics

Сброс всех счётчиков статистики.

```go
func (p *Processor) ResetStatistics()
```

## Аудит

### GetAuditLog

Получение записей журнала аудита.

```go
func (p *Processor) GetAuditLog() []AuditEntry
```

### ClearAuditLog

Очистка журнала аудита.

```go
func (p *Processor) ClearAuditLog()
```

## Жизненный цикл

### Close

Освобождение ресурсов, удерживаемых Processor. Необходимо вызывать после завершения использования.

```go
func (p *Processor) Close() error
```

```go
p, _ := html.New(cfg)
defer p.Close()
// ... использование p для извлечения
```
