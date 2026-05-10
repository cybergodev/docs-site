---
title: Контрольный список для production - HTTPC
description: Контрольный список безопасности HTTPC для production, охватывающий проверку конфигурации TLS, подтверждение защиты от SSRF, тайм-ауты и ограничения размера, стратегию повторных попыток, освобождение ресурсов и мониторинг аудита.
---

# Контрольный список для production

## Обязательные проверки

### Конфигурация TLS

- [ ] `InsecureSkipVerify` установлен в `false` (значение по умолчанию)
- [ ] `MinTLSVersion` не ниже `tls.VersionTLS12`
- [ ] Не используется `TestingConfig()`

### Защита от SSRF

- [ ] `AllowPrivateIPs` равен `false` (значение по умолчанию)
- [ ] При необходимости доступа к внутренним сервисам используйте точные исключения `SSRFExemptCIDRs`
- [ ] При обработке пользовательских URL используйте `SecureConfig()`

### Конфигурация тайм-аутов

- [ ] Все значения тайм-аутов установлены и разумны
- [ ] `Timeouts.Request` не равен 0 (предотвращает бесконечное ожидание)
- [ ] Рассмотрите использование `WithContext` для установки тайм-аута каждого запроса

### Ограничения ответов

- [ ] `MaxResponseBodySize` установлен в разумный предел
- [ ] `MaxDecompressedBodySize` установлен в разумный предел
- [ ] При обработке больших ответов используйте потоковую загрузку

### Конфигурация повторных попыток

- [ ] `MaxRetries` не превышает 5
- [ ] Для неидемпотентных запросов (POST/PUT/PATCH) используйте повторные попытки с осторожностью
- [ ] Включите `EnableJitter` для предотвращения эффекта стада

### Управление ресурсами

- [ ] Клиент закрывается через `Close()` после использования
- [ ] Result освобождается через `ReleaseResult()` после использования
- [ ] Используйте `defer` для гарантии освобождения ресурсов

## Рекомендуемые проверки

### Промежуточное ПО

- [ ] Используйте `RecoveryMiddleware()` для предотвращения падения при panic
- [ ] Используйте `LoggingMiddleware()` для логирования запросов
- [ ] Используйте `MetricsMiddleware()` для сбора метрик
- [ ] В чувствительных к безопасности сценариях используйте `AuditMiddleware()`

### Заголовки запроса

- [ ] Установите осмысленный `User-Agent`
- [ ] Не храните конфиденциальную информацию в заголовках по умолчанию
- [ ] Используйте `WithBearerToken` вместо ручной установки Authorization

### Cookie

- [ ] В чувствительных к безопасности сценариях включите проверку `CookieSecurity`
- [ ] Используйте `StrictCookieSecurityConfig()` для принудительных атрибутов безопасности

### Перенаправления

- [ ] В сценариях с пользовательскими URL отключите перенаправления
- [ ] Используйте `RedirectWhitelist` для ограничения целей перенаправлений

## Примеры кода

### Создание клиента для production

```go
func createProductionClient() (httpc.Client, error) {
    cfg := httpc.DefaultConfig()

    // Тайм-ауты
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

- [Обзор безопасности](./) - обзор функций безопасности
- [Защита от SSRF](./ssrf) - подробное описание защиты от SSRF
- [Конфигурация API](../api-reference/config) - полный справочник конфигурации
