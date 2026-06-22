---
title: "Processor - Методы JSONL - CyberGo JSON | Справочник API"
description: "Методы JSONL процессора CyberGo JSON: StreamJSONL, ForeachJSONL, MapJSONL, ReduceJSONL и FilterJSONL для потоковой обработки данных."
---

# Методы Processor JSONL

Processor предоставляет полный набор возможностей потоковой обработки JSONL (JSON Lines), включая построчную обработку, параллельную обработку, пакетную обработку и функциональные операции.

## Методы потокового чтения

### StreamJSONL

Сигнатура: `func (p *Processor) StreamJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Потоковая обработка данных JSONL, построчное чтение с вызовом функции callback.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных JSONL |
| `fn` | `func(lineNum int, item *IterableValue) error` | Функция обработки, возврат ошибки остановит обработку |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
    level := item.GetString("level")
    msg := item.GetString("message")
    fmt.Printf("[%d] %s: %s\n", lineNum, level, msg)
    return nil
})
```

---

### StreamJSONLParallel

Сигнатура: `func (p *Processor) StreamJSONLParallel(reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Параллельная обработка данных JSONL с использованием нескольких рабочих горутин для ускорения.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных JSONL |
| `workers` | `int` | Количество рабочих горутин (при <=0 по умолчанию 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Функция обработки |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("large.jsonl")
defer file.Close()

var count int64
err := processor.StreamJSONLParallel(file, 8, func(lineNum int, item *json.IterableValue) error {
    atomic.AddInt64(&count, 1)
    // Интенсивная обработка CPU...
    return nil
})
fmt.Printf("Обработано %d строк\n", count)
```

::: tip Рекомендации по производительности
- Подходит для операций, интенсивно использующих CPU (преобразование данных, вычисления)
- Для операций, интенсивно использующих I/O, рекомендуется однопоточный `StreamJSONL`
- Количество workers рекомендуется устанавливать равным количеству ядер CPU
:::

### StreamJSONLParallelWithContext

Сигнатура: `func (p *Processor) StreamJSONLParallelWithContext(ctx context.Context, reader io.Reader, workers int, fn func(lineNum int, item *IterableValue) error) error`

Параллельная обработка данных JSONL с контекстом, поддержка отмены и контроля таймаута.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `ctx` | `context.Context` | Контекст для отмены или таймаута |
| `reader` | `io.Reader` | Источник данных JSONL |
| `workers` | `int` | Количество рабочих горутин (при <=0 по умолчанию 4) |
| `fn` | `func(lineNum int, item *IterableValue) error` | Функция обработки |

```go
processor, _ := json.New()
defer processor.Close()

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

err := processor.StreamJSONLParallelWithContext(ctx, reader, 8, func(lineNum int, item *json.IterableValue) error {
    return nil
})
if err != nil {
    log.Fatal(err)
}
```

---

### StreamJSONLChunked

Сигнатура: `func (p *Processor) StreamJSONLChunked(reader io.Reader, chunkSize int, fn func(chunk []*IterableValue) error) error`

Поблочная обработка данных JSONL, обработка партии элементов за раз.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `reader` | `io.Reader` | Источник данных JSONL |
| `chunkSize` | `int` | Количество элементов в партии |
| `fn` | `func(chunk []*IterableValue) error` | Функция пакетной обработки |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

