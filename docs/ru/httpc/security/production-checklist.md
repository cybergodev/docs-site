---
title: Контрольный список для продакшена - HTTPC
description: "Контрольный список безопасности для развёртывания HTTPC в производственной среде, включая проверку версии TLS и конфигурации сертификатов, подтверждение стратегии защиты от SSRF, настройку таймаутов и ограничений размера тела ответа, выбор и оптимизацию стратегии повторных попыток, управление освобождением ресурсов через defer Close и мониторинг метрик пула соединений"
---

# Контрольный список для продакшена

## Обязательные проверки

### Конфигурация TLS

- [ ] `InsecureSkipVerify` установлен в `false` (значение по умолчанию)
- [ ] `MinTLSVersion` не ниже `tls.VersionTLS12`
- [ ] Не используется `TestingConfig()`

### Защита от SSRF

- [ ] `AllowPrivateIPs` установлен в `false` (значение по умолчанию)
- [ ] При необходимости доступа к внутренним сервисам используйте точное указание через `SSRFExemptCIDRs`
- [ ] При обработке URL, предоставленных пользователем, используйте `SecureConfig()`

### Конфигурация таймаутов

- [ ] Все значения таймаутов установлены и обоснованы
- [ ] `Timeouts.Request` не равен 0 (предотвращает бесконечное ожидание)
- [ ] Рассмотрите использование `WithContext` для установки таймаута каждого запроса

### Ограничения ответов

- [ ] `MaxResponseBodySize` установлен в разумный предел
- [ ] `MaxDecompressedBodySize` установлен в разумный предел
- [ ] При обработке больших ответов используйте потоковую загрузку

### Конфигурация повторных попыток

- [ ] `MaxRetries` не превышает 5
- [ ] Осторожно используйте повторные попытки для неидемпотентных запросов (POST/PUT/PATCH)
- [ ] Включите `EnableJitter` для предотвращения эффекта «гром среди ясного неба»

### Управление ресурсами

- [ ] Вызывайте `Close()` после использования клиента
- [ ] Вызывайте `ReleaseResult()` после использования Result
- [ ] Используйте `defer` для гарантированного освобождения ресурсов

## Рекомендуемые проверки

### Промежуточное ПО

- [ ] Используйте `RecoveryMiddleware()` для предотвращения краха при panic
- [ ] Используйте `LoggingMiddleware()` для логирования запросов
- [ ] Используйте `MetricsMiddleware()` для сбора метрик
- [ ] В чувствительных к безопасности сценариях используйте `AuditMiddleware()`

### Заголовки запросов

- [ ] Установите осмысленный `User-Agent`
- [ ] Не храните конфиденциальную информацию в заголовках по умолчанию
- [ ] Используйте `WithBearerToken` вместо ручной установки Authorization

### Cookie

- [ ] В чувствительных к безопасности сценариях включите проверку `CookieSecurity`
- [ ] Используйте `StrictCookieSecurityConfig()` для принудительной проверки атрибутов безопасности

### Редиректы

- [ ] В сценариях с пользовательским вводом URL отключите редиректы
- [ ] Используйте `RedirectWhitelist` для ограничения целей редиректов

## Примеры кода

### Создание клиента для продакшена

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // Таймауты
    cfg.Timeouts.Request = 30 * time.Second
    cfg.Timeouts.Dial = 10 * time.Second
    cfg.Timeouts.TLSHandshake = 10 * time.Second
    cfg.Timeouts.ResponseHeader = 30 * time.Second

    // Пул соединений
    cfg.Connection.MaxIdleConns = 50
    cfg.Connection.MaxConnsPerHost = 10

    // Безопасность
    cfg.Security.AllowPrivateIPs = false
    cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024

    // Повторные попытки
    cfg.Retry.MaxRetries = 3
    cfg.Retry.Delay = 1 * time.Second
    cfg.Retry.EnableJitter = true

    // Промежуточное ПО
    cfg.Middleware.UserAgent = "my-service/1.0"
    cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
        httpc.RecoveryMiddleware(),
        httpc.LoggingMiddleware(log.Printf),
        httpc.RequestIDMiddleware("X-Request-ID", nil),
    }

    return httpc.New(cfg)
}
```

### Клиент с повышенной безопасностью

```go
func createSecureClient() (httpc.Client, error) {
    cfg := httpc.SecureConfig()
    cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
    cfg.Security.RedirectWhitelist = []string{"api.example.com"}
    return httpc.New(cfg)
}
```

## Команды проверки

```bash
# Проверка неправильного использования TestingConfig
grep -r "TestingConfig" --include="*.go" | grep -v "_test.go"

# Проверка InsecureSkipVerify
grep -r "InsecureSkipVerify.*true" --include="*.go" | grep -v "_test.go"

# Проверка AllowPrivateIPs
grep -r "AllowPrivateIPs.*true" --include="*.go" | grep -v "_test.go"
```

## Что дальше

- [Обзор безопасности](./) - Обзор функций безопасности
- [Защита от SSRF](./ssrf) - Подробно о защите от SSRF
- [Конфигурация API](../api-reference/config) - Полный справочник конфигурации
