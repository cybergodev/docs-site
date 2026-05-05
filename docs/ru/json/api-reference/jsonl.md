---
title: "Обработчик JSONL - CyberGo JSON | Справочник API"
description: "Справочник обработчика JSONL/NDJSON CyberGo JSON: включая потоковую обработку StreamJSONL, запись JSONLWriter, обобщённый поток StreamLinesInto[T], парсинг ParseJSONL, преобразование ToJSONL и параметры конфигурации с полной поддержкой чтения и записи формата JSON Lines."
---

# Обработчик JSONL

JSONL (JSON Lines) или NDJSON (Newline Delimited JSON) — это формат, в котором каждая строка содержит один JSON-объект. Данная библиотека предоставляет полную функциональность обработки JSONL через методы `Processor` и функции уровня пакета.

## Спецификация формата

```json
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
{"id":3,"name":"Charlie"}
```

- Каждая строка является корректным JSON-значением
- Строки разделены символом `\n`
- Последняя строка может как иметь, так и не иметь символ перевода строки

---

## Методы JSONL процессора

Функциональность обработки JSONL предоставляется через методы `Processor`.

### StreamJSONL

Сигнатура: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Потоковая обработка данных JSONL, возвращает `IterableValue` для каждой строки.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных |
| `fn` | `func(lineNum int, item *IterableValue) error` | Callback обработки |

**Возвращаемые значения callback'а**

| Возвращаемое значение | Описание |
|--------|------|
| `nil` | Продолжить обработку следующей строки |
| `item.Break()` | Остановить итерацию без возврата ошибки |
| Другой `error` | Остановить итерацию и вернуть ошибку |

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

Параллельная обработка данных JSONL с использованием паттерна пула воркеров.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных |
| `workers` | `int` | Количество горутин-воркеров (при <=0 по умолчанию 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Callback обработки |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

err = p.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    // Интенсивная обработка на процессоре
    return processItem(item)
})
```

::: tip Совет по производительности
Для операций, интенсивно использующих процессор (например, преобразование данных, вычисления), использование параллельной обработки может значительно повысить производительность. Для операций, интенсивно использующих ввод-вывод, рекомендуется однопоточная обработка.
:::

### StreamJSONLChunked

Сигнатура: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

Побатчевая обработка данных JSONL, каждый раз обрабатывается указанное количество элементов.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// По 1000 записей в пакете
err = p.StreamJSONLChunked(file, 1000, func(chunk []*json.IterableValue) error {
    // Пакетная запись в базу данных
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### StreamJSONLFile

Сигнатура: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Прямая обработка JSONL-файла.

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

Преобразование данных JSONL в новый формат.

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

Агрегация данных JSONL в единый результат.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Вычисление суммы возрастов
totalAge, err := p.ReduceJSONL(file, 0, func(acc any, item *json.IterableValue) any {
    return acc.(int) + item.GetInt("age")
})
```

### FilterJSONL

Сигнатура: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

Фильтрация данных JSONL, возвращает элементы, удовлетворяющие условию.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Фильтрация совершеннолетних
adults, err := p.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetInt("age") >= 18
})
```

### CollectJSONL

Сигнатура: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

Сбор всех элементов JSONL в срез.

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
cfg.JSONLBufferSize = 128 * 1024    // Размер буфера (по умолчанию 64 КБ)
cfg.JSONLMaxLineSize = 2 * 1024 * 1024  // Максимальный размер строки (по умолчанию 1 МБ)
cfg.JSONLSkipEmpty = true           // Пропускать пустые строки (по умолчанию true)
cfg.JSONLSkipComments = true        // Пропускать строки с комментариями (по умолчанию false)
cfg.JSONLContinueOnErr = true       // Продолжать при ошибке парсинга (по умолчанию false)
cfg.JSONLWorkers = 8                // Количество параллельных воркеров (по умолчанию 4)
cfg.JSONLChunkSize = 500            // Размер блока (по умолчанию 1000)
cfg.JSONLMaxMemory = 200 * 1024 * 1024 // Максимальная память (по умолчанию 100 МБ)

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

---

## JSONLWriter

Writer для записи данных в формате JSON Lines.

### NewJSONLWriter

Сигнатура: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Создание writer'а JSONL. Поддерживает необязательный параметр конфигурации.

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

Запись одного JSON-значения как строки.

```go
err := writer.Write(map[string]any{
    "id":   1,
    "name": "Alice",
})
```

### WriteAll

Сигнатура: `func (w *JSONLWriter) WriteAll(data []any) error`

Запись нескольких JSON-значений, каждое как отдельная строка.

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

Запись сырой JSON-строки (без JSON-кодирования).

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

Получение статистики записи.

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

Специализированный обработчик NDJSON-файлов для типа `map[string]any`.

### NewNDJSONProcessor

Сигнатура: `func NewNDJSONProcessor(cfg ...Config) *NDJSONProcessor`

Создание обработчика NDJSON. Поддерживает необязательный параметр конфигурации.

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

Обработка NDJSON-файла.

```go
err := np.ProcessFile("data.ndjson", func(lineNum int, obj map[string]any) error {
    fmt.Printf("[%d] ID: %v\n", lineNum, obj["id"])
    return nil
})
```

### ProcessReader

Сигнатура: `func (np *NDJSONProcessor) ProcessReader(reader io.Reader, fn func(lineNum int, obj map[string]any) error) error`

Обработка NDJSON из Reader'а.

```go
err := np.ProcessReader(file, func(lineNum int, obj map[string]any) error {
    return nil
})
```

---

## Функции уровня пакета

### StreamJSONLFile

Сигнатура: `func StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Функция уровня пакета для потоковой обработки JSONL-данных напрямую из файла без создания Processor.

```go
err := json.StreamJSONLFile("data.jsonl", func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Строка %d: %v\n", lineNum, item.GetData())
    return nil
})
```

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

Парсинг среза байт JSONL.

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}`
results, err := json.ParseJSONL([]byte(jsonl))
```

### ToJSONL

Сигнатура: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Преобразование в срез байт JSONL.

```go
items := []any{
    map[string]any{"id": 1},
    map[string]any{"id": 2},
}
jsonl, err := json.ToJSONL(items)
```

### ToJSONLString

Сигнатура: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Преобразование в строку JSONL.

```go
jsonlStr, err := json.ToJSONLString(items)
```

---

## Полные примеры

### Чтение большого JSONL-файла

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

### Запись JSONL-файла

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

### Параллельная обработка большого файла

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
