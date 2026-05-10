---
title: TLS и закрепление сертификатов - HTTPC
description: Руководство по TLS и закреплению сертификатов HTTPC, подробно описывающее управление версиями TLS, загрузку пользовательских CA, двустороннюю аутентификацию mTLS, закрепление открытых ключей SPKI и согласование HTTP/2.
---

# TLS и закрепление сертификатов

## Управление версиями TLS

HTTPC по умолчанию требует TLS 1.2+, рекомендуется TLS 1.3:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // по умолчанию
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // по умолчанию
```

### Описание версий

| Версия | Статус | По умолчанию в HTTPC |
|--------|--------|---------------------|
| TLS 1.0 | Небезопасно, устарело | Отклоняется |
| TLS 1.1 | Небезопасно, устарело | Отклоняется |
| TLS 1.2 | Безопасно | Минимальное требование |
| TLS 1.3 | Наиболее безопасно, рекомендуется | Поддерживается |

## Шифронаборы

Конфигурация по умолчанию допускает только безопасные шифронаборы:

| Шифронабор | Описание |
|------------|----------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | Рекомендуется |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | Рекомендуется |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | Рекомендуется |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | Рекомендуется |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | Рекомендуется |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | Рекомендуется |

## Пользовательская конфигурация TLS

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // Принудительный TLS 1.3
    // Другие пользовательские настройки
}
```

### Пользовательский CA-сертификат

```go
caCert, _ := os.ReadFile("custom-ca.pem")
caCertPool := x509.NewCertPool()
caCertPool.AppendCertsFromPEM(caCert)

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    RootCAs:    caCertPool,
    MinVersion: tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

### Взаимный TLS (mTLS)

```go
cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

## Закрепление сертификатов

Закрепление сертификатов (Certificate Pinning) предотвращает атаки «человек посередине» путём проверки хеша открытого ключа сертификата сервера.

### Закрепление хеша SPKI

Наиболее распространённый метод закрепления — проверка хеша SPKI любого сертификата в цепочке:

```go
// Генерация хеша SPKI:
// openssl x509 -in cert.pem -pubkey -noout | \
//   openssl pkey -pubin -outform der | \
//   openssl dgst -sha256 -binary | \
//   openssl enc -base64

// Закрепление промежуточного сертификата Let's Encrypt
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // Полная замена стандартной проверки, необходимо выполнить всю проверку в VerifyPeerCertificate
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // Здесь реализуется логика закрепления сертификатов
        // Примечание: при InsecureSkipVerify=true стандартная проверка цепочки пропущена, необходимо выполнить полную проверку сертификатов здесь
        return nil
    },
}
```

:::warning Предупреждение
Закрепление сертификатов увеличивает затраты на обслуживание. При замене сертификата на сервере (например, при продлении Let's Encrypt) клиенту необходимо обновить значение закрепления. Рекомендуется закреплять несколько сертификатов (например, листовой + промежуточный) и настроить механизм обновления.
:::

### Стратегии закрепления

| Стратегия | Безопасность | Затраты на обслуживание | Рекомендация |
|-----------|-------------|------------------------|-------------|
| Закрепление корневого сертификата | Низкая | Низкие | Только защита от подмены |
| Закрепление промежуточного сертификата | Средняя | Средние | Рекомендуется |
| Закрепление листового сертификата | Высокая | Высокие | Высокие требования к безопасности |
| Закрепление нескольких уровней | Высокая | Средние | Лучший вариант |

## InsecureSkipVerify

```go
// Только для тестирования!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → пропуск проверки TLS-сертификатов
```

:::danger Опасность
`InsecureSkipVerify = true` отключает все меры безопасности TLS. Используйте только в тестовой среде. Никогда не устанавливайте `true` в production.
:::

## HTTP/2

HTTP/2 включён по умолчанию, доступен только при использовании TLS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Отключить HTTP/2
```

## Лучшие практики

1. Используйте конфигурацию TLS по умолчанию (TLS 1.2+)
2. При закреплении сертификатов закрепляйте промежуточные сертификаты и подготовьте резервные значения
3. Регулярно обновляйте значения закрепления, синхронно с продлением сертификатов сервера
4. Используйте `SecureConfig()` как базовую конфигурацию безопасности
5. Никогда не устанавливайте `InsecureSkipVerify` в production

## Что дальше

- [Защита от SSRF](./ssrf) - конфигурация безопасности SSRF
- [Обзор безопасности](./) - обзор функций безопасности
- [Конфигурация API](../api-reference/config) - справочник SecurityConfig
