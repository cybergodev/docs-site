---
sidebar_label: "Форматы вывода"
title: "Форматы вывода - CyberGo html | Markdown и JSON"
description: "API форматов вывода CyberGo html: ExtractToMarkdown и ExtractToJSON — функции пакета и методы Processor для преобразования в Markdown/JSON."
sidebar_position: 1
---

# Форматы вывода

Библиотека HTML поддерживает вывод результатов извлечения в форматах Markdown или JSON.

## Вывод в Markdown

Извлечение HTML-контента и конвертация в формат Markdown. Этот метод использует временный Processor с отключённым кэшем; он не читает и не пишет кэш основного Processor.

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

Сериализация результата извлечения в байты JSON. Этот метод проходит через обычный Extract основного Processor (при включённом кэше — попадание/запись), затем сериализуется в JSON.

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
