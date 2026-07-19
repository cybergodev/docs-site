---
sidebar_label: "Запрос и получение"
title: "Функции запросов и получения - CyberGo JSON | Справочник API"
description: "Функции запросов и получения CyberGo JSON: Get/GetString/GetInt типобезопасное получение, GetTyped[T] обобщённое, GetMultiple массовое и SafeGet безопасный доступ, поддержка JSONPath."
sidebar_position: 2
---

# Функции запросов и получения

Функции запросов и получения пакета json поддерживают выражения пути, типобезопасное получение и массовые операции.

## Функции запроса по пути

### Get

Сигнатура: `func Get(jsonStr, path string, cfg ...Config) (any, error)`

Получает значение любого типа по пути.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `jsonStr` | `string` | Да | Строка JSON |
| `path` | `string` | Да | Выражение пути |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Пример**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    val, err := json.Get(`{"items":[{"name":"test"}]}`, "items[0].name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // Вывод: test
}
```

### GetWithContext

Сигнатура: `func GetWithContext(ctx context.Context, jsonStr, path string, cfg ...Config) (any, error)`

Получение по пути с контекстом. Поддерживает тайм-аут и отмену операции. Контекстно-зависимая версия `Get`.

::: info Примечание
Контекст проверяется до и после операции, но не во время парсинга/навигации. Для больших JSON-документов операция может не реагировать на отмену во время выполнения.
:::

```go
package main

import (
    "context"
    "fmt"
    "time"
    "github.com/cybergodev/json"
)

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    val, err := json.GetWithContext(ctx, `{"user":{"name":"Alice"}}`, "user.name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // Вывод: Alice
}
```

## Типобезопасные функции получения

Типобезопасные функции получения предоставляют возврат к нулевому значению через вариативный параметр `defaultValue`. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается `defaultValue` (если не указан — нулевое значение соответствующего типа).

### GetString

Сигнатура: `func GetString(jsonStr, path string, defaultValue ...string) string`

Получает строковое значение по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo"}}`

    name := json.GetString(jsonStr, "user.name")
    fmt.Println(name) // Вывод: CyberGo

    // Несуществующий путь возвращает нулевое значение (пустую строку) или пользовательское значение по умолчанию
    nickname := json.GetString(jsonStr, "user.nickname", "Неизвестно")
    fmt.Println(nickname) // Вывод: Неизвестно
}
```

### GetInt

Сигнатура: `func GetInt(jsonStr, path string, defaultValue ...int) int`

Получает целочисленное значение по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"pagination": {"count": 42}, "timeout": 30}`

    count := json.GetInt(jsonStr, "pagination.count")
    fmt.Println(count) // Вывод: 42

    timeout := json.GetInt(jsonStr, "timeout")
    fmt.Println(timeout) // Вывод: 30

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    page := json.GetInt(jsonStr, "pagination.page", 1)
    fmt.Println(page) // Вывод: 1
}
```

### GetFloat

Сигнатура: `func GetFloat(jsonStr, path string, defaultValue ...float64) float64`

Получает число с плавающей точкой по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"item": {"price": 19.99}, "rate": 0.85}`

    price := json.GetFloat(jsonStr, "item.price")
    fmt.Println(price) // Вывод: 19.99

    rate := json.GetFloat(jsonStr, "rate")
    fmt.Println(rate) // Вывод: 0.85

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    discount := json.GetFloat(jsonStr, "item.discount", 0.0)
    fmt.Println(discount) // Вывод: 0
}
```

### GetBool

Сигнатура: `func GetBool(jsonStr, path string, defaultValue ...bool) bool`

Получает логическое значение по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"feature": {"enabled": true}, "debug": false}`

    enabled := json.GetBool(jsonStr, "feature.enabled")
    fmt.Println(enabled) // Вывод: true

    debug := json.GetBool(jsonStr, "debug")
    fmt.Println(debug) // Вывод: false

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    verbose := json.GetBool(jsonStr, "feature.verbose", false)
    fmt.Println(verbose) // Вывод: false
}
```

### GetArray

Сигнатура: `func GetArray(jsonStr, path string, defaultValue ...[]any) []any`

Получает массив по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"items": ["apple", "banana", "cherry"]}`

    items := json.GetArray(jsonStr, "items")
    for i, item := range items {
        fmt.Printf("[%d] %v\n", i, item)
    }

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    empty := json.GetArray(jsonStr, "tags", []any{"default"})
    fmt.Println(empty) // Вывод: [default]
}
```

### GetObject

Сигнатура: `func GetObject(jsonStr, path string, defaultValue ...map[string]any) map[string]any`

Получает объект по пути.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"profile": {"name": "CyberGo", "level": 5}}}`

    profile := json.GetObject(jsonStr, "user.profile")
    fmt.Println(profile) // map[level:5 name:CyberGo]

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    settings := json.GetObject(jsonStr, "user.settings", map[string]any{"theme": "dark"})
    fmt.Println(settings) // Вывод: map[theme:dark]
}
```

## Обобщённые функции получения

### GetTyped[T]

Сигнатура: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Обобщённая функция получения, поддерживающая пользовательские типы. Если путь не существует, значение равно null или преобразование типа не удалось, возвращается `defaultValue` (если не указан — нулевое значение типа `T`).

**Пояснение к именованию**: `GetTyped[T]` семантически эквивалентен `GetAs[T]`, что означает получение и преобразование JSON-значения в указанный тип `T`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    // Получение типизированной структуры
    user := json.GetTyped[User](jsonStr, "user")
    fmt.Printf("Name: %s, Age: %d\n", user.Name, user.Age)

    // Примеры встроенных типов
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // Вывод: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // Вывод: 30

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // Вывод: unknown@example.com
}
```

