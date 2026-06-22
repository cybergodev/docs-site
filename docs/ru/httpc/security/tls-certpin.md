---
title: "TLS и пиннинг сертификатов - CyberGo HTTPC | Шифры и пиннинг"
description: "Руководство по TLS и закреплению сертификатов HTTPC: версии TLS 1.2-1.3 и шифры, пользовательские CA, mTLS, API закрепления CertificatePinner и HTTP/2."
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
| TLS 1.0 | Небезопасна, устарела | Отклоняется |
| TLS 1.1 | Небезопасна, устарела | Отклоняется |
| TLS 1.2 | Безопасна | Минимальное требование |
| TLS 1.3 | Наиболее безопасна, рекомендуется | Поддерживается |

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

### Взаимная аутентификация TLS (mTLS)

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

Закрепление сертификатов (Certificate Pinning) предотвращает атаки типа "человек посередине" путём проверки хеша открытого ключа серверного сертификата.

### Закрепление хеша SPKI (рекомендуется)

Наиболее распространённый метод. Через `NewSPKIHashPinner` проверяется SPKI (SubjectPublicKeyInfo) SHA-256-хэш любого сертификата в серверной цепочке. Указание нескольких хэшей поддерживает ротацию ключей — соответствие любого из них считается успешным.

Генерация SPKI-хэша:

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

Закрепление промежуточного сертификата Let's Encrypt (рекомендуется закреплять именно промежуточный — баланс безопасности и стоимости поддержки):

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // Текущий промежуточный сертификат
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // Резервный (ротация ключей)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
`CertificatePinner` дополняет стандартную проверку цепочки TLS, **не** требуя `InsecureSkipVerify`. Проверка применяется к любому уровню сертификата в цепочке, поэтому закрепление промежуточного сертификата остаётся действующим и после продления листового сертификата.
:::

:::warning
Закрепление сертификатов увеличивает расходы на обслуживание. Если сервер заменяет сертификат (например, при продлении Let's Encrypt), клиенту необходимо обновить закреплённые значения.
Рекомендуется закреплять несколько сертификатов одновременно (например, листовый + промежуточный) и настроить механизм обновления.
:::

### Другие конструкторы закрепления

Помимо SPKI-хэшей HTTPC предоставляет:

```go
// Напрямую из DER-кодированных публичных ключей PKIX (внутренне вычисляется SHA-256)
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// Объединяет несколько pinner; принимается, если проходит хотя бы один (смешанная стратегия или ротация ключей)
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

### Продвинутое: пользовательский callback проверки TLS

Если требуется полный контроль над логикой проверки TLS (например, закрепление полного сертификата, а не открытого ключа), можно реализовать его самостоятельно через `TLSConfig`. При этом стандартная проверка цепочки пропускается через `InsecureSkipVerify`, и **необходимо** выполнить все проверки в `VerifyPeerCertificate`:

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // Пропускает стандартную проверку цепочки; все проверки нужно выполнить в callback
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // Здесь реализуется полная проверка сертификатов + логика закрепления
        return nil
    },
}
```

:::warning
`InsecureSkipVerify = true` полностью отключает стандартную проверку цепочки сертификатов. Используйте только если действительно нужна пользовательская логика проверки, и обеспечьте выполнение всех необходимых проверок в callback. В большинстве сценариев закрепления предпочтительнее использовать `CertificatePinner`.
:::

### Стратегия закрепления

| Стратегия | Безопасность | Стоимость обслуживания | Рекомендация |
|-----------|-------------|----------------------|-------------|
| Закрепление корневого сертификата | Низкая | Низкая | Только защита от подмены |
| Закрепление промежуточного сертификата | Средняя | Средняя | Рекомендуется |
| Закрепление листового сертификата | Высокая | Высокая | Сценарии повышенной безопасности |
| Закрепление нескольких уровней | Высокая | Средняя | Лучший вариант |

## InsecureSkipVerify

```go
// Только для тестирования!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → пропуск проверки TLS-сертификатов
```

:::danger
`InsecureSkipVerify = true` отключает все меры безопасности TLS, используйте только в тестовой среде. Никогда не устанавливайте `true` в продакшене.
:::

## HTTP/2

HTTP/2 включён по умолчанию, доступен только при использовании TLS:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // Отключить HTTP/2
```

## Лучшие практики

1. Используйте конфигурацию TLS по умолчанию (TLS 1.2+)
2. При закреплении сертификатов закрепляйте промежуточные сертификаты и подготовьте запасные закреплённые значения
3. Регулярно обновляйте закреплённые значения в соответствии с продлением серверных сертификатов
4. Используйте `SecureConfig()` как базовую конфигурацию безопасности
5. Никогда не устанавливайте `InsecureSkipVerify` в продакшене

## Что дальше

- [Защита от SSRF](./ssrf) - конфигурация безопасности SSRF
- [Обзор безопасности](./) - обзор функций безопасности
- [Конфигурация API](../api-reference/config) - справочник по SecurityConfig
