---
title: Конфигурация - HTTPC
description: "Полный справочник API системы конфигурации HTTPC, охватывающий основную структуру Config и её пять подгрупп — Timeouts, Connection, Security, Retry, Middleware — с подробным описанием всех полей, пятью предустановленными функциями конфигурации и методом Validate для проверки"
---

# Конфигурация

## Config

```go
type Config struct {
    Timeouts   TimeoutConfig
    Connection ConnectionConfig
    Security   SecurityConfig
    Retry      RetryConfig
    Middleware MiddlewareConfig
}
```

Основная структура конфигурации. Получите безопасные значения по умолчанию через `DefaultConfig()`.

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // Общий тайм-аут запроса (включая повторные попытки), по умолчанию 30s
    Dial           time.Duration // Тайм-аут TCP-соединения, по умолчанию 10s
    TLSHandshake   time.Duration // Тайм-аут TLS-рукопожатия, по умолчанию 10s
    ResponseHeader time.Duration // Тайм-аут ожидания заголовков ответа, по умолчанию 30s
    IdleConn       time.Duration // Время хранения неактивных соединений, по умолчанию 90s
}
```

| Поле | По умолчанию | Максимум |
|------|-------------|----------|
| Request | 30s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 30s | 30min |
| IdleConn | 90s | 30min |

Установка в 0 означает отсутствие тайм-аута (не рекомендуется для продакшена).

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Глобальный максимум неактивных соединений, по умолчанию 50
    MaxConnsPerHost        int           // Максимум соединений на хост, по умолчанию 10
    ProxyURL               string        // Адрес прокси, например "http://proxy:8080"
    EnableSystemProxy      bool          // Автообнаружение системного прокси, по умолчанию false
    EnableHTTP2            bool          // Включить HTTP/2, по умолчанию true
    EnableCookies          bool          // Включить управление Cookie, по умолчанию false
    EnableDoH              bool          // Включить DNS-over-HTTPS, по умолчанию false
    DoHCacheTTL            time.Duration // TTL кэша DoH, по умолчанию 5min
    MaxResponseHeaderBytes int64         // Максимальный размер заголовков ответа в байтах, по умолчанию 0 (используется стандартное значение Go 10MB)
}
```

### DNS-over-HTTPS

Включение DoH снижает задержку DNS-резолвинга и предотвращает DNS-угон:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (в порядке приоритета): Cloudflare -> Google -> AliDNS. Подробнее см. [Пул соединений и прокси](../advanced/connection-pool).

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Пользовательская конфигурация TLS
    MinTLSVersion           uint16         // Минимальная версия TLS, по умолчанию TLS 1.2
    MaxTLSVersion           uint16         // Максимальная версия TLS, по умолчанию TLS 1.3
    InsecureSkipVerify      bool           // Пропустить проверку сертификата (только для тестов)
    MaxResponseBodySize     int64          // Ограничение размера тела ответа, по умолчанию 10MB
    MaxRequestBodySize      int64          // Ограничение размера тела запроса, по умолчанию 0 (используется значение MaxResponseBodySize)
    MaxDecompressedBodySize int64          // Ограничение размера после распаковки, по умолчанию 100MB
    AllowPrivateIPs         bool           // Разрешить приватные IP, по умолчанию false
    SSRFExemptCIDRs         []string       // Освобождённые от SSRF CIDR
    ValidateURL             bool           // Валидация URL, по умолчанию true
    ValidateHeaders         bool           // Валидация заголовков запроса, по умолчанию true
    StrictContentLength     bool           // Строгий Content-Length, по умолчанию true
    CookieSecurity          *CookieSecurityConfig // Проверка безопасности Cookie
    RedirectWhitelist       []string       // Белый список доменов для перенаправлений
}
```

:::warning Предупреждение
Защита от SSRF
`AllowPrivateIPs` по умолчанию `false`, что блокирует подключение к приватным/зарезервированным IP (127.0.0.1, 10.x, 192.168.x и т.д.). Устанавливайте в `true` только при подключении к внутренним сервисам.
:::

### Пример освобождения от SSRF

```go
cfg := httpc.DefaultConfig()
cfg.Security.SSRFExemptCIDRs = []string{
    "10.0.0.0/8",       // Внутренний VPC
    "100.64.0.0/10",    // Tailscale
}
```

## RetryConfig

```go
type RetryConfig struct {
    MaxRetries    int           // Максимальное количество повторных попыток, по умолчанию 3
    Delay         time.Duration // Начальная задержка между попытками, по умолчанию 1s
    BackoffFactor float64       // Множитель экспоненциального откладывания, по умолчанию 2.0
    EnableJitter  bool          // Включить джиттер, по умолчанию true
    CustomPolicy  RetryPolicy   // Пользовательская политика повторных попыток
}
```

| Поле | По умолчанию | Диапазон |
|------|-------------|----------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |

Формула задержки повтора: `Delay * BackoffFactor^attempt + jitter`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // Список промежуточного ПО
    UserAgent       string           // User-Agent, по умолчанию "httpc/1.0"
    Headers         map[string]string // Заголовки по умолчанию
    FollowRedirects bool             // Следовать перенаправлениям, по умолчанию true
    MaxRedirects    int              // Максимальное количество перенаправлений, по умолчанию 10
}
```

## Предустановки конфигурации

### DefaultConfig

```go
func DefaultConfig() *Config
```

