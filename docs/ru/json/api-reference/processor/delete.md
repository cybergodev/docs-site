---
sidebar_label: "Операции удаления"
title: "Методы удаления Processor - CyberGo JSON | Справочник API"
description: "Методы удаления CyberGo JSON Processor: Delete удаляет по пути, DeleteClean автоматически очищает пустые значения и пустые массивы после удаления, сохраняя возможность цепочечных вызовов."
sidebar_position: 4
---

# Методы удаления

Processor предоставляет методы для удаления значений по указанному пути и возвращает изменённую строку JSON.

## Delete

Сигнатура: `func (p *Processor) Delete(jsonStr, path string, cfg ...Config) (string, error)`

Удаляет значение по указанному пути, возвращает изменённую строку JSON.

```go
result, err := p.Delete(data, "user.temporary")
```

## DeleteClean

Сигнатура: `func (p *Processor) DeleteClean(jsonStr, path string, cfg ...Config) (string, error)`

Удаляет значение по указанному пути и автоматически очищает пустые значения и пустые массивы.

```go
result, err := p.DeleteClean(data, "user.temporary")
// После удаления будут очищены возникшие null и пустые массивы
```

**Разница между Delete и DeleteClean**:

```go
// Исходные данные: {"user": {"temp": "value", "name": "test"}}

// После Delete: {"user": {"name": "test"}}
result, _ := p.Delete(data, "user.temp")

// DeleteClean также удаляет user.temp; здесь user по-прежнему содержит name и не становится пустым
// Результат: {"user": {"name": "test"}}
result, _ = p.DeleteClean(data, "user.temp")
```

## Связанные разделы

- [Модификация](./modify) - цепочечная модификация Set/SetCreate
- [Функции удаления](../functions/delete) - функции Delete уровня пакета
