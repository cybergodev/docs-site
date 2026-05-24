---
title: "Форматы вывода - HTML"
description: "Справочник API форматов вывода библиотеки CyberGo HTML, включая ExtractToMarkdown и ExtractToJSON в виде функций пакета и методов Processor, поддержка извлечения из байтов или файлов с конвертацией в Markdown или JSON, версии с контекстом и пользовательская сериализация MarshalJSON для Result, для различных сценариев форматированного вывода."
---

# Форматы вывода

Библиотека HTML поддерживает вывод результатов извлечения в форматах Markdown или JSON.

## Вывод в Markdown

Извлечение HTML-контента и конвертация в формат Markdown.

### Функции пакета

```go
func ExtractToMarkdown(htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFile(filePath string, cfg ...Config) (string, error)
func ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)
func ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) (string, error)
```

### Методы Processor

```go
func (p *Processor) ExtractToMarkdown(htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFile(filePath string) (string, error)
func (p *Processor) ExtractToMarkdownWithContext(ctx context.Context, htmlBytes []byte) (string, error)
func (p *Processor) ExtractToMarkdownFromFileWithContext(ctx context.Context, filePath string) (string, error)
```

### Пример

```go
cfg := html.MarkdownConfig()
md, err := html.ExtractToMarkdown(data, cfg)
if err != nil {
    log.Fatal(err)
}
fmt.Println(md)
```

## Вывод в JSON

Сериализация результата извлечения в байты JSON.

### Функции пакета

```go
func ExtractToJSON(htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFile(filePath string, cfg ...Config) ([]byte, error)
func ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)
func ExtractToJSONFromFileWithContext(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)
```

### Методы Processor

```go
func (p *Processor) ExtractToJSON(htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFile(filePath string) ([]byte, error)
func (p *Processor) ExtractToJSONWithContext(ctx context.Context, htmlBytes []byte) ([]byte, error)
func (p *Processor) ExtractToJSONFromFileWithContext(ctx context.Context, filePath string) ([]byte, error)
```

### Пример

```go
jsonBytes, err := html.ExtractToJSON(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(jsonBytes))
```

:::tip Result.MarshalJSON
`Result` реализует интерфейс `json.Marshaler`. Поля `ProcessingTime` и `ReadingTime` имеют тег `json:"-"` (стандартная сериализация их пропускает), но пользовательский метод `MarshalJSON()` включает их в вывод в виде миллисекунд.
:::
