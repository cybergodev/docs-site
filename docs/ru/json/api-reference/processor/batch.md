---
sidebar_label: "Пакетные операции"
title: "Пакетные операции Processor - CyberGo JSON | Справочник API"
description: "Пакетные операции CyberGo JSON Processor: ProcessBatch для нескольких операций, типы BatchOperation и BatchResult — подходят для пакетной обработки."
sidebar_position: 7
---

# Методы массовых операций

Processor предоставляет возможности массовых операций для обработки нескольких JSON-операций за один вызов.

## ProcessBatch

Сигнатура: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Массовая обработка нескольких JSON-операций.

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "1"},
    {Type: "set", JSONStr: data, Path: "user.age", Value: 30, ID: "2"},
    {Type: "delete", JSONStr: data, Path: "user.temporary", ID: "3"},
}

results, err := processor.ProcessBatch(operations)
if err != nil {
    panic(err)
}

for _, result := range results {
    fmt.Printf("ID: %s, Результат: %v\n", result.ID, result.Result)
}
```

## Структура BatchOperation

```go
type BatchOperation struct {
    Type    string `json:"type"`     // Тип операции: "get", "set", "delete", "validate"
    JSONStr string `json:"json_str"` // Строка JSON
    Path    string `json:"path"`     // Целевой путь
    Value   any    `json:"value"`    // Значение для операции Set
    ID      string `json:"id"`       // Идентификатор операции
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `Type` | `string` | Тип операции: `get`, `set`, `delete`, `validate` |
| `JSONStr` | `string` | Строка JSON для обработки |
| `Path` | `string` | Целевой путь |
| `Value` | `any` | Значение для установки при операции Set |
| `ID` | `string` | Идентификатор операции для сопоставления с результатом |

## Структура BatchResult

```go
type BatchResult struct {
    ID     string `json:"id"`     // Соответствующий ID операции
    Result any    `json:"result"` // Результат операции
    Error  error  `json:"error"`  // Ошибка (если есть)
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `ID` | `string` | ID, соответствующий BatchOperation |
| `Result` | `any` | Результат операции (Get возвращает значение, Set/Delete возвращает новый JSON) |
| `Error` | `error` | Ошибка отдельной операции (не влияет на другие операции) |

## Примеры использования

### Массовое чтение

```go
operations := []json.BatchOperation{
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "get", JSONStr: data, Path: "user.email", ID: "email"},
    {Type: "get", JSONStr: data, Path: "user.age", ID: "age"},
}

results, _ := processor.ProcessBatch(operations)
for _, r := range results {
    fmt.Printf("%s: %v\n", r.ID, r.Result)
}
```

### Массовая модификация

```go
operations := []json.BatchOperation{
    {Type: "set", JSONStr: data, Path: "status", Value: "active", ID: "1"},
    {Type: "set", JSONStr: data, Path: "updated_at", Value: time.Now().Unix(), ID: "2"},
    {Type: "delete", JSONStr: data, Path: "temp_field", ID: "3"},
}

results, _ := processor.ProcessBatch(operations)
```

### Смешанные операции

```go
operations := []json.BatchOperation{
    {Type: "validate", JSONStr: data, ID: "check"},
    {Type: "get", JSONStr: data, Path: "user.name", ID: "name"},
    {Type: "set", JSONStr: data, Path: "processed", Value: true, ID: "mark"},
}

results, _ := processor.ProcessBatch(operations)

// Проверка результата валидации
for _, r := range results {
    if r.ID == "check" {
        if m, ok := r.Result.(map[string]any); ok {
            fmt.Printf("Результат валидации: %v\n", m["valid"])
        }
    }
}
```

## Примечания

1. Каждая операция выполняется независимо, неудача одной не влияет на другие
2. Порядок результатов соответствует порядку операций
3. Сопоставление операций и результатов осуществляется через ID

## Связанные разделы

- [Запросы по пути](./query) - Методы Get
- [Модификация данных](./modify) - Методы Set/Delete
