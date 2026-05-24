---
title: "JWT - 프로덕션급 JWT 인증 라이브러리"
description: "CyberGo JWT 프로덕션급 인증 라이브러리, HMAC/RSA/ECDSA 다중 알고리즘 서명, 토큰 블랙리스트, 속도 제한, 커스텀 Claims 및 클럭 인젝션을 지원하며 모든 메서드는 동시성에 안전합니다."
---

# JWT - 프로덕션급 JWT 인증 라이브러리

CyberGo JWT는 Go 언어를 위한 고성능 JWT 인증 라이브러리로, 토큰 생성, 검증, 갱신 및 취소의 완전한 솔루션을 제공합니다.

## 특징

- **다중 알고리즘 지원** — HMAC (HS256/384/512), RSA (RS256/384/512), RSA-PSS (PS256/384/512), ECDSA (ES256/384/512)
- **토큰 라이프사이클** — 생성, 검증, 갱신, 취소 원스톱 관리
- **커스텀 Claims** — `CustomClaims` 인터페이스를 통한 임의 비즈니스 필드 지원
- **블랙리스트 관리** — 내장 메모리 저장소, Redis 등 커스텀 백엔드 지원
- **속도 제한** — 토큰 버킷 알고리즘으로 무차별 대입 공격 방지
- **입력 검증** — 필드 길이 제한, 인젝션 패턴 감지, 제어 문자 필터링
- **클럭 인젝션** — `ClockProvider` 인터페이스로 테스트 시나리오 지원
- **동시성 안전** — 모든 내보내기 메서드는 안전하게 동시 호출 가능
- **민감 데이터 제로 유출** — `Close()`로 키 안전 삭제

## 설치

```bash
go get github.com/cybergodev/jwt
```

## 빠른 시작

```go
package main

import (
    "fmt"

    "github.com/cybergodev/jwt"
)

func main() {
    // 1. 설정 생성
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"

    // 2. Processor 생성
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    // 3. 토큰 발급
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 4. 토큰 검증
    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## 아키텍처 개요

```text
┌────────────────────────────────────────────────┐
│                  Processor                      │
│  (implements TokenManager interface)            │
├────────────────────────────────────────────────┤
│  Create / Validate / Refresh / Revoke          │
│  CreateRefresh / ValidateInto / RefreshInto    │
│  ParseUnverified / IsRevoked / IsClosed / Close│
├──────────────────┬─────────────────────────────┤
│  BlacklistManager│     RateLimiter              │
│  (optional)      │     (optional)               │
├──────────────────┴─────────────────────────────┤
│                Config                           │
│  SigningMethod / TTL / Blacklist / Limit       │
└────────────────────────────────────────────────┘
```

## 다음 단계

- [빠른 시작](./getting-started) — 상세 설치 및 설정 가이드
- [서명 알고리즘](./guides/signing-algorithms) — HMAC, RSA, ECDSA 선택 가이드
- [커스텀 Claims](./guides/custom-claims) — 비즈니스 필드 정의
- [API 레퍼런스](./api-reference/) — 전체 API 참조 문서
- [기본 예제](./examples/basic) — HMAC, 토큰 쌍, 검증 예제
