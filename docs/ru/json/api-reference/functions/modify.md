---
sidebar_label: "Модификация"
title: "Функции изменения - CyberGo JSON | API"
description: "Функции изменения CyberGo JSON: Set/SetMultiple, MergeJSON/MergeMany с авто-созданием путей и MergeMode."
sidebar_position: 3
---

# Функции изменения

Функции изменения JSON, предоставляемые пакетом json, поддерживают установку значений по пути, пакетное обновление и операции слияния.

## Функции установки

### Set

Сигнатура: `func Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

Установка значения по указанному пути, возвращает изменённую JSON-строку.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | JSON-строка |
| `path` | `string` | Да | Выражение пути |
| `value` | `any` | Да | Устанавливаемое значение |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Пример**

```go
result, err := json.Set(`{"user":{}}`, "user.name", "Alice")
if err != nil {
    panic(err)
}
fmt.Println(result) // {"user":{"name":"Alice"}}
```

**Автоматическое создание при несуществующем пути**

```go
// Автоматическое создание промежуточных путей
result, err := json.Set(`{}`, "user.profile.name", "Bob")
// {"user":{"profile":{"name":"Bob"}}}
```

**Установка значений разных типов**

```go
data := `{}`

// Установка строки
json.Set(data, "user.name", "Alice")

// Установка числа
json.Set(data, "user.age", 30)

// Установка логического значения
json.Set(data, "user.active", true)

// Установка null
json.Set(data, "user.deleted", nil)

// Установка вложенного объекта
json.Set(data, "user.address", map[string]any{
    "city": "Beijing",
    "zip":  "100000",
})

// Установка массива
json.Set(data, "user.tags", []string{"admin", "developer"})
```

### SetMultiple

Сигнатура: `func SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Пакетная установка значений по нескольким путям.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | JSON-строка |
| `updates` | `map[string]any` | Да | Отображение путей в значения |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Пример**

```go
updates := map[string]any{
    "user.name": "Bob",
    "user.age":  25,
    "user.email": "bob@example.com",
}
result, err := json.SetMultiple(data, updates)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**Преимущество производительности**

Для нескольких операций изменения `SetMultiple` эффективнее многократных вызовов `Set`:

```go
// Рекомендуется: один вызов
updates := map[string]any{"a": 1, "b": 2, "c": 3}
result, err := json.SetMultiple(data, updates)

// Не рекомендуется: многократные вызовы
result, err = json.Set(data, "a", 1)
result, err = json.Set(result, "b", 2)
result, err = json.Set(result, "c", 3)
```

### SetCreate

Сигнатура: `func SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Установка значения с автоматическим созданием несуществующих промежуточных путей. Эквивалент `Set` с `Config.CreatePaths = true`.

```go
// Автоматическое создание при несуществующих промежуточных путях
result, err := json.SetCreate(`{}`, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

### SetMultipleCreate

Сигнатура: `func SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Пакетная установка нескольких значений с автоматическим созданием промежуточных путей.

```go
result, err := json.SetMultipleCreate(`{}`, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## Функции слияния

### MergeJSON

Сигнатура: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Слияние двух JSON-объектов с использованием стратегии глубокого слияния. Для вложенных объектов ключи рекурсивно сливаются в соответствии с режимом, указанным в `Config.MergeMode`. Для примитивных значений и массивов приоритет имеет значение из patch.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `json1` | `string` | Да | Базовая JSON-строка |
| `json2` | `string` | Да | JSON-строка переопределения |
| `cfg` | `...Config` | Нет | Необязательная конфигурация (режим слияния через `MergeMode`) |

**Режимы слияния** (устанавливаются через `Config.MergeMode`, по умолчанию `MergeUnion`):

| Режим | Поведение для объектов | Поведение для массивов |
|------|----------|----------|
| `MergeUnion` | Слияние всех ключей, при конфликте используется значение из patch | Слияние всех элементов с удалением дубликатов |
| `MergeIntersection` | Сохраняются только общие ключи, значения из patch | Сохраняются только общие элементы |
| `MergeDifference` | Сохраняются только уникальные ключи base | Сохраняются только уникальные элементы base |

```go
base := `{"a": 1, "b": 2, "nested": {"x": 10, "y": 20}}`
override := `{"b": 3, "c": 4, "nested": {"y": 30, "z": 40}}`

// Слияние с объединением (по умолчанию)
result, _ := json.MergeJSON(base, override)
// Результат: {"a":1,"b":3,"c":4,"nested":{"x":10,"y":30,"z":40}}

// Слияние с пересечением — только общие ключи
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, _ = json.MergeJSON(base, override, cfg)
// Результат: {"b":3,"nested":{"y":30}}

// Слияние с разностью — только уникальные ключи base
cfg = json.DefaultConfig()
cfg.MergeMode = json.MergeDifference
result, _ = json.MergeJSON(base, override, cfg)
// Результат: {"a":1,"nested":{"x":10}}
```

### MergeMany

Сигнатура: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Слияние нескольких JSON-объектов. Требуется минимум 2 JSON-строки. Поддерживает установку режима слияния через `Config.MergeMode`.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsons` | `[]string` | Да | Срез JSON-строк для слияния (минимум 2) |
| `cfg` | `...Config` | Нет | Необязательная конфигурация (режим слияния через `MergeMode`) |

```go
config1 := `{"api": "v1", "timeout": 30, "retries": 1}`
config2 := `{"timeout": 60, "retries": 3}`
config3 := `{"retries": 5, "debug": true}`

// Слияние с объединением по умолчанию
result, err := json.MergeMany([]string{config1, config2, config3})
// Результат: {"api":"v1","timeout":60,"retries":5,"debug":true}
```

## Методы Processor

Processor предоставляет соответствующие методы изменения, сигнатуры совпадают с функциями уровня пакета:

```go
p, err := json.New()

result, err := p.Set(jsonStr, "user.name", "Alice")
result, err = p.Delete(jsonStr, "user.temp")
result, err = p.SetCreate(jsonStr, "user.email", "test@example.com")
```

У `MergeJSON` и `MergeMany` также есть соответствующие методы Processor с сигнатурами, идентичными функциям уровня пакета, что удобно для повторного использования настроенного Processor:

```go
result, err := p.MergeJSON(base, override)

merged, err := p.MergeMany([]string{config1, config2, config3})

// У CompareJSON тоже есть метод Processor (внимание: Processor.CompareJSON
// всегда выполняет проверку безопасности, в отличие от пути без cfg у функции
// уровня пакета)
equal, err := p.CompareJSON(a, b)
```

Подробнее см. [Модификация данных Processor](../processor/modify#processor-методы-слияния).

## Смотрите также

- [Функции запросов и получения](./query) - Операции запросов Get, GetString и др.
- [Функции пакетных операций](./batch) - Пакетная обработка ProcessBatch
- [Функции кодирования и вывода](./output) - Операции сериализации Marshal, Unmarshal и др.
- [Вспомогательные функции](../helpers) - Утилиты CompareJSON и др.
