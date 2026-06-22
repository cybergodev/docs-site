---
title: "Processor - Методы вывода - CyberGo JSON | Справочник API"
description: "Методы вывода Processor CyberGo JSON: Encode, EncodePretty, EncodeWithConfig, EncodeBatch/EncodeFields и Compact/Indent/HTMLEscape для разных форматов вывода."
---

# Методы вывода

Processor предоставляет различные методы кодирования и вывода JSON.

## Базовый вывод

### Encode

Сигнатура: `func (p *Processor) Encode(value any, config ...Config) (string, error)`

Кодирует любое значение в строку JSON.

```go
result, err := p.Encode(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(result)
```

### EncodePretty

Сигнатура: `func (p *Processor) EncodePretty(value any, config ...Config) (string, error)`

Кодирует любое значение в форматированную строку JSON.

```go
result, err := p.EncodePretty(user)
if err != nil {
    panic(err)
}
```

## Продвинутое кодирование

### EncodeWithConfig

Сигнатура: `func (p *Processor) EncodeWithConfig(value any, cfg ...Config) (string, error)`

Кодирует значение в строку JSON с использованием указанной конфигурации.

**Параметры**

| Имя | Тип | Обязательный | Описание |
|-----|-----|:------------:|----------|
| `value` | `any` | Да | Значение для кодирования |
| `cfg` | `Config` | Нет | Конфигурация кодирования (необязательно) |

```go
// Использование PrettyConfig
result, err := p.EncodeWithConfig(data, json.PrettyConfig())

// Использование SecurityConfig
result, err = p.EncodeWithConfig(data, json.SecurityConfig())

// Использование пользовательской конфигурации
cfg := json.DefaultConfig()
cfg.Pretty = true
cfg.SortKeys = true
cfg.EscapeHTML = true
result, err = p.EncodeWithConfig(data, cfg)
```

### EncodeBatch

Сигнатура: `func (p *Processor) EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Массовое кодирование пар ключ-значение в JSON-объект.

```go
result, err := p.EncodeBatch(map[string]any{
    "name": "CyberGo",
    "version": "1.0.0",
})
```

### EncodeFields

Сигнатура: `func (p *Processor) EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

Кодирует только указанные поля, часто используется для частичной сериализации.

```go
type User struct {
    Name    string `json:"name"`
    Email   string `json:"email"`
    Private string `json:"private"`
}

user := User{Name: "CyberGo", Email: "test@example.com", Private: "secret"}
// Кодировать только поля name и email
result, err := p.EncodeFields(user, []string{"name", "email"})
```

### EncodeStream

Сигнатура: `func (p *Processor) EncodeStream(values any, cfg ...Config) (string, error)`

Кодирует несколько значений в поток JSON-массива (array stream). `values` обычно представляет собой срез или перечислимую коллекцию, выводя строку JSON-массива вида `[v1,v2,...]`.

```go
values := []any{"item1", "item2", "item3"}
result, err := p.EncodeStream(values)
```

## Кодирование/декодирование

### Marshal

Сигнатура: `func (p *Processor) Marshal(value any, cfg ...Config) ([]byte, error)`

Кодирует значение Go в байтовый срез JSON. 100% совместимо с `encoding/json.Marshal`.

```go
data, err := p.Marshal(map[string]any{"name": "CyberGo"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"CyberGo"}
```

### MarshalIndent

Сигнатура: `func (p *Processor) MarshalIndent(value any, prefix, indent string, cfg ...Config) ([]byte, error)`

Кодирует значение Go в форматированный байтовый срез JSON. 100% совместимо с `encoding/json.MarshalIndent`.

```go
data, err := p.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

### Unmarshal

Сигнатура: `func (p *Processor) Unmarshal(data []byte, value any, cfg ...Config) error`

Парсит байтовый срез JSON в целевую переменную. 100% совместимо с `encoding/json.Unmarshal`.

```go
var user User
err := p.Unmarshal([]byte(`{"name":"Alice","age":30}`), &user)
if err != nil {
    panic(err)
}
```

## Форматирование

### Prettify

Сигнатура: `func (p *Processor) Prettify(jsonStr string, cfg ...Config) (string, error)`

Форматирует строку JSON с отступами.

```go
pretty, err := p.Prettify(`{"name":"Alice","age":30}`)
// Вывод:
// {
//   "name": "Alice",
//   "age": 30
// }
```

### Print (удалено)

::: warning Изменение API
`Print`, `PrintE`, `PrintPretty`, `PrintPrettyE` удалены из библиотеки и больше не предоставляются. Используйте следующие альтернативы:

```go
// Компактный вывод
s, err := p.EncodeWithConfig(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(s)

// Форматированный вывод
pretty, err := p.EncodePretty(data)
if err != nil {
    log.Fatal(err)
}
fmt.Println(pretty)
```
:::

### ValidateSchema

Сигнатура: `func (p *Processor) ValidateSchema(jsonStr string, schema *Schema, cfg ...Config) ([]ValidationError, error)`

Проверяет, соответствует ли JSON-данные указанной Schema.

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"name", "email"},
    Properties: map[string]*json.Schema{
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
    },
}

errors, err := p.ValidateSchema(jsonStr, schema)
if err != nil {
    panic(err)
}
for _, ve := range errors {
    fmt.Printf("Путь %s: %s\n", ve.Path, ve.Message)
}
```

## Операции форматирования

### Compact

Сигнатура: `func (p *Processor) Compact(jsonStr string, cfg ...Config) (string, error)`

Сжимает строку JSON, удаляя все пробельные символы.

```go
compact, err := p.Compact(`{"name": "CyberGo"}`)
// Вывод: {"name":"CyberGo"}
```

### CompactBuffer

Сигнатура: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Сжимает JSON и записывает в Buffer.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "test"}`))
```

### Indent

Сигнатура: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Форматирует JSON и записывает в Buffer.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

### HTMLEscape

Сигнатура: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Выполняет HTML-экранирование JSON и записывает в Buffer.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

## Связанные разделы

- [Config](../config) - Параметры конфигурации
- [Парсинг и загрузка](./parse) - Методы Parse/Load