Безопасная конфигурация по умолчанию. Защита от SSRF включена по умолчанию.

### SecureConfig

```go
func SecureConfig() *Config
```

Конфигурация с приоритетом безопасности. Более короткие тайм-ауты, отключены автоматические перенаправления, строгая защита от SSRF.

| Параметр | Значение |
|----------|----------|
| Тайм-аут Request | 15s |
| Тайм-аут Dial | 5s |
| Тайм-аут TLSHandshake | 5s |
| Тайм-аут ResponseHeader | 10s |
| Тайм-аут IdleConn | 30s |
| MaxIdleConns | 20 |
| MaxConnsPerHost | 5 |
| MaxResponseBodySize | 5MB |
| MaxRetries | 1 |
| Delay | 2s |
| EnableJitter | true |
| FollowRedirects | false |

### PerformanceConfig

```go
func PerformanceConfig() *Config
```

Конфигурация для высокой пропускной способности. Больший пул соединений, более длинные тайм-ауты, с сохранением проверок безопасности.

:::tip Подсказка
PerformanceConfig сохраняет включёнными `ValidateURL` и `ValidateHeaders` для обеспечения безопасности. Если в доверенной среде нужна максимальная производительность, можно отключить вручную: `cfg.Security.ValidateURL = false`, но учитывайте риски безопасности (инъекции, SSRF).
:::

| Параметр | Значение |
|----------|----------|
| Тайм-аут Request | 60s |
| Тайм-аут Dial | 15s |
| Тайм-аут TLSHandshake | 15s |
| Тайм-аут ResponseHeader | 60s |
| Тайм-аут IdleConn | 120s |
| MaxIdleConns | 100 |
| MaxConnsPerHost | 20 |
| EnableCookies | true |
| MaxResponseBodySize | 50MB |
| StrictContentLength | false |
| ValidateURL | true |
| ValidateHeaders | true |
| Delay | 500ms |
| BackoffFactor | 1.5 |
| EnableJitter | true |

### TestingConfig

```go
func TestingConfig() *Config
```

Конфигурация для тестовой среды. Проверки безопасности отключены, короткие тайм-ауты.

| Параметр | Значение |
|----------|----------|
| Тайм-аут Dial | 5s |
| Тайм-аут TLSHandshake | 5s |
| Тайм-аут ResponseHeader | 10s |
| Тайм-аут IdleConn | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 5 |
| EnableHTTP2 | false |
| EnableCookies | true |
| InsecureSkipVerify | true |
| AllowPrivateIPs | true |
| ValidateURL | false |
| ValidateHeaders | false |
| MaxRetries | 1 |
| Delay | 100ms |
| EnableJitter | false |
| UserAgent | httpc-test/1.0 |

:::danger Опасность
Эта конфигурация отключает проверку TLS и защиту от SSRF, **используйте только для тестов**. Использование вне тестовой среды вызовет вывод предупреждения безопасности.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Лёгкая конфигурация. Повторные попытки и перенаправления отключены, минимальный пул соединений.

| Параметр | Значение |
|----------|----------|
| Тайм-аут Dial | 5s |
| Тайм-аут TLSHandshake | 5s |
| Тайм-аут ResponseHeader | 10s |
| Тайм-аут IdleConn | 30s |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1MB |
| MaxRetries | 0 |
| Delay | 0 |
| BackoffFactor | 1.0 |
| EnableJitter | false |
| FollowRedirects | false |

## Валидация

### ValidateConfig

```go
func ValidateConfig(cfg *Config) error
```

Проверяет корректность конфигурации. `New()` вызывает автоматически, но можно вызвать явно.

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // Выходит за пределы диапазона

if err := httpc.ValidateConfig(cfg); err != nil {
    log.Fatal(err) // invalid retry configuration: Retry.MaxRetries must be 0-10, got 100
}
```

### Config.String

```go
func (c *Config) String() string
```

Возвращает безопасное строковое представление. Учётные данные ProxyURL маскируются, TLSConfig отображается как `<configured>` или `<default>`, Headers не выводятся.

```go
cfg := httpc.DefaultConfig()
fmt.Println(cfg.String())
// Config{Timeouts:{Request: 30s, ...}, Security:{TLSConfig: <default>, ...}}
```

## Безопасность Cookie

### CookieSecurityConfig

```go
type CookieSecurityConfig struct {
    RequireSecure                bool
    RequireHttpOnly              bool
    RequireSameSite              string
    AllowSameSiteNone            bool
    RequireSecureForSameSiteNone bool
}
```

Конфигурация проверки атрибутов безопасности Cookie.

| Поле | Тип | Описание |
|------|-----|----------|
| `RequireSecure` | `bool` | Требовать установку атрибута Secure у Cookie |
| `RequireHttpOnly` | `bool` | Требовать установку атрибута HttpOnly у Cookie |
| `RequireSameSite` | `string` | Требуемое значение SameSite, например `"Strict"`, `"Lax"`; пустая строка — без проверки |
| `AllowSameSiteNone` | `bool` | Разрешить ли SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | При SameSite=None требовать атрибут Secure (по умолчанию `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

Конфигурация безопасности Cookie по умолчанию. Не требует атрибутов Secure/HttpOnly/SameSite, но принуждает Cookie с SameSite=None иметь установленный Secure.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

Строгая конфигурация безопасности Cookie. Требует Secure, HttpOnly и SameSite=Strict.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
