---
title: "Чек-лист для production - CyberGo HTTPC | Аудит релиза"
description: "Контрольный список безопасности production HTTPC: проверка TLS, аудит SSRF и CIDR, настройка таймаутов, лимиты размера ответов и аудит-мониторинг."
---

# Контрольный список для production

## Обязательные проверки

### Конфигурация TLS

- [ ] `InsecureSkipVerify` установлен в `false` (значение по умолчанию)
- [ ] `MinTLSVersion` не ниже `tls.VersionTLS12`
- [ ] Не используется `TestingConfig()`

### Защита от SSRF

- [ ] `AllowPrivateIPs` равен `false` (значение по умолчанию)
- [ ] При необходимости доступа к внутренним сервисам используйте `SSRFExemptCIDRs` для точного указания
- [ ] При обработке URL от пользователей используйте `SecureConfig()`

### Настройка таймаутов

- [ ] Все значения таймаутов установлены и разумны
- [ ] `Timeouts.Request` не равен 0 (предотвращает бесконечное ожидание)
- [ ] Рассмотрите использование `WithContext` для установки таймаута каждого запроса

### Ограничения ответов

- [ ] `MaxResponseBodySize` установлен в разумный предел
- [ ] `MaxDecompressedBodySize` установлен в разумный предел
- [ ] При обработке больших ответов используйте потоковую загрузку

### Конфигурация повторных попыток

- [ ] `MaxRetries` не превышает 5
- [ ] Для неидемпотентных запросов (POST/PUT/PATCH) используйте повторные попытки с осторожностью
- [ ] Включите `EnableJitter` для предотвращения эффекта стада

### Управление ресурсами

- [ ] После использования клиент вызывает `Close()`
- [ ] Используйте `defer` для гарантии освобождения ресурсов

## Рекомендуемые проверки

### Промежуточное ПО

- [ ] Используйте `RecoveryMiddleware()` для предотвращения падения при panic
- [ ] Используйте `LoggingMiddleware()` для логирования запросов
- [ ] Используйте `MetricsMiddleware()` для сбора метрик
- [ ] В сценариях с повышенной безопасностью используйте `AuditMiddleware()`

### Заголовки запросов

- [ ] Установите осмысленный `User-Agent`
- [ ] Не храните конфиденциальную информацию в заголовках по умолчанию
- [ ] Используйте `WithBearerToken` вместо ручной установки Authorization

### Cookie

- [ ] В сценариях с повышенной безопасностью включите проверку `CookieSecurity`
- [ ] Используйте `StrictCookieSecurityConfig()` для принудительного использования безопасных атрибутов

### Перенаправления

- [ ] В сценариях с пользовательским вводом URL отключите перенаправления
- [ ] Используйте `RedirectWhitelist` для ограничения целевых доменов перенаправлений

## Примеры кода

### Создание production-клиента

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

### Безопасный клиент

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
