---
title: "Функции запросов и получения - CyberGo JSON | Справочник API"
description: "Полный справочник функций запросов и получения CyberGo JSON: включая типобезопасное получение Get/GetString/GetInt/GetFloat/GetBool, обобщённое получение GetTyped[T] и функции парсинга Parse/ParseAny с полной поддержкой выражений JSONPath."
---

# Функции запросов и получения

Функции запросов и получения, предоставляемые пакетом json, поддерживают выражения пути, типобезопасное получение и пакетные операции.

## Функции запросов по пути

### Get

Сигнатура: `func Get(jsonStr, path string, cfg ...Config) (any, error)`

Получение значения любого типа по пути.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | JSON-строка |
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

## Типобезопасные функции получения

Типобезопасные функции получения предоставляют откат к нулевому значению через вариативный параметр `defaultValue`. Когда путь не существует, значение равно null или преобразование типа не удалось, возвращается `defaultValue` (если не предоставлен, возвращается нулевое значение соответствующего типа).

### GetString

Сигнатура: `func GetString(jsonStr, path string, defaultValue ...string) string`

Получение строкового значения по пути.

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

Получение целочисленного значения по пути.

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

Получение значения с плавающей точкой по пути.

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

Получение логического значения по пути.

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

Получение массива по пути.

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

Получение объекта по пути.

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

Обобщённая функция получения с поддержкой пользовательских типов. Когда путь не существует или преобразование типа не удалось, возвращается `defaultValue` (если не предоставлен, возвращается нулевое значение `T`).

**Примечание к именованию**: `GetTyped[T]` эквивалентно семантике `GetAs[T]` и означает получение JSON-значения с преобразованием к указанному типу `T`.

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

    // Пример со встроенным типом
    name := json.GetTyped[string](jsonStr, "user.name")
    fmt.Println(name) // Вывод: CyberGo

    age := json.GetTyped[int](jsonStr, "user.age")
    fmt.Println(age) // Вывод: 30

    // Несуществующий путь возвращает пользовательское значение по умолчанию
    email := json.GetTyped[string](jsonStr, "user.email", "unknown@example.com")
    fmt.Println(email) // Вывод: unknown@example.com
}
```

## Функции парсинга

### Parse

Сигнатура: `func Parse(jsonStr string, target any, cfg ...Config) error`

Разбор JSON-строки в объект, на который указывает указатель `target`. `target` должен быть указателем.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | JSON-строка |
| `target` | `any` | Да | Указатель на целевой объект |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Базовый парсинг**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data)
    if err != nil {
        panic(err)
    }
    fmt.Println(data) // map[name:test]
}
```

**Парсинг в структуру**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type Person struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

func main() {
    var person Person
    err := json.Parse(`{"name": "CyberGo", "age": 30}`, &person)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Name: %s, Age: %d\n", person.Name, person.Age)
}
```

**Использование пользовательской конфигурации**

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    var data map[string]any
    err := json.Parse(`{"name": "test"}`, &data, cfg)
    if err != nil {
        panic(err)
    }
    fmt.Println(data)
}
```

### ParseAny

Сигнатура: `func ParseAny(jsonStr string, cfg ...Config) (any, error)`

Разбор JSON-строки и возврат корневого значения как типа `any` без предварительного объявления целевой переменной.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    result, err := json.ParseAny(`{"name": "test"}`)
    if err != nil {
        panic(err)
    }
    fmt.Println(result) // map[name:test]
}
```

::: tip Parse vs ParseAny
- `Parse(jsonStr, &target)` — разбор в целевой указатель, требует предварительного объявления переменной
- `ParseAny(jsonStr)` — прямой возврат типа `any` без предварительного объявления
:::

### Processor.Parse

**Сигнатура**: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Разбор JSON в целевой указатель через экземпляр Processor.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

var data map[string]any
err = p.Parse(`{"name": "test"}`, &data)
if err != nil {
    panic(err)
}
```

### Processor.ParseAny

**Сигнатура**: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Разбор JSON через экземпляр Processor с возвратом типа `any`, поведение аналогично функции `ParseAny` уровня пакета.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

Подробнее см. [Методы парсинга Processor](../processor/parse.md#Методы-парсинга).

## Функции валидации

### Valid

Сигнатура: `func Valid(data []byte) bool`

Проверка корректности среза байт JSON. 100% совместимость с `encoding/json.Valid`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    if json.Valid(data) {
        fmt.Println("Корректный JSON")
    }
}
```

### ValidWithConfig

Сигнатура: `func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

Проверка корректности JSON-строки с использованием конфигурации и возврат возможной информации об ошибке.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    valid, err := json.ValidWithConfig(`{"name": "test"}`, cfg)
    if err != nil {
        panic(err)
    }
    if valid {
        fmt.Println("Корректный JSON")
    }
}
```

## Безопасные функции получения

### SafeGet (функция уровня пакета)

Сигнатура: `func SafeGet(jsonStr, path string, cfg ...Config) AccessResult`

Выполнение типобезопасной операции получения, возвращает `AccessResult`, предоставляющий методы преобразования типов (`AsString`, `AsInt`, `AsFloat64`, `AsBool`).

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

Выполнение типобезопасной операции получения через экземпляр Processor.

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

### GetMultiple (функция уровня пакета)

Сигнатура: `func GetMultiple(jsonStr string, paths []string, cfg ...Config) (map[string]any, error)`

Пакетное получение значений по нескольким путям (функция уровня пакета, не требует создания Processor).

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

Пакетное получение значений по нескольким путям.

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

### Processor.ProcessBatch

Сигнатура: `func (p *Processor) ProcessBatch(operations []BatchOperation, cfg ...Config) ([]BatchResult, error)`

Пакетная обработка нескольких JSON-операций.

**Поля BatchOperation**: `Type string`, `JSONStr string`, `Path string`, `Value any`, `ID string`

**Поля BatchResult**: `ID string`, `Result any`, `Error error`

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

jsonStr := `{"user": {"name": "CyberGo", "age": 25}}`

operations := []json.BatchOperation{
    {Type: "get", JSONStr: jsonStr, Path: "user.name", ID: "op1"},
    {Type: "set", JSONStr: jsonStr, Path: "user.age", Value: 30, ID: "op2"},
}

results, err := p.ProcessBatch(operations)
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
```

## Связанные типы

### AccessResult

Поля структуры `AccessResult`, используемой в `SafeGet`:

| Поле | Тип | Описание |
|------|------|------|
| `Value` | `any` | Полученное значение |
| `Exists` | `bool` | Существует ли путь |
| `Type` | `string` | Обнаруженный тип значения |

### Result[T]

Поля обобщённой структуры `Result[T]`:

| Поле | Тип | Описание |
|------|------|------|
| `Value` | `T` | Полученное значение |
| `Exists` | `bool` | Было ли значение найдено |
| `Error` | `error` | Информация об ошибке |

## Смотрите также

- [Функции изменения](./modify) - Операции изменения Set, Delete и др.
- [Кодирование и декодирование](./encode-decode) - Операции сериализации Marshal, Unmarshal и др.
- [Вспомогательные функции](../helpers) - Утилиты CompareJSON, MergeJSON и др.
- [Параметры конфигурации](../config) - Подробное описание Config
