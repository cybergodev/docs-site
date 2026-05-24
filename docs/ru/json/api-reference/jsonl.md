---
title: "Обработчик JSONL - CyberGo JSON | Справочник API"
description: "Справочник обработчика JSONL CyberGo JSON: StreamJSONL потоковая обработка, JSONLWriter запись, StreamLinesInto[T] обобщённые потоки, ParseJSONL разбор, ToJSONL преобразование и параметры конфигурации для чтения и записи JSON Lines."
---

# Обработчик JSONL

JSONL (JSON Lines) или NDJSON (Newline Delimited JSON) — это формат, в котором каждая строка содержит один объект JSON. Библиотека предоставляет полный набор инструментов для работы с JSONL через методы `Processor` и функции уровня пакета.

## Спецификация формата

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- Каждая строка является допустимым JSON значением
- Строки разделены `\n`
- Последняя строка может содержать или не содержать символ новой строки

---

## Методы Processor для JSONL

Функциональность JSONL предоставляется через методы `Processor`.

### StreamJSONL

Сигнатура: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Потоковая обработка данных JSONL, возвращает `IterableValue` для каждой строки.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных |
| `fn` | `func(lineNum int, item *IterableValue) error` | Обратный вызов обработки |

**Возвращаемые значения обратного вызова**

| Возвращаемое значение | Описание |
|--------|------|
| `nil` | Продолжить обработку следующей строки |
| `item.Break()` | Остановить итерацию без ошибки |
| другое `error` | Остановить итерацию и вернуть ошибку |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("Строка %d: name=%s, age=%d\n", lineNum, name, age)
    return nil // Продолжить обработку
    // return item.Break() // Остановить итерацию
})
```

### StreamJSONLParallel

Сигнатура: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Параллельная обработка данных JSONL с использованием пула воркеров.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных |
| `workers` | `int` | Количество рабочих горутин (при <=0 по умолчанию 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Обратный вызов обработки |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // Интенсивная обработка на CPU
    return processItem(item)
})
```

::: tip Совет по производительности
Для CPU-интенсивных операций (таких как преобразование данных, вычисления) параллельная обработка может значительно повысить производительность. Для I/O-интенсивных операций рекомендуется однопоточная обработка.
:::

### StreamJSONLParallelWithContext

