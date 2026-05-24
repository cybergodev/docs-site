---
title: "Processor - Методы итерации - CyberGo JSON | Справочник API"
description: "Справочник методов итерации Processor: Foreach, ForeachWithPath, ForeachNested, ForeachWithError, IterableValue и методы файловой итерации."
---

# Методы итерации

Processor предоставляет различные методы для итерации массивов и объектов JSON.

## Foreach

Сигнатура: `func (p *Processor) Foreach(jsonStr string, fn func(key any, item *IterableValue))`

Итерирует массив или объект JSON.

```go
p.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**При итерации массива**: key — индекс (int)
**При итерации объекта**: key — имя ключа (string)

## ForeachWithPath

Сигнатура: `func (p *Processor) ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue)) error`

Итерирует по указанному пути, возвращает ошибку.

```go
err := p.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Применимо для:
- Итерации вложенных массивов
- Итерации объектов по указанному пути

## ForeachNested

Сигнатура: `func (p *Processor) ForeachNested(jsonStr string, fn func(key any, item *IterableValue))`

Рекурсивно итерирует все вложенные уровни.

```go
p.ForeachNested(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
})
```

Пример данных:

```json
{
  "user": {
    "name": "test",
    "profile": {
      "age": 25,
      "tags": ["a", "b"]
    }
  }
}
```

Вывод:

```text
Ключ: user, Значение: map[string]any{...}
Ключ: name, Значение: test
Ключ: profile, Значение: map[string]any{...}
Ключ: age, Значение: 25
Ключ: tags, Значение: []any{...}
...
```

## ForeachReturn

Сигнатура: `func (p *Processor) ForeachReturn(jsonStr string, fn func(key any, item *IterableValue)) (string, error)`

Итерирует и возвращает исходный JSON (операция только для чтения).

```go
result, err := p.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Обработка только для чтения
})
```

Подходит для сценариев, где после итерации нужно продолжить цепочечные операции.

## ForeachWithError

Сигнатура: `func (p *Processor) ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error) error`

Итерирует по указанному пути, обратный вызов поддерживает возврат ошибки.

```go
err := p.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // Продолжить итерацию
})
```

## ForeachNestedWithError

Сигнатура: `func (p *Processor) ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error) error`

Рекурсивно итерирует все вложенные уровни, обратный вызов поддерживает возврат ошибки.

```go
err := p.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Сигнатура: `func (p *Processor) ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl) error`

Итерирует по указанному пути и предоставляет информацию о текущем пути. Использует `IteratorControl` для управления потоком итерации.

```go
err := p.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Путь: %s, Ключ: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // Остановить итерацию
    }
    return json.IteratorNormal // Продолжить итерацию
})
```

## ForeachWithPathAndControl

Сигнатура: `func (p *Processor) ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl) error`

Итерирует исходные значения по указанному пути, использует `IteratorControl` для управления потоком.

```go
err := p.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

`IterableValue` в обратном вызове итерации предоставляет следующие возможности:

| Метод | Описание |
|-------|----------|
| `GetData() any` | Получить текущее значение |
| `Get(path string) any` | Получить значение по пути |
| `GetString(key string) string` | Получить строковое значение |
| `GetInt(key string) int` | Получить целочисленное значение |
| `GetFloat64(key string) float64` | Получить число с плавающей точкой |
| `GetBool(key string) bool` | Получить логическое значение |
| `GetArray(key string) []any` | Получить значение массива |
| `GetObject(key string) map[string]any` | Получить значение объекта |
| `GetWithDefault(key string, defaultValue any) any` | Получить значение (со значением по умолчанию) |
| `GetStringWithDefault(key string, defaultValue string) string` | Получить строку (со значением по умолчанию) |
| `GetIntWithDefault(key string, defaultValue int) int` | Получить целое число (со значением по умолчанию) |
| `GetFloat64WithDefault(key string, defaultValue float64) float64` | Получить число с плавающей точкой (со значением по умолчанию) |
| `GetBoolWithDefault(key string, defaultValue bool) bool` | Получить логическое значение (со значением по умолчанию) |
| `Exists(key string) bool` | Проверить, существует ли поле |
| `IsNull(key string) bool` | Проверить, равно ли поле null |
| `IsNullData() bool` | Проверить, равно ли текущее значение null |
| `IsEmpty(key string) bool` | Проверить, пусто ли поле |
| `IsEmptyData() bool` | Проверить, пусто ли текущее значение |
| `Break() error` | Возвращает сигнал ошибки для прерывания итерации |
| `Release()` | Освобождает ресурсы обратно в пул объектов |
| `ForeachNested(path string, fn func(key any, item *IterableValue))` | Рекурсивная итерация вложенных структур |