## Функции безопасного получения

### SafeGet (функция пакета)

Сигнатура: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Выполняет типобезопасное получение, возвращает `AccessResult` с методами преобразования типов (`AsString`, `AsInt`, `AsFloat64`, `AsBool`).

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

    result := json.SafeGet(jsonStr, "user.age")
    if result.Exists {
        age, _ := result.AsInt()
        fmt.Println(age) // Вывод: 30
    }

    nameResult := json.SafeGet(jsonStr, "user.name")
    name, _ := nameResult.AsString()
    fmt.Println(name) // Вывод: CyberGo
}
```

### SafeGet (метод Processor)

Сигнатура: `func (p *Processor) SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Выполняет типобезопасное получение через экземпляр Processor.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30}}`

result := p.SafeGet(jsonStr, "user.age")
if result.Exists {
    age, _ := result.AsInt()
    fmt.Println(age) // Вывод: 30
}
```

## Расширенные методы Processor

Следующие методы предоставляются как функции уровня пакета и как методы Processor.

### GetMultiple (функция пакета)

Сигнатура: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Массовое получение значений по нескольким путям (функция уровня пакета, не требует создания Processor).

```go
jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := json.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // Вывод: CyberGo
```

### Processor.GetMultiple

Сигнатура: `func (p *Processor) GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Массовое получение значений по нескольким путям.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 30, "email": "test@example.com"}}`

paths := []string{"user.name", "user.age", "user.email"}
values, err := p.GetMultiple(jsonStr, paths)
if err != nil {
    panic(err)
}
fmt.Println(values["user.name"]) // Вывод: CyberGo
```

## Связанные типы

### AccessResult

Поля структуры `AccessResult`, используемой в `SafeGet`:

| Поле | Тип | Описание |
|------|-----|----------|
| `Value` | `any` | Полученное значение |
| `Exists` | `bool` | Существует ли путь |
| `Type` | `string` | Обнаруженный тип значения |

**Методы**: `Ok()` · `Unwrap()` · `UnwrapOr()` · `AsString()` · `AsStringConverted()` · `AsInt()` · `AsFloat64()` · `AsBool()`

Подробнее см. [Тип AccessResult](../types#accessresult-результат-доступа-к-свойству).

### Result[T]

Поля обобщённой структуры `Result[T]`:

| Поле | Тип | Описание |
|------|-----|----------|
| `Value` | `T` | Полученное значение |
| `Exists` | `bool` | Найдено ли значение |
| `Error` | `error` | Информация об ошибке |

## Связанные разделы

- [Функции парсинга и валидации](./parse) - Операции парсинга/валидации Parse, Valid, ValidateSchema и др.
- [Функции пакетных операций](./batch) - Пакетная обработка ProcessBatch
- [Функции модификации](./modify) - Операции Set, Delete и др.
- [Кодирование и вывод](./output) - Операции сериализации Marshal, Unmarshal и др.
- [Вспомогательные функции](../helpers) - Утилиты CompareJSON, MergeJSON и др.
- [Параметры конфигурации](../config) - Подробное описание Config
