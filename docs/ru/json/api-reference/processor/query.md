---
title: "Processor - Запросы по пути - CyberGo JSON | Справочник API"
description: "Справочник методов запросов по пути Processor: Get/GetString/GetInt, GetMultiple, SafeGet с AccessResult, GetTyped[T], CompilePath и GetCompiled с поддержкой JSONPath."
---

# Методы запросов по пути

Processor предоставляет различные типобезопасные методы запросов по пути.

## Базовые запросы

### Get

Сигнатура: `func (p *Processor) Get(jsonStr, path string, cfg ...Config) (any, error)`

Получает значение любого типа из указанного пути.

```go
val, err := p.Get(data, "items[0]")
if err != nil {
    panic(err)
}
```

### GetString

Сигнатура: `func (p *Processor) GetString(jsonStr, path string, defaultValue ...string) string`

Получает строковое значение из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается пустая строка или `defaultValue`.

```go
// Без значения по умолчанию
name := p.GetString(data, "user.name")

// С значением по умолчанию
email := p.GetString(data, "user.email", "unknown@example.com")
```

### GetInt

Сигнатура: `func (p *Processor) GetInt(jsonStr, path string, defaultValue ...int) int`

Получает целочисленное значение из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается 0 или `defaultValue`.

```go
count := p.GetInt(data, "count")
timeout := p.GetInt(data, "timeout", 30)
```

### GetFloat

Сигнатура: `func (p *Processor) GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Получает число с плавающей точкой из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается 0 или `defaultValue`.

```go
price := p.GetFloat(data, "price")
rate := p.GetFloat(data, "rate", 0.5)
```

### GetBool

Сигнатура: `func (p *Processor) GetBool(jsonStr, path string, defaultValue ...bool) bool`

Получает логическое значение из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается false или `defaultValue`.

```go
enabled := p.GetBool(data, "enabled")
debug := p.GetBool(data, "debug", false)
```

### GetWithContext

Сигнатура: `func (p *Processor) GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Получение по пути с контекстом. Поддерживает тайм-аут и отмену операции. Контекстно-зависимая версия `Get`.

::: info Примечание
Контекст проверяется до и после операции, но не во время парсинга/навигации. Для больших JSON-документов операция может не реагировать на отмену во время выполнения.
:::

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

val, err := p.GetWithContext(ctx, data, "items[0].name")
if err != nil {
    panic(err)
}
fmt.Println(val)
```

## Безопасные запросы

### SafeGet

Сигнатура: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Безопасное получение значения, возвращает структуру AccessResult. Подходит для сценариев, требующих преобразования типов.

```go
result := p.SafeGet(data, "user.age")
if result.Ok() {
    age, err := result.AsInt()
    if err != nil {
        // Преобразование типа не удалось
    }
    fmt.Println(age)
}

// Также можно получать другие типы
name, err := result.AsString()
price, err := result.AsFloat64()
enabled, err := result.AsBool()
```

**Методы AccessResult**:

| Метод | Описание |
|-------|----------|
| `Ok() bool` | Проверяет, существует ли значение |
| `Unwrap() any` | Получает исходное значение |
| `UnwrapOr(defaultValue any) any` | Получает значение или значение по умолчанию |
| `AsString() (string, error)` | Безопасно преобразует в строку |
| `AsStringConverted() (string, error)` | Форматирование в строку |
| `AsInt() (int, error)` | Безопасно преобразует в целое число |
| `AsFloat64() (float64, error)` | Безопасно преобразует в число с плавающей точкой |
| `AsBool() (bool, error)` | Безопасно преобразует в логическое значение |

## Получение коллекций

### GetArray

Сигнатура: `func (p *Processor) GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Получает массив из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается nil или `defaultValue`.

```go
items := p.GetArray(data, "items")
tags := p.GetArray(data, "tags", []any{"default"})
```

### GetObject

Сигнатура: `func (p *Processor) GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Получает объект из указанного пути. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается nil или `defaultValue`.

```go
profile := p.GetObject(data, "user.profile")
config := p.GetObject(data, "config", map[string]any{"timeout": 30})
```

## Обобщённое получение

::: tip Функция уровня пакета
`GetTyped[T]` — функция уровня пакета, а не метод Processor. Подробнее см. [Обобщённые операции](../generics#gettyped).
:::

```go
// Использование GetTyped уровня пакета
user := json.GetTyped[User](data, "user")

// С значением по умолчанию
user = json.GetTyped[User](data, "user", User{Name: "unknown"})
```

## Массовые запросы

### GetMultiple

Сигнатура: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Получает значения по нескольким путям за один вызов, возвращает отображение пути в значение.

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

Получает значение с использованием предварительно скомпилированного пути. Подходит для повторных запросов по одному и тому же пути к разным JSON-данным.

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

## Связанные разделы

- [Модификация данных](./modify) - Методы Set/Delete
- [Массовые операции](./batch) - Массовая обработка ProcessBatch
- [Обобщённые операции](../generics) - Обобщённое получение GetTyped[T]
