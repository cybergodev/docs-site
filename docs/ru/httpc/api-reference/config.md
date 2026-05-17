---
title: Конфигурация - HTTPC
description: Справочник API системы конфигурации HTTPC — описание всех полей основной структуры Config и её пяти подгрупп конфигурации, пяти функций предустановленных конфигураций и метода валидации Validate.
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

Основная структура конфигурации. Безопасные значения по умолчанию можно получить через `DefaultConfig()`.

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, err := httpc.New(cfg)
```

## TimeoutConfig

```go
type TimeoutConfig struct {
    Request        time.Duration // Общий таймаут запроса (включая повторные попытки), по умолчанию 180s
    Dial           time.Duration // Таймаут TCP-соединения, по умолчанию 10s
    TLSHandshake   time.Duration // Таймаут TLS-рукопожатия, по умолчанию 10s
    ResponseHeader time.Duration // Таймаут ожидания заголовков ответа, по умолчанию 0 (отключено, зависит от таймаута контекста)
    IdleConn       time.Duration // Время жизни простаивающего соединения, по умолчанию 90s
}
```

| Поле | По умолчанию | Максимум |
|------|--------|--------|
| Request | 180s | 30min |
| Dial | 10s | 30min |
| TLSHandshake | 10s | 30min |
| ResponseHeader | 0 | 30min |
| IdleConn | 90s | 30min |

Установка значения 0 означает отсутствие таймаута (не рекомендуется для production).

:::tip Совет Проектирование ResponseHeader
`ResponseHeader` по умолчанию равен 0 (отключено). В этом случае используется `Timeouts.Request` или `WithTimeout()` как единственный механизм таймаута, что обеспечивает `WithTimeout()` полный контроль над длительностью запроса. Такая схема подходит для сценариев, требующих увеличенного времени ожидания ответа, таких как AI API и long polling. Устанавливайте положительное значение только при необходимости жёсткого ограничения на транспортном уровне (например, для защиты от атак Slowloris), но учтите, что это переопределит `WithTimeout`.
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Глобальный максимум простаивающих соединений, по умолчанию 50
    MaxConnsPerHost        int           // Максимум соединений на хост, по умолчанию 10
    ProxyURL               string        // Адрес прокси, например "http://proxy:8080"
    EnableSystemProxy      bool          // Автоматическое определение системного прокси, по умолчанию false
    EnableHTTP2            bool          // Включить HTTP/2, по умолчанию true
    EnableCookies          bool          // Включить управление Cookie, по умолчанию false
    EnableDoH              bool          // Включить DNS-over-HTTPS, по умолчанию false
    DoHCacheTTL            time.Duration // TTL кэша DoH, по умолчанию 5min
    MaxResponseHeaderBytes int64         // Максимальный размер заголовков ответа в байтах, по умолчанию 0 (используется стандартное значение Go 10MB)
}
```

### DNS-over-HTTPS

Включение DoH снижает задержку DNS-резолвинга и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (в порядке приоритета): Cloudflare → Google → AliDNS. Подробнее в [Пул соединений и прокси](../advanced/connection-pool).

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Пользовательская конфигурация TLS
    MinTLSVersion           uint16         // Минимальная версия TLS, по умолчанию TLS 1.2
    MaxTLSVersion           uint16         // Максимальная версия TLS, по умолчанию TLS 1.3
    InsecureSkipVerify      bool           // Пропустить проверку сертификата (только для тестирования)
    MaxResponseBodySize     int64          // Лимит размера тела ответа, по умолчанию 10MB
    MaxRequestBodySize      int64          // Лимит размера тела запроса, по умолчанию 0 (используется значение MaxResponseBodySize)
    MaxDecompressedBodySize int64          // Лимит размера после распаковки, по умолчанию 100MB
    AllowPrivateIPs         bool           // Разрешить приватные IP, по умолчанию false
    SSRFExemptCIDRs         []string       // Исключения SSRF (CIDR)
    ValidateURL             bool           // Валидация URL, по умолчанию true
    ValidateHeaders         bool           // Валидация заголовков запроса, по умолчанию true
    StrictContentLength     bool           // Строгий Content-Length, по умолчанию true
    CookieSecurity          *CookieSecurityConfig // Проверка безопасности Cookie
    RedirectWhitelist       []string       // Домены белого списка для перенаправлений
}
```

:::warning Предупреждение Защита от SSRF
`AllowPrivateIPs` по умолчанию равен `false`, что блокирует подключение к приватным/зарезервированным IP (127.0.0.1, 10.x, 192.168.x и т.д.). Устанавливайте `true` только при подключении к внутренним сервисам.
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
    Delay         time.Duration // Начальная задержка повторной попытки, по умолчанию 1s
    BackoffFactor float64       // Множитель экспоненциальной задержки, по умолчанию 2.0
    EnableJitter  bool          // Включить джиттер, по умолчанию true
    MaxRetryDelay time.Duration // Максимальный предел задержки повторной попытки, по умолчанию 30s
    CustomPolicy  RetryPolicy   // Пользовательская политика повторных попыток
}
```

