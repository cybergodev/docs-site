---
title: "Кодирование и декодирование - CyberGo JSON | API"
description: "Кодирование/декодирование CyberGo JSON: Marshal/Unmarshal, Compact/Indent/HTMLEscape и Encode/EncodePretty/Prettify, совместимые со стандартной библиотекой."
---

# Функции кодирования и декодирования

Функции кодирования и декодирования, предоставляемые пакетом json, включают сериализацию, десериализацию, форматирование и настраиваемое кодирование.

## Функции сериализации

### Marshal

Сигнатура: `func Marshal(value any) ([]byte, error)`

Сериализация значения Go в срез байт JSON. 100% совместимость с `encoding/json.Marshal`.

```go
data, err := json.Marshal(map[string]any{"name": "test"})
if err != nil {
    panic(err)
}
fmt.Println(string(data)) // {"name":"test"}
```

:::tip
`Marshal` не принимает параметры конфигурации. Для кодирования с конфигурацией используйте [EncodeWithConfig](#encodewithconfig).
:::

### Unmarshal

Сигнатура: `func Unmarshal(data []byte, value any) error`

Десериализация среза байт JSON в значение Go. 100% совместимость с `encoding/json.Unmarshal`.

```go
var result struct {
    Name string `json:"name"`
}
err := json.Unmarshal([]byte(`{"name":"test"}`), &result)
```

### MarshalIndent

Сигнатура: `func MarshalIndent(v any, prefix, indent string) ([]byte, error)`

Сериализация с отступами. 100% совместимость с `encoding/json.MarshalIndent`.

```go
data, err := json.MarshalIndent(user, "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(string(data))
```

:::tip
`MarshalIndent` не принимает параметры конфигурации. Для кодирования с конфигурацией используйте [EncodeWithConfig](#encodewithconfig).
:::

## Функции форматирования

### Compact

Сигнатура: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Сжатие JSON с удалением ненужных пробелов, результат записывается в `dst`. Совместимость с `encoding/json.Compact`.

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
if err != nil {
    panic(err)
}
fmt.Println(buf.String()) // {"name":"test"}
```

### Indent

Сигнатура: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Форматирование JSON с добавлением отступов, результат записывается в `dst`. Совместимость с `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
if err != nil {
    panic(err)
}
fmt.Println(buf.String())
// {
//   "name": "test"
// }
```

### HTMLEscape

Сигнатура: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

HTML-экранирование содержимого JSON, замена специальных символов `<`, `>`, `&` (а также U+2028, U+2029) на соответствующие Unicode-escape последовательности, результат записывается в `dst`. Возвращаемого значения нет.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
fmt.Println(buf.String())
// {"html":"\u003cscript\u003ealert(1)\u003c/script\u003e"}
```

### Prettify

Сигнатура: `func Prettify(jsonStr string, cfg ...Config) (string, error)`

Форматирование JSON-строки с отступами по умолчанию, возвращает отформатированную строку.

```go
pretty, err := json.Prettify(`{"name":"Alice","age":30}`)
if err != nil {
    panic(err)
}
fmt.Println(pretty)
// {
//   "name": "Alice",
//   "age": 30
// }
```

## Функции настраиваемого кодирования

### Encode

Сигнатура: `func Encode(value any, cfg ...Config) (string, error)`

Кодирование значения Go в JSON-строку с поддержкой необязательного параметра конфигурации.

```go
result, err := json.Encode(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**С конфигурацией**

```go
result, err := json.Encode(user, json.SecurityConfig())
```

### EncodePretty

Сигнатура: `func EncodePretty(value any, cfg ...Config) (string, error)`

Кодирование значения Go в форматированную JSON-строку (с отступами) с поддержкой необязательного параметра конфигурации.

```go
result, err := json.EncodePretty(user)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**С конфигурацией**

```go
result, err := json.EncodePretty(user, json.PrettyConfig())
```

### EncodeWithConfig

Сигнатура: `func EncodeWithConfig(value any, cfg ...Config) (string, error)`

Кодирование значения Go в JSON-строку с использованием указанной конфигурации. Подходит для сценариев, требующих точного контроля над поведением кодирования.

```go
// С конфигурацией красивой печати
result, err := json.EncodeWithConfig(data, json.PrettyConfig())
if err != nil {
    panic(err)
}
fmt.Println(result)
```

**Использование конфигурации безопасности**

```go
result, err := json.EncodeWithConfig(data, json.SecurityConfig())
```

## Функции пакетного кодирования

### EncodeBatch

Сигнатура: `func EncodeBatch(pairs map[string]any, cfg ...Config) (string, error)`

Пакетное кодирование пар ключ-значение в строку JSON-объекта.

```go
result, err := json.EncodeBatch(map[string]any{
    "name":  "Alice",
    "age":   30,
    "email": "alice@example.com",
})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"age":30,"email":"alice@example.com","name":"Alice"}
```

### EncodeFields

Сигнатура: `func EncodeFields(value any, fields []string, cfg ...Config) (string, error)`

Кодирование только указанных полей для реализации фильтрации вывода.

```go
user := struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
}{
    Name: "Alice", Email: "a@b.com", Password: "secret",
}

// Вывод только открытых полей
result, err := json.EncodeFields(user, []string{"name", "email"})
if err != nil {
    panic(err)
}
fmt.Println(result) // {"name":"Alice","email":"a@b.com"}
```

### EncodeStream

Сигнатура: `func EncodeStream(values any, cfg ...Config) (string, error)`

Кодирует несколько значений в поток JSON-массива (array stream). `values` обычно представляет собой срез или перечислимую коллекцию, выводя строку JSON-массива вида `[v1,v2,...]`.

```go
values := []map[string]any{
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
}

result, err := json.EncodeStream(values)
if err != nil {
    panic(err)
}
fmt.Println(result)
```

## Методы форматирования Processor

Тип `Processor` предоставляет дополнительные методы форматирования. Используйте `json.New()` для создания Processor (возвращает `(*Processor, error)`):

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()
```

### Processor.CompactBuffer

Сигнатура: `func (p *Processor) CompactBuffer(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Сжатие байт JSON и запись в буфер `dst`. Функция `Compact` уровня пакета делегирует этому методу.

```go
var buf bytes.Buffer
err := p.CompactBuffer(&buf, []byte(`{"name": "Alice"}`))
// buf.String() => {"name":"Alice"}
```

### Processor.Indent

Сигнатура: `func (p *Processor) Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Запись JSON с отступами в буфер `dst`. Совместимость с `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := p.Indent(&buf, []byte(`{"name":"Alice"}`), "", "  ")
```

### Processor.HTMLEscape

Сигнатура: `func (p *Processor) HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Запись HTML-экранированного JSON в буфер `dst`, без возвращаемого значения. Совместимость с `encoding/json.HTMLEscape`.

```go
var buf bytes.Buffer
p.HTMLEscape(&buf, []byte(`{"html":"<script>"}`))
```

:::tip
Полную документацию по Processor см. в разделе [Processor](../interfaces).
:::

## Предустановки конфигурации

Следующие вспомогательные функции возвращают преднастроенные значения `Config`, которые можно передать в любую функцию, принимающую `...Config`:

```go
// Конфигурация по умолчанию
cfg := json.DefaultConfig()

// Конфигурация красивой печати
cfg = json.PrettyConfig()

// Конфигурация безопасности
cfg = json.SecurityConfig()
```

:::tip
Полную документацию по полям Config см. в разделе [Конфигурация](../config).
:::

## Смотрите также

- [Функции запросов и получения](./get) - Операции запросов Get, GetString и др.
- [Функции изменения](./modify) - Операции изменения Set, Delete и др.
- [Файловые операции](./file-io) - Файловые операции LoadFromFile, SaveToFile и др.
- [Конфигурация](../config) - Тип Config и параметры
- [Интерфейсы](../interfaces) - Типы Processor, Encoder, Decoder
