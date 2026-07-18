---
sidebar_label: "Парсинг и валидация"
title: "Парсинг и валидация - CyberGo JSON | API"
description: "Парсинг и валидация CyberGo JSON: Parse/ParseAny, Processor.Parse/ParseAny, Valid/ValidWithConfig/ValidateSchema с JSON Schema."
sidebar_position: 6
---

# Функции парсинга и валидации

Пакет json предоставляет функции парсинга и валидации, поддерживающие парсинг JSON в целевые объекты, парсинг через экземпляры Processor, валидацию JSON и валидацию по JSON Schema.

## Функции парсинга

### Parse

Сигнатура: `func Parse(jsonStr string, target any, cfg ...Config) error`

Парсит строку JSON в объект, на который указывает `target`. `target` должен быть указателем.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `jsonStr` | `string` | Да | Строка JSON |
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

Парсит строку JSON и возвращает корневое значение типа `any` без необходимости предварительно объявлять целевую переменную.

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
- `Parse(jsonStr, &target)` — парсинг в целевой указатель, требует предварительного объявления переменной
- `ParseAny(jsonStr)` — прямое возвращение типа `any`, без предварительного объявления
:::

### Processor.Parse

**Сигнатура**: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Парсит JSON в целевой указатель через экземпляр Processor.

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

Парсит JSON через экземпляр Processor и возвращает тип `any`, поведение аналогично функции уровня пакета `ParseAny`.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

data, err := p.ParseAny(`{"name": "test"}`)
```

Подробнее см. [Методы парсинга Processor](../processor/parse#методы-парсинга).

## Функции валидации

### Valid

Сигнатура: `func Valid(data []byte, cfg ...Config) bool`

Проверяет валидность JSON-байтов. 100% совместимость с `encoding/json.Valid`: вызов `json.Valid(data)` без cfg полностью идентичен стандартной библиотеке и возвращает обычный `bool`.

С помощью необязательного хвостового `Config` можно применять ограничения безопасности (размер, глубина вложенности, полный скан безопасности и т.д.). При передаче cfg `Valid` делегирует `Processor.Valid` и сворачивает любую ошибку в `false`.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := []byte(`{"name": "test"}`)
    // Совместимость с encoding/json (без cfg)
    if json.Valid(data) {
        fmt.Println("Валидный JSON")
    }

    // С конфигурацией (неразрушающий необязательный параметр)
    if json.Valid(data, json.SecurityConfig()) {
        fmt.Println("Прошёл проверку безопасности")
    }
}
```

::: tip Valid vs ValidWithConfig
- `Valid(data, cfg)` возвращает одиночный `bool` (совместимость с `encoding/json`), любая ошибка сворачивается в `false`
- `ValidWithConfig(jsonStr, cfg)` возвращает `(bool, error)`, удобно для выяснения причины сбоя валидации

Обе принимают `cfg`; различие в именовании историческое.
:::

### ValidWithConfig

Сигнатура: `func ValidWithConfig(jsonStr string, cfg ...Config) (bool, error)`

Проверяет валидность строки JSON с использованием конфигурации и возвращает возможную информацию об ошибке.

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
        fmt.Println("Валидный JSON")
    }
}
```

### ValidateSchema

Сигнатура: `func ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

Валидирует JSON-данные с использованием JSON Schema. Возвращает список всех ошибок валидации.

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    schema := &json.Schema{
        Type:     "object",
        Required: []string{"name", "email"},
        Properties: map[string]*json.Schema{
            "name":  {Type: "string", MinLength: 1},
            "email": {Type: "string", Format: "email"},
            "age":   {Type: "integer", Minimum: 0},
        },
    }

    errors, err := json.ValidateSchema(`{"name":"Alice","email":"alice@example.com","age":25}`, schema)
    if err != nil {
        panic(err)
    }
    for _, e := range errors {
        fmt.Printf("Путь %s: %s\n", e.Path, e.Message)
    }
}
```

::: tip Подробнее
Полное определение типа Schema и способы использования валидатора см. в разделе [Валидатор](../../extensions/validator).
:::

## Связанные разделы

- [Функции запросов и получения](./query) - Операции запросов Get, GetString и др.
- [Методы парсинга Processor](../processor/parse) - Подробное описание методов парсинга и валидации уровня Processor
