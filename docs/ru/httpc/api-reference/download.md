---
title: Загрузка файлов - HTTPC
description: Справочник API загрузки файлов HTTPC, охватывающий сигнатуры четырёх функций загрузки, конфигурацию DownloadConfig, обратный вызов прогресса, перечисление контрольных сумм и защиту от обхода пути.
---

# Загрузка файлов

## Функции загрузки уровня пакета

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

Загружает файл по указанному пути с использованием клиента по умолчанию.

```go
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загрузка с конфигурацией, поддерживает докачку и обратный вызов прогресса.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

Загрузка файла с управлением контекстом.

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загрузка файла с конфигурацией и управлением контекстом.

## DownloadConfig

```go
type DownloadConfig struct {
    FilePath          string
    ProgressCallback  DownloadProgressCallback
    Overwrite         bool
    ResumeDownload    bool
    Checksum          string
    ChecksumAlgorithm ChecksumAlgorithm
}

func DefaultDownloadConfig() *DownloadConfig
```

| Поле | Тип | По умолчанию | Описание |
|------|-----|-------------|----------|
| `FilePath` | `string` | - | Путь сохранения (обязательный) |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | Функция обратного вызова прогресса |
| `Overwrite` | `bool` | `false` | Перезаписывать существующий файл |
| `ResumeDownload` | `bool` | `false` | Включить докачку |
| `Checksum` | `string` | `""` | Ожидаемое значение контрольной суммы |
| `ChecksumAlgorithm` | `ChecksumAlgorithm` | `"sha256"` | Алгоритм контрольной суммы |

### DownloadProgressCallback

```go
type DownloadProgressCallback func(downloaded, total int64, speed float64)
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| `downloaded` | `int64` | Количество загруженных байт |
| `total` | `int64` | Общее количество байт (-1 — неизвестно) |
| `speed` | `float64` | Текущая скорость (байт/с) |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s/s)", pct, httpc.FormatSpeed(speed))
}
```

## DownloadResult

```go
type DownloadResult struct {
    FilePath        string
    BytesWritten    int64
    Duration        time.Duration
    AverageSpeed    float64
    StatusCode      int
    ContentLength   int64
    Resumed         bool
    ResponseCookies []*http.Cookie
    ActualChecksum  string
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `FilePath` | `string` | Путь сохранения файла |
| `BytesWritten` | `int64` | Количество записанных байт |
| `Duration` | `time.Duration` | Время загрузки |
| `AverageSpeed` | `float64` | Средняя скорость (байт/с) |
| `StatusCode` | `int` | HTTP-код состояния |
| `ContentLength` | `int64` | Значение заголовка Content-Length |
| `Resumed` | `bool` | Была ли загрузка возобновлена |
| `ResponseCookies` | `[]*http.Cookie` | Cookie ответа |
| `ActualChecksum` | `string` | Фактическая вычисленная контрольная сумма |

```go
fmt.Printf("Загрузка завершена: %s, время %v, средняя скорость %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

## Проверка контрольной суммы

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

Алгоритм проверки целостности загруженного файла.

| Константа | Значение | Описание |
|-----------|---------|----------|
| `ChecksumSHA256` | `"sha256"` | Алгоритм хеширования SHA-256 |

### Пример использования

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.DownloadWithOptions(url, cfg)
if err != nil {
    // При несовпадении контрольной суммы автоматически возвращается ошибка и удаляется загруженный файл
    log.Fatal(err)
}
fmt.Println("Контрольная сумма:", result.ActualChecksum)
```

:::tip Совет
При установке `Checksum` после завершения загрузки автоматически проверяется целостность файла. При несовпадении файл автоматически удаляется и возвращается ошибка — ручное сравнение не требуется.
:::

## Защита безопасности

Загрузка файлов имеет встроенную многоуровневую защиту:

| Защита | Описание |
|--------|----------|
| Блокировка UNC-путей | Запрещает пути формата `\\server\share` |
| Фильтрация управляющих символов | Запрещает управляющие символы в путях |
| Защита системных путей | Запрещает запись в системные каталоги |
| Обнаружение обхода пути | Обнаруживает обход пути через `../` |
| Обнаружение символических ссылок | Предотвращает атаки через символические ссылки |
| Проверка родительских каталогов | Рекурсивная проверка символических ссылок родительских каталогов |

## Докачка

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.DownloadWithOptions(url, cfg)
if result.Resumed {
    fmt.Println("Докачка завершена")
}
```

Механизм докачки:
1. Проверка размера локального файла → используется как смещение для запроса `Range`
2. Сервер возвращает 206 (Partial Content) → дозапись
3. Сервер возвращает 416 (Range Not Satisfiable) → возвращается ошибка
4. Сервер возвращает 200 (Range не поддерживается) → возвращается ошибка (защита локального частичного файла от перезаписи)

## См. также

- [Загрузка и выгрузка файлов](../guides/file-transfer) - руководство по использованию
- [Функции пакета](./functions) - справочник вспомогательных функций
- [Доменный клиент](./domain-client) - методы загрузки доменного клиента
