---
title: TLS와 인증서 고정 - HTTPC
description: HTTPC TLS 보안 및 인증서 고정 완전 가이드로, TLS 버전 관리와 기본 구성 매개변수, 사용자 정의 CA 인증서 로드 방법, 상호 mTLS 인증 구성, SPKI 공개 키 해시 인증서 고정 구현, HTTP/2 프로토콜 협상 및 InsecureSkipVerify 위험 설명을 다룹니다.
---

# TLS와 인증서 고정

## TLS 버전 관리

HTTPC는 기본적으로 TLS 1.2+를 요구하며, TLS 1.3을 권장합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // 기본값
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // 기본값
```

### 버전 설명

| 버전 | 상태 | HTTPC 기본값 |
|------|------|-------------|
| TLS 1.0 | 안전하지 않음, 사용 중단 | 거부 |
| TLS 1.1 | 안전하지 않음, 사용 중단 | 거부 |
| TLS 1.2 | 안전 | 최소 요구 사항 |
| TLS 1.3 | 가장 안전, 권장 | 지원 |

## 암호화 스위트

기본 구성은 안전한 암호화 스위트만 허용합니다:

| 암호화 스위트 | 설명 |
|-------------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 권장 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 권장 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 권장 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 권장 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 권장 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 권장 |

## 사용자 정의 TLS 구성

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // TLS 1.3 강제
    // 기타 사용자 정의 구성
}
```

### 사용자 정의 CA 인증서

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

### 상호 TLS (mTLS)

```go
cert, _ := tls.LoadX509KeyPair("client-cert.pem", "client-key.pem")

cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    Certificates: []tls.Certificate{cert},
    MinVersion:   tls.VersionTLS12,
}

client, _ := httpc.New(cfg)
```

## 인증서 고정

인증서 고정(Certificate Pinning)은 서버 인증서의 공개 키 해시를 검증하여 중간자 공격을 방지합니다.

### SPKI 해시 고정

가장 일반적인 고정 방식으로, 인증서 체인의 임의 인증서에 대한 SPKI 해시를 검증합니다:

```go
// SPKI 해시 생성:
// openssl x509 -in cert.pem -pubkey -noout | \
//   openssl pkey -pubin -outform der | \
//   openssl dgst -sha256 -binary | \
//   openssl enc -base64

// Let's Encrypt 중간 인증서 고정
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 표준 검증을 완전히 대체하며, VerifyPeerCertificate에서 모든 검증을 직접 수행해야 함
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // 여기에 인증서 고정 로직을 구현합니다
        // 참고: InsecureSkipVerify=true일 때 표준 체인 검증이 생략되므로, 여기서 완전한 인증서 검증을 수행해야 합니다
        return nil
    },
}
```

:::warning
인증서 고정은 유지 관리 비용을 증가시킵니다. 서버가 인증서를 변경하는 경우(예: Let's Encrypt 갱신) 클라이언트도 고정 값을 동기화하여 업데이트해야 합니다.
여러 인증서(예: 리프 인증서 + 중간 인증서)를 동시에 고정하고, 업데이트 메커니즘을 설정하는 것이 좋습니다.
:::

### 고정 전략

| 전략 | 보안성 | 유지 관리 비용 | 권장 |
|------|--------|-------------|------|
| 루트 인증서 고정 | 낮음 | 낮음 | 변조 방지만 |
| 중간 인증서 고정 | 중간 | 중간 | 권장 |
| 리프 인증서 고정 | 높음 | 높음 | 고보안 시나리오 |
| 다중 계층 고정 | 높음 | 중간 | 최적 |

## InsecureSkipVerify

```go
// 테스트 전용!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → TLS 인증서 검증 건너뜀
```

:::danger
`InsecureSkipVerify = true`는 모든 TLS 보안 조치를 무력화합니다. 테스트 환경에서만 사용하세요. 프로덕션 환경에서는 절대 `true`로 설정하지 마세요.
:::

## HTTP/2

HTTP/2는 기본적으로 활성화되며, TLS 사용 시에만 가능합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 비활성화
```

## 모범 사례

1. 기본 TLS 구성 사용 (TLS 1.2+)
2. 인증서 고정 시 중간 인증서를 고정하고, 백업 고정 값을 준비
3. 서버 인증서 갱신에 맞춰 고정 값을 정기적으로 업데이트
4. `SecureConfig()`를 보안 기준선으로 사용
5. 프로덕션 환경에서 절대 `InsecureSkipVerify` 설정하지 않기

## 다음 단계

- [SSRF 방어](./ssrf) - SSRF 보안 구성
- [보안 개요](./) - 보안 기능 개요
- [구성 API](../api-reference/config) - SecurityConfig 참조
