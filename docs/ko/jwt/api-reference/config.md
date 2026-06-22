---
title: "Config - CyberGo JWT | 통합 설정 안내"
description: "Config는 CyberGo JWT 통합 설정으로 서명 키·알고리즘, 접근·갱신 토큰 TTL, 발급자, 기대 청중, 클럭 스큐, 블랙리스트와 속도 제한 전체 필드·기본값·자동 채움 규칙·Validate 검증 로직을 정의합니다."
---

# Config

## Config

```go
type Config struct {
    SecretKey       string
    SigningKey      any
    VerificationKey any
    SigningMethod   SigningMethod

    AccessTokenTTL    time.Duration
    RefreshTokenTTL   time.Duration
    Issuer            string
    ExpectedAudience  string
    RequireExpiration bool
    ClockSkew         time.Duration

    Blacklist BlacklistConfig

    EnableRateLimit bool
    RateLimitRate   int
    RateLimitWindow time.Duration
    RateLimiter     RateLimitProvider

    Clock ClockProvider
}
```

JWT Processor의 통합 설정. 제로값 필드는 `New()`에서 자동으로 기본값이 채워집니다(`normalizeConfig` 통해).

:::tip 자동 채우기 규칙
- `RateLimitRate`, `RateLimitWindow`는 `EnableRateLimit = true`인 경우에만 채워짐
- 내장 블랙리스트 저장소의 `EnableAutoCleanup`은 항상 `true`로 강제됨 (무한 증가 방지)
- `SecretKey`, `SigningKey`, `VerificationKey`는 자동으로 채워지지 않으므로 수동 설정 필요
:::

<Badge type="info" text="struct" />

### 필드

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `SecretKey` | `string` | — | HMAC 키 (최소 32바이트) |
| `SigningKey` | `any` | — | 비대칭 알고리즘 개인 키 (`*rsa.PrivateKey` 또는 `*ecdsa.PrivateKey`) |
| `VerificationKey` | `any` | — | 비대칭 알고리즘 공개 키 (선택, 기본값은 SigningKey 사용) |
| `SigningMethod` | `SigningMethod` | `HS256` | 서명 알고리즘 |
| `AccessTokenTTL` | `time.Duration` | `15m` | 액세스 토큰 유효 기간 |
| `RefreshTokenTTL` | `time.Duration` | `168h` | 리프레시 토큰 유효 기간 |
| `Issuer` | `string` | `"jwt-service"` | 발급자 |
| `ExpectedAudience` | `string` | — | 예상 수신자 (선택) |
| `RequireExpiration` | `bool` | `false` | `true`인 경우 검증 시 `exp` 클레임이 없는 토큰을 거부 ([`ErrExpirationRequired`](./errors#센티넬-오류) 반환) |
| `ClockSkew` | `time.Duration` | `0` | 검증 시 exp/nbf에 적용되는 클럭 스큐 허용 오차 (발급자와 검증자 사이의 클럭 드리프트 허용); 음수 값은 `Validate()`에서 거부됨 |
| `Blacklist` | `BlacklistConfig` | — | 블랙리스트 설정 |
| `EnableRateLimit` | `bool` | `false` | 속도 제한 활성화 |
| `RateLimitRate` | `int` | `100` | 윈도우당 최대 요청 수 |
| `RateLimitWindow` | `time.Duration` | `1m` | 속도 제한 윈도우 |
| `RateLimiter` | `RateLimitProvider` | — | 커스텀 속도 제한기 (선택) |
| `Clock` | `ClockProvider` | `SystemClock{}` | 클럭 제공자 |

### 메서드

| 메서드 | 시그니처 | 설명 |
|------|------|------|
| `Validate` | `func (c *Config) Validate() error` | 설정 유효성 검증 |

`Validate()` 검사 항목:

| 검사 항목 | 설명 |
|--------|------|
| 서명 키 | HMAC은 SecretKey ≥32바이트 및 약한 키가 아니어야 함; RSA/ECDSA는 올바른 타입의 SigningKey 필요; ECDSA는 곡선 일치 필요; VerificationKey는 알고리즘 공개 키 타입과 일치해야 함 |
| TTL 유효성 | `AccessTokenTTL`과 `RefreshTokenTTL`은 양수여야 함 |
| TTL 순서 | `AccessTokenTTL`은 `RefreshTokenTTL`보다 작아야 함 |
| ClockSkew | `ClockSkew`는 음수일 수 없음 |
| 서명 알고리즘 | 내장 지원하는 12개 알고리즘 중 하나여야 함 |
| 블랙리스트 | 내장 저장소 사용 시 MaxSize와 CleanupInterval은 양수여야 함 |

---

## BlacklistConfig

```go
type BlacklistConfig struct {
    CleanupInterval   time.Duration
    MaxSize           int
    EnableAutoCleanup bool
    Store             BlacklistStore
}
```

블랙리스트 설정.

<Badge type="info" text="struct" />

### 필드

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `CleanupInterval` | `time.Duration` | `5m` | 만료 항목 정리 간격 (내장 저장소에만 적용) |
| `MaxSize` | `int` | `100000` | 메모리 저장소 최대 항목 수 (내장 저장소에만 적용) |
| `EnableAutoCleanup` | `bool` | `true` | 만료 항목 자동 정리 (내장 저장소에만 적용) |
| `Store` | `BlacklistStore` | — | 커스텀 저장소 백엔드 (설정 시 다른 필드는 무시됨) |
