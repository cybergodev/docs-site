---
title: "고급 예제 - JWT"
description: "CyberGo JWT 고급 예제: RSA/ECDSA 비대칭 서명, 커스텀 Claims, Redis 블랙리스트 백엔드, 클럭 인젝션 테스트, 미검증 파싱 및 웹 서비스 통합."
---

# 고급 예제

## RSA 비대칭 서명

RSA 개인 키로 서명하고 공개 키로 검증합니다. 마이크로서비스 아키텍처에 적합하며, 검증 측에서 개인 키를 보유할 필요가 없습니다.

```go
package main

import (
    "crypto/rand"
    "crypto/rsa"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // RSA 키 쌍 생성 (실제 사용 시 파일에서 로드)
    privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodRS256
    cfg.SigningKey = privateKey
    cfg.VerificationKey = &privateKey.PublicKey // 선택, 설정하지 않으면 SigningKey 사용

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user456", Username: "bob"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("RSA Token:", token)

    parsed, valid, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Valid:", valid)
    fmt.Println("UserID:", parsed.UserID)
}
```

## ECDSA 비대칭 서명

ECDSA 타원 곡선 서명을 사용하며, 키가 더 짧고 성능이 더 좋습니다.

```go
package main

import (
    "crypto/ecdsa"
    "crypto/elliptic"
    "crypto/rand"
    "fmt"
    "log"

    "github.com/cybergodev/jwt"
)

func main() {
    // ECDSA 키 쌍 생성
    privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
    if err != nil {
        log.Fatal(err)
    }

    cfg := jwt.DefaultConfig()
    cfg.SigningMethod = jwt.SigningMethodES256
    cfg.SigningKey = privateKey

    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &jwt.Claims{UserID: "user789", Username: "charlie"}
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("ECDSA Token:", token)
}
```

## 커스텀 Claims

자체 Claims 구조체를 정의하여 비즈니스 필드를 추가합니다.

```go
package main

import (
    "errors"
    "fmt"

    "github.com/cybergodev/jwt"
)

// 커스텀 Claims 구조체
type MyClaims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
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
    if c.Email == "" {
        return errors.New("email is required")
    }
    return nil
}

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    processor, err := jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    claims := &MyClaims{
        UserID: "user123",
        Email:  "alice@example.com",
        Role:   "admin",
    }

    // 토큰 생성
    token, err := processor.Create(claims)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token:", token)

    // 커스텀 Claims로 검증
    myClaims := &MyClaims{}
    result, valid, err := processor.ValidateInto(token, myClaims)
    if err != nil {
        panic(err)
    }
    if valid {
        parsed := result.(*MyClaims)
        fmt.Println("UserID:", parsed.UserID) // 출력: user123
        fmt.Println("Email:", parsed.Email)   // 출력: alice@example.com
    }

    // 커스텀 Claims로 갱신
    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        panic(err)
    }
    newToken, err := processor.RefreshInto(refreshToken, &MyClaims{})
    if err != nil {
        panic(err)
    }
    fmt.Println("New Token:", newToken)
}
```

## 커스텀 블랙리스트 백엔드 (Redis)

```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

// RedisBlacklistStore는 BlacklistStore 인터페이스를 구현
// 참고: 실제 사용 시 Redis 클라이언트를 가져와야 함 (예: github.com/redis/go-redis)
type RedisBlacklistStore struct {
    // client *redis.Client
}

func (s *RedisBlacklistStore) Add(tokenID string, expiresAt time.Time) error {
    ttl := time.Until(expiresAt)
    if ttl <= 0 {
        return nil
    }
    // return s.client.Set(context.Background(), "blacklist:"+tokenID, "1", ttl).Err()
    fmt.Printf("Redis ADD: %s, TTL: %v\n", tokenID, ttl)
    return nil
}

func (s *RedisBlacklistStore) Contains(tokenID string) (bool, error) {
    // return s.client.Exists(context.Background(), "blacklist:"+tokenID).Result()
    return false, nil
}

func (s *RedisBlacklistStore) Close() error {
    // return s.client.Close()
    return nil
}

func main() {
    _ = context.Background() // context import 유지 (실제 사용 시 Redis 호출 주석 해제)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Blacklist.Store = &RedisBlacklistStore{}

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

    err = processor.Revoke(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("Token revoked via Redis backend")
}
```

## 클럭 인젝션 (테스트 시나리오)

`FixedClock`을 사용하여 테스트에서 시간을 제어합니다.

```go
package main

import (
    "fmt"
    "time"

    "github.com/cybergodev/jwt"
)

func main() {
    fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Clock = jwt.FixedClock{T: fixedTime}

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

    parsed, _, err := processor.Validate(token)
    if err != nil {
        panic(err)
    }
    fmt.Println("IssuedAt:", parsed.IssuedAt.Time)   // 출력: 2026-01-01 00:00:00
    fmt.Println("ExpiresAt:", parsed.ExpiresAt.Time) // 출력: 2026-01-01 00:15:00
}
```

## 미검증 토큰 파싱

Claims 정보를 추출하지만 서명을 검증하지 않으며, 디버깅이나 로깅에 사용합니다.

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

    // 서명 검증 없이 파싱
    parsed := &jwt.Claims{}
    err = processor.ParseUnverified(token, parsed)
    if err != nil {
        panic(err)
    }
    fmt.Println("UserID (unverified):", parsed.UserID)
}
```

## 전체 웹 서비스 예제

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "strings"

    "github.com/cybergodev/jwt"
)

var processor *jwt.Processor

func main() {
    cfg := jwt.DefaultConfig()
    cfg.SecretKey = "hmac-key-that-has-at-least-32-bytes!"
    cfg.Issuer = "my-web-service"
    cfg.ExpectedAudience = "my-app"

    var err error
    processor, err = jwt.New(cfg)
    if err != nil {
        panic(err)
    }
    defer processor.Close()

    http.HandleFunc("/login", handleLogin)
    http.HandleFunc("/protected", handleProtected)

    fmt.Println("Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
    // 실제 시나리오에서는 사용자 이름/비밀번호 검증
    claims := &jwt.Claims{
        UserID:   "user123",
        Username: "alice",
        Role:     "admin",
    }

    accessToken, err := processor.Create(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    refreshToken, err := processor.CreateRefresh(claims)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }

    fmt.Fprintf(w, `{"access_token":"%s","refresh_token":"%s"}`, accessToken, refreshToken)
}

func handleProtected(w http.ResponseWriter, r *http.Request) {
    auth := r.Header.Get("Authorization")
    if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
        http.Error(w, "missing token", http.StatusUnauthorized)
        return
    }

    tokenString := strings.TrimPrefix(auth, "Bearer ")
    claims, valid, err := processor.Validate(tokenString)
    if err != nil || !valid {
        http.Error(w, "invalid token", http.StatusUnauthorized)
        return
    }

    fmt.Fprintf(w, "Hello, %s (ID: %s, Role: %s)",
        claims.Username, claims.UserID, claims.Role)
}
```
