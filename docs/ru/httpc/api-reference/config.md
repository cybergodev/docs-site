---
title: Конфигурация - HTTPC
description: Справочник API системы конфигурации HTTPC, охватывающий основную структуру Config и все поля пяти подгрупп конфигурации, пять функций предустановок и метод валидации Validate.
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
    Request        time.Duration // Общий тайм-аут запроса (включая повторы), по умолчанию 30с
    Dial           time.Duration // Тайм-аут TCP-соединения, по умолчанию 10с
    TLSHandshake   time.Duration // Тайм-аут TLS-рукопожатия, по умолчанию 10с
    ResponseHeader time.Duration // Тайм-аут ожидания заголовков ответа, по умолчанию 30с
    IdleConn       time.Duration // Время удержания простаивающих соединений, по умолчанию 90с
}
```

| Поле | Значение по умолчанию | Максимум |
|------|---------------------|----------|
| Request | 30с | 30 мин |
| Dial | 10с | 30 мин |
| TLSHandshake | 10с | 30 мин |
| ResponseHeader | 30с | 30 мин |
| IdleConn | 90с | 30 мин |

Установка 0 означает отсутствие тайм-аута (не рекомендуется для production).

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Глобальное макс. простаивающих соединений, по умолчанию 50
    MaxConnsPerHost        int           // Макс. соединений на хост, по умолчанию 10
    ProxyURL               string        // Адрес прокси, например "http://proxy:8080"
    EnableSystemProxy      bool          // Автоопределение системного прокси, по умолчанию false
    EnableHTTP2            bool          // Включить HTTP/2, по умолчанию true
    EnableCookies          bool          // Включить управление Cookie, по умолчанию false
    EnableDoH              bool          // Включить DNS-over-HTTPS, по умолчанию false
    DoHCacheTTL            time.Duration // TTL кэша DoH, по умолчанию 5 мин
    MaxResponseHeaderBytes int64         // Макс. байт заголовков ответа, по умолчанию 0 (используется стандартная библиотека Go — 10 МБ)
}
```

### DNS-over-HTTPS

Включите DoH для снижения задержки разрешения DNS и предотвращения перехвата DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (по приоритету): Cloudflare → Google → AliDNS. Подробнее в [Пуле соединений и прокси](../advanced/connection-pool).

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Пользовательская конфигурация TLS
    MinTLSVersion           uint16         // Минимальная версия TLS, по умолчанию TLS 1.2
    MaxTLSVersion           uint16         // Максимальная версия TLS, по умолчанию TLS 1.3
    InsecureSkipVerify      bool           // Пропустить проверку сертификата (только для тестов)
    MaxResponseBodySize     int64          // Лимит размера тела ответа, по умолчанию 10 МБ
    MaxRequestBodySize      int64          // Лимит размера тела запроса, по умолчанию 0 (используется значение MaxResponseBodySize)
    MaxDecompressedBodySize int64          // Лимит размера распакованного тела, по умолчанию 100 МБ
    AllowPrivateIPs         bool           // Разрешить приватные IP, по умолчанию false
    SSRFExemptCIDRs         []string       // Исключения CIDR для SSRF
    ValidateURL             bool           // Валидация URL, по умолчанию true
    ValidateHeaders         bool           // Валидация заголовков запроса, по умолчанию true
    StrictContentLength     bool           // Строгий Content-Length, по умолчанию true
    CookieSecurity          *CookieSecurityConfig // Проверка безопасности Cookie
    RedirectWhitelist       []string       // Белый список доменов для перенаправлений
}
```

:::warning Защита от SSRF
`AllowPrivateIPs` по умолчанию `false`, блокирует подключения к приватным/зарезервированным IP (127.0.0.1, 10.x, 192.168.x и др.). Устанавливайте `true` только при подключении к внутренним сервисам.
:::

### Пример исключений SSRF

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
    Delay         time.Duration // Начальная задержка повтора, по умолчанию 1с
    BackoffFactor float64       // Множитель отката, по умолчанию 2.0
    EnableJitter  bool          // Включить джиттер, по умолчанию true
    CustomPolicy  RetryPolicy   // Пользовательская стратегия повторных попыток
}
```

