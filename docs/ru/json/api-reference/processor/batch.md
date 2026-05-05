---
title: Processor - Пакетные операции - CyberGo JSON | Справочник API
description: "Полный справочник методов пакетных операций CyberGo JSON Processor: ProcessBatch для пакетной обработки нескольких операций, BatchOperation для определения операций (типы get/set/delete), BatchResult для типа результата, стратегии обработки ошибок и конфигурация ContinueOnError, поддержка транзакционных пакетных операций и оптимизация производительности."
---

# Методы пакетных операций

Processor предоставляет возможности пакетных операций для обработки нескольких JSON-операций за один вызов.

## ProcessBatch

Сигнатура: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Пакетная обработка нескольких JSON-операций.

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
    Type    string  // Тип операции: "get", "set", "delete", "validate"
    JSONStr string  // Строка JSON
    Path    string  // Целевой путь
    Value   any     // Значение для операции Set
    ID      string  // Идентификатор операции
}
```

| Поле | Тип | Описание |
|------|------|------|
| `Type` | `string` | Тип операции: `get`, `set`, `delete`, `validate` |
| `JSONStr` | `string` | Строка JSON для обработки |
| `Path` | `string` | Целевой путь |
| `Value` | `any` | Значение для установки при операции Set |
| `ID` | `string` | Идентификатор операции для сопоставления результатов |

## Структура BatchResult

```go
type BatchResult struct {
    ID     string  // Соответствующий ID операции
    Result any     // Результат операции
    Error  error   // Ошибка (если есть)
}
```

| Поле | Тип | Описание |
|------|------|------|
| `ID` | `string` | ID, соответствующий BatchOperation |
| `Result` | `any` | Результат операции (Get возвращает значение, Set/Delete возвращает новый JSON) |
| `Error` | `error` | Ошибка отдельной операции (не влияет на другие операции) |

## Примеры использования

### Пакетное чтение

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

### Пакетное изменение

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

1. Каждая операция выполняется независимо, сбой одной не влияет на другие
2. Порядок результатов соответствует порядку операций
3. Используйте ID для сопоставления операций и результатов

## См. также

- [Запросы по пути](./query) - семейство методов Get
- [Изменение данных](./modify) - методы Set/Delete
