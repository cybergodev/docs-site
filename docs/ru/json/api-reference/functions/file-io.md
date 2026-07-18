---
sidebar_label: "Файловый ввод-вывод"
title: "Файловые функции - CyberGo JSON | API"
description: "Файловые функции CyberGo JSON: LoadFromFile/SaveToFile, LoadFromReader/SaveToWriter, MarshalToFile/UnmarshalFromFile."
sidebar_position: 9
---

# Функции файловых операций

Пакет json предоставляет функции файловых операций, поддерживающие чтение/запись файлов и потоковый ввод-вывод.

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

Читает и десериализует данные из файла.

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

Загружает JSON-данные из io.Reader. Подходит для чтения JSON из потоковых источников, таких как сетевые соединения, тела HTTP-запросов и т. д.

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
data, err = json.LoadFromReader(strings.NewReader(`{"name":"test"}`))
```

### SaveToWriter

Сигнатура: `func SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Записывает JSON-данные в io.Writer.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `writer` | `io.Writer` | Да | Целевой вывод |
| `data` | `any` | Да | Данные для записи |
| `cfg` | `Config` | Нет | Необязательная конфигурация |

```go
var buf bytes.Buffer
err := json.SaveToWriter(&buf, map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
```

## Связанные разделы

- [Функции обработки JSONL](./jsonl) - Обработка JSON с разделением строками ParseJSONL, StreamLinesInto и др.
- [Функции кодирования и вывода](./output) - Операции сериализации Marshal, Unmarshal и др.
- [Потоковая обработка](../../streaming/large-files) - Подробное описание потокового процессора
