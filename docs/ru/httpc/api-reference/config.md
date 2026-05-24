---
title: "Конфигурация — HTTPC"
description: "Справочник API системы конфигурации HTTPC: описание всех полей основной структуры Config и пяти подгрупп Timeouts, Connection, Security, Retry, Middleware, пять функций предустановок DefaultConfig/SecureConfig/PerformanceConfig/TestingConfig/MinimalConfig, валидация ValidateConfig и конфигурация безопасности Cookie."
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
    Request        time.Duration // Общий таймаут запроса (включая повторы), по умолчанию 180s
    Dial           time.Duration // Таймаут TCP-соединения, по умолчанию 10s
    TLSHandshake   time.Duration // Таймаут TLS-рукопожатия, по умолчанию 10s
    ResponseHeader time.Duration // Таймаут ожидания заголовков ответа, по умолчанию 0 (отключено, зависит от контекста)
    IdleConn       time.Duration // Время удержания простаивающих соединений, по умолчанию 90s
}
```

| Поле | Значение по умолчанию | Максимум |
|------|----------------------|----------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

Установка в 0 означает отсутствие таймаута (не рекомендуется для production).

:::tip Совет Дизайн ResponseHeader
`ResponseHeader` по умолчанию равен 0 (отключен). В этом случае используется `Timeouts.Request` или `WithTimeout()` как единственный механизм таймаута, что обеспечивает полный контроль `WithTimeout()` над длительностью запроса. Этот дизайн подходит для AI API и длинного опроса, где требуется расширенное время ответа. Устанавливайте положительное значение только при необходимости жёсткого ограничения транспортного уровня (например, для защиты от атак Slowloris), но учтите, что это переопределит `WithTimeout`.
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Глобальный максимум простаивающих соединений, по умолчанию 50
    MaxConnsPerHost        int           // Максимум соединений на хост, по умолчанию 10
    ProxyURL               string        // Адрес прокси, например "http://proxy:8080"
    EnableSystemProxy      bool          // Автообнаружение системного прокси, по умолчанию false
    EnableHTTP2            bool          // Включить HTTP/2, по умолчанию true
    EnableCookies          bool          // Включить управление Cookie, по умолчанию false
    EnableDoH              bool          // Включить DNS-over-HTTPS, по умолчанию false
    DoHCacheTTL            time.Duration // TTL кэша DoH, по умолчанию 5min
    BrowserFingerprint     string        // Маскировка TLS-отпечатка, по умолчанию "" (стандартный Go TLS)
    MaxResponseHeaderBytes int64         // Максимальный размер заголовков ответа в байтах, по умолчанию 0 (стандарт Go 10MB)
}
```

### DNS-over-HTTPS

Включение DoH снижает задержку разрешения DNS и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (по приоритету): Cloudflare → Google → AliDNS. Подробнее в [Пул соединений и прокси](../advanced/connection-pool).

### Маскировка TLS-отпечатка

Включение `BrowserFingerprint` имитирует TLS ClientHello реального браузера, обходя антибот-детекцию на основе TLS-отпечатков. После настройки соединения используют utls вместо стандартного Go `crypto/tls`:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.BrowserFingerprint = "chrome" // варианты: "chrome", "firefox", "safari", "ios"
```

| Значение | Имитируемый браузер |
|----------|---------------------|
| `"chrome"` | Google Chrome |
| `"firefox"` | Mozilla Firefox |
| `"safari"` | Apple Safari |
| `"ios"` | iOS Safari |
| `""` (по умолчанию) | Стандартный Go TLS |

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Пользовательская конфигурация TLS
    MinTLSVersion           uint16         // Минимальная версия TLS, по умолчанию TLS 1.2
    MaxTLSVersion           uint16         // Максимальная версия TLS, по умолчанию TLS 1.3
    InsecureSkipVerify      bool           // Пропуск проверки сертификата (только для тестов)
    MaxResponseBodySize     int64          // Лимит размера тела ответа, по умолчанию 10MB
    MaxRequestBodySize      int64          // Лимит размера тела запроса, по умолчанию 0 (используется MaxResponseBodySize)
    MaxDecompressedBodySize int64          // Лимит размера после распаковки, по умолчанию 100MB
    AllowPrivateIPs         bool           // Разрешить приватные IP, по умолчанию false
    SSRFExemptCIDRs         []string       // Исключения CIDR для SSRF
    ValidateURL             bool           // Валидация URL, по умолчанию true
    ValidateHeaders         bool           // Валидация заголовков, по умолчанию true
    StrictContentLength     bool           // Строгий Content-Length, по умолчанию true
    CookieSecurity          *CookieSecurityConfig // Проверка безопасности Cookie
    RedirectWhitelist       []string       // Белый список доменов для перенаправлений
}
```

