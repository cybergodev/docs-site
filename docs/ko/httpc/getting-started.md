---
title: "빠른 시작 - HTTPC"
description: "5분 만에 HTTPC 안전한 HTTP 클라이언트 라이브러리 빠르게 시작하기: go get 설치, GET/POST 요청, 다섯 가지 설정 프리셋, JSON 파싱, Bearer Token 인증과 ClientError 오류 분류 처리를 다룹니다."
---

# 빠른 시작

## 설치

```bash
go get github.com/cybergodev/httpc
```

## 기본 요청

클라이언트를 생성할 필요 없이 패키지 레벨 함수를 직접 사용하세요:

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        log.Fatal(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
    fmt.Println(result.Body())       // 응답 내용
}
```

지원하는 HTTP 메서드: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

## 클라이언트 생성

커스텀 설정이 필요한 경우 클라이언트 인스턴스를 생성하세요:

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://httpbin.org/get")
```

### 프리셋 설정

| 설정 | 용도 | 특징 |
|------|------|------|
| `DefaultConfig()` | 일반 시나리오 | 안전한 기본값, SSRF 방어 활성화 |
| `SecureConfig()` | 보안 민감 시나리오 | 자동 리다이렉트 비활성화, 엄격한 타임아웃 |
| `PerformanceConfig()` | 높은 처리량 시나리오 | 대규모 연결 풀, 긴 타임아웃, Cookie 활성화 |
| `TestingConfig()` | 테스트 환경 | 보안 검사 및 HTTP/2 비활성화, 짧은 타임아웃 |
| `MinimalConfig()` | 경량 요청 | 재시도 없음, 리다이렉트 없음 |

```go
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second

client, err := httpc.New(cfg)
```

## 응답 처리

```go
result, err := client.Get("https://httpbin.org/json")
if err != nil {
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// 상태 확인
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// JSON 파싱
var data map[string]any
if err := result.Unmarshal(&data); err != nil {
    log.Fatal(err)
}
```

## 데이터 전송

```go
// JSON
result, err := client.Post("https://httpbin.org/post",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

```go
// 폼
result, err := client.Post("https://httpbin.org/post",
    httpc.WithForm(map[string]string{"username": "admin"}),
)
```

```go
// 인증 포함
result, err := client.Get("https://api.example.com/data",
    httpc.WithBearerToken("my-token"),
)
```

## 오류 처리

HTTPC은 **네트워크 계층 오류**와 **HTTP 상태 코드**를 구분합니다:

```go
result, err := client.Get("https://api.example.com/data")
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        log.Printf("오류 코드: %s", clientErr.Code())
    }
    log.Fatal(err)
}
defer httpc.ReleaseResult(result)

// HTTP 상태 코드는 수동으로 확인 필요
switch {
case result.IsSuccess():
    // 2xx 성공
case result.IsClientError():
    log.Printf("클라이언트 오류: %d", result.StatusCode())
case result.IsServerError():
    log.Printf("서버 오류: %d", result.StatusCode())
}
```

:::tip
4xx/5xx는 `error`로 반환되지 않으며, `result.IsSuccess()` 등의 메서드로 확인해야 합니다. 자세한 내용은 [오류 처리](./advanced/error-handling)를 참조하세요.
:::

## 다음 단계

- **[실전 튜토리얼](./guides/tutorial)** - 30분 만에 GitHub API 클라이언트 구축
- **[요청과 응답](./guides/request-response)** - 전체 요청 옵션 및 응답 처리
- **[기본 예제](./examples/basic-usage)** - GET/POST/미들웨어 등 실제 사용 예
- **[치트시트](./cheatsheet)** - 자주 사용하는 작업 빠른 참조
- **[보안](./security/)** - 보안 모범 사례
