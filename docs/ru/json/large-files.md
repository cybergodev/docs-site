---
title: "Обработка больших файлов - CyberGo JSON | Руководство"
description: "Большие файлы CyberGo JSON: итерация ForeachFile, пакетная ForeachFileChunked, управление памятью и потоковая NDJSONProcessor для Go-аналитики."
---

# Обработка больших файлов

Для больших JSON-файлов (например, логов, конфигураций, экспорта данных) прямая загрузка в память может привести к её переполнению. Библиотека json предоставляет несколько эффективных способов обработки.

::: warning
`ForeachFile` и `ForeachFileChunked` загружают весь файл в память перед началом итерации. Поведение "построчной обработки" влияет только на способ итерации данных в памяти, а не на способ чтения файла. Для действительно больших файлов, где требуется контроль над памятью, используйте `NDJSONProcessor` с форматом JSONL или `StreamIterator`.
:::

## Альтернативные подходы

| Подход | Сценарий использования | Использование памяти |
|--------|------------------------|----------------------|
| **Processor.ForeachFile** | Структурированная построчная обработка файла | Загружает весь файл, итерирует построчно |
| **Processor.ForeachFileChunked** | Пакетная обработка по частям | Загружает весь файл, итерирует порциями |
| **NDJSONProcessor** | Построчная обработка JSONL-файлов | Контролируемое использование памяти, настоящая потоковая обработка |

## Унифицированный API: Processor

### Параметры конфигурации

Настройки обработки больших файлов интегрированы в `Config`:

```go
type Config struct {
    // ... другие настройки ...

    // Настройки обработки больших файлов
    ChunkSize       int64 // Размер порции (по умолчанию 1 МБ)
    MaxMemory       int64 // Максимальное использование памяти (по умолчанию 100 МБ)
    BufferSize      int   // Размер буфера чтения (по умолчанию 64 КБ)
    SamplingEnabled bool  // Включить выборку (по умолчанию true)
    SampleSize      int   // Количество образцов (по умолчанию 1000)
}
```

### Базовое использование

```go
package main

import (
    "log"
    "github.com/cybergodev/json"
)

func main() {
    // Создание Processor (с конфигурацией по умолчанию)
    processor, err := json.New()
    if err != nil {
        log.Fatal(err)
    }
    defer processor.Close()

    // Способ 1: построчная обработка (рекомендуется)
    count := 0
    err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        count++

        // Использование удобных методов IterableValue для доступа к полям
        id := item.GetInt("id")
        name := item.GetString("name")
        email := item.GetString("email")

        // Поддержка доступа к вложенным свойствам через путь
        city := item.GetString("profile.city")
        interests := item.GetArray("profile.interests")

        if count%10000 == 0 {
            log.Printf("Обработано %d записей, пример: id=%d name=%s email=%s city=%s интересы=%d",
                count, id, name, email, city, len(interests))
        }
        return nil
    })

    if err != nil {
        log.Fatal(err)
    }
    log.Printf("Обработка завершена, всего %d записей", count)
}
```

### Пакетная обработка

```go
// Способ 2: пакетная обработка (подходит для массовой записи в базу данных)
err := processor.ForeachFileChunked("large-data.json", 1000, func(chunk []*json.IterableValue) error {
    log.Printf("Обработка пакета: %d записей", len(chunk))

    // Массовая запись в базу данных
    for _, item := range chunk {
        id := item.GetInt("id")
        name := item.GetString("name")
        // ... обработка данных
    }
    return nil
})
```

### С управлением прерыванием
```go
// Способ 3: с управлением прерыванием (остановка после нахождения определённых данных)
// Верните item.Break() для остановки итерации, верните nil для продолжения
err := processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    id := item.GetInt("id")

    if id == targetID {
        // Найдено, остановка итерации
        fmt.Printf("Найдено: ID=%d, Имя=%s\n", id, item.GetString("name"))
        return item.Break() // Остановка итерации (возвращает сигнал прерывания)
    }

    return nil // Продолжение итерации
})
```

### Обработка файлов объектов
```go
// Способ 4: обработка файла с JSON-объектами (структура ключ-значение)
// Формат файла: {"user1": {...}, "user2": {...}, ...}
err := processor.ForeachFile("config-map.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %s, Имя: %s\n", key, item.GetString("name"))
    return nil
})
```

