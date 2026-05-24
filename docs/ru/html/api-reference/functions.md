---
title: "Функции пакета - HTML"
description: "Полный справочник API функций уровня пакета библиотеки CyberGo HTML, включая Extract, ExtractFromFile, ExtractText, ExtractFromFileWithContext и другие функции извлечения контента с версиями с контекстом, внутренне использующие sync.Pool для повторного использования экземпляров Processor, подходящие для простых случаев и быстрой интеграции."
---

# Функции пакета

Функции уровня пакета подходят для однократных вызовов, внутри используют `sync.Pool` для повторного использования Processor, не требуют ручного управления жизненным циклом.

## Извлечение контента

### Extract

Извлечение контента из байтов HTML с возвратом полного `Result`.

```go
func Extract(htmlBytes []byte, cfg ...Config) (*Result, error)
```

**Параметры**:

| Параметр | Тип | Описание |
|------|------|------|
| `htmlBytes` | `[]byte` | Содержимое HTML |
| `cfg` | `...Config` | Необязательная конфигурация, максимум одна |

**Пример**:

```go
result, err := html.Extract(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(result.Title, result.Text)
```

### ExtractFromFile

Извлечение контента из HTML-файла.

```go
func ExtractFromFile(filePath string, cfg ...Config) (*Result, error)
```

## Извлечение текста

### ExtractText

Извлечение только текстового содержимого.

```go
func ExtractText(htmlBytes []byte, cfg ...Config) (string, error)
```

### ExtractTextFromFile

Извлечение текста из файла.

```go
func ExtractTextFromFile(filePath string, cfg ...Config) (string, error)
```

## Версии с контекстом

Все функции поддерживают версии с `context.Context` для отмены и управления тайм-аутом:

| Функция | Сигнатура |
|------|------|
| `ExtractWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (*Result, error)` |
| `ExtractFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (*Result, error)` |
| `ExtractTextWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` |
| `ExtractTextFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` |

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

result, err := html.ExtractWithContext(ctx, data)
```

## Форматы вывода

| Функция | Сигнатура | Описание |
|------|------|------|
| `ExtractToMarkdown` | `(htmlBytes []byte, cfg ...Config) (string, error)` | HTML → Markdown |
| `ExtractToMarkdownFromFile` | `(filePath string, cfg ...Config) (string, error)` | Файл → Markdown |
| `ExtractToMarkdownWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) (string, error)` | С контекстом |
| `ExtractToMarkdownFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) (string, error)` | Файл + контекст |
| `ExtractToJSON` | `(htmlBytes []byte, cfg ...Config) ([]byte, error)` | HTML → JSON |
| `ExtractToJSONFromFile` | `(filePath string, cfg ...Config) ([]byte, error)` | Файл → JSON |
| `ExtractToJSONWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]byte, error)` | С контекстом |
| `ExtractToJSONFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]byte, error)` | Файл + контекст |

Подробное использование и примеры в [Форматы вывода](./output).

## Извлечение ссылок

| Функция | Сигнатура | Описание |
|------|------|------|
| `ExtractAllLinks` | `(htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | Извлечение всех ссылок |
| `ExtractAllLinksFromFile` | `(filePath string, cfg ...Config) ([]LinkResource, error)` | Извлечение ссылок из файла |
| `ExtractAllLinksWithContext` | `(ctx context.Context, htmlBytes []byte, cfg ...Config) ([]LinkResource, error)` | С контекстом |
| `ExtractAllLinksFromFileWithContext` | `(ctx context.Context, filePath string, cfg ...Config) ([]LinkResource, error)` | Файл + контекст |

Подробное использование и примеры в [Извлечение ссылок](./links).

## Пакетная обработка

| Функция | Сигнатура | Описание |
|------|------|------|
| `ExtractBatch` | `(htmlContents [][]byte, cfg ...Config) *BatchResult` | Пакетное извлечение |
| `ExtractBatchWithContext` | `(ctx context.Context, htmlContents [][]byte, cfg ...Config) *BatchResult` | С контекстом |
| `ExtractBatchFiles` | `(filePaths []string, cfg ...Config) *BatchResult` | Пакетное извлечение из файлов |
| `ExtractBatchFilesWithContext` | `(ctx context.Context, filePaths []string, cfg ...Config) *BatchResult` | Файлы + контекст |

Подробное использование и примеры в [Пакетная обработка](./batch).
