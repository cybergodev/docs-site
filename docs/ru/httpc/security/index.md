---
title: "Обзор безопасности — HTTPC"
description: "Обзор функций безопасности HTTPC: управление версиями TLS 1.2+, блокировка приватных IP от SSRF с исключениями CIDR, защита от инъекции CRLF, безопасность Cookie StrictCookieSecurityConfig, белый список перенаправлений RedirectWhitelist и ограничения размера тела ответа."
---

# Обзор безопасности

HTTPC следует принципу безопасности по умолчанию (Secure by Default), все функции безопасности работают из коробки.

## Обзор функций безопасности

| Функция | Значение по умолчанию | Описание |
|---------|----------------------|----------|
| Минимальная версия TLS | TLS 1.2 | Отклоняет TLS 1.0/1.1 |
| Защита от SSRF | Включена | Блокирует соединения с приватными IP |
| Валидация URL | Включена | Проверка формата и протокола URL |
| Валидация заголовков | Включена | Предотвращение инъекции CRLF |
| Строгая проверка Content-Length | Включена | Предотвращение smuggling ответов |
| Проверка безопасности Cookie | Опционально | Проверка атрибутов безопасности Cookie |
| Ограничение размера тела ответа | 10MB | Предотвращение исчерпания памяти |
| Ограничение размера распакованного тела | 100MB | Предотвращение распаковки-бомбы |
| Ограничение перенаправлений | 10 | Предотвращение бесконечных перенаправлений |

## Безопасность TLS

```go
cfg := httpc.DefaultConfig()
// По умолчанию TLS 1.2–1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger Опасность
`InsecureSkipVerify` используйте только для тестирования. В production никогда не устанавливайте `true`.
:::

## Защита от SSRF

SSRF (подделка серверных запросов) — это атака, при которой злоумышленник использует сервер для отправки запросов во внутреннюю сеть.

```go
// По умолчанию: блокировка приватных IP
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → блокирует 127.0.0.1, 10.x, 192.168.x и др.

// Исключение определённых CIDR (например, VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // Внутренний VPC
    "100.64.0.0/10",    // Tailscale
}

// Безопасная предустановка: усиленная защита от SSRF
client, _ := httpc.New(httpc.SecureConfig())
```

### Блокируемые диапазоны IP

| Диапазон | Описание |
|----------|----------|
| 127.0.0.0/8 | Loopback-адрес |
| 10.0.0.0/8 | Класс A, приватные |
| 172.16.0.0/12 | Класс B, приватные |
| 192.168.0.0/16 | Класс C, приватные |
| 169.254.0.0/16 | Link-local |
| ::1/128 | IPv6 loopback |
| fc00::/7 | IPv6 уникальные локальные |
| fe80::/10 | IPv6 link-local |

## Валидация заголовков запроса

Автоматическая защита от инъекции CRLF и smuggling заголовков:

```go
// Следующие заголовки будут отклонены
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // Инъекция CRLF
httpc.WithHeader("X-Bad", "value\x00null")                // Управляющие символы
```

## Безопасность Cookie

```go
// Строгая безопасность Cookie
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
// Требуется: Secure, HttpOnly, SameSite=Strict
```

## Безопасность перенаправлений

```go
// Запретить перенаправления (для сценариев, чувствительных к безопасности)
cfg := httpc.SecureConfig() // FollowRedirects = false

// Ограничить домены перенаправлений
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## Промежуточное ПО аудита

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL маскирован (учётные данные удалены)
    log.Printf("[AUDIT] %s %s -> %d (%v)",
        event.Method, event.URL, event.StatusCode, event.Duration)
})

cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{auditMiddleware}
```

### Настраиваемый аудит

```go
auditCfg := &httpc.AuditMiddlewareConfig{
    Format:         "json",
    IncludeHeaders: true,
    MaskHeaders:    []string{"Authorization", "Cookie"},
    SanitizeError:  true,
}
auditMiddleware := httpc.AuditMiddlewareWithConfig(func(event httpc.AuditEvent) {
    data, _ := json.Marshal(event)
    log.Println(string(data))
}, auditCfg)
```

## Что дальше

- [Защита от SSRF](./ssrf) — подробное описание защиты от SSRF и настройки
- [TLS и закрепление сертификатов](./tls-certpin) — настройка TLS и закрепление сертификатов
- [Контрольный список для production](./production-checklist) — обязательные проверки перед запуском
