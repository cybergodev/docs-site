---
title: "Обработка больших файлов - CyberGo JSON | Справочник API"
description: "Полный справочник API обработки больших файлов CyberGo JSON: включая потоковую обработку ForeachFile, побатчевую обработку ForeachFileChunked, обработку с путём ForeachFileWithPath, вложенную итерацию ForeachFileNested, конфигурацию управления памятью и рекомендации по оптимизации производительности."
---

# Обработка больших файлов


## Параметры конфигурации

Конфигурация обработки больших файлов интегрирована в структуру `Config`:

```go
type Config struct {
    // ... другие параметры ...

    // Конфигурация обработки больших файлов
    ChunkSize       int64 // Размер блока (по умолчанию 1 МБ)
    MaxMemory       int64 // Максимальное использование памяти (по умолчанию 100 МБ)
    BufferSize      int   // Размер буфера чтения (по умолчанию 64 КБ)
    SamplingEnabled bool  // Включить выборку (по умолчанию true)
    SampleSize      int   // Количество выборок (по умолчанию 1000)
}
```

### Пользовательская конфигурация

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // Блок 10 МБ
cfg.MaxMemory = 500 * 1024 * 1024  // Лимит памяти 500 МБ
cfg.BufferSize = 128 * 1024        // Буфер 128 КБ

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

Сигнатура: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Поочерёдная обработка элементов JSON-массива из большого файла.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к JSON-файлу |
| `fn` | `func(key any, item *IterableValue) error` | Callback обработки |

**Возвращаемые значения callback'а**

| Возвращаемое значение | Описание |
|--------|------|
| `nil` | Продолжить обработку следующего элемента |
| `item.Break()` | Остановить итерацию без возврата ошибки |
| Другой `error` | Остановить итерацию и вернуть ошибку |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // Использование IterableValue для удобного доступа к полям
    id := item.GetInt("id")
    name := item.GetString("name")

    if count%10000 == 0 {
        log.Printf("Обработано %d записей", count)
    }
    return nil
})
```

**Пример прерывания итерации**

```go
err := p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // Цель найдена, остановить итерацию
        return item.Break() // Остановить без ошибки
    }
    return nil // Продолжить итерацию
})
```

---

## ForeachFileChunked

Сигнатура: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Побатчевая обработка большого файла, каждый раз обрабатывается указанное количество элементов.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к JSON-файлу |
| `chunkSize` | `int` | Количество элементов в пакете |
| `fn` | `func(chunk []*IterableValue) error` | Callback пакетной обработки |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Обработка по 1000 записей за раз
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // Пакетная запись в базу данных
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... обработка данных
    }
    return nil
})
```

---

## ForeachFileWithPath

Сигнатура: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Обработка JSON-массива или объекта по указанному пути в файле.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к JSON-файлу |
| `path` | `string` | Выражение пути JSON |
| `fn` | `func(key any, item *IterableValue) error` | Callback обработки |

```go
// Обработка каждого элемента массива users в файле
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Имя: %s\n", item.GetString("name"))
    return nil
})
```

---

## ForeachFileNested

Сигнатура: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Рекурсивный обход всех вложенных JSON-структур в файле.

```go
// Рекурсивный обход всех вложенных элементов
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %v, Тип: %T\n", key, item.GetData())
    return nil
})
```

---

## Удобные методы IterableValue

Серия методов `ForeachFile*` предоставляет интерфейс `IterableValue` с удобным доступом к данным:

| Метод | Описание | Пример |
|------|------|------|
| `GetInt(path)` | Получить целое число | `item.GetInt("id")` |
| `GetString(path)` | Получить строку | `item.GetString("name")` |
| `GetFloat64(path)` | Получить число с плавающей точкой | `item.GetFloat64("score")` |
| `GetBool(path)` | Получить логическое значение | `item.GetBool("active")` |
| `GetArray(path)` | Получить массив | `item.GetArray("tags")` |
| `GetObject(path)` | Получить объект | `item.GetObject("profile")` |
| `Exists(path)` | Проверить существование поля | `item.Exists("email")` |
| `IsNull(path)` | Проверить, является ли значение null | `item.IsNull("deleted_at")` |
| `GetData()` | Получить исходные данные | `item.GetData()` |
| `Break()` | Вернуть сигнал прерывания | `return item.Break()` |

**Поддержка навигации по пути**

```go
city := item.GetString("profile.address.city")      // Вложенный объект
firstTag := item.GetString("tags[0]")               // Индекс массива
lastTag := item.GetString("tags[-1]")               // Отрицательный индекс (последний)
nested := item.GetString("data.items[0].name")      // Сложный путь
```

---

## Полные примеры

### Обработка сверхбольшого файла журнала

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Создание обработчика
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // Блок 10 МБ
    cfg.MaxMemory = 500 * 1024 * 1024 // Лимит памяти 500 МБ

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Подсчёт записей об ошибках
    errorCount := 0
    err = p.ForeachFile("logs.json", func(key any, item *json.IterableValue) error {
        level := item.GetString("level")
        if level == "error" {
            message := item.GetString("message")
            fmt.Printf("Ошибка: %s\n", message)
            errorCount++
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Обнаружено %d ошибок\n", errorCount)
}
```

### Пакетный импорт в базу данных

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Запись в базу данных по 500 записей в пакете
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // Пакетная вставка
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("Пакетно вставлено %d записей", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## Функции итерации файлов на уровне пакета

Помимо методов Processor, следующие функции можно вызывать напрямую без создания экземпляра Processor. Они используют глобальный обработчик внутри.

### ForeachFile (функция уровня пакета)

Сигнатура: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Загрузка JSON из файла и итерация.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (функция уровня пакета)

Сигнатура: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Загрузка JSON из файла и итерация по указанному пути.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("Пользователь: %s\n", name)
    return nil
})
```

### ForeachFileChunked (функция уровня пакета)

Сигнатура: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Поблочная итерация JSON-массива в файле.

```go
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    for _, item := range chunk {
        processItem(item)
    }
    return nil
})
```

### ForeachFileNested (функция уровня пакета)

Сигнатура: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Загрузка JSON из файла и рекурсивная итерация по всем вложенным структурам.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Путь: %v, Тип: %T\n", key, item.GetData())
    return nil
})
```

---

## Смотрите также

- [Руководство по обработке больших файлов](../large-files) - Полное руководство по использованию
- [Обработчик NDJSON](./jsonl) - Обработка JSONL/NDJSON
- [JSONLWriter](./jsonl#jsonlwriter) - Writer для записи JSONL
