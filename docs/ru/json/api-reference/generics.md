---
title: Обобщённые операции - CyberGo JSON | Справочник API
description: "Полный справочник обобщённых API CyberGo JSON: подробное описание функции GetTyped[T] для получения значений с обобщёнными типами, типа Result[T], AccessResult для динамического доступа к типам и руководство по типобезопасным операциям с использованием обобщений Go 1.18+."
---

# Обобщённые операции

Библиотека json предоставляет типобезопасные обобщённые операции, используя возможности обобщений Go 1.18+ для проверки типов во время компиляции.

## GetTyped

Сигнатура: `func GetTyped[T any](jsonStr, path string, defaultValue ...T) T`

Получает значение указанного типа из JSON. Поддерживает пользовательские типы. Возвращает `T` без ошибки. Если путь не существует или преобразование типа не удалось, возвращает нулевое значение или значение по умолчанию, указанное через `defaultValue`.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `jsonStr` | `string` | Да | Строка JSON |
| `path` | `string` | Да | Путь JSON |
| `defaultValue` | `...T` | Нет | Необязательное значение по умолчанию, возвращается если путь не существует или преобразование типа не удалось |

**Возвращаемое значение**

| Возвращаемое значение | Тип | Описание |
|--------|------|------|
| Единственное возвращаемое значение | `T` | Полученное значение; если путь не существует или преобразование типа не удалось, возвращается нулевое значение или значение по умолчанию |

**Поддерживаемые типы**

- Базовые типы: `string`, `int`, `int64`, `float64`, `bool`
- Типы срезов: `[]any`
- Типы отображений: `map[string]any`
- Пользовательные структуры

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

`AccessResult` — результат динамического доступа к типу, предоставляет методы преобразования типов для динамической обработки. Получается через `SafeGet()`.

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

Проверяет, существует ли значение и нет ли ошибки.

```go
result := json.SafeGet(data, "user.name")
if result.Ok() {
    // Значение существует и нет ошибок
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

Безопасное преобразование в строку. Успешно только если само значение имеет тип string.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    // Несовпадение типа или путь не существует
}
```

#### AsInt

Сигнатура: `func (r AccessResult) AsInt() (int, error)`

Безопасное преобразование в целое число. Поддерживает все целочисленные типы и float (если значение является целым числом). **Примечание: bool не преобразуется в int.**

#### AsFloat64

Сигнатура: `func (r AccessResult) AsFloat64() (float64, error)`

Безопасное преобразование в число с плавающей точкой. Поддерживает все числовые типы. **Примечание: bool не преобразуется в float64.**

#### AsBool

Сигнатура: `func (r AccessResult) AsBool() (bool, error)`

Безопасное преобразование в логическое значение. Поддерживает типы bool и string ("true", "false", "1", "0" и т.д.).

### Методы цепочечного преобразования типов

`AccessResult` предоставляет следующие методы преобразования типов:

| Метод | Возвращаемый тип | Описание |
|------|----------|------|
| `AsString()` | `(string, error)` | Преобразование в строку (строгая проверка типа) |
| `AsStringConverted()` | `(string, error)` | Форматирование в строку |
| `AsInt()` | `(int, error)` | Преобразование в целое число (bool не преобразуется) |
| `AsFloat64()` | `(float64, error)` | Преобразование в float64 (bool не преобразуется) |
| `AsBool()` | `(bool, error)` | Преобразование в логическое значение |

### AsString vs AsStringConverted

| Метод | Поведение | Вариант использования |
|------|------|----------|
| `AsString()` | Строгая проверка типа, успешно только для типа string | Когда нужно убедиться в исходном типе |
| `AsStringConverted()` | Форматирование любого типа в строку | Когда нужно строковое представление |

```go
// Сценарий: получить значение, которое может быть числом или строкой
result := json.SafeGet(data, "user.id")

// Строгий режим - успешно только если значение является string
id, err := result.AsString()

// Мягкий режим - число также будет преобразовано в строку
idStr, err := result.AsStringConverted()
```

