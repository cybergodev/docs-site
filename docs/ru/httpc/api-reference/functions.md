---
title: Функции пакета - HTTPC
description: Справочник API функций пакета и методов клиента HTTPC, охватывающий семь HTTP-методов, функцию создания New, серию Download и метод повторного использования объектов ReleaseResult.
---

# Функции пакета

## HTTP-методы уровня пакета

Отправляйте запросы напрямую без создания клиента. Внутри используется лениво инициализированный клиент по умолчанию.

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

Универсальный метод запроса с контекстом, поддерживает управление тайм-аутом и отменой.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## Методы клиента

Интерфейс Client предоставляет те же HTTP-методы, что и функции уровня пакета, а также метод `Request` с контекстом.

### New

```go
func New(config ...*Config) (Client, error)
```

Создаёт новый HTTP-клиент. Без передачи конфигурации или при передаче `nil` используется `DefaultConfig()`.

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

Метод интерфейса Client, освобождающий ресурсы, удерживаемые клиентом (пул соединений, Transport). После вызова клиент нельзя использовать.

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

Устанавливает пользовательский клиент в качестве клиента по умолчанию для использования функциями уровня пакета. Старый клиент по умолчанию будет автоматически закрыт.

:::warning Ограничение
Принимает только клиентов, созданных через `httpc.New()`. Нельзя установить уже закрытый клиент.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// Последующие функции уровня пакета используют PerformanceConfig
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

Закрывает клиент по умолчанию и сбрасывает его. При следующем вызове функции уровня пакета будет создан новый клиент.

## Управление результатами

### ReleaseResult

```go
func ReleaseResult(r *Result)
```

Возвращает Result в пул объектов для снижения нагрузки на GC. После вызова Result нельзя использовать.

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
```

:::warning Предупреждение
После вызова `ReleaseResult` не обращайтесь к Result — его внутренние данные будут обнулены.
:::

## Функции загрузки

Функции загрузки уровня пакета используют клиент по умолчанию. Интерфейс Client также предоставляет одноимённые методы.

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

Загружает файл по указанному пути с использованием клиента по умолчанию.

```go
// Функция уровня пакета
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")

// Метод интерфейса Client
result, err := client.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загрузка файла с конфигурацией, поддерживает докачку и обратный вызов прогресса.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// Функция уровня пакета
result, err := httpc.DownloadWithOptions(url, cfg)
// Метод интерфейса Client
result, err = client.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

Загрузка файла с управлением контекстом, поддерживает тайм-аут и отмену.

```go
// Функция уровня пакета
result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
// Метод интерфейса Client
result, err = client.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
```

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

Загрузка файла с конфигурацией и управлением контекстом.

```go
// Функция уровня пакета
result, err := httpc.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
// Метод интерфейса Client
result, err = client.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
```

## Вспомогательные функции

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

Форматирует количество байт в читаемую строку.

```go
httpc.FormatBytes(1536)      // "1.50 KB"
httpc.FormatBytes(1048576)   // "1.00 MB"
```

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

Форматирует скорость передачи в читаемую строку.

```go
httpc.FormatSpeed(1536.0)    // "1.50 KB/s"
httpc.FormatSpeed(1048576.0) // "1.00 MB/s"
```

## Доменный клиент

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

Создаёт клиент с областью видимости домена, автоматически управляющий Cookie и заголовками.

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## См. также

- [Result](./result) - тип результата ответа и методы
- [Параметры запросов](./options) - параметры конфигурации запросов
- [Доменный клиент](./domain-client) - клиент с областью видимости домена
- [Загрузка файлов](./download) - функции и типы загрузки
