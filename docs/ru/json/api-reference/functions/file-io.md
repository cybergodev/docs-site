---
title: "Функции файловых операций - CyberGo JSON | Справочник API"
description: "Полный справочник файловых операций CyberGo JSON: включая LoadFromReader для чтения из потока, ParseJSONL/ToJSONL для обработки JSONL, StreamLinesInto[T] для обобщённой потоковой обработки, NewJSONLWriter для записи и подробное описание конфигурации JSONL."
---

# Функции файловых операций

Функции файловых операций и обработки JSONL, предоставляемые пакетом json.

## Функции чтения файлов

### LoadFromFile

Сигнатура: `func LoadFromFile(filePath string, cfg ...Config) (string, error)`

Загрузка JSON-данных из файла.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `filePath` | `string` | Да | Путь к файлу |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
data, err := json.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data)
```

### SaveToFile

Сигнатура: `func SaveToFile(filePath string, data any, cfg ...Config) error`

Сохранение JSON-данных в файл.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `filePath` | `string` | Да | Путь к файлу |
| `data` | `any` | Да | Данные для сохранения |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
err := json.SaveToFile("output.json", map[string]any{
    "name": "Alice",
    "age":  30,
})
if err != nil {
    panic(err)
}
```

### MarshalToFile

Сигнатура: `func MarshalToFile(filePath string, data any, cfg ...Config) error`

Сериализация данных и запись в файл.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `filePath` | `string` | Да | Путь к файлу |
| `data` | `any` | Да | Данные для сериализации |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

Сигнатура: `func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

Чтение из файла и десериализация данных.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `filePath` | `string` | Да | Путь к файлу |
| `v` | `any` | Да | Указатель на целевой объект |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
var config MyConfig
err := json.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### LoadFromReader

Сигнатура: `func LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Загрузка JSON-данных из io.Reader. Подходит для чтения JSON из сетевых соединений, тела HTTP-запроса и других потоковых источников данных.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `reader` | `io.Reader` | Да | Источник данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
// Чтение из тела HTTP-ответа
resp, _ := http.Get("https://api.example.com/data")
defer resp.Body.Close()
data, err := json.LoadFromReader(resp.Body)

// Чтение из строки
data, err := json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

Сигнатура: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Запись JSON-данных в io.Writer.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `writer` | `io.Writer` | Да | Цель вывода |
| `data` | `any` | Да | Данные для записи |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

## Функции обработки JSONL

JSONL (JSON Lines) — формат JSON с разделением строками, где каждая строка содержит независимый JSON-объект.

### ParseJSONL

Сигнатура: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Парсинг данных JSONL (JSON с разделением строками).

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `data` | `[]byte` | Да | Байтовые данные JSONL |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
jsonl := `{"name":"Alice"}
{"name":"Bob"}
{"name":"Charlie"}`
results, err := json.ParseJSONL([]byte(jsonl))
if err != nil {
    panic(err)
}
for i, r := range results {
    fmt.Printf("[%d] %v\n", i, r)
}
```

### StreamLinesInto

Сигнатура: `func StreamLinesInto[T any](reader io.Reader, fn func(lineNum int, data T) error, cfg ...Config) ([]T, error)`

Потоковое чтение данных JSONL из io.Reader с обработкой каждой строки через callback-функцию. Это рекомендуемый способ обобщённой обработки JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `reader` | `io.Reader` | Да | Источник данных |
| `fn` | `func(lineNum int, data T) error` | Да | Callback обработки (получает номер строки и данные) |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Возвращаемые значения**

| Тип | Описание |
|------|------|
| `[]T` | Срез всех обработанных результатов |
| `error` | Информация об ошибке |

```go
type User struct {
    Name string `json:"name"`
}

file, _ := os.Open("users.jsonl")
defer file.Close()

// Базовое использование
results, err := json.StreamLinesInto[User](file, func(lineNum int, user User) error {
    fmt.Printf("Строка %d: Пользователь %s\n", lineNum, user.Name)
    return nil // Возврат error прервёт обработку
})
if err != nil {
    panic(err)
}
fmt.Printf("Всего обработано %d записей\n", len(results))
```

### ToJSONL

Сигнатура: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Преобразование среза данных в формат JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `data` | `[]any` | Да | Срез данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
items := []any{
    map[string]any{"name": "Alice"},
    map[string]any{"name": "Bob"},
}
jsonl, err := json.ToJSONL(items)
if err != nil {
    panic(err)
}
fmt.Println(string(jsonl))
// {"name":"Alice"}
// {"name":"Bob"}
```

### ToJSONLString

Сигнатура: `func ToJSONLString(data []any, cfg ...Config) (string, error)`

Преобразование среза данных в строку JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|------|------|------|------|
| `data` | `[]any` | Да | Срез данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
jsonlStr, err := json.ToJSONLString(items)
```

## Конфигурация JSONL

::: warning
Независимая структура `JSONLConfig` и функция `DefaultJSONLConfig()` удалены. Конфигурация JSONL унифицирована и интегрирована в поля `JSONL*` структуры `Config`.
:::

### Конфигурация JSONL через Config

```go
cfg := json.DefaultConfig()

// Конфигурация JSONL
cfg.JSONLBufferSize    = 64 * 1024    // Размер буфера чтения (по умолчанию: 64 КБ)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Максимальный размер одной строки (по умолчанию: 1 МБ)
cfg.JSONLSkipEmpty     = true         // Пропускать пустые строки (по умолчанию: true)
cfg.JSONLSkipComments  = false        // Пропускать строки с комментариями (по умолчанию: false)
cfg.JSONLContinueOnErr = false        // Продолжать при ошибке (по умолчанию: false)
cfg.JSONLWorkers       = 4            // Количество параллельных горутин (по умолчанию: 4)
cfg.JSONLChunkSize     = 1000         // Строк на пакет (по умолчанию: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Максимальная память (по умолчанию: 100 МБ)

processor, err := json.New(cfg)
```

Подробнее см. [Конфигурация Config](../config#config-Структура)

## Writer для записи JSONL

### NewJSONLWriter

Сигнатура: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Создание writer'а для записи JSONL.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
```

**Методы JSONLWriter**

| Метод | Сигнатура | Описание |
|------|------|------|
| `Write` | `(data any) error` | Запись одной строки |
| `WriteAll` | `(data []any) error` | Запись нескольких строк |
| `WriteRaw` | `(line []byte) error` | Запись сырой байтовой строки |
| `Err` | `() error` | Возврат накопленной ошибки |
| `Stats` | `() JSONLStats` | Возврат статистики записи |

```go
jw := json.NewJSONLWriter(file)

items := []any{
    map[string]any{"id": 1, "name": "Alice"},
    map[string]any{"id": 2, "name": "Bob"},
}
if err := jw.WriteAll(items); err != nil {
    log.Fatal(err)
}

if err := jw.Err(); err != nil {
    log.Fatal(err)
}
```

## Смотрите также

- [Функции кодирования и декодирования](./encode-decode) - Операции сериализации Marshal, Unmarshal и др.
- [Потоковая обработка](../../large-files) - Подробное описание потокового обработчика
- [Методы JSONL процессора](../processor/jsonl) - Подробное описание методов JSONL уровня Processor
