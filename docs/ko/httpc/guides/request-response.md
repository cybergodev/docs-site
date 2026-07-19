---
sidebar_label: "요청과 응답"
title: "요청과 응답 - CyberGo HTTPC | 옵션과 응답"
description: "HTTPC 요청과 응답 가이드: 패키지 함수와 클라이언트 요청, WithHeader/WithJSON 요청 옵션, Bearer 인증, 쿼리 매개변수, Cookie 관리, 컨텍스트 제어와 스트리밍 응답 모범 사례를 다룹니다."
sidebar_position: 2
---

# 요청과 응답

## 요청 전송

### 패키지 함수

클라이언트를 생성할 필요 없이 직접 요청을 전송합니다:

```go
result, err := httpc.Get("https://api.example.com/data")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode())
fmt.Println(result.Body())
```

지원하는 HTTP 메서드: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`.

### 클라이언트 인스턴스

```go
client, err := httpc.New()
if err != nil {
    log.Fatal(err)
}
defer client.Close()

result, err := client.Get("https://api.example.com/data")
```

### 범용 요청 메서드

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## 요청 옵션

### 요청 헤더

```go
result, err := client.Get(url,
    httpc.WithHeader("Authorization", "Bearer token"),
    httpc.WithHeader("X-Custom", "value"),
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "123",
    }),
    httpc.WithUserAgent("my-app/1.0"),
)
```

### 요청 본문

```go
// JSON
result, err := client.Post(url, httpc.WithJSON(map[string]any{
    "name": "test",
}))

// XML
result, err := client.Post(url, httpc.WithXML(data))

// 폼
result, err := client.Post(url, httpc.WithForm(map[string]string{
    "username": "admin",
    "password": "secret",
}))

// 바이너리 (기본 application/octet-stream)
result, err := client.Post(url, httpc.WithBinary(data))
// 타입 지정
result, err := client.Post(url, httpc.WithBinary(data, "image/png"))

// 자동 타입 감지
result, err := client.Post(url, httpc.WithBody(data))
// string → text/plain; charset=utf-8, []byte → application/octet-stream,
// map[string]string → application/x-www-form-urlencoded,
// *FormData → multipart/form-data, io.Reader → passed through,
// 기타 → application/json
// 명시적 지정 가능: httpc.WithBody(data, httpc.BodyJSON)
```

### 쿼리 매개변수

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)

// 또는 Map 사용
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
    }),
)
```

### 인증

```go
// Bearer Token
result, err := client.Get(url, httpc.WithBearerToken("my-token"))

// Basic Auth
result, err := client.Get(url, httpc.WithBasicAuth("user", "pass"))
```

### Cookie

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"}),
    httpc.WithCookieMap(map[string]string{"session": "abc", "lang": "zh"}),
    httpc.WithCookieString("session=abc; lang=zh"),
)
```

### 요청 제어

```go
// 타임아웃
result, err := client.Get(url, httpc.WithTimeout(10*time.Second))

// 재시도
result, err := client.Get(url, httpc.WithMaxRetries(5))

// 리다이렉트
result, err := client.Get(url,
    httpc.WithFollowRedirects(false),    // 리다이렉트 비활성화
)
```

:::tip WithMaxRedirects(0)는 비활성화가 아님
`WithMaxRedirects(0)`는 리다이렉트를 **비활성화하지 않습니다** — 엔진은 `0`을 "설정되지 않음"으로 간주하고 기본값 10으로 폴백합니다. 리다이렉트 따라가기를 완전히 비활성화하려면 `WithFollowRedirects(false)`를 사용하세요.
:::

### 콜백

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("요청 전송: %s %s", req.Method(), req.URL())
        return nil
    }),
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("응답 수신: %d", resp.StatusCode())
        return nil
    }),
)
```

## 응답 처리

```go
result, err := client.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

// 상태 확인
result.StatusCode()     // 200
result.IsSuccess()      // true (2xx)
result.IsRedirect()     // false (3xx)
result.IsClientError()  // false (4xx)
result.IsServerError()  // false (5xx)

// 응답 읽기
result.Body()           // 문자열
result.RawBody()        // []byte
result.Proto()          // "HTTP/1.1"

// JSON 파싱
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}

// Cookie
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}

// 요청 메타데이터
fmt.Println(result.Meta.Duration)       // 요청 소요 시간
fmt.Println(result.Meta.Attempts)       // 재시도 횟수
fmt.Println(result.Meta.RedirectCount)  // 리다이렉트 횟수
```

## 컨텍스트 제어

```go
// 타임아웃 제어
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
result, err := httpc.Request(ctx, "GET", url)

// 취소 제어
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(5 * time.Second)
    cancel() // 5초 후 취소
}()
result, err := httpc.Request(ctx, "GET", url)
```

## 스트리밍 응답

`WithStreamBody(true)`는 내부 메커니즘으로, 파일 다운로드 시 전체 응답 본문을 메모리에 캐시하지 않기 위해 사용됩니다. 활성화하면 응답 본문이 `Result`에 읽히지 않습니다(`Body()`와 `RawBody()`가 빈 값을 반환).

:::warning
`WithStreamBody(true)`는 파일 다운로드 API에서 내부적으로 사용됩니다. 응답 내용을 스트리밍으로 가져오려면 [파일 다운로드 API](./file-transfer)를 사용하세요.
:::

대용량 파일을 다운로드하려면 다운로드 API를 사용하세요:

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/path/to/file"
result, err := client.Download(context.Background(), url, cfg)
```

## 응답 압축 해제

HTTPC은 gzip, deflate 등 콘텐츠 인코딩의 압축 해제를 자동으로 처리합니다. 보안 설정을 통해 압축 해제 후 크기를 제한하여 압축 폭탄 공격을 방지할 수 있습니다:

```go
cfg := httpc.DefaultConfig()
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024      // 응답 본문 상한: 스트리밍 다운로드 시 강제; 비스트리밍 시 압축 해제 후 상한의 폴백
cfg.Security.MaxDecompressedBodySize = 100 * 1024 * 1024  // 압축 해제 후 최대 100MB
```

| 설정 항목 | 기본값 | 설명 |
|-----------|--------|------|
| `MaxResponseBodySize` | 10MB | 스트리밍 다운로드 응답 본문 상한; 비스트리밍 시 압축 해제 후 상한의 폴백 |
| `MaxDecompressedBodySize` | 100MB | 압축 해제 후 응답 본문 크기 상한 |

압축된 응답 본문의 바이트 수에는 별도의 100MB 하드 캡(`maxCompressedSize`, 설정 불가)이 있으며, 압축 폭탄 방어용으로 `MaxResponseBodySize`와 독립적으로 작동합니다.

한도를 초과하면 `"exceeds limit"` 정보가 포함된 오류가 반환되며, `ClientError` 타입으로 확인할 수 있습니다. `ErrResponseBodyTooLarge`는 `Result.Unmarshal()`에서 50MB JSON 크기 제한을 초과하는 응답 본문을 파싱할 때 반환됩니다(`MaxResponseBodySize`와 별개).

## 다음 단계

- [파일 업로드와 다운로드](./file-transfer) - 파일 전송 가이드
- [도메인 클라이언트와 세션](./domain-session) - 세션 관리
- [요청 옵션 API](../api-reference/core/options) - 완전한 옵션 참조
- [Result API](../api-reference/core/result) - 응답 처리 참조
