---
title: "Processor - Парсинг и загрузка - CyberGo JSON | Справочник API"
description: "Справочник методов парсинга и загрузки Processor: Valid, ValidBytes, Parse, ParseAny, PreParse, GetFromParsed, LoadFromFile, SaveToFile, MarshalToFile."
---

# Методы парсинга и загрузки

Processor предоставляет функциональность парсинга JSON и загрузки данных.

## Методы валидации

### Valid

Сигнатура: `func (p *Processor) Valid(jsonStr string, cfg ...Config) (bool, error)`

Проверяет, является ли строка JSON валидной.

```go
valid, err := p.Valid(data)
if valid && err == nil {
    // Валидный JSON
}
```

### ValidBytes

Сигнатура: `func (p *Processor) ValidBytes(data []byte) bool`

Проверяет, является ли байтовый срез валидным JSON.

```go
if p.ValidBytes([]byte(data)) {
    // Валидный JSON
}
```

## Методы парсинга

### Parse

Сигнатура: `func (p *Processor) Parse(jsonStr string, target any, cfg ...Config) error`

Парсит строку JSON в целевую переменную. Поддерживает стандартный режим и режим сохранения чисел.

```go
// Парсинг в map
var obj map[string]any
err := p.Parse(`{"name":"Alice"}`, &obj)

// Парсинг в структуру
type User struct { Name string }
var user User
err = p.Parse(`{"name":"Alice"}`, &user)

// Использование режима сохранения чисел
cfg := json.DefaultConfig()
cfg.PreserveNumbers = true
var data any
err = p.Parse(`{"price":19.99}`, &data, cfg)
```

### ParseAny

Сигнатура: `func (p *Processor) ParseAny(jsonStr string, cfg ...Config) (any, error)`

Парсит строку JSON в тип `any`.

```go
data, err := p.ParseAny(`{"name": "test"}`)
if err != nil {
    panic(err)
}
```

### PreParse

Сигнатура: `func (p *Processor) PreParse(jsonStr string, cfg ...Config) (*ParsedJSON, error)`

Предварительно парсит JSON-данные для последующих многократных запросов к одним и тем же данным без повторного парсинга.

```go
parsed, err := p.PreParse(jsonStr)
if err != nil {
    panic(err)
}

// Многократные запросы к распарсенным данным
name, _ := p.GetFromParsed(parsed, "user.name")
age, _ := p.GetFromParsed(parsed, "user.age")
```

### GetFromParsed

Сигнатура: `func (p *Processor) GetFromParsed(parsed *ParsedJSON, path string, cfg ...Config) (any, error)`

Получает значение из предварительно распарсенных данных. Используется вместе с `PreParse` для повышения производительности многократных запросов.

### SetFromParsed

Сигнатура: `func (p *Processor) SetFromParsed(parsed *ParsedJSON, path string, value any, cfg ...Config) (*ParsedJSON, error)`

Устанавливает значение в предварительно распарсенных данных, возвращает новый `ParsedJSON`.

```go
parsed, _ := p.PreParse(jsonStr)
newParsed, err := p.SetFromParsed(parsed, "user.name", "Bob")
```

## Загрузка из файла

### LoadFromFile

Сигнатура: `func (p *Processor) LoadFromFile(filePath string, cfg ...Config) (string, error)`

Загружает JSON-данные из файла и возвращает исходную строку.

```go
data, err := p.LoadFromFile("config.json")
if err != nil {
    panic(err)
}
fmt.Println(data) // Исходная строка JSON
```

### LoadFromFileAsData (приватизировано)

::: warning Изменение API
`LoadFromFileAsData` преобразован во внутренний метод (`loadFromFileAsData`) и больше не экспортируется как публичный API. Используйте комбинацию `LoadFromFile` + `Parse`:

```go
jsonStr, err := p.LoadFromFile("data.json")
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
// data имеет тип map[string]any или []any
if obj, ok := data.(map[string]any); ok {
    fmt.Println(obj["name"])
}
```
:::

## Загрузка из Reader

### LoadFromReader

Сигнатура: `func (p *Processor) LoadFromReader(reader io.Reader, cfg ...Config) (string, error)`

Загружает JSON-данные из Reader и возвращает исходную строку.

```go
file, _ := os.Open("data.json")
defer file.Close()

data, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
```

### LoadFromReaderAsData (приватизировано)

::: warning Изменение API
`LoadFromReaderAsData` преобразован во внутренний метод (`loadFromReaderAsData`) и больше не экспортируется как публичный API. Используйте комбинацию `LoadFromReader` + `Parse`:

```go
file, _ := os.Open("data.json")
defer file.Close()

jsonStr, err := p.LoadFromReader(file)
if err != nil {
    panic(err)
}
var data any
err = p.Parse(jsonStr, &data)
```
:::

## Выбор метода

| Сценарий | Рекомендуемый метод |
|----------|---------------------|
| Нужна исходная строка | `LoadFromFile` / `LoadFromReader` |
| Нужны распарсенные данные | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| Многократные запросы к одним данным | `PreParse` + `GetFromParsed` |
| Только проверка валидности | `Valid` / `ValidBytes` |
| Парсинг в целевую переменную | `Parse` |
| Сохранение данных в файл | `SaveToFile` / `MarshalToFile` |
| Запись в Writer | `SaveToWriter` |
| Чтение из файла и декодирование | `UnmarshalFromFile` |

## Запись в файл

### SaveToFile

Сигнатура: `func (p *Processor) SaveToFile(filePath string, data any, cfg ...Config) error`

Сохраняет данные как JSON-файл. Автоматически создаёт родительские каталоги.

```go
err := p.SaveToFile("data.json", map[string]any{"name": "CyberGo"})

// Сохранение с форматированием используя PrettyConfig
err = p.SaveToFile("data.json", data, json.PrettyConfig())
```

### MarshalToFile

Сигнатура: `func (p *Processor) MarshalToFile(path string, data any, cfg ...Config) error`

Кодирует данные в JSON и записывает в файл. Автоматически создаёт родительские каталоги.

```go
err := p.MarshalToFile("output.json", data)

// Форматированное сохранение
err = p.MarshalToFile("output.json", data, json.PrettyConfig())
```

### UnmarshalFromFile

Сигнатура: `func (p *Processor) UnmarshalFromFile(path string, v any, cfg ...Config) error`

Читает JSON из файла и декодирует в целевую переменную.

```go
var config Config
err := p.UnmarshalFromFile("config.json", &config)
if err != nil {
    panic(err)
}
```

### SaveToWriter

Сигнатура: `func (p *Processor) SaveToWriter(writer io.Writer, data any, cfg ...Config) error`

Кодирует данные в JSON и записывает в io.Writer.

```go
var buf bytes.Buffer
err := p.SaveToWriter(&buf, data, json.PrettyConfig())
```

## Связанные разделы

- [Методы вывода](./output) - Методы Encode/EncodePretty
- [Запросы по пути](./query) - Методы Get
