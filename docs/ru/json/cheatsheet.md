---
title: "Шпаргалка - CyberGo JSON | Быстрый справочник по API"
description: "CyberGo JSON шпаргалка по API: охватывает запросы по пути GetString/GetInt, операции изменения Set/Delete, сериализацию Marshal/Unmarshal, параметры конфигурации, итераторы и безопасные функции -- быстрый справочник для разработчиков."
---

# Шпаргалка

Быстрый поиск часто используемых API и фрагментов кода.

## Запросы по пути

| Операция | Функция | Пример |
|------|------|------|
| Получить строку | `GetString` | `json.GetString(data, "user.name")` |
| Получить целое число | `GetInt` | `json.GetInt(data, "count")` |
| Получить число с плавающей точкой | `GetFloat` | `json.GetFloat(data, "price")` |
| Получить логическое значение | `GetBool` | `json.GetBool(data, "enabled")` |
| Получить массив | `GetArray` | `json.GetArray(data, "items")` |
| Получить объект | `GetObject` | `json.GetObject(data, "user")` |
| Получить любое значение | `Get` | `json.Get(data, "items[0].id")` |
| Обобщённое получение | `GetTyped[T]` | `json.GetTyped[User](data, "user")` |

### Со значениями по умолчанию

Функции `GetString`, `GetInt`, `GetFloat`, `GetBool` и другие поддерживают необязательный параметр значения по умолчанию:

| Операция | Функция | Пример |
|------|------|------|
| Строка | `GetString` | `json.GetString(data, "name", "unknown")` |
| Целое число | `GetInt` | `json.GetInt(data, "count", 0)` |
| Число с плавающей точкой | `GetFloat` | `json.GetFloat(data, "rate", 0.5)` |
| Логическое значение | `GetBool` | `json.GetBool(data, "debug", false)` |

## Операции изменения

| Операция | Функция | Пример |
|------|------|------|
| Установить значение | `Set` | `json.Set(data, "user.name", "Alice")` |
| Пакетная установка | `SetMultiple` | `json.SetMultiple(data, map[string]any{"a": 1, "b": 2})` |
| Установка с созданием пути | `SetCreate` | `json.SetCreate(data, "a.b.c", 1)` |
| Пакетная установка с созданием пути | `SetMultipleCreate` | `json.SetMultipleCreate(data, updates)` |
| Удалить значение | `Delete` | `json.Delete(data, "user.temporary")` |
| Удалить с очисткой | `DeleteClean` | `json.DeleteClean(data, "user.temporary")` |

```go
// Установка значения
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
// {"user":{"name":"Alice"}}

// Последовательная установка нескольких полей
result, err = json.Set(data, "user.name", "Bob")
result, err = json.Set(result, "user.age", 25)

// Удаление
result, err := json.Delete(data, "user.temporary")
```

## Сериализация

| Операция | Функция | Пример |
|------|------|------|
| Кодирование | `Marshal` | `json.Marshal(data)` |
| Форматированное кодирование | `MarshalIndent` | `json.MarshalIndent(data, "", "  ")` |
| Декодирование | `Unmarshal` | `json.Unmarshal(bytes, &v)` |
| Разбор | `Parse` | `var v T; json.Parse(jsonStr, &v)` |
| Разбор в any | `ParseAny` | `json.ParseAny(jsonStr)` |
| Форматирование | `Prettify` | `json.Prettify(jsonStr)` |
| Сжатие | `Compact` | `json.Compact(&buf, []byte(data))` |

```go
// Кодирование
b, err := json.Marshal(map[string]any{"name": "test"})

// Форматированный вывод
pretty, err := json.MarshalIndent(data, "", "  ")

// Разбор в структуру
var result map[string]any
err = json.Parse(`{"name": "test"}`, &result)

// Разбор в any
parsed, err := json.ParseAny(`{"name": "test"}`)

// Форматирование JSON строки
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
```

## Валидация

| Операция | Функция | Пример |
|------|------|------|
| Быстрая валидация | `Valid` | `json.Valid([]byte(data))` |

```go
// Быстрая валидация
if json.Valid([]byte(data)) {
    // Корректный JSON
}

// Валидация по Schema
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name"},
    Properties: map[string]*json.Schema{
        "name": {Type: "string"},
        "age":  {Type: "number"},
    },
}
p, err := json.New()
if err != nil {
    panic(err)
}
errors, _ := p.ValidateSchema(data, schema)
```

## Вспомогательные функции

| Операция | Функция | Пример |
|------|------|------|
| Сравнение | `CompareJSON` | `json.CompareJSON(a, b)` |
| Слияние | `MergeJSON` | `json.MergeJSON(a, b)` |
| Множественное слияние | `MergeMany` | `json.MergeMany([]string{s1, s2, s3})` |

```go
// Сравнение (игнорирует порядок ключей и точность чисел)
equal, _ := json.CompareJSON(`{"a":1.0,"b":2}`, `{"b":2,"a":1}`)
fmt.Println("Equal:", equal) // true (игнорирует порядок и точность)

// Слияние JSON
base := `{"database":{"host":"localhost","port":5432},"debug":false}`
override := `{"database":{"host":"prod-server","ssl":true},"monitoring":true}`

// Слияние
merged, _ := json.MergeJSON(base, override)
// Результат: {"database":{"host":"prod-server","port":5432,"ssl":true},"debug":false,"monitoring":true}

// Множественное слияние
result, _ := json.MergeMany([]string{
    `{"a":1}`,
    `{"b":2}`,
    `{"c":3}`,
})
```

## Методы Processor

```go
// Создание процессора
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

// Получение значения
result := processor.GetString(data, "user.profile.name")

// Безопасное получение (возвращает AccessResult)
accessResult := processor.SafeGet(data, "user.age")
age, err := accessResult.AsInt()
```

