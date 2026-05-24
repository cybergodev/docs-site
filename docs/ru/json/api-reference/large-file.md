---
title: "Обработка больших файлов - CyberGo JSON | Справочник API"
description: "Справочник API обработки больших файлов CyberGo JSON: ForeachFile потоковая обработка, ForeachFileChunked пакетная обработка, ForeachFileWithPath обработка по пути, ForeachFileNested вложенная итерация и конфигурация управления памятью."
---

# Обработка больших файлов


## Параметры конфигурации

Конфигурация обработки больших файлов интегрирована в структуру `Config`:

```go
type Config struct {
    // ... другие настройки ...

    // Настройки обработки больших файлов
    ChunkSize       int64 // Размер чанка (по умолчанию 1МБ)
    MaxMemory       int64 // Максимальное использование памяти (по умолчанию 100МБ)
    BufferSize      int   // Размер буфера чтения (по умолчанию 64КБ)
    SamplingEnabled bool  // Включить ли выборку (по умолчанию true)
    SampleSize      int   // Количество выборок (по умолчанию 1000)
}
```

### Пользовательская конфигурация

```go
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // Чанки по 10МБ
cfg.MaxMemory = 500 * 1024 * 1024  // Лимит памяти 500МБ
cfg.BufferSize = 128 * 1024        // Буфер 128КБ

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

---

## ForeachFile

Сигнатура: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Построчная обработка элементов массива JSON в большом файле.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к файлу JSON |
| `fn` | `func(key any, item *IterableValue) error` | Обратный вызов обработки |

**Возвращаемые значения обратного вызова**

| Возвращаемое значение | Описание |
|--------|------|
| `nil` | Продолжить обработку следующего элемента |
| `item.Break()` | Остановить итерацию без ошибки |
| другое `error` | Остановить итерацию и вернуть ошибку |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

count := 0
err = p.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    count++

    // Удобный доступ к полям через IterableValue
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
        // Найдено, остановить итерацию
        return item.Break() // Остановить без ошибки
    }
    return nil // Продолжить итерацию
})
```

---

## ForeachFileChunked

Сигнатура: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Пакетная обработка большого файла, обработка указанного количества элементов за раз.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к файлу JSON |
| `chunkSize` | `int` | Количество элементов в пакете |
| `fn` | `func(chunk []*IterableValue) error` | Обратный вызов пакетной обработки |

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Обработка по 1000 записей за раз
err = p.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    // Массовая запись в базу данных
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

Обработка массива или объекта JSON по указанному пути в файле.

**Параметры**

| Название | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к файлу JSON |
| `path` | `string` | Выражение пути JSON |
| `fn` | `func(key any, item *IterableValue) error` | Обратный вызов обработки |

```go
// Обработка каждого элемента массива users в файле
err := p.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    fmt.Printf("Name: %s\n", item.GetString("name"))
    return nil
})
```

---

## ForeachFileNested

Сигнатура: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Рекурсивный обход всех вложенных JSON структур в файле.

```go
// Рекурсивный обход всех вложенных элементов
err := p.ForeachFileNested("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Key: %v, Type: %T\n", key, item.GetData())
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
| `IsNull(path)` | Проверить на null | `item.IsNull("deleted_at")` |
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

### Обработка сверхбольшого файла логов

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Создание процессора
    cfg := json.DefaultConfig()
    cfg.ChunkSize = 10 * 1024 * 1024 // Чанки по 10МБ
    cfg.MaxMemory = 500 * 1024 * 1024 // Лимит памяти 500МБ

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Подсчёт ошибок в логах
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

    // Запись в базу данных пакетами по 500 записей
    err = p.ForeachFileChunked("users.json", 500, func(chunk []*json.IterableValue) error {
        // Массовая вставка
        for _, item := range chunk {
            user := User{
                ID:    item.GetInt("id"),
                Name:  item.GetString("name"),
                Email: item.GetString("email"),
            }
            // db.Create(&user)
            _ = user
        }
        log.Printf("Пакетная вставка %d записей", len(chunk))
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
}
```

---

## Функции файловой итерации уровня пакета

Помимо методов Processor, следующие функции можно вызывать напрямую без создания экземпляра Processor. Они используют глобальный процессор внутри.

### ForeachFile (функция уровня пакета)

Сигнатура: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Загружает JSON из файла и итерирует.

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil
})
```

### ForeachFileWithPath (функция уровня пакета)

Сигнатура: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Загружает JSON из файла и итерирует по указанному пути.

```go
err := json.ForeachFileWithPath("data.json", "users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("Пользователь: %s\n", name)
    return nil
})
```

### ForeachFileChunked (функция уровня пакета)

Сигнатура: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Построчная итерация массива JSON в файле чанками.

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

Загружает JSON из файла и рекурсивно итерирует все вложенные структуры.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Путь: %v, Тип: %T\n", key, item.GetData())
    return nil
})
```

---

## Смотрите также

- [Руководство по обработке больших файлов](../large-files) - Полное руководство
- [Обработчик NDJSON](./jsonl) - Обработка JSONL/NDJSON
- [JSONLWriter](./jsonl#jsonlwriter) - Модуль записи JSONL
