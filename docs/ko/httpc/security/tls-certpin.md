---
title: "TLS와 인증서 고정 - CyberGo HTTPC | 암호와 핀닝"
description: "HTTPC TLS와 인증서 고정 가이드: TLS 1.2-1.3 버전 제어와 암호 스위트, 커스텀 CA 인증서 로드, mTLS 상호 인증, CertificatePinner 인증서 고정 API와 HTTP/2 협상을 다룹니다."
---

# TLS와 인증서 고정

## TLS 버전 제어

HTTPC은 기본적으로 TLS 1.2+를 요구하며, TLS 1.3을 권장합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MinTLSVersion = tls.VersionTLS12  // 기본값
cfg.Security.MaxTLSVersion = tls.VersionTLS13  // 기본값
```

### 버전 설명

| 버전 | 상태 | HTTPC 기본값 |
|------|------|-------------|
| TLS 1.0 | 안전하지 않음, 폐기됨 | 거부 |
| TLS 1.1 | 안전하지 않음, 폐기됨 | 거부 |
| TLS 1.2 | 안전함 | 최소 요구사항 |
| TLS 1.3 | 가장 안전함, 권장 | 지원 |

## 암호 스위트

기본 설정은 안전한 암호 스위트만 허용합니다:

| 암호 스위트 | 설명 |
|------------|------|
| `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256` | 권장 |
| `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384` | 권장 |
| `TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305` | 권장 |
| `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` | 권장 |
| `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384` | 권장 |
| `TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305` | 권장 |

## 커스텀 TLS 설정

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    MinVersion: tls.VersionTLS13,  // TLS 1.3 강제
    // 기타 커스텀 설정
}
```

### 커스텀 CA 인증서

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

### SPKI 해시 고정 (권장)

가장 일반적인 고정 방식입니다. `NewSPKIHashPinner`로 서버 인증서 체인 중 어느 한 인증서의 SPKI(SubjectPublicKeyInfo) SHA-256 해시를 검증합니다. 여러 해시를 제공하면 키 로테이션을 지원합니다 — 어느 하나라도 일치하면 통과합니다.

SPKI 해시 생성:

```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

Let's Encrypt 중간 인증서 고정(보안과 유지보수 비용의 균형을 위해 중간 인증서 고정을 권장):

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 현재 중간 인증서
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 백업 (키 로테이션)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
`CertificatePinner`는 표준 TLS 체인 검증 **위에** 고정 검증을 추가하며, `InsecureSkipVerify`를 설정할 필요가 없습니다. 검증은 인증서 체인의 어느 계층에나 적용되므로 중간 인증서를 고정하면 리프 인증서가 갱신되어도 계속 유효합니다.
:::

:::warning
인증서 고정은 유지보수 비용을 증가시킵니다. 서버가 인증서를 교체하는 경우(예: Let's Encrypt 갱신) 클라이언트도 고정 값을 동기화해야 합니다.
여러 인증서(예: 리프 인증서 + 중간 인증서)를 함께 고정하고 업데이트 메커니즘을 설정하는 것이 좋습니다.
:::

### 기타 고정 생성자

SPKI 해시 외에도 HTTPC은 다음을 제공합니다:

```go
// DER 인코딩된 PKIX 공개키로 직접 생성 (내부적으로 SHA-256 계산)
pubPinner, err := httpc.NewPublicKeyPinner(pubKeyDER1, pubKeyDER2)

// 여러 pinner를 조합, 어느 하나라도 통과하면 수락 (혼합 고정 전략이나 키 로테이션)
chainPinner := httpc.NewCertificatePinnerChain(spkiPinner, pubPinner)
cfg.Security.CertificatePinner = chainPinner
```

### 고급: 커스텀 TLS 검증 콜백

TLS 검증 로직을 완전히 제어해야 하는 경우(예: 공개키가 아닌 전체 인증서를 고정), `TLSConfig`로 직접 구현할 수 있습니다. 이때 표준 체인 검증은 `InsecureSkipVerify`로 건너뛰며, `VerifyPeerCertificate`에서 **반드시** 모든 검증을 완료해야 합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.TLSConfig = &tls.Config{
    InsecureSkipVerify: true, // 표준 체인 검증 건너뛰기, 콜백에서 모든 검증을 직접 수행해야 함
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
        // 여기에 완전한 인증서 검증 + 고정 로직 구현
        return nil
    },
}
```

:::warning
`InsecureSkipVerify = true`는 표준 인증서 체인 검증을 완전히 건너뜁니다. 실제로 커스텀 검증 로직이 필요한 경우에만 사용하고, 콜백에서 필요한 모든 검증을 완료하세요. 대부분의 고정 시나리오에서는 `CertificatePinner`를 우선적으로 사용해야 합니다.
:::

### 고정 전략

| 전략 | 보안성 | 유지보수 비용 | 권장 |
|------|--------|-------------|------|
| 루트 인증서 고정 | 낮음 | 낮음 | 변조 방지만 |
| 중간 인증서 고정 | 중간 | 중간 | 권장 |
| 리프 인증서 고정 | 높음 | 높음 | 고보안 시나리오 |
| 다중 계층 고정 | 높음 | 중간 | 최적 |

## InsecureSkipVerify

```go
// 테스트에만 사용!
cfg := httpc.TestingConfig()
// InsecureSkipVerify = true → TLS 인증서 검증 건너뛰기
```

:::danger
`InsecureSkipVerify = true`는 모든 TLS 보안 조치를 무효화하므로 테스트 환경에서만 사용하세요. 프로덕션 환경에서는 절대 `true`로 설정하지 마세요.
:::

## HTTP/2

HTTP/2는 기본적으로 활성화되어 있으며, TLS 사용 시에만 사용 가능합니다:

```go
cfg := httpc.DefaultConfig()
cfg.Connection.EnableHTTP2 = false // HTTP/2 비활성화
```

## 모범 사례

1. 기본 TLS 설정 사용 (TLS 1.2+)
2. 인증서 고정 시 중간 인증서를 고정하고, 백업 고정 값 준비
3. 고정 값을 정기적으로 업데이트하고 서버 인증서 갱신과 동기화
4. `SecureConfig()`를 보안 기준선으로 사용
5. 프로덕션 환경에서 절대 `InsecureSkipVerify` 설정하지 않기

## 다음 단계

- [SSRF 방어](./ssrf) - SSRF 보안 설정
- [보안 개요](./) - 보안 기능 개요
- [설정 API](../api-reference/config) - SecurityConfig 참조
