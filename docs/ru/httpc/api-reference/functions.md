---
title: "Функции пакета - CyberGo HTTPC | Функции пакета"
description: "Справочник API функций пакета HTTPC: семь HTTP-методов Get/Post, создание клиента New, вход загрузки Download, инструменты форматирования и NewDomain."
---

# Функции пакета

## HTTP-методы уровня пакета

Нет необходимости создавать клиент — отправляйте запросы напрямую. Внутри используется лениво инициализируемый клиент по умолчанию.

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

Отправляет GET-запрос.

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

Отправляет POST-запрос.

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

Универсальный метод запроса с контекстом, поддерживающий управление таймаутом и отменой.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## Методы клиента

Интерфейс Client предоставляет те же HTTP-методы, что и функции пакета, плюс метод `Request` с контекстом.

### New

```go
func New(config ...*Config) (Client, error)
```

Создаёт новый HTTP-клиент. Без передачи конфигурации или с `nil` используется `DefaultConfig()`.

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### HTTP-методы клиента

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

### Close

Метод интерфейса Client, освобождающий ресурсы клиента (пул соединений, Transport). После вызова использование клиента невозможно.

```go
// Метод интерфейса Client
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## Управление клиентом по умолчанию

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

Устанавливает пользовательский клиент как клиент по умолчанию для функций пакета. Предыдущий клиент по умолчанию будет автоматически закрыт.

:::warning Ограничение
Принимает только клиентов, созданных через `httpc.New()`. Нельзя установить закрытый клиент.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// Последующие функции пакета используют PerformanceConfig
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

Закрывает клиент по умолчанию и сбрасывает его. При следующем вызове функции пакета будет создан новый клиент.

## Функции загрузки

Функции загрузки уровня пакета используют клиент по умолчанию. Интерфейс Client и DomainClient также предоставляют одноимённые методы с идентичной сигнатурой.

### Download

```go
func Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

`Download` — **единый канонический вход для загрузки** на уровне пакета, интерфейса `Client` и `DomainClient`, заменяющий прежнюю матрицу вариантов `{config}` × `{context}` одной сигнатурой.

`cfg` не может быть nil, и `cfg.FilePath` должен быть задан (иначе возвращается `ErrEmptyFilePath`). Если управление отменой или таймаутом не требуется, передавайте `context.Background()`; параметры запроса служат для установки заголовков, аутентификации, параметров запроса и т. п.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// Функция пакета (использует клиент по умолчанию)
result, err := httpc.Download(context.Background(), url, cfg)

// Метод интерфейса Client
result, err = client.Download(ctx, url, cfg)

// Метод DomainClient (path относительно baseURL, Cookie ответа фиксируется автоматически)
result, err = dc.Download(ctx, "/files/report.pdf", cfg)
```

:::tip Замечание о миграции
Старые `DownloadFile`, `DownloadWithOptions`, `DownloadFileWithContext` и `DownloadWithOptionsWithContext` удалены в v1.5.2. Используйте единый `Download(ctx, url, cfg, options...)`, настраивая путь, перезапись, возобновление и контрольную сумму через `DownloadConfig`.
:::

## Вспомогательные функции

### SetSecurityWarnOutput

```go
func SetSecurityWarnOutput(w io.Writer)
```

Перенаправляет вывод предупреждений безопасности (например, предупреждения `TestingConfig`, `InsecureSkipVerify`). Передайте `io.Discard` для подавления всех предупреждений.

```go
// Подавить все предупреждения безопасности
httpc.SetSecurityWarnOutput(io.Discard)

// Перенаправить в пользовательский лог
httpc.SetSecurityWarnOutput(log.Writer())
```

:::warning
Эта функция в основном предназначена для тестирования. В продакшене следует использовать `SecureConfig()` или `DefaultConfig()`, а не подавлять предупреждения.
:::

## Инструменты форматирования

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

Форматирует количество байт в человекочитаемую строку (например, `"1.50 KB"`, `"500 B"`). Часто используется для отображения результатов загрузки и в логах.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("Загружено %s\n", httpc.FormatBytes(result.BytesWritten))
// Загружено 12.34 MB
```

| Ввод | Вывод |
|------|-------|
| `500` | `500 B` |
| `1536` | `1.50 KB` |
| `1048576` | `1.00 MB` |
| `1073741824` | `1.00 GB` |

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

Форматирует скорость байт/сек в человекочитаемую строку (например, `"1.50 MB/s"`). Часто используется совместно с `DownloadResult.AverageSpeed` или параметром `speed` из `DownloadProgressCallback`.

```go
result, _ := httpc.Download(context.Background(), url, cfg)
fmt.Printf("Средняя скорость %s\n", httpc.FormatSpeed(result.AverageSpeed))
// Средняя скорость 5.67 MB/s

// Использование в обратном вызове прогресса
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%s / %s (%s)",
        httpc.FormatBytes(downloaded),
        httpc.FormatBytes(total),
        httpc.FormatSpeed(speed),
    )
}
```

| Ввод (байт/сек) | Вывод |
|-----------------|-------|
| `500` | `500 B/s` |
| `1536` | `1.50 KB/s` |
| `1048576` | `1.00 MB/s` |

:::tip
Обе функции используют двоичные единицы (основание 1024), последовательность единиц: `B → KB → MB → GB → TB → PB → EB`.
:::

## Доменный клиент

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Создаёт клиент с областью действия домена, автоматически управляющий Cookie и заголовками запросов.

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## См. также

- [Result](./result) - тип результата ответа и методы
- [Параметры запроса](./options) - параметры конфигурации запроса
- [Доменный клиент](./domain-client) - клиент с областью действия домена
- [Загрузка файлов](./download) - функции и типы загрузки
