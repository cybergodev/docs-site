---
title: "도메인 클라이언트와 세션 - CyberGo HTTPC | 세션과 도메인"
description: "HTTPC 도메인 클라이언트와 세션 가이드: NewDomain으로 도메인 범위 클라이언트 생성, URL 자동 조합, SetHeader 헤더 유지, Cookie 보안 검증과 REST API 클라이언트 래핑 실전 예제를 다룹니다."
---

# 도메인 클라이언트와 세션

도메인 클라이언트(DomainClient)는 같은 도메인에 대한 세션 관리 클라이언트로, Cookie와 요청 헤더를 자동으로 유지합니다.

## 도메인 클라이언트 생성

```go
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// Cookie 자동 활성화
dc.SetHeader("Authorization", "Bearer "+token)

// 상대 경로로 요청 전송
result, err := dc.Get("/users")
```

:::tip
`NewDomain`은 Cookie 관리를 자동으로 활성화합니다(`EnableCookies = true`), 수동 설정이 필요 없습니다.
:::

## 세션 헤더 관리

```go
// 세션 헤더 설정 (모든 후속 요청에 자동 포함)
dc.SetHeader("Authorization", "Bearer "+token)
dc.SetHeader("Accept", "application/json")

// 일괄 설정
dc.SetHeaders(map[string]string{
    "Authorization": "Bearer " + token,
    "Accept":        "application/json",
    "X-Version":     "2.0",
})

// 삭제와 초기화
dc.DeleteHeader("X-Version")
dc.ClearHeaders()

// 조회
headers := dc.GetHeaders()
```

## Cookie 관리

```go
// Cookie 설정
dc.SetCookie(&http.Cookie{Name: "session", Value: "abc123"})

// 일괄 설정
dc.SetCookies([]*http.Cookie{
    {Name: "session", Value: "abc123"},
    {Name: "lang", Value: "zh"},
})

// 응답 Cookie 자동 캡처
result, _ := dc.Get("/login")
// 서버가 반환한 Set-Cookie가 세션에 자동 저장

// 조회
cookie := dc.GetCookie("session")
cookies := dc.GetCookies()

// 삭제와 초기화
dc.DeleteCookie("session")
dc.ClearCookies()
```

:::tip
매 요청 후 서버가 반환한 Cookie가 세션에 자동 업데이트되므로 수동 처리가 필요 없습니다.
:::

## 요청 방식

```go
// 상대 경로
result, _ := dc.Get("/users")
result, _ := dc.Post("/users", httpc.WithJSON(data))
result, _ := dc.Put("/users/1", httpc.WithJSON(data))
result, _ := dc.Patch("/users/1", httpc.WithJSON(data))
result, _ := dc.Delete("/users/1")
result, _ := dc.Head("/users/1")
result, _ := dc.Options("/users")

// 컨텍스트 포함
result, _ := dc.Request(ctx, "GET", "/users")

// 절대 URL (base URL 조합 건너뜀)
result, _ := dc.Get("https://other-api.com/data")
```

## 세션 접근

```go
// 기본 정보 가져오기
dc.URL()     // "https://api.example.com"
dc.Domain()  // "api.example.com"

// 내부 SessionManager 접근
session := dc.Session()
if err := session.SetHeader("X-Trace-ID", traceID); err != nil {
    log.Fatal(err)
}
```

## Cookie 보안 검증

Cookie 보안 정책을 설정하여 보안 기준을 충족하는 Cookie만 수락할 수 있습니다:

```go
dc, _ := httpc.NewDomain("https://api.example.com")

// 엄격한 Cookie 보안 설정
session := dc.Session()
session.SetCookieSecurity(httpc.StrictCookieSecurityConfig())
// 요구사항: Secure=true, HttpOnly=true, SameSite=Strict

// 보안 요구사항을 충족하지 않는 Cookie는 SetCookie에서 오류 반환
if err := dc.SetCookie(&http.Cookie{
    Name:  "insecure",
    Value: "test",
    // Secure, HttpOnly 누락 → 거부됨
}); err != nil {
    log.Println("Cookie 거부됨:", err)
}
```

## 완전한 예제: REST API 클라이언트

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/cybergodev/httpc"
)

func main() {
    // 도메인 클라이언트 생성
    dc, err := httpc.NewDomain("https://api.example.com")
    if err != nil {
        log.Fatal(err)
    }
    defer dc.Close()

    // 로그인하여 Token 획득
    loginResult, err := dc.Post("/auth/login", httpc.WithJSON(map[string]string{
        "username": "admin",
        "password": "secret",
    }))
    if err != nil {
        log.Fatal(err)
    }

    // 응답에서 Token 파싱
    var loginResp struct {
        Token string `json:"token"`
    }
    if err := loginResult.Unmarshal(&loginResp); err != nil {
        log.Fatal(err)
    }

    // 세션 헤더 설정
    if err := dc.SetHeader("Authorization", "Bearer "+loginResp.Token); err != nil {
        log.Fatal(err)
    }

    // 후속 요청에 Token과 Cookie 자동 포함
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    users, err := dc.Request(ctx, "GET", "/users")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(users.StatusCode()) // 200
}
```

## 다음 단계

- [도메인 클라이언트 API](../api-reference/domain-client) - 완전한 API 참조
- [세션 관리 API](../api-reference/session) - SessionManager 참조
- [요청과 응답](./request-response) - 기본 요청 가이드
