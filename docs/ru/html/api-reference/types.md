---
title: "Типы - CyberGo HTML | структуры данных"
description: "Типы данных CyberGo HTML: поля Result (с MarshalJSON), ImageInfo, LinkInfo, LinkResource, Statistics, BatchResult и других ключевых структур."
---

# Определения типов

## Result

Результат извлечения, содержащий текст, метаданные и медиа-информацию.

```go
type Result struct {
    Text           string        `json:"text"`
    Title          string        `json:"title"`
    Images         []ImageInfo   `json:"images,omitempty"`
    Links          []LinkInfo    `json:"links,omitempty"`
    Videos         []VideoInfo   `json:"videos,omitempty"`
    Audios         []AudioInfo   `json:"audios,omitempty"`
    ProcessingTime time.Duration `json:"-"`       // Время обработки (не участвует в стандартной сериализации)
    WordCount      int           `json:"word_count"`
    ReadingTime    time.Duration `json:"-"`       // Расчётное время чтения (не участвует в стандартной сериализации)
}
```

### MarshalJSON

Пользовательская JSON-сериализация. Поля `ProcessingTime` и `ReadingTime` имеют тег `json:"-"` (стандартная сериализация их пропускает), но через пользовательский метод `MarshalJSON()` они выводятся в виде миллисекунд.

```go
func (r *Result) MarshalJSON() ([]byte, error)
```

## ImageInfo

Информация об изображении.

```go
type ImageInfo struct {
    URL          string `json:"url"`           // Адрес изображения
    Alt          string `json:"alt"`           // Альтернативный текст
    Title        string `json:"title"`         // Заголовок
    Width        string `json:"width"`         // Ширина
    Height       string `json:"height"`        // Высота
    IsDecorative bool   `json:"is_decorative"` // Является ли декоративным изображением
    Position     int    `json:"position"`      // Позиция в документе
}
```

## LinkInfo

Информация о ссылке.

```go
type LinkInfo struct {
    URL        string `json:"url"`         // Адрес ссылки
    Text       string `json:"text"`        // Текст ссылки
    Title      string `json:"title"`       // Заголовок ссылки
    IsExternal bool   `json:"is_external"` // Является ли внешней ссылкой
    IsNoFollow bool   `json:"is_nofollow"` // Имеет ли nofollow
    Position   int    `json:"position"`    // Позиция в документе
}
```

## VideoInfo

Информация о видео.

```go
type VideoInfo struct {
    URL      string `json:"url"`      // Адрес видео
    Type     string `json:"type"`     // Тип видео
    Poster   string `json:"poster"`   // Адрес обложки
    Width    string `json:"width"`    // Ширина
    Height   string `json:"height"`   // Высота
    Duration string `json:"duration"` // Длительность
}
```

## AudioInfo

Информация об аудио.

```go
type AudioInfo struct {
    URL      string `json:"url"`      // Адрес аудио
    Type     string `json:"type"`     // Тип аудио
    Duration string `json:"duration"` // Длительность
}
```

## LinkResource

Ссылочный ресурс (для API извлечения ссылок).

```go
type LinkResource struct {
    URL   string // Адрес ссылки
    Title string // Заголовок ссылки
    Type  string // Тип ссылки
}
```

## Statistics

Статистика обработки.

```go
type Statistics struct {
    TotalProcessed    int64         // Общее количество обработанных
    CacheHits         int64         // Попаданий в кэш
    CacheMisses       int64         // Промахов кэша
    ErrorCount        int64         // Количество ошибок
    AverageProcessTime time.Duration // Среднее время обработки
}
```

## BatchResult

Результат пакетной обработки.

```go
type BatchResult struct {
    Results   []*Result // Результаты извлечения, nil при неудаче или отмене
    Errors    []error   // Ошибки неудачных операций
    Success   int       // Количество успешных
    Failed    int       // Количество неудачных
    Cancelled int       // Количество отменённых
}
```

## NodeAttr

Атрибут HTML-узла.

```go
type NodeAttr struct {
    Key   string // Имя атрибута
    Value string // Значение атрибута
}
```
