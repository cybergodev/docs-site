---
title: "Загрузка и выгрузка файлов - CyberGo HTTPC | Resume & Hash"
description: "Руководство по загрузке файлов HTTPC: выгрузка WithFile, мультизагрузка WithFormData, единый Download, возобновляемая загрузка и защита SHA-256."
---

# Загрузка и выгрузка файлов

## Выгрузка файлов

### Простая выгрузка файла

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

Загрузка файла с одновременной передачей полей формы:

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

### Бинарная выгрузка

```go
data, _ := os.ReadFile("data.bin")
result, err := httpc.Post(url,
    httpc.WithBinary(data, "application/octet-stream"),
)
```

## Загрузка файлов

`Download(ctx, url, cfg, options...)` — единый канонический вход для загрузки на уровне пакета, `Client` и `DomainClient`.

### Базовая загрузка

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
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
    fmt.Printf("\rЗагрузка: %.1f%% (%s)", pct, httpc.FormatSpeed(speed))
}

result, err := httpc.Download(context.Background(), "https://example.com/file.zip", cfg)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("\nЗагрузка завершена: %s, средняя скорость %s\n",
    httpc.FormatBytes(result.BytesWritten),
    httpc.FormatSpeed(result.AverageSpeed),
)
```

### Докачка

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    log.Fatal(err)
}

if result.Resumed {
    fmt.Printf("Докачка завершена: возобновлено с точки останова\n")
}
```

:::tip
Докачка зависит от поддержки сервером заголовка `Range`. Если сервер не поддерживает Range (возвращает 200 вместо 206), будет возвращена ошибка для защиты частично загруженного файла.
:::

### С управлением контекстом

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"

result, err := httpc.Download(ctx, url, cfg)
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        log.Println("Таймаут загрузки")
    }
    log.Fatal(err)
}
```

## Защита безопасности

Загрузка файлов включает многоуровневую защиту:

| Уровень защиты | Описание |
|----------------|----------|
| Валидация пути | Блокировка UNC-путей, управляющих символов, обхода пути |
| Защита системных путей | Запрет записи в `/etc/`, `C:\Windows\` и другие системные каталоги |
| Обнаружение символических ссылок | Предотвращение атак через символические ссылки |
| Ограничение размера файла | Ограничено настройкой `MaxResponseBodySize` |

## Загрузка через доменный клиент

Загрузки через доменный клиент автоматически фиксируют Cookie ответа в сессии:

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)

// Загрузка с автоматическим управлением сессией (path относительно baseURL)
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/report.pdf"

result, err := dc.Download(context.Background(), "/files/report.pdf", cfg)
```

## Что дальше

- [Загрузка файлов API](../api-reference/download) - полный справочник API загрузки
- [Доменный клиент и сессии](./domain-session) - управление сессиями
- [Запросы и ответы](./request-response) - руководство по базовым запросам
