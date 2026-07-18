---
sidebar_label: "Быстрый старт"
title: "Быстрый старт - CyberGo JSON | За 5 минут"
description: "Быстрый старт CyberGo JSON: установка, GetString/GetInt, Marshal/Unmarshal, файловый ввод-вывод за 5 минут, совместимый со stdlib."
sidebar_position: 1
---

# Быстрый старт

Это руководство поможет вам быстро приступить к работе с библиотекой `github.com/cybergodev/json`.

## Установка

```bash
go get github.com/cybergodev/json
```

## Базовое использование

### Функции уровня пакета

Библиотека предоставляет набор удобных функций уровня пакета, которые можно использовать без создания процессора:

#### Получение значений

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "CyberGo",
        "version": 1,
        "active": true,
        "price": 99.99,
        "tags": ["json", "go", "fast"],
        "meta": {"author": "dev"}
    }`

    // Универсальное получение
    val, err := json.Get(data, "name")
    if err != nil {
        panic(err)
    }
    fmt.Println(val) // CyberGo

    // Типобезопасное получение
    name := json.GetString(data, "name")
    version := json.GetInt(data, "version")
    active := json.GetBool(data, "active")
    price := json.GetFloat(data, "price")
    tags := json.GetArray(data, "tags")
    meta := json.GetObject(data, "meta")

    fmt.Println(name, version, active, price)
    fmt.Println(tags)  // [json go fast]
    fmt.Println(meta)  // map[author:dev]

    // Получение со значением по умолчанию
    desc := json.GetString(data, "description", "N/A")
    count := json.GetInt(data, "count", 0)
    fmt.Println(desc, count) // N/A 0
}
```

#### Вложенные пути

Поддерживаются вложенные пути, разделённые точкой:

```go
data := `{"user": {"profile": {"name": "Alice"}}}`

name := json.GetString(data, "user.profile.name")
fmt.Println(name) // Alice
```

#### Индексация массивов

Поддерживается доступ по индексу массива:

```go
data := `{"items": ["a", "b", "c"]}`

// Оба синтаксиса поддерживаются
item0 := json.GetString(data, "items.0")   // "a"
item1 := json.GetString(data, "items.1")   // "b"
last := json.GetString(data, "items.-1")   // "c"

// Синтаксис с квадратными скобками
first := json.GetString(data, "items[0]")  // "a"
last2 := json.GetString(data, "items[-1]") // "c"

// Получение диапазона (возвращает массив)
arr := json.GetArray(data, "items[0:2]")   // ["a", "b"]
```

::: tip Подробнее о синтаксисе путей
Помимо базовых свойств и индексов массивов, поддерживаются **срезы массивов** `[1:5]`, **подстановочные знаки** `[*]`, **извлечение полей** `{name,email}` и другой расширенный синтаксис. Подробнее см. [Синтаксис выражений пути](./path-syntax).
:::

#### Установка значений

```go
data := `{"name": "old"}`

// Установка нового значения
updated, _ := json.Set(data, "name", "new")
fmt.Println(updated) // {"name":"new"}

// Добавление нового поля
updated, _ = json.Set(data, "version", 1)
fmt.Println(updated) // {"name":"old","version":1}

// Последовательная установка нескольких полей
updated, _ = json.Set(data, "name", "updated")
updated, _ = json.Set(updated, "version", 2)
updated, _ = json.Set(updated, "active", true)
```

#### Удаление значений

```go
data := `{"name": "test", "temp": "remove"}`

// Удаление поля
updated, _ := json.Delete(data, "temp")
fmt.Println(updated) // {"name":"test"}
```

### Кодирование и декодирование

Полная совместимость со стандартной библиотекой:

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age"`
}

// Кодирование
user := User{Name: "Alice", Age: 30}
bytes, _ := json.Marshal(user)
fmt.Println(string(bytes)) // {"name":"Alice","age":30}

// Форматированное кодирование
pretty, _ := json.MarshalIndent(user, "", "  ")
fmt.Println(string(pretty))
// {
//   "name": "Alice",
//   "age": 30
// }

// Декодирование
var u User
json.Unmarshal(bytes, &u)
fmt.Println(u.Name, u.Age) // Alice 30
```

### Валидация

```go
valid := `{"key": "value"}`
invalid := `{key: value}`

fmt.Println(json.Valid([]byte(valid)))   // true
fmt.Println(json.Valid([]byte(invalid))) // false
```

### Форматирование

```go
compact := `{"name":"test","nested":{"key":"value"}}`

// Красивый вывод
pretty, _ := json.Prettify(compact)
fmt.Println(pretty)
// {
//   "name": "test",
//   "nested": {
//     "key": "value"
//   }
// }

// Сжатый вывод
jsonStr := `{
  "name": "test"
}`
var buf bytes.Buffer
err := json.Compact(&buf, []byte(jsonStr))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

## Использование Processor

Для частых операций рекомендуется использовать `Processor` для лучшей производительности и кэширования:

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Создание процессора с конфигурацией по умолчанию
    p, err := json.New()
    if err != nil {
        panic(err)
    }
    defer p.Close() // Не забудьте закрыть для освобождения ресурсов

    data := `{"name": "test", "value": 42}`

    // Операции через процессор
    name := p.GetString(data, "name")
    value := p.GetInt(data, "value")

    fmt.Println(name, value)
}
```

## Параметры конфигурации

```go
// Конфигурация по умолчанию
cfg := json.DefaultConfig()

// Конфигурация с усиленной безопасностью (для недоверенного ввода)
// cfg = json.SecurityConfig()

// Конфигурация с форматированным выводом
// cfg = json.PrettyConfig()

// Пользовательская конфигурация
cfg = json.DefaultConfig()
cfg.MaxJSONSize = 50 * 1024 * 1024 // 50МБ
cfg.EnableCache = true
cfg.CacheTTL = 5 * time.Minute

// Создание процессора с пользовательской конфигурацией
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
```

## Итерация и обход

```go
data := `{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}`

err := json.ForeachWithPath(data, "users", func(key any, item *json.IterableValue) {
    name := item.GetString("name")
    age := item.GetInt("age")
    fmt.Printf("User %v: %s (age %d)\n", key, name, age)
})
// User 0: Alice (age 30)
// User 1: Bob (age 25)
```

## Что дальше

- [Синтаксис выражений пути](./path-syntax) — изучите полный синтаксис запросов по пути
- [Обработка больших файлов](../streaming/large-files) — работа с большими JSON-файлами
- [Документация API](../api-reference/) — полный справочник API
- [Примеры использования](../examples/) — больше практических примеров
