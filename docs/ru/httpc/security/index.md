---
title: Обзор безопасности - HTTPC
description: Обзор функций безопасности HTTPC, охватывающий принудительное управление версиями TLS, защиту от SSRF, валидацию заголовков запросов, атрибуты безопасности Cookie, белый список перенаправлений и ограничения размера тела ответа.
---

# Обзор безопасности

HTTPC обеспечивает безопасность по умолчанию (Secure by Default) — все функции безопасности работают «из коробки».

## Обзор функций безопасности

| Функция | По умолчанию | Описание |
|---------|-------------|----------|
| Минимальная версия TLS | TLS 1.2 | Отклоняет TLS 1.0/1.1 |
| Защита от SSRF | Включена | Блокирует подключения к приватным IP |
| Валидация URL | Включена | Проверяет формат и протокол URL |
| Валидация заголовков запроса | Включена | Предотвращает инъекцию CRLF |
| Строгий Content-Length | Включён | Предотвращает контрабанду ответов |
| Проверка безопасности Cookie | Опционально | Проверяет атрибуты безопасности Cookie |
| Лимит размера тела ответа | 10 МБ | Предотвращает исчерпание памяти |
| Лимит размера распакованного тела | 100 МБ | Предотвращает распакованные бомбы |
| Ограничение перенаправлений | 10 раз | Предотвращает бесконечные перенаправления |

## Безопасность TLS

```go
cfg := httpc.DefaultConfig()
// По умолчанию TLS 1.2-1.3
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger Опасность
`InsecureSkipVerify` предназначен только для тестирования. Никогда не устанавливайте `true` в production.
:::

## Защита от SSRF

SSRF (Server-Side Request Forgery) — это атака, при которой злоумышленник использует сервер для отправки запросов во внутреннюю сеть.

```go
// По умолчанию: блокирует приватные IP
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → блокирует 127.0.0.1, 10.x, 192.168.x и др.

// Исключения для определённых CIDR (например, VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // Внутренний VPC
    "100.64.0.0/10",    // Tailscale
}

// Безопасная предустановка: самая строгая защита от SSRF
client, _ := httpc.New(httpc.SecureConfig())
```

### Блокируемые диапазоны IP

| Диапазон | Описание |
|----------|----------|
| 127.0.0.0/8 | Адреса обратной петли |
| 10.0.0.0/8 | Частные класса A |
| 172.16.0.0/12 | Частные класса B |
| 192.168.0.0/16 | Частные класса C |
| 169.254.0.0/16 | Link-local |
| ::1/128 | IPv6 обратная петля |
| fc00::/7 | IPv6 уникальные локальные адреса |
| fe80::/10 | IPv6 link-local |

## Валидация заголовков запроса

Автоматическая защита от инъекции CRLF и контрабанды заголовков:

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
// Запретить перенаправления (чувствительные к безопасности сценарии)
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
    // URL маскированы (учётные данные удалены)
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

- [Защита от SSRF](./ssrf) - подробное описание защиты от SSRF
- [TLS и закрепление сертификатов](./tls-certpin) - конфигурация TLS и закрепление сертификатов
- [Контрольный список для production](./production-checklist) - обязательные проверки перед запуском
