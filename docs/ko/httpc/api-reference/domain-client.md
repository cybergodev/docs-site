---
title: "도메인 클라이언트 - HTTPC"
description: "HTTPC 도메인 클라이언트 API 레퍼런스: NewDomain 생성 함수, Get/Post 등 7가지 HTTP 메서드와 Request 범용 메서드, 4가지 다운로드 메서드, URL 자동 조합 규칙, DomainClienter 인터페이스의 SetHeader/SetCookie 세션 관리와 Close 수명 주기."
---

# 도메인 클라이언트

도메인 클라이언트는 특정 도메인에 대한 요청 관리를 제공하며, Cookie와 요청 헤더를 자동으로 유지합니다.

## NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

도메인 범위 클라이언트를 생성합니다. Cookie가 자동으로 활성화됩니다.

```go
// 기본 구성 사용
dc, err := httpc.NewDomain("https://api.example.com")
if err != nil {
    log.Fatal(err)
}
defer dc.Close()

// 사용자 정의 구성 사용
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
dc, err := httpc.NewDomain("https://api.example.com", cfg)
if err != nil {
    log.Fatal(err)
}
defer dc.Close()
```

**매개변수 설명:**

| 매개변수 | 타입 | 설명 |
|------|------|------|
| `baseURL` | `string` | 기본 URL (scheme과 host 포함 필수) |
| `config` | `...*Config` | 선택적 구성, 전달하지 않으면 DefaultConfig() 사용 |

**반환값:** `DomainClienter` 인터페이스 (구체적 타입 `*DomainClient`가 아님).

## HTTP 메서드

모든 메서드는 상대 경로 또는 절대 URL을 허용합니다:

```go
// 상대 경로: baseURL에 자동 조합
result, err := dc.Get("/users")
result, err := dc.Post("/users", httpc.WithJSON(data))
result, err := dc.Put("/users/1", httpc.WithJSON(data))
result, err := dc.Patch("/users/1", httpc.WithJSON(data))
result, err := dc.Delete("/users/1")
result, err := dc.Head("/users/1")
result, err := dc.Options("/users")

// 절대 URL: 직접 사용
result, err := dc.Get("https://other-api.com/data")
```

### Request

```go
result, err := dc.Request(ctx, "GET", "/users", options...)
```

컨텍스트가 포함된 범용 요청 메서드로, 타임아웃과 취소 제어를 지원합니다.

## 다운로드 메서드

```go
// 기본 다운로드
result, err := dc.DownloadFile("/files/report.pdf", "/tmp/report.pdf")

// 구성 포함 다운로드
result, err := dc.DownloadWithOptions("/files/report.pdf", downloadOpts)

// 컨텍스트 포함
result, err := dc.DownloadFileWithContext(ctx, "/files/report.pdf", "/tmp/report.pdf")
result, err := dc.DownloadWithOptionsWithContext(ctx, "/files/report.pdf", downloadOpts)
```

다운로드의 응답 Cookie는 자동으로 세션에 캡처됩니다.

## 접근 메서드

```go
dc.URL()      // string - 기본 URL
dc.Domain()   // string - 도메인 (포트 제외)
dc.Session()  // *SessionManager - 기본 세션 관리자
dc.Close()    // error - 클라이언트 닫기 및 리소스 해제
```

## URL 조합 규칙

| 입력 경로 | 조합 결과 (baseURL = `https://api.example.com/v1`) |
|----------|------|
| `/users` | `https://api.example.com/v1/users` |
| `users` | `https://api.example.com/v1/users` |
| `/users?page=1` | `https://api.example.com/v1/users?page=1` |
| `https://other.com/api` | `https://other.com/api` (절대 URL) |

:::warning
`http://`와 `https://` 프로토콜의 절대 URL만 허용되며, 다른 프로토콜은 거부됩니다 (SSRF 방지).
:::

## DomainClienter 인터페이스

```go
type DomainClienter interface {
    Client

    URL() string
    Domain() string

    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    Session() *SessionManager
}
```

테스트와 구현 교체를 쉽게 하기 위해 인터페이스 타입을 사용하는 것을 권장합니다.

## 참고

- [세션 관리](./session) - SessionManager 상세 참조
- [도메인 클라이언트와 세션](../guides/domain-session) - 사용 가이드
- [인터페이스 정의](./interfaces) - Client, Doer 인터페이스 참조
