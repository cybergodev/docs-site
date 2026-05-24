---
title: "서명 알고리즘 - JWT"
description: "CyberGo JWT 서명 알고리즘 가이드: HMAC, RSA, RSA-PSS, ECDSA 4종류 12개 알고리즘의 사용법, 키 요구사항, 시나리오 선택 및 성능 비교."
---

# 서명 알고리즘

CyberGo JWT는 4종류 총 12개의 서명 알고리즘을 지원하며, 단일 애플리케이션부터 마이크로서비스 아키텍처까지 다양한 시나리오를 다룹니다.

## 알고리즘 개요

| 타입 | 알고리즘 | 키 타입 | 적용 시나리오 |
|------|------|----------|----------|
| HMAC | HS256 / HS384 / HS512 | 대칭 키 | 단일 애플리케이션, 단순 서비스 |
| RSA | RS256 / RS384 / RS512 | 공개 키/개인 키 | 마이크로서비스, 다중 서비스 검증 |
| RSA-PSS | PS256 / PS384 / PS512 | 공개 키/개인 키 | 마이크로서비스 (RSA 대체 권장) |
| ECDSA | ES256 / ES384 / ES512 | 공개 키/개인 키 | 고성능 마이크로서비스 |

## HMAC (대칭 키)

HMAC은 동일한 키로 서명하고 검증하는 가장 간단한 방식입니다.

### 키 요구사항

- 최소 32바이트
- 라이브러리가 약한 키를 자동으로 감지합니다 (예: 순수 반복 문자, 단순 증가 시퀀스 등)

### 사용법

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // 기본값, 생략 가능
```

### 알고리즘 선택

| 상수 | 알고리즘 | 설명 |
|------|------|------|
| `SigningMethodHS256` | HMAC-SHA256 | 권장, 성능과 보안의 균형 |
| `SigningMethodHS384` | HMAC-SHA384 | 더 높은 보안성 |
| `SigningMethodHS512` | HMAC-SHA512 | 최고 보안성 |

:::tip 권장
대부분의 시나리오에서는 `HS256`을 사용하면 충분합니다. 키는 암호학적으로 안전한 난수로 생성하고 길이는 최소 32바이트 이상으로 하는 것을 권장합니다.
:::

## RSA (비대칭 키)

RSA는 개인 키로 서명하고 공개 키로 검증합니다. 검증 측에서 개인 키를 보유할 필요가 없는 시나리오에 적합합니다.

### 사용법

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (선택)
```

:::tip 검증 키
`VerificationKey`는 선택 사항입니다. 설정하지 않으면 라이브러리가 `SigningKey`에서 공개 키를 추출하여 검증에 사용합니다.
:::

### 키 생성

```go
// 2048비트 RSA 키 쌍 생성
privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 알고리즘 선택

| 상수 | 알고리즘 | 설명 |
|------|------|------|
| `SigningMethodRS256` | RSA-SHA256 | 권장 |
| `SigningMethodRS384` | RSA-SHA384 | 더 높은 보안성 |
| `SigningMethodRS512` | RSA-SHA512 | 최고 보안성 |

## RSA-PSS (비대칭 키, RSA 대체 권장)

RSA-PSS는 RSA의 개선된 서명 방식으로, 확률적 서명 방식(PSS) 패딩을 사용하여 PKCS#1 v1.5보다 보안성이 뛰어납니다. 키는 RSA와 동일합니다.

### 사용법

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey (RSA와 키 공유)
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (선택)
```

:::tip 대체 권장
RSA-PSS는 RSA PKCS#1 v1.5보다 안전하므로 신규 프로젝트에서는 RSA-PSS 알고리즘을 우선 사용하는 것이 좋습니다. 키는 RSA와 완전히 동일하므로 추가로 생성할 필요가 없습니다.
:::

### 알고리즘 선택

| 상수 | 알고리즘 | 설명 |
|------|------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 | 권장 |
| `SigningMethodPS384` | RSA-PSS-SHA384 | 더 높은 보안성 |
| `SigningMethodPS512` | RSA-PSS-SHA512 | 최고 보안성 |

## ECDSA (타원 곡선)

ECDSA 역시 비대칭 알고리즘이지만, 키가 더 짧고 성능이 더 좋습니다.

### 사용법

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey (선택)
```

### 키 생성

```go
// P-256 곡선 키 쌍 생성
privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
if err != nil {
    log.Fatal(err)
}
publicKey := &privateKey.PublicKey
```

### 알고리즘 선택

| 상수 | 알고리즘 | 곡선 | 설명 |
|------|------|------|------|
| `SigningMethodES256` | ECDSA-SHA256 | P-256 | 권장 |
| `SigningMethodES384` | ECDSA-SHA384 | P-384 | 더 높은 보안성 |
| `SigningMethodES512` | ECDSA-SHA512 | P-521 | 최고 보안성 |

## 선택 방법

```text
단일 애플리케이션 ──────────→ HMAC
마이크로서비스 (동일 신뢰 도메인) ──→ HMAC
마이크로서비스 (교차 서비스 검증)→ RSA, RSA-PSS 또는 ECDSA
보안 우선 ────────────────→ RSA-PSS (RSA 대체)
고성능 요구 ──────────────→ ECDSA
키 길이 민감 ─────────────→ ECDSA
```

| 고려 요소 | HMAC | RSA | RSA-PSS | ECDSA |
|----------|------|-----|---------|-------|
| 서명 속도 | 빠름 | 느림 | 느림 | 빠름 |
| 검증 속도 | 빠름 | 빠름 | 빠름 | 빠름 |
| 키 길이 | 32+ 바이트 | 2048+ 비트 | 2048+ 비트 | 256+ 비트 |
| 서명 길이 | 고정 | 김 (~256바이트) | 김 (~256바이트) | 짧음 (~64바이트) |
| 아키텍처 결합 | 강결합 | 느슨한 결합 | 느슨한 결합 | 느슨한 결합 |
| 보안성 | 높음 | 높음 | 더 높음 | 높음 |

## 보안 주의사항

:::danger 금지 사항
- 코드에 키를 하드코딩하지 마세요
- 약한 키를 사용하지 마세요 (숫자만, 반복 문자 등)
- `none` 알고리즘을 사용하지 마세요 (본 라이브러리는 자동으로 거부함)
- HMAC 키는 32바이트 미만으로 사용하지 마세요
:::

:::tip 모범 사례
- 환경 변수 또는 키 관리 서비스를 사용하여 키를 저장하세요
- 서명 키를 정기적으로 교체하세요
- 프로덕션 환경에서는 RSA 또는 ECDSA 사용을 권장합니다
- RSA 키는 2048비트 이상을 권장합니다
:::

## 다음 단계

- [커스텀 Claims](./custom-claims) — 비즈니스 필드 정의
- [API 레퍼런스 → 패키지 함수](../api-reference/functions) — 전체 API 시그니처
- [기본 예제](../examples/basic) — HMAC 전체 예제