:::warning Предупреждение Защита от SSRF
`AllowPrivateIPs` по умолчанию `false`, блокирует соединения с приватными/зарезервированными IP (127.0.0.1, 10.x, 192.168.x и др.). Устанавливайте `true` только при подключении к внутренним сервисам.
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
    MaxRetries    int           // Максимум повторных попыток, по умолчанию 3
    Delay         time.Duration // Начальная задержка повтора, по умолчанию 1s
    BackoffFactor float64       // Множитель отката, по умолчанию 2.0
    EnableJitter  bool          // Включить джиттер, по умолчанию true
    MaxRetryDelay time.Duration // Максимальная задержка повтора, по умолчанию 30s
    CustomPolicy  RetryPolicy   // Пользовательская стратегия повторов
}
```

| Поле | Значение по умолчанию | Диапазон |
|------|----------------------|----------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

Формула задержки повтора: `min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // Список промежуточного ПО
    UserAgent       string           // User-Agent, по умолчанию "httpc/1.0"
    Headers         map[string]string // Заголовки по умолчанию
    FollowRedirects bool             // Следовать перенаправлениям, по умолчанию true
    MaxRedirects    int              // Максимум перенаправлений, по умолчанию 10
}
```

## Предустановки конфигурации

### DefaultConfig

```go
func DefaultConfig() *Config
```

Безопасная конфигурация по умолчанию. Защита SSRF включена по умолчанию.

### SecureConfig

```go
func SecureConfig() *Config
```

Конфигурация с приоритетом безопасности. Более короткие таймауты, отключены автоматические перенаправления, строгая защита SSRF.

| Параметр | Значение |
|----------|----------|
| Request таймаут | 15s |
| Dial таймаут | 5s |
| TLSHandshake таймаут | 5s |
| ResponseHeader таймаут | 10s (защита от Slowloris) |
| IdleConn таймаут | 30s |
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

Высокопроизводительная конфигурация. Больший пул соединений, более длинные таймауты, сохраняются проверки безопасности.

:::tip Совет
PerformanceConfig сохраняет `ValidateURL` и `ValidateHeaders` включёнными для обеспечения безопасности. Для максимальной производительности в доверенной среде можно отключить вручную: `cfg.Security.ValidateURL = false`, но учитывайте риски безопасности (инъекции, SSRF).
:::

| Параметр | Значение |
|----------|----------|
| Request таймаут | 60s |
| Dial таймаут | 15s |
| TLSHandshake таймаут | 15s |
| ResponseHeader таймаут | 0 (отключено, используется Request таймаут) |
| IdleConn таймаут | 120s |
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

Конфигурация для тестовой среды. Отключены проверки безопасности, короткие таймауты.

| Параметр | Значение |
|----------|----------|
| Dial таймаут | 5s |
| TLSHandshake таймаут | 5s |
| ResponseHeader таймаут | 0 (отключено, используется Request таймаут) |
| IdleConn таймаут | 30s |
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
Эта конфигурация отключает проверку TLS и защиту SSRF, **используйте только для тестирования**. При использовании вне тестовой среды выводится предупреждение безопасности.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Лёгкая конфигурация. Отключены повторы и перенаправления, минимальный пул соединений.

| Параметр | Значение |
|----------|----------|
| Dial таймаут | 5s |
| TLSHandshake таймаут | 5s |
| ResponseHeader таймаут | 0 (отключено, используется Request таймаут) |
| IdleConn таймаут | 30s |
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
cfg.Retry.MaxRetries = 100 //超出 диапазона

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
// Config{Timeouts:{Request: 3m0s, ...}, Security:{TLSConfig: <default>, ...}}
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
| `RequireSecure` | `bool` | Требовать установки атрибута Secure |
| `RequireHttpOnly` | `bool` | Требовать установки атрибута HttpOnly |
| `RequireSameSite` | `string` | Требуемое значение SameSite, например `"Strict"`, `"Lax"`; пустая строка — без проверки |
| `AllowSameSiteNone` | `bool` | Разрешать ли SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | Требовать атрибут Secure при SameSite=None (по умолчанию `true`) |

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