Сигнатура: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Параллельная обработка данных JSONL с контекстом. Поддерживает таймаут и отмену операции.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `ctx` | `context.Context` | Контекст для отмены и таймаута |
| `reader` | `io.Reader` | Источник данных |
| `workers` | `int` | Количество рабочих горутин (при <=0 по умолчанию 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Обратный вызов обработки |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err = p.StreamJSONLParallelWithContext(ctx, file, 8, func(lineNum int, item *json.IterableValue) error {
    // Параллельная обработка с поддержкой отмены
    return processItem(item)
})
```

### StreamJSONLChunked

Сигнатура: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

Пакетная обработка данных JSONL, обработка указанного количества элементов за раз.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// По 1000 записей в пакете
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // Массовая запись в базу данных
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### StreamJSONLFile

Сигнатура: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Прямая обработка файла JSONL.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Строка %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

## Расширенные операции JSONL

### MapJSONL

Сигнатура: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

Преобразует данные JSONL в новый формат.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

result, err := p.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return map[string]any{
        "name": item.GetString("name"),
        "age":  item.GetInt("age"),
    }, nil
})
```

### ReduceJSONL

Сигнатура: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

Агрегирует данные JSONL в единый результат.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Подсчёт суммы возрастов
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

Сигнатура: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

Фильтрует данные JSONL, возвращает элементы, удовлетворяющие условию.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Фильтрация взрослых
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

Сигнатура: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

Собирает все элементы JSONL в срез.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

items, err := p.CollectJSONL(file)
for _, item := range items {
    fmt.Println(item.GetString("name"))
}
```

### FirstJSONL

Сигнатура: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

Возвращает первый элемент, удовлетворяющий условию.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

user, found, err := p.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("name") == "Alice"
})
if found {
    fmt.Println("Найден:", user.GetString("name"))
}
```

### ForeachJSONL

Сигнатура: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Итерация по данным JSONL (псевдоним для StreamJSONL).

---

## Конфигурация JSONL

Конфигурация JSONL интегрирована в структуру `Config`:

```go
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024    // Размер буфера (по умолчанию 64КБ)
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // Максимальный размер строки (по умолчанию 1МБ)
cfg.JSONLSkipEmpty = true           // Пропускать пустые строки (по умолчанию true)
cfg.JSONLSkipComments = true        // Пропускать строки с комментариями (по умолчанию false)
cfg.JSONLContinueOnErr = true       // Продолжать при ошибке парсинга (по умолчанию false)
cfg.JSONLWorkers = 8                // Количество параллельных обработчиков (по умолчанию 4)
cfg.JSONLChunkSize = 500            // Размер чанка (по умолчанию 1000)
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // Максимальная память (по умолчанию 100МБ)

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

---

## JSONLWriter

Модуль записи JSONL используется для записи данных в формате JSON Lines.

### NewJSONLWriter

Сигнатура: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Создаёт модуль записи JSONL. Поддерживает необязательный параметр конфигурации.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()

// С конфигурацией по умолчанию
writer := json.NewJSONLWriter(file)

// С пользовательской конфигурацией
cfg := json.DefaultConfig()
cfg.EscapeHTML = true
writer = json.NewJSONLWriter(file, cfg)
```

### Write

Сигнатура: `func (w *JSONLWriter) Write(data any) error`

Записывает одно JSON значение как строку.

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

### WriteAll

Сигнатура: `func (w *JSONLWriter) WriteAll(data []any) error`

Записывает несколько JSON значений, каждое как отдельную строку.

```go
items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
    map[string]any{"id": 3, "name": "Charlie"},
}

err := writer.WriteAll(items)
```

### WriteRaw

Сигнатура: `func (w *JSONLWriter) WriteRaw(line []byte) error`

Записывает сырую строку JSON (без JSON кодирования).

```go
err := writer.WriteRaw([]byte(`{"id":1,"name":"raw"}`))
```

### Err

Сигнатура: `func (w *JSONLWriter) Err() error`

Возвращает ошибку, возникшую в процессе записи.

```go
if err := writer.Err(); err != nil {
    fmt.Printf("Ошибка записи: %v\n", err)
}
```

### Stats

Сигнатура: `func (w *JSONLWriter) Stats() JSONLStats`

Получает статистику записи.

```go
stats := writer.Stats()
fmt.Printf("Записано %d строк, %d байт\n", stats.LinesProcessed, stats.BytesWritten)
```

**Структура JSONLStats**:

```go
type JSONLStats struct {
    LinesProcessed int64 // Количество обработанных строк
    BytesWritten   int64 // Количество записанных байт
}
```

---

## NDJSONProcessor

Специализированный обработчик файлов NDJSON для работы с типом `map[string]any`.

### NewNDJSONProcessor

Сигнатура: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

Создаёт обработчик NDJSON. Поддерживает необязательный параметр конфигурации.

```go
// С конфигурацией по умолчанию
np := json.NewNDJSONProcessor()

// С пользовательской конфигурацией
cfg := json.DefaultConfig()
cfg.JSONLBufferSize = 128 * 1024
np = json.NewNDJSONProcessor(cfg)
```

### ProcessFile

Сигнатура: `func (np *NDJSONProcessor) ProcessFile(filename string, fn func(lineNum int, obj map[string]any) error) error`

Обрабатывает файл NDJSON.

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

Сигнатура: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

Обрабатывает NDJSON из Reader.

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## Функции уровня пакета

::: warning Примечание
`StreamJSONLFile` — это метод Processor, а не функция уровня пакета. Перед использованием необходимо создать экземпляр Processor:

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Строка %d: %v\n", lineNum, item.GetData())
    return nil
})
```

Подробнее в разделе [Методы Processor JSONL](./processor/jsonl#streamjsonlfile).
:::

### StreamLinesInto[T]

Сигнатура: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Потоковое чтение JSONL с построчной обработкой.

```go
type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// С конфигурацией по умолчанию
entries, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Обработка: %s\n", user.Name)
    return nil
})

// С пользовательской конфигурацией
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true
entries, err = json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
}, cfg)
```

### ParseJSONL

Сигнатура: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Разбирает срез байтов JSONL.

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

Сигнатура: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Преобразует в срез байтов JSONL.

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

Сигнатура: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Преобразует в строку JSONL.

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## Полные примеры

### Чтение большого файла JSONL

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

type LogEntry struct {
    Time    string `json:"time"`
    Level   string `json:"level"`
    Message string `json:"message"`
}

func main() {
    file, _ := os.Open("logs.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    count := 0
    err = p.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        count++
        if item.GetString("level") == "error" {
            fmt.Printf("Ошибка: %s\n", item.GetString("message"))
        }
        return nil
    })

    if err != nil {
        fmt.Printf("Ошибка: %v\n", err)
    }

    fmt.Printf("Всего обработано %d строк\n", count)
}
```

### Запись файла JSONL

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Create("output.jsonl")
    defer file.Close()

    writer := json.NewJSONLWriter(file)

    for i := 0; i < 10; i++ {
        writer.Write(map[string]any{
            "id":    i,
            "value": fmt.Sprintf("item-%d", i),
        })
    }

    stats := writer.Stats()
    fmt.Printf("Записано %d байт\n", stats.BytesWritten)
}
```

### Параллельная обработка больших файлов

```go
package main

import (
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    file, _ := os.Open("large.jsonl")
    defer file.Close()

    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    var count int64
    err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
        atomic.AddInt64(&count, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Параллельно обработано %d строк\n", count)
}
```

---

## Смотрите также

- [API обработки больших файлов](./large-file) - Серия методов ForeachFile
- [Руководство по обработке больших файлов](../large-files) - Руководство по обработке больших файлов
- [Итераторы](./iterator) - API итеративного обхода
