---
title: "Обзор безопасности - CyberGo HTTPC | Обзор безопасности"
description: "Обзор безопасности HTTPC: управление версиями TLS 1.2+, блокировка приватных IP при SSRF, защита от CRLF, безопасность Cookie и белые списки перенаправлений."
---

# Обзор безопасности

HTTPC следует принципу "Secure by Default" (безопасность по умолчанию), все функции безопасности работают из коробки.

## Обзор функций безопасности

| Функция | По умолчанию | Описание |
|---------|-------------|----------|
| Минимальная версия TLS | TLS 1.2 | Отклоняет TLS 1.0/1.1 |
| Защита от SSRF | Включена | Блокирует подключения к приватным IP |
| Валидация URL | Включена | Проверка формата и протокола URL |
| Валидация заголовков | Включена | Предотвращает CRLF-инъекции |
| Строгая проверка Content-Length | Включена | Предотвращает response smuggling |
| Проверка безопасности Cookie | Опционально | Проверка атрибутов безопасности Cookie |
| Лимит размера тела ответа | 10MB | Предотвращает исчерпание памяти |
| Лимит размера распакованного тела | 100MB | Предотвращает атаки с распакованными бомбами |
| Ограничение перенаправлений | 10 раз | Предотвращает бесконечные перенаправления |

## Безопасность TLS

```go
cfg := httpc.DefaultConfig()
// По умолчанию TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger
`InsecureSkipVerify` предназначен только для тестирования. Никогда не устанавливайте `true` в продакшене.
:::

## Защита от SSRF

SSRF (Server-Side Request Forgery) — атака, при которой злоумышленник использует сервер для отправки запросов во внутреннюю сеть.

```go
// По умолчанию: блокировка приватных IP
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → блокировка 127.0.0.1, 10.x, 192.168.x и др.

// Исключение для определённых CIDR (например, VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // Внутренний VPC
    "100.64.0.0/10",    // Tailscale
}

// Безопасная предустановка: максимальная защита от SSRF
client, _ := httpc.New(httpc.SecureConfig())
```

### Блокируемые диапазоны IP

| Диапазон | Описание |
|----------|----------|
| 127.0.0.0/8 | Loopback |
| 10.0.0.0/8 | Класс A приватные |
| 172.16.0.0/12 | Класс B приватные |
| 192.168.0.0/16 | Класс C приватные |
| 169.254.0.0/16 | Link-local |
| ::1/128 | IPv6 loopback |
| fc00::/7 | IPv6 уникальные локальные |
| fe80::/10 | IPv6 link-local |

## Валидация заголовков

Автоматическая защита от CRLF-инъекций и контрабанды заголовков:

```go
// Следующие заголовки будут отклонены
httpc.WithHeader("X-Custom", "value\r\nInjected: header") // CRLF-инъекция
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
// Запрет перенаправлений (сценарии с повышенной безопасностью)
cfg := httpc.SecureConfig() // FollowRedirects = false

// Ограничение доменов перенаправлений
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

### Аудит с конфигурацией

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

- [Защита от SSRF](./ssrf) - подробное описание защиты от SSRF и настройка
- [TLS и закрепление сертификатов](./tls-certpin) - конфигурация TLS и закрепление сертификатов
- [Контрольный список для продакшена](./production-checklist) - обязательные проверки перед запуском
