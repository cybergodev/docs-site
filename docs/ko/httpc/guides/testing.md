---
title: 테스트 가이드 - HTTPC
description: HTTPC 테스트 가이드, TestingConfig 구성, httptest.Server 응답 시뮬레이션, 테이블 기반 테스트, 네트워크 오류 시뮬레이션 및 클라이언트 리소스 정리 상세 설명.
---

# 테스트 가이드

## TestingConfig

`TestingConfig()`는 테스트 환경에 특화되어 보안 검사를 비활성화하고 타임아웃을 단축하여 테스트 실행 속도를 높입니다:

```go
func TestAPI(t *testing.T) {
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    result, err := client.Get("http://localhost:8080/test")
    // ...
}
```

:::danger 위험
`TestingConfig`는 TLS 검증, SSRF 방어 등 보안 기능을 비활성화하므로 **테스트 환경에서만 사용**하십시오. 테스트 환경이 아닌 곳에서 사용하면 보안 경고가 출력됩니다.
:::

## httptest.Server 통합

표준 라이브러리 `net/http/httptest`를 사용하여 모의 서버를 생성하고, 실제 백엔드 없이 통합 테스트를 구현합니다:

```go
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/cybergodev/httpc"
)

func TestGetUser(t *testing.T) {
    // 모의 서버 생성
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/users/1" {
            t.Errorf("unexpected path: %s", r.URL.Path)
        }
        if r.Header.Get("Authorization") != "Bearer test-token" {
            t.Errorf("missing auth header")
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]any{
            "id":   1,
            "name": "Test User",
        })
    }))
    defer server.Close()

    // TestingConfig로 클라이언트 생성
    client, err := httpc.New(httpc.TestingConfig())
    if err != nil {
        t.Fatal(err)
    }
    defer client.Close()

    // 모의 서버에 요청 전송
    result, err := client.Get(server.URL+"/users/1",
        httpc.WithBearerToken("test-token"),
    )
    if err != nil {
        t.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    if !result.IsSuccess() {
        t.Fatalf("expected success, got %d", result.StatusCode())
    }

    var user struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }
    if err := result.Unmarshal(&user); err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("expected Test User, got %s", user.Name)
    }
}
```

## 다양한 시나리오 시뮬레이션

### 오류 응답 시뮬레이션

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusNotFound)
    json.NewEncoder(w).Encode(map[string]string{
        "error": "user not found",
    })
}))
defer server.Close()
```

### 지연 시뮬레이션

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    time.Sleep(5 * time.Second)
    w.WriteHeader(http.StatusOK)
}))
defer server.Close()

// 타임아웃 처리 테스트
ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
defer cancel()

_, err := httpc.Request(ctx, "GET", server.URL)
if err == nil {
    t.Fatal("expected timeout error")
}
```

### 리다이렉트 시뮬레이션

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    switch r.URL.Path {
    case "/old":
        http.Redirect(w, r, "/new", http.StatusMovedPermanently)
    case "/new":
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("redirected"))
    }
}))
defer server.Close()
```

### 파일 업로드 시뮬레이션

```go
server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        t.Errorf("expected POST, got %s", r.Method)
    }

    // multipart 폼 파싱
    r.ParseMultipartForm(10 << 20)
    file, header, err := r.FormFile("upload")
    if err != nil {
        t.Fatal(err)
    }
    defer file.Close()

    if header.Filename != "test.txt" {
        t.Errorf("expected test.txt, got %s", header.Filename)
    }

    w.WriteHeader(http.StatusOK)
}))
defer server.Close()
```

## 테이블 기반 테스트

```go
func TestHTTPMethods(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(r.Method))
    }))
    defer server.Close()

    client, _ := httpc.New(httpc.TestingConfig())
    defer client.Close()

    tests := []struct {
        name   string
        method func(url string, opts ...httpc.RequestOption) (*httpc.Result, error)
    }{
        {"GET", client.Get},
        {"POST", client.Post},
        {"PUT", client.Put},
        {"PATCH", client.Patch},
        {"DELETE", client.Delete},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := tt.method(server.URL + "/test")
            if err != nil {
                t.Fatal(err)
            }
            defer httpc.ReleaseResult(result)

            if result.Body() != tt.name {
                t.Errorf("expected %s, got %s", tt.name, result.Body())
            }
        })
    }
}
```

## 모범 사례

| 실천 사항 | 설명 |
|------|------|
| `httptest.Server` 사용 | 실제 HTTP 동작 시뮬레이션, 네트워크 의존성 불필요 |
| `TestingConfig()` 사용 | 보안 검사 비활성화, 로컬 연결 차단 방지 |
| `ReleaseResult()` 호출 | 객체 풀로 반환, 테스트 성능 유지 |
| `defer` 사용 | 테스트 실패 시에도 리소스 해제 보장 |
| 테이블 기반 | 다양한 입력을 커버하고 코드가 간결함 |

## 다음 단계

- [구성 API](../api-reference/config) - TestingConfig 상세 매개변수
- [오류 유형](../api-reference/errors) - 오류 단언 참조
- [미들웨어 체인](./middleware-chain) - 미들웨어 테스트 패턴
