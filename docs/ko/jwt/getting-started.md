---
title: "빠른 시작 - JWT"
description: "CyberGo JWT 빠른 시작 가이드: 설치 설정, 토큰 발급 및 검증, 갱신 및 취소, HMAC/RSA/ECDSA 알고리즘 선택, 커스텀 Claims, 블랙리스트 및 속도 제한 설정."
---

# 빠른 시작

## 설치

```bash
go get github.com/cybergodev/jwt
```

Go 1.25+ 필요.

## 기본 사용법

### 1. Processor 생성

```go
package main

import (
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!" // HMAC 최소 32바이트
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close() // 키 안전 삭제
}
```

### 2. 토큰 발급

```go
claims := &jwt.Claims{
    UserID:   "user123",
    Username: "alice",
    Role:     "admin",
    Permissions: []string{"read", "write"},
}

// 액세스 토큰 (단기)
accessToken, err := processor.Create(claims)
if err != nil {
    panic(err)
}

// 리프레시 토큰 (장기)
refreshToken, err := processor.CreateRefresh(claims)
if err != nil {
    panic(err)
}
```

### 3. 토큰 검증

```go
parsed, valid, err := processor.Validate(accessToken)
if err != nil {
    // 오류 처리: 만료, 서명 무효 등
    panic(err)
}
if valid {
    fmt.Println("UserID:", parsed.UserID)
    fmt.Println("Role:", parsed.Role)
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time)
}
```

### 4. 토큰 갱신

```go
newAccessToken, err := processor.Refresh(refreshToken)
if err != nil {
    panic(err)
}
fmt.Println("New Access Token:", newAccessToken)
```

### 5. 토큰 취소

```go
// 토큰을 블랙리스트에 추가
err := processor.Revoke(accessToken)
if err != nil {
    panic(err)
}

// 취소 여부 확인
revoked, err := processor.IsRevoked(accessToken)
if err != nil {
    panic(err)
}
fmt.Println("Revoked:", revoked) // true
```

## 서명 알고리즘

### HMAC (대칭 키)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.SigningMethod = jwt.SigningMethodHS256 // 기본값
```

| 메서드 | 알고리즘 |
|------|------|
| `SigningMethodHS256` | HMAC-SHA256 |
| `SigningMethodHS384` | HMAC-SHA384 |
| `SigningMethodHS512` | HMAC-SHA512 |

### RSA (비대칭 키)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodRS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (선택, 기본값은 SigningKey 사용)
```

| 메서드 | 알고리즘 |
|------|------|
| `SigningMethodRS256` | RSA-SHA256 |
| `SigningMethodRS384` | RSA-SHA384 |
| `SigningMethodRS512` | RSA-SHA512 |

### RSA-PSS (비대칭 키, 권장)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodPS256
cfg.SigningKey = rsaPrivateKey        // *rsa.PrivateKey
cfg.VerificationKey = rsaPublicKey    // *rsa.PublicKey (선택)
```

| 메서드 | 알고리즘 |
|------|------|
| `SigningMethodPS256` | RSA-PSS-SHA256 |
| `SigningMethodPS384` | RSA-PSS-SHA384 |
| `SigningMethodPS512` | RSA-PSS-SHA512 |

### ECDSA (비대칭 키)

```go
cfg := jwt.DefaultConfig()
cfg.SigningMethod = jwt.SigningMethodES256
cfg.SigningKey = ecdsaPrivateKey      // *ecdsa.PrivateKey
cfg.VerificationKey = ecdsaPublicKey  // *ecdsa.PublicKey (선택)
```

| 메서드 | 알고리즘 |
|------|------|
| `SigningMethodES256` | ECDSA-SHA256 |
| `SigningMethodES384` | ECDSA-SHA384 |
| `SigningMethodES512` | ECDSA-SHA512 |

## 커스텀 Claims

`CustomClaims` 인터페이스를 구현하여 자체 Claims 구조체를 정의합니다:

```go
type MyClaims struct {
    UserID string `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}

func (c *MyClaims) GetRegisteredClaims() *jwt.RegisteredClaims {
    return &c.RegisteredClaims
}

func (c *MyClaims) Validate() error {
    if c.UserID == "" {
        return errors.New("user_id is required")
    }
    return nil
}
```

커스텀 Claims 사용:

```go
claims := &MyClaims{UserID: "123", Role: "admin"}

// 토큰 생성
token, err := processor.Create(claims)

// 커스텀 구조체로 검증
result := &MyClaims{}
parsed, valid, err := processor.ValidateInto(token, result)

// 커스텀 구조체로 갱신
newToken, err := processor.RefreshInto(refreshToken, claims)
```

## 블랙리스트 설정

### 내장 메모리 저장소 사용 (기본값)

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
// 내장 블랙리스트가 자동으로 활성화됨
```

### 커스텀 저장소 백엔드

`BlacklistStore` 인터페이스 구현 (예: Redis):

```go
type RedisStore struct {
    client *redis.Client
}

func (s *RedisStore) Add(tokenID string, expiresAt time.Time) error {
    return s.client.Set(ctx, "blacklist:"+tokenID, "1", time.Until(expiresAt)).Err()
}

func (s *RedisStore) Contains(tokenID string) (bool, error) {
    n, err := s.client.Exists(ctx, "blacklist:"+tokenID).Result()
    return n > 0, err
}

func (s *RedisStore) Close() error {
    return s.client.Close()
}

// 사용
cfg.Blacklist.Store = &RedisStore{client: rdb}
```

## 속도 제한 설정

```go
cfg := jwt.DefaultConfig()
cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
cfg.EnableRateLimit = true
cfg.RateLimitRate = 100          // 윈도우당 최대 요청 수
cfg.RateLimitWindow = time.Minute // 시간 윈도우
```

## 오류 처리

```go
import "errors"

claims, valid, err := processor.Validate(tokenString)
if err != nil {
    switch {
    case errors.Is(err, jwt.ErrTokenExpired):
        // 토큰 만료
    case errors.Is(err, jwt.ErrTokenRevoked):
        // 토큰이 취소됨
    case errors.Is(err, jwt.ErrTokenInvalidIssuer):
        // 발급자 불일치
    case errors.Is(err, jwt.ErrTokenInvalidAudience):
        // 수신자 불일치
    case errors.Is(err, jwt.ErrInvalidToken):
        // 서명 무효 또는 형식 오류
    case errors.Is(err, jwt.ErrProcessorClosed):
        // Processor가 종료됨
    default:
        // 기타 오류
    }
}
```

## 다음 단계

- [서명 알고리즘](./guides/signing-algorithms) — 알고리즘 선택 및 키 설정
- [커스텀 Claims](./guides/custom-claims) — 비즈니스 필드 정의
- [토큰 블랙리스트](./guides/blacklist) — 취소 및 커스텀 저장소
- [속도 제한](./guides/rate-limiting) — 속도 제한 설정
- [오류 처리](./guides/error-handling) — 오류 분류 및 처리 패턴
- [API 레퍼런스](./api-reference/) — 전체 API 참조 문서
