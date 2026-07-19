---
sidebar_label: "Методы итерации"
title: "Функции итерации уровня пакета - CyberGo JSON | Справочник API"
description: "Функции итерации уровня пакета CyberGo JSON: Foreach, ForeachWithPath, рекурсивный ForeachNested, обработка ошибок ForeachWithError и доступ к данным IterableValue, включая файловую итерацию ForeachFile."
sidebar_position: 10
---

# Функции итерации уровня пакета

Функции итерации, которые можно вызывать напрямую без создания экземпляра Processor. Однозначно соответствуют [методам итерации Processor](../processor/iterate) (двухуровневый дизайн).

## Foreach

Сигнатура: `func Foreach(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Обходит массив или объект JSON.

```go
json.Foreach(data, func(key any, item *json.IterableValue) {
    fmt.Printf("Key: %v, Value: %v\n", key, item.GetData())
})
```

**При итерации массива**: key — индекс (int)
**При итерации объекта**: key — имя ключа (string)

## ForeachWithPath

Сигнатура: `func ForeachWithPath(jsonStr, path string, fn func(key any, item *IterableValue), cfg ...Config) error`

Обходит по указанному пути, возвращает ошибку.

```go
err := json.ForeachWithPath(data, "items", func(key any, item *json.IterableValue) {
    fmt.Printf("[%v] %v\n", key, item.GetData())
})
```

Применимо для:
- итерации вложенных массивов
- итерации объектов по указанному пути

## ForeachNested

Сигнатура: `func ForeachNested(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config)`

Рекурсивно обходит все вложенные уровни.

```go
json.ForeachNested(data, func(key any, item *json.IterableValue) {
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

Сигнатура: `func ForeachReturn(jsonStr string, fn func(key any, item *IterableValue), cfg ...Config) (string, error)`

Обходит JSON-данные через обратный вызов для доступа к каждому элементу и возвращает повторно сериализованную строку JSON. Обратный вызов может изменять map/slice через `GetData()`, и изменения отразятся в возвращаемом значении.

```go
result, err := json.ForeachReturn(data, func(key any, item *json.IterableValue) {
    // Доступ/изменение элементов через item.GetData()
})
```

Применимо в сценариях, где после итерации требуются дальнейшие цепочечные операции.

## ForeachWithError

Сигнатура: `func ForeachWithError(jsonStr, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Обходит по пути, обратный вызов поддерживает возврат ошибки.

```go
err := json.ForeachWithError(data, "items", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == 0 {
        return fmt.Errorf("invalid item at index %v", key)
    }
    return nil // Продолжить итерацию
})
```

## ForeachNestedWithError

Сигнатура: `func ForeachNestedWithError(jsonStr string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Рекурсивно обходит все вложенные уровни, обратный вызов поддерживает возврат ошибки.

```go
err := json.ForeachNestedWithError(data, func(key any, item *json.IterableValue) error {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, item.GetData())
    return nil
})
```

## ForeachWithPathAndIterator

Сигнатура: `func ForeachWithPathAndIterator(jsonStr, path string, fn func(key any, item *IterableValue, currentPath string) IteratorControl, cfg ...Config) error`

Обходит по пути и предоставляет информацию о текущем пути. Использует `IteratorControl` для управления потоком итерации.

```go
err := json.ForeachWithPathAndIterator(data, "items", func(key any, item *json.IterableValue, currentPath string) json.IteratorControl {
    fmt.Printf("Путь: %s, Ключ: %v\n", currentPath, key)
    if item.GetInt("id") == targetID {
        return json.IteratorBreak // Остановить итерацию
    }
    return json.IteratorNormal // Продолжить итерацию
})
```

## ForeachWithPathAndControl

Сигнатура: `func ForeachWithPathAndControl(jsonStr, path string, fn func(key any, value any) IteratorControl, cfg ...Config) error`

Обходит по пути исходные значения, использует `IteratorControl` для управления потоком.

```go
err := json.ForeachWithPathAndControl(data, "items", func(key any, value any) json.IteratorControl {
    fmt.Printf("Ключ: %v, Значение: %v\n", key, value)
    return json.IteratorNormal
})
```

## IterableValue

`IterableValue` в обратном вызове итерации предоставляет удобные методы доступа к значениям. Полные определения методов см. в [Типы итераторов](../iterator#тип-iterablevalue).

| Метод | Описание |
|------|------|
| `GetData() any` | Получить текущее значение |
| `Get(path string) any` | Получить значение по пути |
| `GetString(key string) string` | Получить строковое значение |
| `GetInt(key string) int` | Получить целочисленное значение |
| `GetFloat64(key string) float64` | Получить значение с плавающей точкой |
| `GetBool(key string) bool` | Получить логическое значение |
| `GetArray(key string) []any` | Получить значение массива |
| `GetObject(key string) map[string]any` | Получить значение объекта |
| `Exists(key string) bool` | Проверить, существует ли поле |
| `IsNull(key string) bool` / `IsNullData() bool` | Проверить, равно ли значение null |
| `IsEmpty(key string) bool` / `IsEmptyData() bool` | Проверить, пусто ли значение |
| `Break() error` | Вернуть сигнал ошибки для прерывания итерации |
| `Release()` | Вернуть ресурс в пул объектов |

## Сравнение методов

| Метод | Параметр пути | Рекурсия | Возвращаемое значение | Обратный вызов ошибки |
|------|:--------:|:----:|--------|:--------:|
| `Foreach` | Нет | Нет | Нет | Нет |
| `ForeachWithPath` | Да | Нет | error | Нет |
| `ForeachNested` | Нет | Да | Нет | Нет |
| `ForeachReturn` | Нет | Нет | (string, error) | Нет |
| `ForeachWithError` | Да | Нет | error | Да |
| `ForeachNestedWithError` | Нет | Да | error | Да |
| `ForeachWithPathAndIterator` | Да | Нет | error | IteratorControl |
| `ForeachWithPathAndControl` | Да | Нет | error | IteratorControl |

---

## Функции итерации файлов

Пакет предоставляет функции для итерации напрямую из файла, подходящие для обработки больших JSON-файлов; соответствуют [методам файловой итерации Processor](../processor/iterate#методы-файловой-итерации).

### ForeachFile

Сигнатура: `func ForeachFile(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Загружает JSON из файла и выполняет итерацию.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к JSON-файлу |
| `fn` | `func(key any, item *IterableValue) error` | Обратный вызов итерации |

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    fmt.Printf("[%v] %v\n", key, item.GetData())
    return nil // Продолжить итерацию
})
```

---

### ForeachFileWithPath

Сигнатура: `func ForeachFileWithPath(filePath, path string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Загружает JSON из файла и выполняет итерацию по указанному пути.

```go
// Итерировать только массив users
err := json.ForeachFileWithPath("data.json", ".users", func(key any, item *json.IterableValue) error {
    name := item.GetString("name")
    fmt.Printf("Пользователь: %s\n", name)
    return nil
})
```

---

### ForeachFileChunked

Сигнатура: `func ForeachFileChunked(filePath string, chunkSize int, fn func(chunk []*IterableValue) error, cfg ...Config) error`

Поблочно итерирует JSON-массив в файле, подходит для пакетной обработки больших наборов данных.

**Параметры**

| Имя | Тип | Описание |
|------|------|------|
| `filePath` | `string` | Путь к JSON-файлу |
| `chunkSize` | `int` | Количество элементов в пакете (≤0 — по умолчанию 100) |
| `fn` | `func(chunk []*IterableValue) error` | Обратный вызов пакетной обработки |

```go
// По 100 записей в пакете
err := json.ForeachFileChunked("large_data.json", 100, func(chunk []*json.IterableValue) error {
    // Пакетная вставка в базу данных
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

::: tip Варианты использования
- Пакетная вставка в базу данных
- Пакетные вызовы API
- Обработка больших файлов с ограниченной памятью
:::

---

### ForeachFileNested

Сигнатура: `func ForeachFileNested(filePath string, fn func(key any, item *IterableValue) error, cfg ...Config) error`

Загружает JSON из файла и рекурсивно обходит все вложенные структуры.

```go
err := json.ForeachFileNested("config.json", func(key any, item *json.IterableValue) error {
    // Обход всех пар ключ-значение на всех уровнях
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

## Сравнение методов итерации файлов

| Метод | Параметр пути | Рекурсия | Поблочно | Подходящий сценарий |
|------|:--------:|:----:|:----:|----------|
| `ForeachFile` | Нет | Нет | Нет | Простой обход файла |
| `ForeachFileWithPath` | Да | Нет | Нет | Точечный обход |
| `ForeachFileChunked` | Нет | Нет | **Да** | Пакетная обработка, ограниченная память |
| `ForeachFileNested` | Нет | **Да** | Нет | Глубокий обход всех узлов |

---

## Управление итерацией

### Константы IteratorControl

`ForeachWithPathAndControl` и `ForeachWithPathAndIterator` управляют потоком итерации через возвращаемое значение `IteratorControl` (определение констант см. в [Типы итераторов](../iterator#константы-iteratorcontrol)):

| Константа | Описание |
|------|------|
| `IteratorNormal` | Нормальное продолжение итерации |
| `IteratorContinue` | Пропустить текущий элемент, продолжить итерацию |
| `IteratorBreak` | Остановить итерацию |

### Прерывание итерации

Возврат `item.Break()` в обратном вызове ошибки прерывает итерацию:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetInt("id") == targetID {
        // Цель найдена, остановить итерацию
        return item.Break()
    }
    return nil // Продолжить итерацию
})
```

### Обработка ошибок

Возврат любой другой ошибки прерывает итерацию и возвращает эту ошибку:

```go
err := json.ForeachFile("data.json", func(key any, item *json.IterableValue) error {
    if item.GetString("status") == "error" {
        return fmt.Errorf("обнаружена запись с ошибкой: %v", key)
    }
    return nil
})
if err != nil {
    log.Printf("Итерация прервана: %v", err)
}
```

---

## Связанные разделы

- [Методы итерации Processor](../processor/iterate) - Соответствующие методы процессора
- [Типы итераторов](../iterator) - Определения типов Iterator/IterableValue/Stream/Batch/Parallel
- [Запросы по пути](./query) - Серия методов Get
- [Пакетные операции](./batch) - Пакетная обработка ProcessBatch
- [Файловые операции](./file-io) - LoadFromFile/SaveToFile
- [Руководство по обработке больших файлов](../../streaming/large-files) - Практика потоковой обработки