### Пользовательская конфигурация
```go
// Пользовательская конфигурация обработки больших файлов
cfg := json.DefaultConfig()
cfg.ChunkSize = 10 * 1024 * 1024   // Порция 10 МБ
cfg.MaxMemory = 500 * 1024 * 1024  // Лимит памяти 500 МБ
cfg.BufferSize = 128 * 1024        // Буфер 128 КБ

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

## Удобные методы IterableValue

Методы серии `ForeachFile*` предоставляют интерфейс `IterableValue` с удобным доступом к данным:

| Метод | Описание | Пример |
|-------|----------|--------|
| `Get(path)` | Получить значение | `item.Get("field")` |
| `GetString(path)` | Получить строку | `item.GetString("name")` |
| `GetInt(path)` | Получить целое число | `item.GetInt("id")` |
| `GetFloat64(path)` | Получить число с плавающей точкой | `item.GetFloat64("score")` |
| `GetBool(path)` | Получить логическое значение | `item.GetBool("active")` |
| `GetArray(path)` | Получить массив | `item.GetArray("tags")` |
| `GetObject(path)` | Получить объект | `item.GetObject("profile")` |
| `Exists(path)` | Проверить существование поля | `item.Exists("email")` |
| `IsNull(path)` | Проверить, равно ли null | `item.IsNull("deleted_at")` |
| `IsEmpty(path)` | Проверить, пусто ли | `item.IsEmpty("notes")` |
| `Break()` | Вернуть сигнал прерывания | `return item.Break()` |

**Поддержка навигации по путям**
```go
city := item.GetString("profile.address.city")      // Вложенный объект
firstTag := item.GetString("tags[0]")               // Индекс массива
lastTag := item.GetString("tags[-1]")               // Отрицательный индекс (последний)
nested := item.GetString("data.items[0].name")      // Сложный путь
```

## Настройка потоковой обработки

Настройка параметров потоковой обработки через `Config`:

```go
cfg := json.DefaultConfig()

// Настройки обработки больших файлов
cfg.ChunkSize = 10 * 1024 * 1024   // Порция 10 МБ
cfg.MaxMemory = 500 * 1024 * 1024  // Лимит памяти 500 МБ
cfg.BufferSize = 128 * 1024        // Буфер 128 КБ

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Использование обобщённой функции StreamLinesInto

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

_, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Обработка: %s\n", user.Name)
    return nil
})
```

### Параллельная обработка

Для задач, допускающих параллельную обработку, можно использовать несколько goroutine:

```go
package main

import (
    "sync"
    "github.com/cybergodev/json"
)

func main() {
    processor, err := json.New()
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // Использование пула воркеров
    workers := 4
    items := make(chan any, 100)
    var wg sync.WaitGroup

    // Запуск воркеров
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for item := range items {
                // Обработка элемента
                _ = item
            }
        }(i)
    }

    // Потоковое чтение и распределение
    processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
        items <- item.Get("")
        return nil
    })

    close(items)
    wg.Wait()
}
```

## Рекомендации по оптимизации производительности

### Управление памятью
```go
// Настройка в зависимости от доступной памяти
cfg := json.DefaultConfig()
cfg.MaxMemory = 500 * 1024 * 1024 // 500 МБ
cfg.ChunkSize = 10 * 1024 * 1024  // 10 МБ

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Лучшие практики
1. **Оценка размера файла**: проверяйте размер файла перед обработкой и выбирайте подходящую стратегию
2. **Установка лимитов памяти**: используйте `MaxMemory` для предотвращения OOM
3. **Пакетная запись**: накапливайте определённое количество записей перед массовой записью в базу данных
4. **Обработка ошибок**: реализуйте `JSONLContinueOnErr` или записывайте неудачные записи
5. **Мониторинг прогресса**: регулярно выводите ход обработки

## Руководство по выбору

| Размер файла | Рекомендуемый подход | Пример |
|--------------|----------------------|--------|
| < 10 МБ | Прямая загрузка | `json.ParseAny` + `Get` |
| 10-100 МБ | Processor.ForeachFile | Построчная обработка |
| 100 МБ - 1 ГБ | Processor.ForeachFileChunked | Порционная итерационная обработка |
| > 1 ГБ | NDJSONProcessor / формат JSONL | Настоящая потоковая обработка, контролируемое использование памяти |


## Что дальше
- [Документация API](./api-reference/) — полный справочник API
