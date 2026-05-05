---
title: Обзор безопасности - HTTPC
description: "Полный обзор функций безопасности HTTPC, включая обязательное управление версиями TLS 1.2+ с конфигурацией шифронаборов по умолчанию, принцип работы механизма защиты от SSRF путём блокировки приватных IP, валидацию заголовков запросов, безопасность Cookie, управление белым списком редиректов и ограничения размера тела ответа"
---

# Обзор безопасности

HTTPC обеспечивает безопасность по умолчанию (Secure by Default) — все функции безопасности работают из коробки.

## Обзор функций безопасности

| Функция | По умолчанию | Описание |
|---------|-------------|----------|
| Минимальная версия TLS | TLS 1.2 | Отклоняет TLS 1.0/1.1 |
| Защита от SSRF | Включена | Блокирует подключение к приватным IP |
| Валидация URL | Включена | Проверяет формат и протокол URL |
| Валидация заголовков | Включена | Предотвращает CRLF-инъекцию |
| Строгая проверка Content-Length | Включена | Предотвращает smuggling ответов |
| Проверка безопасности Cookie | Опционально | Проверяет атрибуты безопасности Cookie |
| Ограничение размера тела ответа | 10 МБ | Предотвращает исчерпание памяти |
| Ограничение размера распакованного тела | 100 МБ | Предотвращает распаковочные бомбы |
| Ограничение редиректов | 10 | Предотвращает бесконечные редиректы |

## Безопасность TLS

```go
cfg := httpc.DefaultConfig()
// TLS 1.2-1.3 по умолчанию
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxTLSVersion = tls.VersionTLS13
```

:::danger Опасность
`InsecureSkipVerify` предназначен только для тестирования. В производственной среде никогда не устанавливайте его в `true`.
:::

## Защита от SSRF

SSRF (Server-Side Request Forgery) — это атака, при которой злоумышленник использует сервер для отправки запросов во внутреннюю сеть.

```go
// По умолчанию: блокирует приватные IP
cfg := httpc.DefaultConfig()
// AllowPrivateIPs = false → блокирует 127.0.0.1, 10.x, 192.168.x и т.д.

// Освобождение определённых CIDR (например, VPN, VPC)
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // Внутренний VPC
    "100.64.0.0/10",    // Tailscale
}

// Безопасный пресет: максимальная защита от SSRF
client, _ := httpc.New(httpc.SecureConfig())
```

### Заблокированные диапазоны IP

| Диапазон | Описание |
|----------|----------|
| 127.0.0.0/8 | Адреса обратной связи (loopback) |
| 10.0.0.0/8 | Частные класса A |
| 172.16.0.0/12 | Частные класса B |
| 192.168.0.0/16 | Частные класса C |
| 169.254.0.0/16 | Линковые локальные |
| ::1/128 | IPv6 loopback |
| fc00::/7 | IPv6 уникальные локальные |
| fe80::/10 | IPv6 линковые локальные |

## Валидация заголовков

Автоматически предотвращает CRLF-инъекцию и smuggling заголовков:

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

## Безопасность редиректов

```go
// Запрет редиректов (для чувствительных к безопасности сценариев)
cfg := httpc.SecureConfig() // FollowRedirects = false

// Ограничение доменов редиректа
cfg := httpc.DefaultConfig()
cfg.Security.RedirectWhitelist = []string{
    "api.example.com",
    "auth.example.com",
}
```

## Промежуточное ПО аудита

```go
auditMiddleware := httpc.AuditMiddleware(func(event httpc.AuditEvent) {
    // URL очищен (учётные данные удалены)
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

- [Защита от SSRF](./ssrf) - Подробно о защите от SSRF и конфигурации
- [TLS и привязка сертификатов](./tls-certpin) - Конфигурация TLS и привязка сертификатов
- [Контрольный список для продакшена](./production-checklist) - Обязательные проверки перед запуском