---

## StreamLinesInto

Сигнатура: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Построчно читает JSON из `io.Reader`, разбирает каждую строку как тип `T` и вызывает функцию обратного вызова. Подходит для обработки больших файлов в формате JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `reader` | `io.Reader` | Да | Источник данных |
| `fn` | `func(lineNum int, data T) error` | Да | Функция обратного вызова для каждой строки, получает номер строки и разобранные данные |
| `cfg` | `...Config` | Нет | Необязательная конфигурация |

**Возвращаемые значения**

| Возвращаемое значение | Тип | Описание |
|--------|------|------|
| Первое | `[]T` | Все успешно разобранные результаты |
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

### Разбор конфигурации

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

    // Разобрать конфигурацию в структуру
    dbConfig := json.GetTyped[DatabaseConfig](config, "database")

    fmt.Printf("Host: %s:%d\n", dbConfig.Host, dbConfig.Port)
}
```

### Обработка нескольких типов

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

    fmt.Printf("Имя: %s\n", name)
    fmt.Printf("Возраст: %d\n", age)
    fmt.Printf("Активен: %v\n", active)
    fmt.Printf("Балл: %.1f\n", score)
    fmt.Printf("Теги: %v\n", tags)
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
    fmt.Printf("Таймаут: %d\n", timeout) // Вывод: 30

    // Путь не существует, возвращается нулевое значение
    retries := json.GetTyped[int](config, "retries")
    fmt.Printf("Повторные попытки: %d\n", retries) // Вывод: 0 (нулевое значение)

    // Путь не существует, используется значение по умолчанию
    retries = json.GetTyped[int](config, "retries", 3)
    fmt.Printf("Повторные попытки: %d\n", retries) // Вывод: 3 (значение по умолчанию)
}
```

---

## Примечания по производительности

Обобщённые операции используют рефлексию для преобразования типов во время выполнения, что несколько медленнее, чем специфичные для типа геттеры (такие как `GetString`, `GetInt`). Для сценариев, чувствительных к производительности, рекомендуется использовать специфичные для типа функции.

| Метод | Производительность | Рекомендуемый сценарий |
|------|------|----------|
| `GetString`, `GetInt` и др. | Самый быстрый | Чувствительность к производительности, тип известен |
| `GetTyped[T]` | Средний | Пользовательские типы |
| `SafeGet` + `AccessResult` | Средний | Динамическая обработка типов |

---

## Тип Result[T]

`Result[T]` — типобезопасный результат обобщённой операции, используемый в сценариях, где требуется явный тип и обработка ошибок.

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
|------|----------|------|
| `Ok()` | `bool` | Проверяет, действителен ли результат (нет ошибки и путь найден) |
| `Unwrap()` | `T` | Возвращает значение, при ошибке возвращает нулевое значение |
| `UnwrapOr(default T)` | `T` | Возвращает значение, при ошибке возвращает значение по умолчанию |

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
|------|-----------|---------------------|
| Типобезопасность | Обобщённый тип T | Тип any |
| Проверка существования | `Exists bool` | `Exists bool` |
| Обработка ошибок | Встроенное поле Error | Методы преобразования типов возвращают error |
| Цепочечные вызовы | Не поддерживаются | Поддерживают цепочечное преобразование типов |
| Способ получения | `GetTyped[T]` | `SafeGet()` |
| Вариант использования | Получение с известным типом | Динамическая обработка типов |

### Рекомендации по выбору

- **Известный тип**: используйте `Result[T]` и `GetTyped[T]`
- **Динамический тип**: используйте `AccessResult` и `SafeGet()`
- **Необходимо цепочечное преобразование**: используйте `AccessResult`
- **Необходима обработка ошибок**: используйте поле Error `Result[T]` или методы преобразования типов `AccessResult`

---

## Связанные разделы

- [Функции пакета](./functions) - Специфичные для типов функции-геттеры
- [Определения типов](./types) - Подробное определение AccessResult
- [Конфигурация](./config) - Параметры конфигурации ProcessorOptions
