---
title: "Функции удаления - CyberGo JSON | API"
description: "Функции удаления CyberGo JSON: Delete удаляет узлы, DeleteClean очищает пустые родительские узлы и поддерживает пути."
sidebar_label: "Операции удаления"
sidebar_position: 4
---

# Функции удаления

Функции удаления JSON, предоставляемые пакетом json, удаляют узлы по указанным путям с возможной очисткой пустых родительских узлов, возникающих в результате удаления.

## Delete

Сигнатура: `func Delete(jsonStr, path string, cfg ...Config) (string, error)`

Удаление значения по указанному пути.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | JSON-строка |
| `path` | `string` | Да | Выражение пути |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Пример**

```go
result, err := json.Delete(data, "user.temporary")
if err != nil {
    panic(err)
}
```

**Удаление свойства объекта**

```go
// Удаление одного свойства
result, err := json.Delete(`{"user":{"name":"Alice","temp":"value"}}`, "user.temp")
// {"user":{"name":"Alice"}}
```

**Удаление элемента массива**

```go
// Удаление элемента массива (индексация с 0)
result, err := json.Delete(`{"items":["a","b","c"]}`, "items[1]")
// {"items":["a","c"]}
```

**Несуществующий путь**

```go
// При несуществующем пути возвращается исходный JSON и ошибка
result, err := json.Delete(`{"a":1}`, "nonexistent.path")
if err != nil {
    // err содержит JsonsError, обёрнутый вокруг ErrPathNotFound
    fmt.Println("Ошибка удаления:", err)
}
// result всё ещё содержит исходный JSON: {"a":1}
```

## DeleteClean

Сигнатура: `func DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Удаление по указанному пути с автоматической очисткой пустых значений и пустых массивов.

```go
// Исходные данные: {"user": {"temp": "value", "name": "test"}}
result, err := json.DeleteClean(data, "user.temp")
// {"user":{"name":"test"}}

// Если после удаления родительский объект пуст, очистка продолжается
// {"user": {}} -> {}
```

## Смотрите также

- [Операции модификации](./modify) - Функции установки, слияния и др.
- [Функции запросов и получения](./query) - Операции запросов Get, GetString и др.