## Сравнение методов

| Метод | Параметр пути | Рекурсия | Возвращаемое значение | Обратный вызов ошибки |
|-------|:------------:|:--------:|----------------------|:---------------------:|
| `Foreach` | Нет | Нет | Нет | Нет |
| `ForeachWithPath` | Да | Нет | error | Нет |
| `ForeachNested` | Нет | Да | Нет | Нет |
| `ForeachReturn` | Нет | Нет | (string, error) | Нет |
| `ForeachWithError` | Да | Нет | error | Да |
| `ForeachNestedWithError` | Нет | Да | error | Да |
| `ForeachWithPathAndIterator` | Да | Нет | error | IteratorControl |
| `ForeachWithPathAndControl` | Да | Нет | error | IteratorControl |

---

## Методы файловой итерации

Processor предоставляет методы для прямой итерации из файлов, подходящие для обработки больших JSON-файлов.

### ForeachFile

Сигнатура: `func (p *Processor) ForeachFile(filePath string, fn func(key any, item *IterableValue) error) error`

Загружает JSON из файла и итерирует.

**Параметры**

| Имя | Тип | Описание |
|-----|-----|----------|
| `filePath` | `string` | Путь к JSON-файлу |
| `fn` | `func(key any, item *IterableValue) error` | Обратный вызов итерации |

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // Продолжить итерацию
})
```

---

### ForeachFileWithPath

Сигнатура: `func (p *Processor) ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error) error`

Загружает JSON из файла и итерирует по указанному пути.

```go
// Итерировать только массив users
err := p.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("Пользователь: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

Сигнатура: `func (p *Processor) ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error) error`

Построчно итерирует JSON-массив в файле, подходит для массовой обработки больших наборов данных.

**Параметры**

| Имя | Тип | Описание |
|-----|-----|----------|
| `filePath` | `string` | Путь к JSON-файлу |
| `chunkSize` | `int` | Количество элементов в пакете (при <=0 по умолчанию 100) |
| `fn` | `func(chunk []*IterableValue) error` | Обратный вызов пакетной обработки |

```go
// Обработка по 100 записей в пакете
err := p.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // Массовая вставка в базу данных
    records := make([]Record, len(chunk))
    for i, item := range chunk {
        records[i] = Record{
            ID:   item.GetInt("id"),
            Name: item.GetString("name"),
        }
    }
    return db.BatchInsert(records)
})
```

::: tip Сценарии использования
- Массовая вставка в базу данных
- Пакетные вызовы API
- Обработка больших файлов при ограниченной памяти
:::

---

### ForeachFileNested

Сигнатура: `func (p *Processor) ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error) error`

Загружает JSON из файла и рекурсивно итерирует все вложенные структуры.

```go
err := p.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // Обход всех ключей и значений на всех уровнях
    fmt.Printf("Путь: %v, Тип: %T\n", key, item.GetData())
    return nil
})
```

**Пример данных**:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}
```

**Вывод**:

```text
Путь: database, Тип: map[string]any
Путь: host, Тип: string
Путь: port, Тип: float64
Путь: pool, Тип: map[string]any
Путь: min, Тип: float64
Путь: max, Тип: float64
```

---

## Сравнение методов файловой итерации

| Метод | Параметр пути | Рекурсия | Порциями | Подходящий сценарий |
|-------|:------------:|:--------:|:--------:|---------------------|
| `ForeachFile` | Нет | Нет | Нет | Простой обход файла |
| `ForeachFileWithPath` | Да | Нет | Нет | Целевой обход |
| `ForeachFileChunked` | Нет | Нет | **Да** | Массовая обработка, ограниченная память |
| `ForeachFileNested` | Нет | **Да** | Нет | Глубокий обход всех узлов |

---

## Управление итерацией

### Прерывание итерации

Возврат `item.Break()` в функции обратного вызова прерывает итерацию:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // Цель найдена, остановить итерацию
        return item.Break()
    }
    return nil // Продолжить итерацию
})
```

### Обработка ошибок

Возврат другой ошибки прерывает итерацию и возвращает эту ошибку:

```go
err := p.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("обнаружена ошибочная запись: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("Итерация прервана: %v", err)
}
```

---

## Связанные разделы

- [Запросы по пути](./query) - Методы Get
- [Массовые операции](./batch) - Массовая обработка ProcessBatch
- [Файловые операции](../functions/file-io) - LoadFromFile/SaveToFile
