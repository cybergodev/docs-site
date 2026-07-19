---
sidebar_label: "Обобщённые функции"
title: "Обобщённые операции - CyberGo JSON | Справочник API"
description: "CyberGo JSON обобщённый API: обобщённое получение GetTyped[T], тип результата Result[T], динамический доступ AccessResult — типобезопасность на этапе компиляции через обобщения Go 1.18+."
sidebar_position: 10
---

# Обобщённые операции

Библиотека json предоставляет типобезопасные обобщённые операции с использованием обобщений Go 1.18+ для проверки типов во время компиляции.

## GetTyped

Сигнатура: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Получает значение указанного типа из JSON. Поддерживает пользовательские типы. Возвращает `T` без ошибки. Если путь не существует или преобразование типа не удалось, возвращает нулевое значение или `defaultValue`.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `jsonStr` | `string` | Да | Строка JSON |
| `path` | `string` | Да | Путь JSON |
| `defaultValue` | `...T` | Нет | Необязательное значение по умолчанию, возвращается если путь не существует или преобразование типа не удалось |

**Возвращаемое значение**

| Возвращаемое значение | Тип | Описание |
|----------------------|-----|----------|
| Единственное значение | `T` | Полученное значение; если путь не существует или преобразование типа не удалось — нулевое значение или значение по умолчанию |

**Поддерживаемые типы**

- Базовые типы: `string`, `int`, `int64`, `float64`, `bool`
- Типы срезов: `[]any`
- Типы отображений: `map[string]any`
- Пользовательские структуры

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // Получить строку
    name := json.GetTyped[string](data, "user.name")
    fmt.Println(name) // Вывод: Alice

    // Получить целое число
    age := json.GetTyped[int](data, "user.age")
    fmt.Println(age) // Вывод: 30

    // Получить массив
    arrData := `{"items": [1, 2, 3]}`
    items := json.GetTyped[[]any](arrData, "items")
    fmt.Println(items) // Вывод: [1 2 3]

    // Использовать значение по умолчанию
    email := json.GetTyped[string](data, "user.email", "unknown@example.com")
    fmt.Println(email) // Вывод: unknown@example.com
}
```

---

## AccessResult

`AccessResult` — результат динамического типизированного доступа, предоставляющий методы преобразования типов для динамической обработки. Получается через `SafeGet()`.

### Определение структуры

```go
type AccessResult struct {
    Value  any    // Значение результата
    Exists bool   // Существует ли путь
    Type   string // Информация о типе во время выполнения (для отладки)
}
```

### Методы

#### Ok

Сигнатура: `func (r AccessResult) Ok() bool`

Проверяет, существует ли значение.

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // Значение существует
}
```

#### Unwrap

Сигнатура: `func (r AccessResult) Unwrap() any`

Получает значение, возвращает nil если не существует.

```go
value := result.Unwrap()
```

#### UnwrapOr

Сигнатура: `func (r AccessResult) UnwrapOr(defaultValue any) any`

Получает значение или значение по умолчанию.

```go
value := result.UnwrapOr("default")
```

#### AsString

Сигнатура: `func (r AccessResult) AsString() (string, error)`

Безопасно преобразует в строку. Успешно только если значение имеет тип string.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // Несовпадение типа или путь не существует
}
```

#### AsInt

Сигнатура: `func (r AccessResult) AsInt() (int, error)`

Безопасно преобразует в целое число. Поддерживает все целочисленные типы и float (если это целое значение). **Примечание: bool не преобразуется в int.**

#### AsFloat64

Сигнатура: `func (r AccessResult) AsFloat64() (float64, error)`

Безопасно преобразует в число с плавающей точкой. Поддерживает все числовые типы. **Примечание: bool не преобразуется в float64.**

#### AsBool

Сигнатура: `func (r AccessResult) AsBool() (bool, error)`

Безопасно преобразует в логическое значение. Поддерживает типы bool и string ("true", "false", "1", "0" и т.д.).

### Цепочечные методы преобразования типов

`AccessResult` предоставляет следующие методы преобразования типов:

| Метод | Возвращаемый тип | Описание |
|-------|-----------------|----------|
| `AsString()` | `(string, error)` | Преобразование в строку (строгая проверка типа) |
| `AsStringConverted()` | `(string, error)` | Форматирование в строку |
| `AsInt()` | `(int, error)` | Преобразование в целое число (bool не преобразуется) |
| `AsFloat64()` | `(float64, error)` | Преобразование в float64 (bool не преобразуется) |
| `AsBool()` | `(bool, error)` | Преобразование в логическое значение |

### AsString vs AsStringConverted

| Метод | Поведение | Сценарий использования |
|-------|-----------|----------------------|
| `AsString()` | Строгая проверка типа, успешно только для типа string | Нужно убедиться в оригинальном типе |
| `AsStringConverted()` | Форматирование любого типа в строку | Нужно строковое представление |

```go
// Сценарий: получение значения, которое может быть числом или строкой
result := json.SafeGet(data, "user.id")

// Строгий режим — успешно только когда значение является string
id, err := result.AsString()

// Свободный режим — числа также будут преобразованы в строку
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

Сигнатура: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Построчно читает JSON из `io.Reader`, парсит каждую строку в тип `T` и вызывает функцию обратного вызова. Подходит для обработки больших файлов в формате JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `reader` | `io.Reader` | Да | Источник данных |
| `fn` | `func(lineNum int, data T) error` | Да | Функция обратного вызова для каждой строки, получает номер строки и распарсенные данные |
| `cfg` | `...Config` | Нет | Необязательная конфигурация |

