---
title: "Конфигурация - CyberGo HTTPC | Конфиг и пресеты"
description: "Справочник API конфигурации HTTPC: структура Config с подконфигурациями Timeouts, Connection, Security, Retry, Middleware, пять пресетов и ValidateConfig."
---

# Конфигурация

## Config

```go
type Config struct {
    Timeouts   *TimeoutConfig
    Connection *ConnectionConfig
    Security   *SecurityConfig
    Retry      *RetryConfig
    Middleware *MiddlewareConfig
}
```

Основная структура конфигурации. Получите безопасные значения по умолчанию через `DefaultConfig()`.

:::tip Подконфигурации как указатели
Начиная с v1.5.1 все пять подконфигураций являются **типами-указателями**. `DefaultConfig()` и все функции предустановок (`SecureConfig`, `PerformanceConfig` и др.) автоматически инициализируют эти указатели непустыми структурами, поэтому обращения к полям вида `cfg.Timeouts.Request`, `cfg.Security.AllowPrivateIPs` и т. п. можно использовать напрямую. При ручном конструировании литерала `Config{}` значения нужно присваивать в виде `&httpc.TimeoutConfig{...}`, а перед использованием убедиться, что указатель не равен nil.
:::

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

Значение 0 означает отсутствие таймаута (не рекомендуется для продакшена).

:::tip Дизайн ResponseHeader
`ResponseHeader` по умолчанию равен 0 (отключен), при этом используется `Timeouts.Request` или `WithTimeout()` как единственный механизм таймаута, что обеспечивает полный контроль `WithTimeout()` над длительностью запроса. Этот дизайн подходит для AI API и long-polling, где требуется увеличенное время ответа. Устанавливайте положительное значение только при необходимости жёсткого ограничения транспортного уровня (например, для защиты от атак Slowloris), но учтите, что это переопределит `WithTimeout`.
:::

## ConnectionConfig

```go
type ConnectionConfig struct {
    MaxIdleConns           int           // Глобальное максимальное число простаивающих соединений, по умолчанию 50
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

Включение DoH снижает задержку разрешения DNS и предотвращает перехват DNS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableDoH = true
cfg.Connection.DoHCacheTTL = 5 * time.Minute
```

Провайдеры DoH по умолчанию (по приоритету): Cloudflare → Google → AliDNS. Подробнее см. [Пул соединений и прокси](../advanced/connection-pool).

## SecurityConfig

```go
type SecurityConfig struct {
    TLSConfig               *tls.Config    // Пользовательская конфигурация TLS
    MinTLSVersion           uint16                // Минимальная версия TLS, по умолчанию TLS 1.2
    MaxTLSVersion           uint16                // Максимальная версия TLS, по умолчанию TLS 1.3
    InsecureSkipVerify      bool                  // Пропуск проверки сертификата (только для тестов)
    MaxResponseBodySize     int64                 // Лимит размера тела ответа, по умолчанию 10MB
    MaxRequestBodySize      int64                 // Лимит размера тела запроса, по умолчанию 0 (без ограничения размера тела запроса; в отличие от MaxResponseBodySize автоматического отката нет)
    MaxDecompressedBodySize int64                 // Лимит размера после распаковки, по умолчанию 100MB
    AllowPrivateIPs         bool                  // Разрешить приватные IP, по умолчанию false
    SSRFExemptCIDRs         []string              // Исключения CIDR для SSRF
    ValidateURL             bool                  // Валидация URL, по умолчанию true
    ValidateHeaders         bool                  // Валидация заголовков запроса, по умолчанию true
    StrictContentLength     bool                  // Строгий Content-Length, по умолчанию true
    CookieSecurity          *CookieSecurityConfig // Проверка безопасности Cookie
    CertificatePinner       CertificatePinner     // Пиннинг сертификатов (SPKI-хэш/публичный ключ), по умолчанию nil (отключено)
    RedirectWhitelist       []string              // Белый список доменов для перенаправлений
}
```

### Пиннинг сертификатов (CertificatePinner)

`CertificatePinner` включает пиннинг сертификатов: TLS-рукопожатие отклоняется, если сервер не предоставил закреплённый ключ/сертификат, что защищает от атак типа «человек посередине» даже при компрометации доверенного УЦ. По умолчанию `nil` (отключено). Создаётся следующими конструкторами:

| Конструктор | Описание |
|-------------|----------|
| `NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)` | Создаётся из одного или нескольких base64-кодированных SPKI SHA-256-хэшей (наиболее распространён, поддерживает ротацию ключей) |
| `NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)` | Создаётся из DER-кодированных публичных ключей PKIX (внутренне вычисляется SHA-256) |
| `NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner` | Объединяет несколько pinner; принимается, если проходит хотя бы один |

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // Текущий ключ
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // Резервный ключ (ротация)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::warning Стоимость поддержки
Пиннинг сертификатов требует синхронного обновления закреплённых значений при смене серверного сертификата (например, при продлении Let's Encrypt). Рекомендуется закреплять несколько хэшей (текущий + резервный) и завести механизм обновления, чтобы ротация ключей не приводила к разрыву соединений.
:::

:::warning Защита от SSRF
`AllowPrivateIPs` по умолчанию `false`, блокирует подключение к приватным/зарезервированным IP (127.0.0.1, 10.x, 192.168.x и др.). Устанавливайте `true` только при подключении к внутренним сервисам.
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
    MaxRetries    int           // Максимальное число повторных попыток, по умолчанию 3
    Delay         time.Duration // Начальная задержка повтора, по умолчанию 1s
    BackoffFactor float64       // Множитель экспоненциальной задержки, по умолчанию 2.0
    EnableJitter  bool          // Включить джиттер, по умолчанию true
    MaxRetryDelay time.Duration // Максимальный предел задержки повтора, по умолчанию 30s
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
    MaxRedirects    int              // Максимальное число перенаправлений, по умолчанию 10
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

Конфигурация для высокой пропускной способности. Увеличенный пул соединений, более длинные таймауты, с сохранением проверок безопасности.

:::tip
PerformanceConfig сохраняет включёнными `ValidateURL` и `ValidateHeaders` для обеспечения безопасности. Если в доверенной среде требуется максимальная производительность, можно вручную отключить: `cfg.Security.ValidateURL = false`, но учитывайте риски безопасности (инъекции, SSRF).
:::

| Параметр | Значение |
|----------|----------|
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
|----------|----------|
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

:::danger
Эта конфигурация отключает проверку TLS и защиту SSRF, **используйте только для тестов**. Использование вне тестовой среды вызовет предупреждение безопасности.
:::

### MinimalConfig

```go
func MinimalConfig() *Config
```

Лёгкая конфигурация. Отключены повторные попытки и перенаправления, минимальный пул соединений.

| Параметр | Значение |
|----------|----------|
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

Проверяет корректность конфигурации. `New()` вызывает автоматически, также можно вызывать явно.

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
| `AllowSameSiteNone` | `bool` | Разрешить ли SameSite=None |
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
