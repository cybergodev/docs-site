---
sidebar_label: "JSONL"
title: "JSONL функции - CyberGo JSON | API"
description: "Функции JSONL CyberGo JSON: ParseJSONL/ToJSONL/ToJSONLString, StreamLinesInto[T], NewJSONLWriter и поля JSONL* в Config."
sidebar_position: 8
---

# Функции обработки JSONL

Пакет json предоставляет функции обработки JSONL (JSON Lines), поддерживающие парсинг, потоковое чтение, преобразование и запись данных JSON с разделением строками.

## Функции обработки JSONL

JSONL (JSON Lines) — формат с разделением строками, где каждая строка представляет отдельный JSON-объект.

### ParseJSONL

Сигнатура: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Парсит данные JSONL (JSON с разделением строками).

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `data` | `[]byte` | Да | Байтовые данные JSONL |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
    results, err := json.ParseJSONL([]byte(jsonl))
    if err != nil {
        panic(err)
    }
    for i, r := range results {
        fmt.Printf("[%d] %v\n", i, r)
    }
}
```

### StreamLinesInto

Сигнатура: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Потоково читает данные JSONL из io.Reader и обрабатывает каждую строку через функцию обратного вызова. Это рекомендуемый обобщённый способ обработки JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `reader` | `io.Reader` | Да | Источник данных |
| `fn` | `func(lineNum int, data T) error` | Да | Обратный вызов обработки (получает номер строки и данные) |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Возвращаемое значение**

| Тип | Описание |
|-----|----------|
| `[]T` | Срез всех обработанных результатов |
| `error` | Информация об ошибке |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
}

func main() {
    src := `{"name":"Alice"}
{"name":"Bob"}`

    // Базовое использование
    results, err := json.StreamLinesInto[User](strings.NewReader(src), func(lineNum int, user User) error {
        fmt.Printf("Строка %d: пользователь %s\n", lineNum, user.Name)
        return nil // Возврат ошибки прервет обработку
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Всего обработано %d записей\n", len(results))
}
```

### ToJSONL

Сигнатура: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Преобразует срез данных в формат JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `data` | `[]any` | Да | Срез данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonl, err := json.ToJSONL(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(jsonl))
    // {"name":"Alice"}
    // {"name":"Bob"}
}
```

### ToJSONLString

Сигнатура: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Преобразует срез данных в строку JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `data` | `[]any` | Да | Срез данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    items := []any{
        map[string]any{"name": "Alice"},
        map[string]any{"name": "Bob"},
    }
    jsonlStr, err := json.ToJSONLString(items)
    if err != nil {
        panic(err)
    }
    fmt.Println(jsonlStr)
}
```

## Конфигурация JSONL

::: warning
Отдельная структура JSONLConfig и функция `DefaultJSONLConfig()` удалены. Конфигурация JSONL теперь интегрирована в поля `JSONL*` структуры `Config`.
:::

### Конфигурация JSONL через Config

```go
cfg := json.DefaultConfig()

// Конфигурация JSONL
cfg.JSONLBufferSize    = 64 * 1024    // Размер буфера чтения (по умолчанию: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Максимальный размер одной строки (по умолчанию: 1MB)
cfg.JSONLSkipEmpty     = true         // Пропускать пустые строки (по умолчанию: true)
cfg.JSONLSkipComments  = false        // Пропускать строки с комментариями (по умолчанию: false)
cfg.JSONLContinueOnErr = false        // Продолжать при ошибке (по умолчанию: false)
cfg.JSONLWorkers       = 4            // Количество параллельных горутин (по умолчанию: 4)
cfg.JSONLChunkSize     = 1000         // Строк на пакет обработки (по умолчанию: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Максимальная память (по умолчанию: 100MB)

processor, err := json.New(cfg)
```

Подробнее см. [Конфигурация Config](../config#структура-config)

## JSONL-писатель

### NewJSONLWriter

Сигнатура: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Создаёт JSONL-писатель.

```go
package main

import (
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, err := os.Create("output.jsonl")
    if err != nil {
        panic(err)
    }
    defer file.Close()
    jw := json.NewJSONLWriter(file)
    jw.Write(map[string]any{"id": 1, "name": "Alice"})
    jw.Write(map[string]any{"id": 2, "name": "Bob"})
}
```

**Методы JSONLWriter**

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(data any) error` | Записать одну строку |
| `WriteAll` | `(data []any) error` | Записать несколько строк |
| `WriteRaw` | `(line []byte) error` | Записать сырую байтовую строку |
| `Err` | `() error` | Возвращает накопленную ошибку |
| `Stats` | `() JSONLStats` | Возвращает статистику записи |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## Связанные разделы

- [Функции файловых операций](./file-io) - Файловые операции LoadFromFile, SaveToFile и др.
- [Методы Processor JSONL](../processor/jsonl) - Подробное описание методов JSONL уровня Processor
- [Потоковая обработка](../../streaming/large-files) - Подробное описание потокового процессора