**Возвращаемое значение**

| Возвращаемое значение | Тип | Описание |
|----------------------|-----|----------|
| Первое | `[]T` | Все успешно распарсенные результаты |
| Второе | `error` | Информация об ошибке |

```go
package main

import (
    "fmt"
    "strings"
    "github.com/cybergodev/json"
)

func main() {
    jsonl := `{"name":"Alice","age":30}
{"name":"Bob","age":25}
{"name":"Charlie","age":35}`

    type Person struct {
        Name string `json:"name"`
        Age  int    `json:"age"`
    }

    reader := strings.NewReader(jsonl)
    results, err := json.StreamLinesInto[Person](reader, func(lineNum int, data Person) error {
        fmt.Printf("Строка %d: %s, %d лет\n", lineNum, data.Name, data.Age)
        return nil
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Всего обработано %d записей\n", len(results))
}
```

---

## Примеры использования

### Парсинг конфигурации

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

type DatabaseConfig struct {
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Database string `json:"database"`
    SSL      bool   `json:"ssl"`
}

func main() {
    config := `{
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": "myapp",
            "ssl": true
        }
    }`

    // Парсинг конфигурации в структуру
    dbConfig := json.GetTyped[DatabaseConfig](config, "database")

    fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### Многотиповая обработка

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{
        "name": "Alice",
        "age": 30,
        "active": true,
        "score": 95.5,
        "tags": ["admin", "user"]
    }`

    // Обобщённое получение разных типов
    name := json.GetTyped[string](data, "name")
    age := json.GetTyped[int](data, "age")
    active := json.GetTyped[bool](data, "active")
    score := json.GetTyped[float64](data, "score")
    tags := json.GetTyped[[]any](data, "tags")

    fmt.Printf("Name: %s\n", name)
    fmt.Printf("Age: %d\n", age)
    fmt.Printf("Active: %v\n", active)
    fmt.Printf("Score: %.1f\n", score)
    fmt.Printf("Tags: %v\n", tags)
}
```

### Обработка ошибок

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    config := `{"timeout": 30}`

    timeout := json.GetTyped[int](config, "timeout")
    fmt.Printf("Timeout: %d\n", timeout) // Вывод: 30

    // Путь не существует, возвращается нулевое значение
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Retries: %d\n", retries) // Вывод: 0 (нулевое значение)

    // Путь не существует, используется значение по умолчанию
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Retries: %d\n", retries) // Вывод: 3 (значение по умолчанию)
}
```

---

## Замечания по производительности

Обобщённые операции используют рефлексию для преобразования типов во время выполнения, что несколько медленнее, чем специализированные геттеры (например, `GetString`, `GetInt`). Для чувствительных к производительности сценариев рекомендуется использовать специализированные функции.

| Метод | Производительность | Рекомендуемый сценарий |
|-------|--------------------|----------------------|
| `GetString`, `GetInt` и др. | Наивысшая | Чувствительность к производительности, тип известен |
| `GetTyped[T]` | Средняя | Нужны пользовательские типы |
| `SafeGet` + `AccessResult` | Средняя | Динамическая обработка типов |

---

## Тип Result[T]

`Result[T]` — типобезопасный результат обобщённой операции для сценариев, где требуется определённый тип и обработка ошибок.

### Определение структуры

```go
type Result[T any] struct {
    Value  T     // Значение результата
    Exists bool  // Найден ли путь
    Error  error // Информация об ошибке
}
```

### Методы

| Метод | Возвращаемый тип | Описание |
|-------|-----------------|----------|
| `Ok()` | `bool` | Проверка валидности результата (нет ошибок и найден) |
| `Unwrap()` | `T` | Возвращает значение, при ошибке — нулевое значение |
| `UnwrapOr(default T)` | `T` | Возвращает значение, при ошибке — значение по умолчанию |

### Пример использования

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    data := `{"user": {"name": "Alice", "age": 30}}`

    // GetTyped возвращает T
    name := json.GetTyped[string](data, "user.name")
    fmt.Println("Имя:", name)

    // Несуществующий путь возвращает нулевое значение
    email := json.GetTyped[string](data, "user.email")
    fmt.Println("Email:", email) // Вывод: "" (нулевое значение)

    // Использование значения по умолчанию
    email = json.GetTyped[string](data, "user.email", "none@example.com")
    fmt.Println("Email:", email) // Вывод: none@example.com
}
```

---

## Сравнение Result[T] и AccessResult

| Свойство | Result[T] | AccessResult |
|----------|-----------|---------------------|
| Типобезопасность | Обобщённый тип T | Тип any |
| Проверка существования | `Exists bool` | `Exists bool` |
| Обработка ошибок | Встроенное поле Error | Методы преобразования возвращают error |
| Цепочечные вызовы | Не поддерживаются | Поддерживаются |
| Способ получения | `GetTyped[T]` | `SafeGet()` |
| Сценарий использования | Получение с известным типом | Динамическая обработка типов |

### Рекомендации по выбору

- **Известный тип**: используйте `Result[T]` и `GetTyped[T]`
- **Динамический тип**: используйте `AccessResult` и `SafeGet()`
- **Необходимы цепочечные преобразования**: используйте `AccessResult`
- **Необходима обработка ошибок**: используйте поле Error `Result[T]` или методы преобразования `AccessResult`

---

## Связанные разделы

- [Функции пакета](./functions/) - Специализированные функции-геттеры
- [Определения типов](./types) - Подробное определение AccessResult
- [Конфигурация](./config) - Параметры конфигурации Config
