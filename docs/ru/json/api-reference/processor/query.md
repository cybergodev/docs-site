---
title: Processor - Запросы по пути - CyberGo JSON | Справочник API
description: "Полный справочник методов запросов по пути CyberGo JSON Processor: Get/GetString/GetInt и другие типобезопасные получения, пакетные запросы GetMultiple, безопасное получение SafeGet с возвратом AccessResult, обобщённое получение GetTyped[T], поддержка выражений JSONPath и оптимизация кэша."
---

# Методы запросов по пути

Processor предоставляет различные типобезопасные методы запросов по пути.

## Базовые запросы

### Get

Сигнатура: `func (p *Processor) Get(jsonStr, path string, cfg ...Config) (any, error)`

Получает значение любого типа по указанному пути.

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

Сигнатура: `func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

Получает строковое значение по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает пустую строку или `defaultValue`.

```go
// Без значения по умолчанию
name := p.GetString(data, "user.name")

// Со значением по умолчанию
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

Сигнатура: `func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

Получает целочисленное значение по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает 0 или `defaultValue`.

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

Сигнатура: `func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Получает значение с плавающей точкой по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает 0 или `defaultValue`.

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

Сигнатура: `func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

Получает логическое значение по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает false или `defaultValue`.

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

## Безопасные запросы

### SafeGet

Сигнатура: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Безопасно получает значение, возвращает структуру AccessResult. Подходит для сценариев, требующих преобразования типов.

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // Ошибка преобразования типа
    }
    fmt.Println(age)
}

// Также можно получить другие типы
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**Методы AccessResult**:

| Метод | Описание |
|------|------|
| `Ok() bool` | Проверяет, существует ли значение |
| `Unwrap() any` | Возвращает исходное значение |
| `UnwrapOr(defaultValue any) any` | Возвращает значение или значение по умолчанию |
| `AsString() (string, error)` | Безопасное преобразование в строку |
| `AsStringConverted() (string, error)` | Форматированное преобразование в строку |
| `AsInt() (int, error)` | Безопасное преобразование в целое число |
| `AsFloat64() (float64, error)` | Безопасное преобразование в число с плавающей точкой |
| `AsBool() (bool, error)` | Безопасное преобразование в логическое значение |

## Получение коллекций

### GetArray

Сигнатура: `func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Получает массив по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает nil или `defaultValue`.

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

Сигнатура: `func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Получает объект по указанному пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращает nil или `defaultValue`.

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## Обобщённое получение

::: tip Функции пакетного уровня
`GetTyped[T]` является функцией пакетного уровня, а не методом Processor. Подробнее в [обобщённых операциях](../generics#gettyped).
:::

```go
// Использование GetTyped на уровне пакета
user := json.GetTyped[User](data, "user")

// Со значением по умолчанию
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## Пакетные запросы

### GetMultiple

Сигнатура: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Получает значения нескольких путей за один вызов, возвращает отображение пути в значение.

```go
results, err := p.GetMultiple(data, []string{"user.name", "user.age", "user.email"})
if err != nil {
    panic(err)
}
fmt.Println(results["user.name"]) // Alice
fmt.Println(results["user.age"])  // 30
```

## Компиляция путей

### CompilePath

Сигнатура: `func (p *Processor) CompilePath(path string) (*CompiledPath, error)`

Предварительно компилирует выражение пути для последующих быстрых повторных операций.

```go
cp, err := p.CompilePath("users[0].name")
if err != nil {
    panic(err)
}
defer cp.Release()

// Использование скомпилированного пути для нескольких запросов
value, err := p.GetCompiled(data1, cp)
value, err = p.GetCompiled(data2, cp)
```

### GetCompiled

Сигнатура: `func (p *Processor) GetCompiled(jsonStr string, cp *CompiledPath) (any, error)`

Получает значение с использованием предварительно скомпилированного пути. Подходит для повторных запросов по одному и тому же пути к нескольким JSON-данным.

```go
cp, _ := p.CompilePath("items[0].id")
defer cp.Release()

for _, jsonStr := range jsonStrings {
    id, err := p.GetCompiled(jsonStr, cp)
    if err != nil {
        continue
    }
    fmt.Println(id)
}
```

## См. также

- [Изменение данных](./modify) - методы Set/Delete
- [Пакетные операции](./batch) - пакетная обработка ProcessBatch
- [Обобщённые операции](../generics) - обобщённое получение GetTyped[T]