err := processor.StreamJSONLChunked(file, 100, func(chunk []*json.IterableValue) error {
    // Пакетная запись в базу данных
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:    item.GetInt("id"),
            Name:  item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

---

### StreamJSONLFile

Сигнатура: `func (p *Processor) StreamJSONLFile(filename string, fn func(lineNum int, item *IterableValue) error) error`

Потоковая обработка данных JSONL непосредственно из файла.

```go
processor, _ := json.New()
defer processor.Close()

err := processor.StreamJSONLFile("logs.jsonl", func(lineNum int, item *json.IterableValue) error {
    if item.GetString("level") == "error" {
        logErrors(item)
    }
    return nil
})
```

---

## Функциональные методы

### ForeachJSONL

Сигнатура: `func (p *Processor) ForeachJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) error) error`

Метод-псевдоним для итерации данных JSONL, поведение аналогично `StreamJSONL`.

```go
err := processor.ForeachJSONL(file, func(lineNum int, item *json.IterableValue) error {
    fmt.Printf("Строка %d: %v\n", lineNum, item.GetData())
    return nil
})
```

---

### MapJSONL

Сигнатура: `func (p *Processor) MapJSONL(reader io.Reader, fn func(lineNum int, item *IterableValue) (any, error)) ([]any, error)`

Преобразует данные JSONL в новый формат, возвращает срез преобразованных значений.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Извлечение всех имён пользователей
names, err := processor.MapJSONL(file, func(lineNum int, item *json.IterableValue) (any, error) {
    return item.GetString("name"), nil
})
// names: []any{"Alice", "Bob", "Charlie"}
```

---

### ReduceJSONL

Сигнатура: `func (p *Processor) ReduceJSONL(reader io.Reader, initial any, fn func(acc any, item *IterableValue) any) (any, error)`

Сводит данные JSONL к одному значению.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("sales.jsonl")
defer file.Close()

// Подсчёт общей суммы продаж
total, err := processor.ReduceJSONL(file, 0.0, func(acc any, item *json.IterableValue) any {
    price := item.GetFloat64("price")
    return acc.(float64) + price
})
fmt.Printf("Общая сумма продаж: %.2f\n", total.(float64))
```

---

### FilterJSONL

Сигнатура: `func (p *Processor) FilterJSONL(reader io.Reader, predicate func(item *IterableValue) bool) ([]*IterableValue, error)`

Фильтрует данные JSONL, возвращает элементы, удовлетворяющие условию.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("logs.jsonl")
defer file.Close()

// Фильтрация журналов ошибок
errors, err := processor.FilterJSONL(file, func(item *json.IterableValue) bool {
    return item.GetString("level") == "error"
})
fmt.Printf("Обнаружено %d записей об ошибках\n", len(errors))
```

---

### CollectJSONL

Сигнатура: `func (p *Processor) CollectJSONL(reader io.Reader) ([]*IterableValue, error)`

Собирает все данные JSONL в срез.

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("data.jsonl")
defer file.Close()

items, err := processor.CollectJSONL(file)
if err != nil {
    panic(err)
}
fmt.Printf("Собрано %d записей\n", len(items))
```

::: warning Внимание к памяти
Этот метод загружает все данные в память и не подходит для очень больших файлов. Для больших файлов рекомендуется использовать `StreamJSONL` для построчной обработки.
:::

---

### FirstJSONL

Сигнатура: `func (p *Processor) FirstJSONL(reader io.Reader, predicate func(item *IterableValue) bool) (*IterableValue, bool, error)`

Находит первый элемент, удовлетворяющий условию.

**Возвращаемые значения**

| Тип | Описание |
|------|------|
| `*IterableValue` | Найденный элемент (если существует) |
| `bool` | Был ли найден элемент |
| `error` | Информация об ошибке |

```go
processor, _ := json.New()
defer processor.Close()

file, _ := os.Open("users.jsonl")
defer file.Close()

// Поиск первого администратора
admin, found, err := processor.FirstJSONL(file, func(item *json.IterableValue) bool {
    return item.GetBool("is_admin")
})
if err != nil {
    panic(err)
}
if found {
    fmt.Printf("Администратор: %s\n", admin.GetString("name"))
}
```

---

## Параметры конфигурации

Поведение обработки JSONL можно настроить через следующие поля `Config`:

| Поле | Тип | Значение по умолчанию | Описание |
|------|------|--------|------|
| `JSONLBufferSize` | `int` | 65536 (64КБ) | Размер буфера чтения |
| `JSONLMaxLineSize` | `int` | 1048576 (1МБ) | Максимальное количество байтов в строке |
| `JSONLSkipEmpty` | `bool` | `true` | Пропускать пустые строки |
| `JSONLSkipComments` | `bool` | `false` | Пропускать комментарии `#` или `//` |
| `JSONLContinueOnErr` | `bool` | `false` | Продолжать при ошибке разбора |
| `JSONLWorkers` | `int` | 4 | Количество рабочих горутин для параллельной обработки |
| `JSONLChunkSize` | `int` | 1000 | Размер пакета для поблочной обработки |
| `JSONLMaxMemory` | `int64` | 104857600 (100МБ) | Максимальное использование памяти |

```go
cfg := json.DefaultConfig()
cfg.JSONLSkipComments = true     // Пропускать строки с комментариями
cfg.JSONLContinueOnErr = true    // Продолжать при ошибке разбора
cfg.JSONLWorkers = 8             // 8 параллельных workers

processor, _ := json.New(cfg)
defer processor.Close()
```

---

## Полные примеры

### Анализ журналов

```go
package main

import (
    "fmt"
    "os"
    "github.com/cybergodev/json"
)

func main() {
    processor, _ := json.New()
    defer processor.Close()

    file, _ := os.Open("app.log.jsonl")
    defer file.Close()

    var errorCount, warningCount int

    err := processor.StreamJSONL(file, func(lineNum int, item *json.IterableValue) error {
        level := item.GetString("level")
        switch level {
        case "error":
            errorCount++
            fmt.Printf("[ERROR] %s\n", item.GetString("message"))
        case "warning":
            warningCount++
        }
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Статистика: %d ошибок, %d предупреждений\n", errorCount, warningCount)
}
```

### Параллельная обработка данных

```go
package main

import (
    "fmt"
    "os"
    "sync/atomic"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    cfg.JSONLWorkers = 16 // 16 параллельных workers

    processor, _ := json.New(cfg)
    defer processor.Close()

    file, _ := os.Open("large_data.jsonl")
    defer file.Close()

    var processed int64

    err := processor.StreamJSONLParallel(file, 16, func(lineNum int, item *json.IterableValue) error {
        // Интенсивная обработка CPU
        _ = item
        atomic.AddInt64(&processed, 1)
        return nil
    })

    if err != nil {
        panic(err)
    }

    fmt.Printf("Параллельно обработано %d записей\n", processed)
}
```

---

## См. также

- [Обработчик JSONL](../jsonl) - функции JSONL на уровне пакета
- [Обработка больших файлов](../../large-files) - руководство по обработке больших файлов
- [Итератор](../iterator) - подробное описание типа IterableValue
