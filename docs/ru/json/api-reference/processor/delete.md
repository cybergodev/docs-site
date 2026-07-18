---
sidebar_label: "Операции удаления"
title: "Processor Методы удаления - CyberGo JSON | API"
description: "Методы удаления Processor CyberGo JSON: Delete удаляет по пути, DeleteClean очищает пустые значения и массивы с цепочечными вызовами."
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

// Если после удаления родительский объект пуст, DeleteClean продолжит очистку
// {"user": {}} -> {}
result, _ = p.DeleteClean(data, "user.temp")
```

## Связанные разделы

- [Модификация](./modify) - цепочечная модификация Set/SetCreate
- [Функции удаления](../functions/delete) - функции Delete уровня пакета
