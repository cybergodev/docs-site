---
title: "Processor Модификация данных - CyberGo JSON | API"
description: "Методы изменения Processor CyberGo JSON: Set, SetMultiple, SetCreate, Delete и DeleteClean с поддержкой цепочечных вызовов в Go."
---

# Методы модификации данных

Processor предоставляет методы модификации данных, все методы возвращают изменённую строку JSON.

## Set

Сигнатура: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (string, error)`

Устанавливает значение по указанному пути, возвращает изменённую строку JSON.

```go
result, err := p.Set(data, "user.name", "NewName")
```

Поддерживает установку значений различных типов:

```go
// Строка
result, _ := p.Set(data, "user.name", "CyberGo")

// Число
result, _ = p.Set(data, "user.age", 25)

// Логическое значение
result, _ = p.Set(data, "user.active", true)

// Объект
result, _ = p.Set(data, "user.profile", map[string]any{
    "bio": "Developer",
    "location": "China",
})

// Массив
result, _ = p.Set(data, "items", []any{"a", "b", "c"})
```

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

## SetMultiple

Сигнатура: `func (p *Processor) SetMultiple(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Массовая установка значений по нескольким путям, возвращает изменённую строку JSON.

```go
result, err := p.SetMultiple(data, map[string]any{
    "user.name": "CyberGo",
    "user.age":  25,
    "user.active": true,
})
```

## SetCreate

Сигнатура: `func (p *Processor) SetCreate(jsonStr, path string, value any, cfg ...Config) (string, error)`

Устанавливает значение и автоматически создаёт несуществующие промежуточные пути. Эквивалентно `Set` с `Config.CreatePaths = true`.

```go
// Промежуточный путь user.profile будет создан автоматически, если не существует
result, err := p.SetCreate(data, "user.profile.bio", "Developer")
// {"user":{"profile":{"bio":"Developer"}}}
```

## SetMultipleCreate

Сигнатура: `func (p *Processor) SetMultipleCreate(jsonStr string, updates map[string]any, cfg ...Config) (string, error)`

Массовая установка нескольких значений с автоматическим созданием промежуточных путей.

```go
result, err := p.SetMultipleCreate(data, map[string]any{
    "user.profile.bio":      "Developer",
    "user.profile.location": "China",
})
```

## Цепочечная модификация

Методы модификации поддерживают цепочечные вызовы:

```go
processor, _ := json.New()

result1, _ := processor.Set(data, "user.name", "CyberGo")
result2, _ := processor.Set(result1, "user.version", "1.0.0")
finalResult, _ := processor.Delete(result2, "user.temporary")
```

## Связанные разделы

- [Запросы по пути](./query) - Методы Get
- [Массовые операции](./batch) - Массовая обработка ProcessBatch