### Создание с конфигурацией

```go
// Конфигурация по умолчанию
processor, err := json.New(json.DefaultConfig())

// Безопасная конфигурация (для обработки недоверенных входных данных)
processor, err := json.New(json.SecurityConfig())

// Пользовательская конфигурация
cfg := json.DefaultConfig()
cfg.CreatePaths = true
processor, err := json.New(cfg)
```

## Потоковая обработка

### Processor.ForeachFile (большие файлы)

```go
// Обработка большого файла
processor, err := json.New()
if err != nil {
    panic(err)
}
defer processor.Close()

err = processor.ForeachFile("large-data.json", func(key any, item *json.IterableValue) error {
    // Обработка элемента данных
    id := item.GetInt("id")
    name := item.GetString("name")
    return nil // Возврат item.Break() прервёт итерацию
})
```

### NDJSON/JSONL

```go
// Разбор JSONL
results, err := json.ParseJSONL(jsonlBytes)

// Обобщённый разбор (с использованием StreamLinesInto)
file, _ := os.Open("data.jsonl")
defer file.Close()
users, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    return nil
})

// Потоковая запись
outputFile, _ := os.Create("output.jsonl")
defer outputFile.Close()
writer := json.NewJSONLWriter(outputFile)
_ = writer.Write(map[string]any{"name": "Alice"})
_ = writer.Write(map[string]any{"name": "Bob"})
```

## Параметры конфигурации

```go
// Рекомендуемый способ: модификация на основе конфигурации по умолчанию
cfg := json.DefaultConfig()
cfg.MaxJSONSize = 200 * 1024 * 1024 // Пользовательский предел размера
cfg.FullSecurityScan = true          // Включить полный сканирование безопасности
```

### Предустановки конфигурации

```go
// Конфигурация по умолчанию
cfg := json.DefaultConfig()

// Безопасная конфигурация (для обработки недоверенных входных данных)
cfg := json.SecurityConfig()

// Конфигурация форматирования
cfg := json.PrettyConfig()
```

## Синтаксис путей

| Синтаксис | Описание | Пример |
|------|------|------|
| `.property` | Доступ к свойству | `user.name` |
| `[n]` | Индекс массива | `items[0]` |
| `[*]` | Подстановочный знак | `items[*].id` |
| `[start:end]` | Срез | `items[0:5]` |
| `[start:end:step]` | Срез с шагом | `items[0:10:2]` |
| `{field1,field2}` | Извлечение полей | `user{name,email}` |
| `[+]` | Добавление | `items[+]` |
| `[-1]` | Отрицательный индекс (последний) | `items[-1]` |

## Распространённые паттерны

### Безопасное получение вложенных значений

```go
// Использование функции получения со значением по умолчанию
name := json.GetString(data, "user.profile.name", "unknown")

// Использование Get, когда нужно различать типы ошибок
val, err := json.Get(data, "user.profile.name")
if err != nil {
    if errors.Is(err, json.ErrPathNotFound) {
        // Путь не найден
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Несоответствие типов
    }
}
```

### Получение со значением по умолчанию

```go
// Функции GetString/GetInt и др. поддерживают необязательный параметр значения по умолчанию
timeout := json.GetInt(data, "timeout", 30)
debug := json.GetBool(data, "debug", false)
name := json.GetString(data, "user.nickname", "unknown")
```

### Утверждение типа

```go
val, _ := json.Get(data, "value")
switch v := val.(type) {
case string:
    fmt.Println("Строка:", v)
case float64:
    fmt.Println("Число:", v)
case bool:
    fmt.Println("Логическое:", v)
case []any:
    fmt.Println("Массив:", len(v), "элементов")
case map[string]any:
    fmt.Println("Объект:", len(v), "ключей")
}
```

### Слияние конфигураций

```go
// Конфигурация по умолчанию + пользовательская конфигурация
defaults := `{"timeout": 30, "retries": 3}`
userConfig := `{"timeout": 60, "debug": true}`

merged, _ := json.MergeJSON(defaults, userConfig)
// {"timeout": 60, "retries": 3, "debug": true}
```

### Обработка ошибок

```go
val, err := json.Get(data, path)
if err != nil {
    // Проверка типа ошибки
    if errors.Is(err, json.ErrPathNotFound) {
        // Путь не найден
    } else if errors.Is(err, json.ErrInvalidJSON) {
        // Неверный формат JSON
    } else if errors.Is(err, json.ErrTypeMismatch) {
        // Несоответствие типов
    }
}
```

## Управление кэшем

```go
// Прогрев кэша
paths := []string{"user.name", "user.email", "items[*].id"}
result, _ := json.WarmupCache(data, paths)
fmt.Printf("Прогрев завершён: %d/%d\n", result.Successful, result.TotalPaths)

// Очистка кэша
json.ClearCache()

// Получение статистики
stats := json.GetStats()
fmt.Printf("Коэффициент попадания в кэш: %.2f%%\n", stats.HitRatio * 100)
```

## Глобальный процессор

```go
// Установка пользовательского глобального процессора
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
json.SetGlobalProcessor(p)

// Теперь все функции уровня пакета используют этот процессор
name := json.GetString(data, "user.name")

// Очистка при завершении приложения
defer json.ShutdownGlobalProcessor()
```

## Смотрите также

- [Функции пакета](./api-reference/functions) - Полный справочник API
- [Вспомогательные функции](./api-reference/helpers) - Инструменты преобразования типов
- [Processor](./api-reference/processor/) - Методы процессора
- [Конфигурация](./api-reference/config) - Параметры конфигурации
- [Определения типов](./api-reference/types) - AccessResult, Schema и др.