| Поле | Значение по умолчанию | Диапазон |
|------|---------------------|----------|
| MaxRetries | 3 | 0-10 |
| Delay | 1с | 0-30 мин |
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
|----------|---------|
| Тайм-аут Request | 15с |
| Тайм-аут Dial | 5с |
| Тайм-аут TLSHandshake | 5с |
| Тайм-аут ResponseHeader | 10с |
| Тайм-аут IdleConn | 30с |
| MaxIdleConns | 20 |
| MaxConnsPerHost | 5 |
| MaxResponseBodySize | 5 МБ |
| MaxRetries | 1 |
| Delay | 2с |
| EnableJitter | true |
| FollowRedirects | false |

### PerformanceConfig

```go
func PerformanceConfig() *Config
```

Высокопроизводительная конфигурация. Больший пул соединений, более длинные тайм-ауты, сохраняет проверки безопасности.

:::tip Совет
PerformanceConfig сохраняет включёнными `ValidateURL` и `ValidateHeaders` для обеспечения безопасности. Для максимальной производительности в доверенной среде можно отключить вручную: `cfg.Security.ValidateURL = false`, но учтите риски безопасности (инъекции, SSRF).
:::

| Параметр | Значение |
|----------|---------|
| Тайм-аут Request | 60с |
| Тайм-аут Dial | 15с |
| Тайм-аут TLSHandshake | 15с |
| Тайм-аут ResponseHeader | 60с |
| Тайм-аут IdleConn | 120с |
| MaxIdleConns | 100 |
| MaxConnsPerHost | 20 |
| EnableCookies | true |
| MaxResponseBodySize | 50 МБ |
| StrictContentLength | false |
| ValidateURL | true |
| ValidateHeaders | true |
| Delay | 500мс |
| BackoffFactor | 1.5 |
| EnableJitter | true |

### TestingConfig

```go
func TestingConfig() *Config
```

Конфигурация для тестовой среды. Отключены проверки безопасности, короткие тайм-ауты.

| Параметр | Значение |
|----------|---------|
| Тайм-аут Dial | 5с |
| Тайм-аут TLSHandshake | 5с |
| Тайм-аут ResponseHeader | 10с |
| Тайм-аут IdleConn | 30с |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 5 |
| EnableHTTP2 | false |
| EnableCookies | true |
| InsecureSkipVerify | true |
| AllowPrivateIPs | true |
| ValidateURL | false |
| ValidateHeaders | false |
| MaxRetries | 1 |
| Delay | 100мс |
| EnableJitter | false |
| UserAgent | httpc-test/1.0 |

:::danger Опасность
Эта конфигурация отключает проверку TLS и защиту от SSRF, **используйте только для тестирования**. При использовании вне тестовой среды выводится предупреждение безопасности.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Лёгкая конфигурация. Отключены повторные попытки и перенаправления, минимальный пул соединений.

| Параметр | Значение |
|----------|---------|
| Тайм-аут Dial | 5с |
| Тайм-аут TLSHandshake | 5с |
| Тайм-аут ResponseHeader | 10с |
| Тайм-аут IdleConn | 30с |
| MaxIdleConns | 10 |
| MaxConnsPerHost | 2 |
| MaxResponseBodySize | 1 МБ |
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

Проверяет корректность конфигурации. Автоматически вызывается внутри `New()`, также можно вызвать явно.

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // вне диапазона

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
| `RequireSecure` | `bool` | Требовать установки атрибута Secure у Cookie |
| `RequireHttpOnly` | `bool` | Требовать установки атрибута HttpOnly у Cookie |
| `RequireSameSite` | `string` | Требуемое значение SameSite, например `"Strict"`, `"Lax"`; пустая строка — не проверять |
| `AllowSameSiteNone` | `bool` | Разрешать ли SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | Требовать атрибут Secure при SameSite=None (по умолчанию `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

Конфигурация безопасности Cookie по умолчанию. Не требует атрибутов Secure/HttpOnly/SameSite, но принудительно требует Secure для Cookie с SameSite=None.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

Строгая конфигурация безопасности Cookie. Требует Secure, HttpOnly и SameSite=Strict.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
