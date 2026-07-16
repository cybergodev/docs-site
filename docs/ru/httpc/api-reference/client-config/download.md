---
sidebar_label: "Скачивание файлов"
title: "Загрузка файлов - CyberGo HTTPC | Download и проверка"
description: "Справочник API загрузки файлов HTTPC: единый вход Download, конфигурация DownloadConfig, обратные вызовы прогресса, проверка SHA-256 и защита UNC."
sidebar_position: 4
---

# Загрузка файлов

## Функции загрузки уровня пакета

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загружает файл с использованием клиента по умолчанию. `Download` — **единый канонический вход для загрузки** на уровне пакета, интерфейса `Client` и `DomainClient`, заменяющий прежнюю матрицу вариантов одной сигнатурой. `cfg` не может быть nil, и `cfg.FilePath` должен быть задан (иначе возвращается `ErrEmptyFilePath`).

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
```

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
| `FilePath` | `string` | - | Путь сохранения (обязательно) |
| `ProgressCallback` | `DownloadProgressCallback` | `nil` | Обратный вызов прогресса |
| `Overwrite` | `bool` | `false` | Перезаписать существующий файл |
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
| `total` | `int64` | Общее количество байт (-1 если неизвестно) |
| `speed` | `float64` | Текущая скорость (байт/сек) |

```go
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    pct := float64(downloaded) / float64(total) * 100
    fmt.Printf("\r%.1f%% (%s)", pct, httpc.FormatSpeed(speed))
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
    Proto           string
    ResponseHeaders http.Header
    RequestURL      string
    RequestMethod   string
    RequestHeaders  http.Header
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `FilePath` | `string` | Путь сохранения файла |
| `BytesWritten` | `int64` | Количество записанных байт |
| `Duration` | `time.Duration` | Время загрузки |
| `AverageSpeed` | `float64` | Средняя скорость (байт/сек) |
| `StatusCode` | `int` | HTTP-код состояния |
| `ContentLength` | `int64` | Значение заголовка Content-Length |
| `Resumed` | `bool` | Завершена ли докачка |
| `ResponseCookies` | `[]*http.Cookie` | Cookie ответа |
| `ActualChecksum` | `string` | Фактическая контрольная сумма |
| `Proto` | `string` | Версия HTTP-протокола (например `"HTTP/1.1"`, `"HTTP/2.0"`) |
| `ResponseHeaders` | `http.Header` | Заголовки ответа |
| `RequestURL` | `string` | Фактический URL запроса |
| `RequestMethod` | `string` | HTTP-метод запроса |
| `RequestHeaders` | `http.Header` | Заголовки запроса |

```go
fmt.Printf("Загрузка завершена: %s, время %v, средняя скорость %s\n",
    httpc.FormatBytes(result.BytesWritten),
    result.Duration,
    httpc.FormatSpeed(result.AverageSpeed),
)
```

:::tip
Используйте [FormatBytes](../core/functions#formatbytes) и [FormatSpeed](../core/functions#formatspeed), чтобы получить человекочитаемые строки байт и скорости и не выполнять вручную пересчёт по основанию `1024`.
:::

## Проверка контрольной суммы

### ChecksumAlgorithm

```go
type ChecksumAlgorithm string
```

Алгоритм проверки целостности загруженного файла.

| Константа | Значение | Описание |
|-----------|----------|----------|
| `ChecksumSHA256` | `"sha256"` | Алгоритм хеширования SHA-256 |

### Пример использования

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/package.tar.gz"
cfg.Checksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
cfg.ChecksumAlgorithm = httpc.ChecksumSHA256

result, err := httpc.Download(context.Background(), url, cfg)
if err != nil {
    // При несовпадении контрольной суммы автоматически возвращается ошибка и удаляется загруженный файл
    log.Fatal(err)
}
fmt.Println("Контрольная сумма:", result.ActualChecksum)
```

:::tip
При установке `Checksum` после завершения загрузки автоматически проверяется целостность файла. При несовпадении файл автоматически удаляется и возвращается ошибка, ручное сравнение не требуется.
:::

## Защита безопасности

Загрузка файлов включает многоуровневую защиту:

| Защита | Описание |
|--------|----------|
| Блокировка UNC-путей | Запрет путей формата `\\server\share` |
| Фильтрация управляющих символов | Запрет управляющих символов в пути |
| Защита системных путей | Запрет записи в системные каталоги |
| Обнаружение обхода пути | Обнаружение обхода пути `../` |
| Обнаружение символических ссылок | Предотвращение атак через символические ссылки |
| Проверка родительских каталогов | Рекурсивная проверка символических ссылок родительских каталогов |

## Докачка

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/large-file.zip"
cfg.ResumeDownload = true

result, err := httpc.Download(context.Background(), url, cfg)
if result.Resumed {
    fmt.Println("Докачка завершена")
}
```

Механизм докачки:
1. Проверка размера локального файла → используется как смещение запроса Range
2. Сервер возвращает 206 (Partial Content) → дозапись
3. Сервер возвращает 416 (Range Not Satisfiable) → возврат ошибки
4. Сервер возвращает 200 (Range не поддерживается) → возврат ошибки (защита локального частичного файла от перезаписи)

## См. также

- [Загрузка и выгрузка файлов](../../guides/file-transfer) - руководство по использованию
- [Функции пакета](../core/functions) - справочник вспомогательных функций
- [Доменный клиент](./domain-client) - методы загрузки доменного клиента