| Поле | По умолчанию | Диапазон |
|------|--------|------|
| MaxRetries | 3 | 0-10 |
| Delay | 1s | 0-30min |
| BackoffFactor | 2.0 | 1.0-10.0 |
| MaxRetryDelay | 30s | 0-30min |

Формула задержки повторной попытки: `min(Delay * BackoffFactor^attempt + jitter, MaxRetryDelay)`

## MiddlewareConfig

```go
type MiddlewareConfig struct {
    Middlewares     []MiddlewareFunc // Список middleware
    UserAgent       string           // User-Agent, по умолчанию "httpc/1.0"
    Headers         map[string]string // Заголовки запроса по умолчанию
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

Конфигурация с приоритетом безопасности. Более короткие таймауты, отключено автоматическое перенаправление, строгая защита от SSRF.

| Параметр | Значение |
|--------|-----|
| Таймаут Request | 15s |
| Таймаут Dial | 5s |
| Таймаут TLSHandshake | 5s |
| Таймаут ResponseHeader | 10s (защита от Slowloris) |
| Таймаут IdleConn | 30s |
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

Конфигурация для высокой пропускной способности. Более крупный пул соединений, увеличенные таймауты, с сохранением проверок безопасности.

:::tip Совет
PerformanceConfig оставляет `ValidateURL` и `ValidateHeaders` включёнными для обеспечения безопасности. В доверенной среде для максимальной производительности их можно отключить вручную: `cfg.Security.ValidateURL = false`, но учитывайте риски безопасности (инъекции, SSRF).
:::

| Параметр | Значение |
|--------|-----|
| Таймаут Request | 60s |
| Таймаут Dial | 15s |
| Таймаут TLSHandshake | 15s |
| Таймаут ResponseHeader | 0 (отключено, используется таймаут Request) |
| Таймаут IdleConn | 120s |
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
|--------|-----|
| Таймаут Dial | 5s |
| Таймаут TLSHandshake | 5s |
| Таймаут ResponseHeader | 0 (отключено, используется таймаут Request) |
| Таймаут IdleConn | 30s |
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
Эта конфигурация отключает проверку TLS и защиту от SSRF. **Используйте только для тестирования**. Использование в не-тестовой среде вызовет вывод предупреждения о безопасности.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Лёгкая конфигурация. Отключены повторные попытки и перенаправления, минимальный пул соединений.

| Параметр | Значение |
|--------|-----|
| Таймаут Dial | 5s |
| Таймаут TLSHandshake | 5s |
| Таймаут ResponseHeader | 0 (отключено, используется таймаут Request) |
| Таймаут IdleConn | 30s |
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

Проверяет корректность конфигурации. Автоматически вызывается внутри `New()`, также может вызываться явно.

```go
cfg := httpc.DefaultConfig()
cfg.Retry.MaxRetries = 100 // Превышение диапазона

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
|------|------|------|
| `RequireSecure` | `bool` | Требовать наличие у Cookie атрибута Secure |
| `RequireHttpOnly` | `bool` | Требовать наличие у Cookie атрибута HttpOnly |
| `RequireSameSite` | `string` | Требуемое значение SameSite, например `"Strict"`, `"Lax"`; пустая строка — не проверять |
| `AllowSameSiteNone` | `bool` | Разрешать ли SameSite=None |
| `RequireSecureForSameSiteNone` | `bool` | При SameSite=None требовать атрибут Secure (по умолчанию `true`) |

### DefaultCookieSecurityConfig

```go
func DefaultCookieSecurityConfig() *CookieSecurityConfig
```

Конфигурация безопасности Cookie по умолчанию. Не требует атрибутов Secure/HttpOnly/SameSite, но принудительно требует наличия Secure для Cookie с SameSite=None.

### StrictCookieSecurityConfig

```go
func StrictCookieSecurityConfig() *CookieSecurityConfig
```

Строгая конфигурация безопасности Cookie. Требует Secure, HttpOnly и SameSite=Strict.

```go
cfg := httpc.DefaultConfig()
cfg.Security.CookieSecurity = httpc.StrictCookieSecurityConfig()
```
