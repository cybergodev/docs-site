---
sidebar_label: "Парсинг и валидация"
title: "Processor: парсинг - CyberGo JSON | API"
description: "Методы парсинга Processor CyberGo JSON: Valid, Parse, ParseAny, PreParse и GetFromParsed с настраиваемым парсингом."
sidebar_position: 6
---

# Методы парсинга и валидации

Processor предоставляет функциональность парсинга JSON и проверки валидности. Чтение/запись файлов и потоковая загрузка описаны в разделе [Файловый ввод-вывод](./file-io).

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

## Выбор метода

| Сценарий | Рекомендуемый метод |
|----------|---------------------|
| Только проверка валидности | `Valid` / `ValidBytes` |
| Парсинг в целевую переменную | `Parse` |
| Многократные запросы к одним данным | `PreParse` + `GetFromParsed` |

## Связанные разделы

- [Файловый ввод-вывод](./file-io) - файловые методы LoadFromFile/SaveToFile
- [Методы вывода](./output) - методы кодирования Encode/EncodePretty
- [Запросы по пути](./query) - Методы Get
