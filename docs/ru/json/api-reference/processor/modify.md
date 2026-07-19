---
sidebar_label: "Модификация"
title: "Модификация данных Processor - CyberGo JSON | Справочник API"
description: "Методы модификации CyberGo JSON Processor: установка Set, массовый SetMultiple, SetCreate с автоматическим созданием путей, массовый SetMultipleCreate — все методы поддерживают цепочечные вызовы."
sidebar_position: 3
---

# Методы модификации данных

Processor предоставляет методы модификации данных, все методы возвращают изменённую строку JSON. Методы удаления описаны в разделе [Операции удаления](./delete).

## Set

Сигнатура: `func (p *Processor) Set(jsonStr, path string, value any, cfg ...Config) (result string, err error)`

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

## Processor методы слияния

Processor предоставляет методы-экземпляры, соответствующие пакетным [MergeJSON](../functions/modify#mergejson), [MergeMany](../functions/modify#mergemany) и [CompareJSON](../helpers#comparejson).

### Processor.MergeJSON

Сигнатура: `func (p *Processor) MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Разбирает параметры из cfg (**при отсутствии cfg используется DefaultConfig, а не собственная конфигурация процессора** — если процессор создан с пользовательским MergeMode, необходимо явно передать cfg, чтобы применить этот режим), глубоко объединяет два объекта в соответствии с `Config.MergeMode`, а затем повторно кодирует результат этим процессором.

Как и пакетная функция, `Processor.MergeJSON` не выполняет проверку безопасности — это структурный инструмент, который только декодирует, глубоко объединяет и снова кодирует. Для проверки безопасности используйте `CompareJSON` (всегда выполняет проверку безопасности; при передаче cfg — по cfg, иначе по собственной конфигурации процессора).

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Слияние с объединением (по умолчанию)
result, err := p.MergeJSON(base, override)

// Слияние с пересечением
cfg := json.DefaultConfig()
cfg.MergeMode = json.MergeIntersection
result, err = p.MergeJSON(base, override, cfg)
```

### Processor.MergeMany

Сигнатура: `func (p *Processor) MergeMany(jsons []string, cfg ...Config) (string, error)`

Свёртывает срез слева направо через `MergeJSON`, стратегия слияния определяется `Config.MergeMode` (по умолчанию `MergeUnion`). При количестве JSON-строк менее 2 возвращает ошибку; при сбое любого шага слияния возвращает ошибку с индексом сбойного шага.

```go
result, err := p.MergeMany([]string{config1, config2, config3})
```

### Processor.CompareJSON

Сигнатура: `func (p *Processor) CompareJSON(json1, json2 string, cfg ...Config) (bool, error)`

Сравнивает две JSON-строки на равенство (нормализация чисел, независимость от порядка ключей).

::: warning Отличие от пакетного CompareJSON
Пакетный `CompareJSON` без cfg не выполняет проверку безопасности и маршалирует обе стороны через `encoding/json`; метод Processor **всегда** выполняет проверку безопасности (при передаче cfg — по cfg, иначе по собственной конфигурации процессора) и симметрично маршалирует обе стороны библиотечным кодировщиком, благодаря чему сконфигурированное кодирование (например, `EscapeHTML`) применяется симметрично.
:::

```go
equal, err := p.CompareJSON(a, b)
equal, err = p.CompareJSON(a, b, json.SecurityConfig())
```

## Связанные разделы

- [Запросы по пути](./query) - Методы Get
- [Операции удаления](./delete) - Методы Delete/DeleteClean
- [Массовые операции](./batch) - Массовая обработка ProcessBatch
