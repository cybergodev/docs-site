---
title: "Функции печати - CyberGo JSON | Справочник API"
description: "Справочник по печати и форматированному выводу CyberGo JSON: использование функций Encode, EncodePretty, Prettify вместе со стандартным пакетом fmt для форматированного вывода JSON, замена приватизированных функций Print/PrintPretty, поддержка пользовательских отступов и префиксов."
---

# Функции печати

::: warning
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE` стали внутренними функциями (имена с маленькой буквы) и больше не экспортируются как открытый API. Используйте следующие альтернативы.
:::

## Альтернативы

### Печать компактного JSON

Используйте `fmt.Println` + `Encode`:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Вывод: {"age":30,"name":"Alice"}
```

### Печать форматированного JSON

Используйте `fmt.Println` + `EncodePretty`:

```go
s, err := json.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Вывод:
// {
//   "age": 30,
//   "name": "Alice"
// }
```

### Печать строки JSON (форматирование существующего JSON)

Используйте `Prettify`:

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

### Печать через Processor

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

// Кодирование и печать
s, err := p.Encode(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Форматированная печать
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```

## Полный пример

```go
package main

import (
    "fmt"
    "log"
    "github.com/cybergodev/json"
)

func main() {
    data := map[string]any{
        "users": []any{
            map[string]any{"id": 1, "name": "Alice"},
            map[string]any{"id": 2, "name": "Bob"},
        },
        "total": 2,
    }

    // Компактный вывод
    compact, err := json.Encode(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(compact)

    // Форматированный вывод
    pretty, err := json.EncodePretty(data)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(pretty)
}
```

## Связанные разделы

- [Функции кодирования/декодирования](./functions/encode-decode) - Encode, EncodePretty, Prettify
- [Функции пакета](./functions) - Обзор функций уровня пакета
