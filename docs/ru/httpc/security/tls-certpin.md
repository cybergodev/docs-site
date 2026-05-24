---
title: "TLS и закрепление сертификатов — HTTPC"
description: "Руководство по TLS и закреплению сертификатов HTTPC: управление версиями TLS 1.2-1.3 и шифрскими наборами, загрузка пользовательских CA сертификатов, двусторонняя аутентификация mTLS, закрепление открытых ключей SPKI через VerifyPeerCertificate, предупреждение об InsecureSkipVerify и согласование HTTP/2."
---

# TLS и закрепление сертификатов

## Управление версиями TLS

HTTPC по умолчанию требует TLS 1.2+, рекомендуется TLS 1.3:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // По умолчанию
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // По умолчанию
```

### Описание версий

| Версия | Статус | В HTTPC по умолчанию |
|--------|--------|---------------------|
| TLS 1.0 | Небезопасно, устарело | Отклоняется |
| TLS 1.1 | Небезопасно, устарело | Отклоняется |
| TLS 1.2 | Безопасно | Минимальное требование |
| TLS 1.3 | Наиболее безопасно, рекомендуется | Поддерживается |

## Шифрские наборы

Конфигурация по умолчанию допускает только безопасные шифрские наборы:

| Шифрский набор | Описание |
|----------------|----------|
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

### Двусторонний TLS (mTLS)

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

Закрепление сертификатов (Certificate Pinning) предотвращает атаки «человек посередине» путём проверки хеша открытого ключа серверного сертификата.

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
    InsecureSkipVerify: true, // Полная замена стандартной проверки, необходимо выполнить все проверки в VerifyPeerCertificate
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // Здесь реализуется логика закрепления сертификатов
        // Внимание: при InsecureSkipVerify=true стандартная проверка цепочки пропущена, необходимо выполнить полную проверку сертификатов
        return nil
    },
}
```

:::warning Предупреждение
Закрепление сертификатов увеличивает расходы на обслуживание. Если сервер меняет сертификат (например, продление Let's Encrypt), клиенту необходимо синхронно обновить значение закрепления. Рекомендуется одновременно закреплять несколько сертификатов (например, конечный + промежуточный) и настроить механизм обновления.
:::

### Стратегии закрепления

| Стратегия | Безопасность | Стоимость обслуживания | Рекомендация |
|-----------|-------------|----------------------|--------------|
| Закрепление корневого сертификата | Низкая | Низкая | Только защита от подмены |
| Закрепление промежуточного сертификата | Средняя | Средняя | Рекомендуется |
| Закрепление конечного сертификата | Высокая | Высокая | Сценарии повышенной безопасности |
| Закрепление нескольких уровней | Высокая | Средняя | Наилучший вариант |

## InsecureSkipVerify

```go
// Только для тестирования!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → пропуск проверки TLS-сертификатов
```

:::danger Опасность
`InsecureSkipVerify = true` делает все меры безопасности TLS недействительными, используйте только в тестовой среде. В production никогда не устанавливайте `true`.
:::

## HTTP/2

HTTP/2 включён по умолчанию, доступен только при использовании TLS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Отключить HTTP/2
```

## Лучшие практики

1. Используйте конфигурацию TLS по умолчанию (TLS 1.2+)
2. При закреплении сертификатов закрепляйте промежуточный сертификат и подготовьте резервные значения
3. Регулярно обновляйте значения закрепления, синхронно с продлением серверных сертификатов
4. Используйте `SecureConfig()` как базовый уровень безопасности
5. Никогда не устанавливайте `InsecureSkipVerify` в production

## Что дальше

- [Защита от SSRF](./ssrf) — настройка безопасности SSRF
- [Обзор безопасности](./) — обзор функций безопасности
- [Конфигурация API](../api-reference/config) — справочник SecurityConfig
