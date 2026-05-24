---
title: "기본 예제 - JWT"
description: "CyberGo JWT 기본 예제: HMAC 서명 토큰 생성 및 검증, 액세스 토큰과 리프레시 토큰, 토큰 취소 및 블랙리스트 관리, 속도 제한 보호의 전체 실행 가능 코드."
---

# 기본 예제

## HMAC 서명

가장 일반적인 방식으로, 대칭 키를 사용하여 서명하고 검증합니다.

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.AccessTokenTTL = 15 * time.Minute
    cfg.RefreshTokenTTL = 7 * 24 * time.Hour

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 발급
    claims := &jwt.Claims{
        UserID:      "user123",
        Username:    "alice",
        Role:        "admin",
        Permissions: []string{"read", "write", "delete"},
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Access Token:", token)

    // 검증
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)          // 출력: true
    fmt.Println("UserID:", parsed.UserID) // 출력: user123
}
```

## 액세스 토큰과 리프레시 토큰

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
    }

    // 액세스 토큰 생성 (단기)
    accessToken, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // 리프레시 토큰 생성 (장기)
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }

    fmt.Println("Access Token:", accessToken)
    fmt.Println("Refresh Token:", refreshToken)

    // 리프레시 토큰으로 새로운 액세스 토큰 획득
    newAccessToken, err := processor.Refresh(refreshToken)
    if err != nil {
        panic(err)
    }
    fmt.Println("New Access Token:", newAccessToken)
}
```

## 토큰 취소 (블랙리스트)

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }

    // 토큰 취소
    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked")

    // 다시 검증하면 실패함
    _, _, err = processor.Validate(token)
    fmt.Println("Validate error:", err) // token revoked

    // 취소 여부 확인
    revoked, err := processor.IsRevoked(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Is revoked:", revoked) // 출력: true
}
```

## 속도 제한 보호

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.EnableRateLimit = true
    cfg.RateLimitRate = 5              // 분당 최대 5회
    cfg.RateLimitWindow = time.Minute

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user123", Username: "alice"}

    // 정상 요청
    for i := 0; i < 5; i++ {
        _, err := processor.Create(claims)
        if err != nil {
            fmt.Printf("Request %d: %v\n", i+1, err)
        } else {
            fmt.Printf("Request %d: success\n", i+1)
        }
    }

    // 6번째 요청은 속도 제한 적용
    _, err = processor.Create(claims)
    fmt.Println("Request 6:", err) // rate limit exceeded
}
```

## 더 많은 예제

- [고급 예제](./advanced) — RSA, ECDSA, 커스텀 Claims, Redis 블랙리스트, 웹 서비스
