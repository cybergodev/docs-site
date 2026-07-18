---
sidebar_label: "Функции вывода"
title: "Функции печати - CyberGo JSON | API"
description: "Печать и форматирование CyberGo JSON: Encode, EncodePretty, Prettify и fmt для вывода JSON."
sidebar_position: 11
---

# Функции печати

::: warning
Print, PrintPretty, PrintE, PrintPrettyE удалены из библиотеки и больше не предоставляются. Используйте следующие альтернативы.
:::

## Альтернативы

### Печать компактного JSON

Используйте `fmt.Println` + `EncodeWithConfig` (рекомендуется) или `Marshal`:

```go
data := map[string]any{"name": "Alice", "age": 30}

s, err := json.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)
// Вывод: {"age":30,"name":"Alice"}

// Либо через Marshal (вывод []byte)
b, err := json.Marshal(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(string(b))
```

::: warning Encode устарел
`json.Encode` помечен как устаревший (функционально эквивалентен `EncodeWithConfig`) и будет удалён в будущей мажорной версии. В новом коде используйте `EncodeWithConfig` или `Marshal`.
:::

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

// Кодирование и печать (рекомендуется EncodeWithConfig; Encode устарел)
s, err := p.EncodeWithConfig(data)
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

    // Компактный вывод (Encode устарел, рекомендуется EncodeWithConfig)
    compact, err := json.EncodeWithConfig(data)
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

- [Функции кодирования и вывода](./functions/output) - Encode, EncodePretty, Prettify
- [Функции пакета](./functions/) - Обзор функций уровня пакета
