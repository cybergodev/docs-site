---
sidebar_label: "Пакетные операции"
title: "Пакетные функции - CyberGo JSON | API"
description: "Пакетные функции CyberGo JSON: ProcessBatch, BatchOperation (Type/Path/Value/ID), BatchResult (ID/Result/Error) для пакетной обработки."
sidebar_position: 7
---

# Функции пакетных операций

Пакет json предоставляет функции пакетных операций, поддерживающие одновременную обработку нескольких JSON-операций (get/set/delete/validate) для сценариев пакетной обработки данных.

## Пакетные операции

### ProcessBatch

Сигнатура: `func ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Пакетная обработка нескольких JSON-операций (функция уровня пакета, не требует создания Processor).

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

    operations := []json.BatchOperation{
        {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
        {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
    }

    results, err := json.ProcessBatch(operations)
    if err != nil {
        panic(err)
    }
    for _, r := range results {
        if r.Error != nil {
            fmt.Printf("Операция %s не удалась: %v\n", r.ID, r.Error)
        } else {
            fmt.Printf("Результат операции %s: %v\n", r.ID, r.Result)
        }
    }
}
```

### BatchOperation

Структура описания пакетной операции.

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Тип операции: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // Целевая JSON-строка
    Path    string `json:"path"`     // Выражение пути
    Value   any    `json:"value"`    // Значение операции (используется для set)
    ID      string `json:"id"`       // Идентификатор операции
}
```

### BatchResult

Структура результата пакетной операции.

```go
type BatchResult struct {
    ID     string `json:"id"`     // Идентификатор операции
    Result any    `json:"result"` // Результат операции
    Error  error  `json:"error"`  // Информация об ошибке
}
```

::: tip Пакетный метод Processor
Экземпляр Processor предоставляет эквивалентный пакетный метод `p.ProcessBatch(operations)` с той же сигнатурой, что и функция уровня пакета, подходит для сценариев повторного использования Processor. Подробнее см. [Пакетные операции Processor](../processor/batch).
:::

## Связанные разделы

- [Функции модификации](./modify) - Операции модификации Set, MergeJSON и др.
- [Пакетные операции Processor](../processor/batch) - Подробное описание методов пакетных операций уровня Processor
