---
title: "Шпаргалка — HTTPC"
description: "Шпаргалка HTTPC: создание клиента и пять предустановок конфигурации, семь HTTP-методов Get/Post, 27 функций параметров запросов WithXxx, обработка ответов Result, цепочка промежуточного ПО, тип ошибок ClientError и полные фрагменты кода для загрузки файлов."
---

# Шпаргалка

## Создание клиента

```go
// Конфигурация по умолчанию
client, _ := httpc.New()
defer client.Close()

// Пользовательская конфигурация
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

## HTTP-методы

```go
// Функции уровня пакета (используют клиент по умолчанию)
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// Методы экземпляра
result, _ := client.Get(url)

// С контекстом
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## Параметры запросов

### Заголовки запроса

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### Тело запроса

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // загрузка файла
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // с указанием типа
httpc.WithBody(data)                    // автоопределение типа
httpc.WithBody(data, httpc.BodyJSON)    // явное указание: BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

### Параметры запроса

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
```

### Аутентификация

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookie

```go
httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"})
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig())
```

### Управление

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithMaxRetries(3)
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(5)
httpc.WithStreamBody(true)
```

### Обратные вызовы

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("отправка %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("получен ответ: %d", resp.StatusCode())
    return nil
})
```

## Обработка ответов

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // парсинг JSON
result.GetCookie("name")               // получение Cookie из ответа
result.HasCookie("name")               // проверка Cookie в ответе
result.ResponseCookies()               // все Cookie ответа
result.RequestCookies()                // все Cookie запроса
result.GetRequestCookie("name")        // получение Cookie запроса
result.HasRequestCookie("name")        // проверка Cookie запроса
result.SaveToFile("/path/to/file")     // сохранение в файл
result.String()                        // читаемое представление (заголовки с маскировкой)
httpc.ReleaseResult(result)            // возврат в пул объектов
```

## Конфигурация

```go
cfg := httpc.DefaultConfig()

// Таймауты
cfg.Timeouts.Request = 30 * time.Second
cfg.Timeouts.Dial = 10 * time.Second
cfg.Timeouts.TLSHandshake = 10 * time.Second
cfg.Timeouts.ResponseHeader = 30 * time.Second
cfg.Timeouts.IdleConn = 90 * time.Second

// Соединения
cfg.Connection.MaxIdleConns = 50
cfg.Connection.MaxConnsPerHost = 10
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// Безопасность
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}

// Повторные попытки
cfg.Retry.MaxRetries = 3
cfg.Retry.Delay = 1 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

## Промежуточное ПО

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(log.Printf),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.TimeoutMiddleware(30 * time.Second),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
    }),
}
```

## Обработка ошибок

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // Таймаут
        case httpc.ErrorTypeNetwork:
            // Сетевая ошибка
        case httpc.ErrorTypeTLS:
            // Ошибка TLS
        case httpc.ErrorTypeDNS:
            // Ошибка разрешения DNS
        case httpc.ErrorTypeContextCanceled:
            // Контекст отменён
        case httpc.ErrorTypeRetryExhausted:
            // Исчерпаны повторные попытки
        case httpc.ErrorTypeValidation:
            // Ошибка валидации запроса
        case httpc.ErrorTypeHTTP:
            // Ошибка уровня HTTP
        // Другие: ErrorTypeUnknown, ErrorTypeResponseRead,
        //         ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // Можно повторить
        }
    }
}
```

## Загрузка файлов

```go
dlResult, err := client.DownloadFile(url, "/path/to/file")

// С параметрами
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%s/s)", float64(downloaded)/float64(total)*100, httpc.FormatSpeed(speed))
}
dlResult, err := client.DownloadWithOptions(url, dlCfg)

// dlResult имеет тип *DownloadResult (не *Result)
// Поля: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## Доменный клиент

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```
