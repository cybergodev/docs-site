---
title: "Функции файловых операций - CyberGo JSON | Справочник API"
description: "Полный справочник файловых операций CyberGo JSON: LoadFromReader чтение из потока, ParseJSONL/ToJSONL обработка JSONL, StreamLinesInto[T] обобщённая потоковая обработка, NewJSONLWriter писатель и конфигурация JSONL."
---

# Функции файловых операций

Функции файловых операций и обработки JSONL пакета json.

## Функции чтения файлов

### LoadFromFile

Сигнатура: `func LoadFromFile(filePath string, cfg ...Config) (string, error)`

Загружает JSON-данные из файла.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Сохраняет JSON-данные в файл.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Сериализует данные и записывает в файл.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `filePath` | `string` | Да | Путь к файлу |
| `data` | `any` | Да | Данные для сериализации |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
err := json.MarshalToFile("data.json", myStruct)
```

### UnmarshalFromFile

Сигнатура: `func UnmarshalFromFile(filePath string, v any, cfg ...Config) error`

Читает из файла и десериализует данные.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Загружает JSON-данные из io.Reader. Подходит для чтения JSON из сетевых соединений, тел HTTP-запросов и других потоковых источников данных.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Записывает JSON-данные в io.Writer.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

JSONL (JSON Lines) — формат с разделением строками, где каждая строка представляет отдельный JSON-объект.

### ParseJSONL

Сигнатура: `func ParseJSONL(data []byte, cfg ...Config) ([]any, error)`

Парсит данные JSONL (JSON с разделением строками).

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Потоково читает данные JSONL из io.Reader и обрабатывает каждую строку через функцию обратного вызова. Это рекомендуемый обобщённый способ обработки JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `reader` | `io.Reader` | Да | Источник данных |
| `fn` | `func(lineNum int, data T) error` | Да | Обратный вызов обработки (получает номер строки и данные) |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

**Возвращаемое значение**

| Тип | Описание |
|-----|----------|
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
    fmt.Printf("Строка %d: пользователь %s\n", lineNum, user.Name)
    return nil // Возврат ошибки прервет обработку
})
if err != nil {
    panic(err)
}
fmt.Printf("Всего обработано %d записей\n", len(results))
```

### ToJSONL

Сигнатура: `func ToJSONL(data []any, cfg ...Config) ([]byte, error)`

Преобразует срез данных в формат JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
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

Преобразует срез данных в строку JSONL.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `data` | `[]any` | Да | Срез данных |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
jsonlStr, err := json.ToJSONLString(items)
```

## Конфигурация JSONL

::: warning
Отдельная структура `JSONLConfig` и функция `DefaultJSONLConfig()` удалены. Конфигурация JSONL теперь интегрирована в поля `JSONL*` структуры `Config`.
:::

### Конфигурация JSONL через Config

```go
cfg := json.DefaultConfig()

// Конфигурация JSONL
cfg.JSONLBufferSize    = 64 * 1024    // Размер буфера чтения (по умолчанию: 64KB)
cfg.JSONLMaxLineSize   = 1024 * 1024  // Максимальный размер одной строки (по умолчанию: 1MB)
cfg.JSONLSkipEmpty     = true         // Пропускать пустые строки (по умолчанию: true)
cfg.JSONLSkipComments  = false        // Пропускать строки с комментариями (по умолчанию: false)
cfg.JSONLContinueOnErr = false        // Продолжать при ошибке (по умолчанию: false)
cfg.JSONLWorkers       = 4            // Количество параллельных горутин (по умолчанию: 4)
cfg.JSONLChunkSize     = 1000         // Строк на пакет обработки (по умолчанию: 1000)
cfg.JSONLMaxMemory     = 100 * 1024 * 1024 // Максимальная память (по умолчанию: 100MB)

processor, err := json.New(cfg)
```

Подробнее см. [Конфигурация Config](../config#структура-config)

## JSONL-писатель

### NewJSONLWriter

Сигнатура: `func NewJSONLWriter(writer io.Writer, cfg ...Config) *JSONLWriter`

Создаёт JSONL-писатель.

```go
file, _ := os.Create("output.jsonl")
defer file.Close()
jw := json.NewJSONLWriter(file)
jw.Write(map[string]any{"id": 1, "name": "Alice"})
jw.Write(map[string]any{"id": 2, "name": "Bob"})
```

**Методы JSONLWriter**

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Write` | `(data any) error` | Записать одну строку |
| `WriteAll` | `(data []any) error` | Записать несколько строк |
| `WriteRaw` | `(line []byte) error` | Записать сырую байтовую строку |
| `Err` | `() error` | Возвращает накопленную ошибку |
| `Stats` | `() JSONLStats` | Возвращает статистику записи |

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

## Связанные разделы

- [Функции кодирования/декодирования](./encode-decode) - Операции сериализации Marshal, Unmarshal и др.
- [Потоковая обработка](../../large-files) - Подробное описание потокового процессора
- [Методы Processor JSONL](../processor/jsonl) - Подробное описание методов JSONL уровня Processor
