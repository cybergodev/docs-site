---
title: Загрузка и скачивание файлов - HTTPC
description: "Полное руководство по загрузке и скачиванию файлов HTTPC, охватывающее загрузку нескольких файлов через Multipart-форму с полями формы, скачивание больших файлов по частям с обратным вызовом прогресса, механизм возобновления загрузки, автоматическую проверку контрольных сумм SHA-256, многоуровневую защиту от обхода каталогов и проверку безопасности путей к файлам"
---

# Загрузка и скачивание файлов

## Загрузка файлов

### Простая загрузка файла

```go
fileContent, err := os.ReadFile("document.pdf")
if err != nil {
    log.Fatal(err)
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFile("file", "document.pdf", fileContent),
)
```

### Multipart-форма

Загрузка файла с дополнительными полями формы:

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "title": "My Document",
        "type":  "pdf",
    },
    Files: map[string]*httpc.FileData{
        "file": {
            Filename: "report.pdf",
            Content:  fileContent,
        },
    },
}

result, err := httpc.Post("https://api.example.com/upload",
    httpc.WithFormData(form),
)
```

### Множественная загрузка файлов

```go
form := &httpc.FormData{
    Fields: map[string]string{
        "description": "Пакетная загрузка",
    },
    Files: map[string]*httpc.FileData{
        "file1": {Filename: "doc1.pdf", Content: content1},
        "file2": {Filename: "doc2.pdf", Content: content2},
        "file3": {Filename: "image.png", Content: content3},
    },
}

result, err := httpc.Post(url, httpc.WithFormData(form))
```

### Бинарная загрузка

```go
data, _ := os.ReadFile("data.bin")
result, err := httpc.Post(url,
    httpc.WithBinary(data, "application/octet-stream"),
)
```

## Скачивание файлов

### Базовое скачивание

```go
result, err := httpc.DownloadFile(
    "https://example.com/file.zip",
    "/tmp/file.zip",
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Загрузка завершена: %s\n", httpc.FormatBytes(result.BytesWritten))
fmt.Printf("Время: %v\n", result.Duration)
```

### С обратным вызовом прогресса

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\rЗагрузка: %.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}

result, err := httpc.DownloadWithOptions("https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nЗагрузка завершена: %s, средняя скорость %s\n",
    httpc.FormatBytes(result.BytesWritten),
    httpc.FormatSpeed(result.AverageSpeed),
)
```

### Возобновление загрузки

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    log.Fatal(err)
}

if result.Resumed {
    fmt.Printf("Возобновление завершено: продолжено с точки остановки\n")
}
```

:::tip
Возобновление загрузки зависит от поддержки сервером заголовка `Range`. Если сервер не поддерживает его (возвращает 200 вместо 206), будет возвращена ошибка для защиты уже загруженной части файла.
:::

### С управлением контекстом

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("Таймаут загрузки")
    }
    log.Fatal(err)
}
```

## Защита безопасности

Скачивание файлов включает многоуровневую защиту:

| Уровень защиты | Описание |
|----------------|----------|
| Валидация пути | Блокировка UNC-путей, управляющих символов, обхода каталогов |
| Защита системных путей | Запрет записи в `/etc/`, `C:\Windows\` и другие системные каталоги |
| Обнаружение символических ссылок | Предотвращение атак через символические ссылки |
| Ограничение размера файла | Ограничивается `MaxResponseBodySize` |

## Скачивание через доменный клиент

Скачивание через доменный клиент автоматически захватывает Cookie ответа в сессию:

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

// Скачивание с автоматическим управлением сессией
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")
```

## Что дальше

- [API скачивания файлов](../api-reference/download) — полный справочник API скачивания
- [Доменный клиент и сессии](./domain-session) — управление сессиями
- [Запросы и ответы](./request-response) — базовое руководство по запросам
