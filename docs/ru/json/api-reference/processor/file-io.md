---
sidebar_label: "Файловый ввод-вывод"
title: "Processor: файлы - CyberGo JSON | API"
description: "Файловые методы Processor CyberGo JSON: LoadFromFile/LoadFromReader, SaveToFile/MarshalToFile, UnmarshalFromFile, SaveToWriter."
sidebar_position: 9
---

# Методы файлового ввода-вывода

Processor предоставляет методы чтения/записи JSON-файлов и потоковой загрузки, охватывающие файлы, `io.Reader` и `io.Writer`.

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
LoadFromFileAsData преобразован во внутренний метод (`loadFromFileAsData`) и больше не экспортируется как публичный API. Используйте комбинацию `LoadFromFile` + `Parse`:

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
LoadFromReaderAsData преобразован во внутренний метод (`loadFromReaderAsData`) и больше не экспортируется как публичный API. Используйте комбинацию `LoadFromReader` + `Parse`:

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

## Выбор метода

| Сценарий | Рекомендуемый метод |
|----------|---------------------|
| Нужна исходная строка | `LoadFromFile` / `LoadFromReader` |
| Нужны распарсенные данные | `LoadFromFile` + `Parse` / `LoadFromReader` + `Parse` |
| Сохранение данных в файл | `SaveToFile` / `MarshalToFile` |
| Запись в Writer | `SaveToWriter` |
| Чтение из файла и декодирование | `UnmarshalFromFile` |

## Связанные разделы

- [Парсинг и валидация](./parse) - методы Parse/Valid
- [Файловые функции](../functions/file-io) - файловые функции уровня пакета
