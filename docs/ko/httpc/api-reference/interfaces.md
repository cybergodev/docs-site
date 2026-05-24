---
title: "인터페이스 정의 - HTTPC"
description: "HTTPC 핵심 인터페이스 API 레퍼런스: Client 전체 기능 인터페이스(7가지 HTTP 메서드와 4가지 다운로드), Doer 최소 실행 인터페이스, DomainClienter 도메인 클라이언트(세션 관리 포함), RetryPolicy 재시도 전략, RequestMutator/ResponseMutator 미들웨어 인터페이스와 Handler/MiddlewareFunc 정의."
---

# 인터페이스 정의

## Client

```go
type Client interface {
    Doer

    // HTTP 메서드
    Get(url string, options ...RequestOption) (*Result, error)
    Post(url string, options ...RequestOption) (*Result, error)
    Put(url string, options ...RequestOption) (*Result, error)
    Patch(url string, options ...RequestOption) (*Result, error)
    Delete(url string, options ...RequestOption) (*Result, error)
    Head(url string, options ...RequestOption) (*Result, error)
    Options(url string, options ...RequestOption) (*Result, error)

    // 파일 다운로드
    DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
    DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
    DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // 수명 주기
    Close() error
}
```

기본 클라이언트 인터페이스로, `New()`로 생성합니다. 자세한 내용은 [패키지 함수](./functions)를 참조하세요.

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

최소 인터페이스로, 핵심 `Request` 메서드만 포함합니다. 사용자 정의 구현에 적합합니다.

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // 사용자 정의 구현
    return nil, nil
}
```

## DomainClienter

```go
type DomainClienter interface {
    Client

    // URL 접근
    URL() string
    Domain() string

    // 세션 헤더 관리
    SetHeader(key, value string) error
    SetHeaders(headers map[string]string) error
    DeleteHeader(key string)
    ClearHeaders()
    GetHeaders() map[string]string

    // 세션 Cookie 관리
    SetCookie(cookie *http.Cookie) error
    SetCookies(cookies []*http.Cookie) error
    DeleteCookie(name string)
    ClearCookies()
    GetCookies() []*http.Cookie
    GetCookie(name string) *http.Cookie

    // 세션 접근
    Session() *SessionManager
}
```

도메인 범위 클라이언트로, Cookie와 요청 헤더를 자동으로 관리합니다. 자세한 내용은 [도메인 클라이언트](./domain-client)와 [세션 관리](./session)를 참조하세요.

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

사용자 정의 재시도 전략 인터페이스.

| 메서드 | 설명 |
|------|------|
| `ShouldRetry(resp, err, attempt)` | 재시도 여부 판단, `attempt`는 0부터 시작 |
| `GetDelay(attempt)` | 다음 재시도 전 대기 시간 반환 |
| `MaxRetries()` | 최대 재시도 횟수 반환 |

:::warning 내부 타입 제한
`ShouldRetry`의 `resp` 매개변수 타입 `ResponseReader`는 내부 인터페이스(`internal/types` 패키지에 위치)이므로 외부 코드에서 직접 참조할 수 없습니다. 따라서 `RetryPolicy`는 같은 모듈 내에서만 구현할 수 있습니다. 대부분의 시나리오는 `RetryConfig` 구성과 `WithMaxRetries` 옵션으로 재시도 요구를 충족할 수 있습니다. 사용자 정의 전략이 필요한 경우 프로젝트 내부 패키지에서 `RetryPolicy` 인터페이스를 구현하세요.
:::

아래 예제는 `RetryPolicy`의 구현 패턴을 보여줍니다. `ResponseReader`는 내부 타입임에 유의하세요 -- 이 코드는 `httpc` 모듈 내부에서만 컴파일할 수 있습니다:

```go
// 참고: ResponseReader는 내부 타입(internal/types 패키지)입니다.
// 이 코드는 httpc 모듈 외부에서 컴파일할 수 없습니다.
// 대부분의 사용자는 RetryConfig와 WithMaxRetries로 재시도를 구성해야 합니다.

type MyRetryPolicy struct {
    maxRetries int
}

func (p *MyRetryPolicy) ShouldRetry(resp ResponseReader, err error, attempt int) bool {
    if attempt >= p.maxRetries {
        return false
    }
    if err != nil {
        return true
    }
    return resp.StatusCode() >= 500
}

func (p *MyRetryPolicy) GetDelay(attempt int) time.Duration {
    return time.Second * time.Duration(1<<attempt)
}

func (p *MyRetryPolicy) MaxRetries() int {
    return p.maxRetries
}
```

## 핵심 타입

### RequestMutator

```go
type RequestMutator interface {
    // 읽기 메서드
    Method() string
    URL() string
    Headers() map[string]string
    QueryParams() map[string]any
    Body() any
    Timeout() time.Duration
    MaxRetries() int
    Context() context.Context
    Cookies() []http.Cookie
    FollowRedirects() *bool
    MaxRedirects() *int
    StreamBody() bool

    // 쓰기 메서드
    SetMethod(string)
    SetURL(string)
    SetHeaders(map[string]string)
    SetHeader(key, value string)
    SetQueryParams(map[string]any)
    SetBody(any)
    SetTimeout(time.Duration)
    SetMaxRetries(int)
    SetContext(context.Context)
    SetCookies([]http.Cookie)
    SetFollowRedirects(*bool)
    SetMaxRedirects(*int)
    SetStreamBody(bool)
}
```

미들웨어에서 사용하며, 요청에 대한 읽기/쓰기 접근을 제공합니다. 내부 인터페이스 `RequestReader`와 `RequestWriter`로 구성됩니다.

### ResponseMutator

```go
type ResponseMutator interface {
    // 읽기 메서드
    StatusCode() int
    Status() string
    Proto() string
    Headers() http.Header
    Body() string
    RawBody() []byte
    ContentLength() int64
    Duration() time.Duration
    Attempts() int
    Cookies() []*http.Cookie
    RedirectChain() []string
    RedirectCount() int
    RequestHeaders() http.Header
    RequestURL() string
    RequestMethod() string

    // 쓰기 메서드
    SetStatusCode(int)
    SetStatus(string)
    SetProto(string)
    SetHeaders(http.Header)
    SetBody(string)
    SetRawBody([]byte)
    SetContentLength(int64)
    SetDuration(time.Duration)
    SetAttempts(int)
    SetCookies([]*http.Cookie)
    SetRedirectChain([]string)
    SetRedirectCount(int)
    SetRequestHeaders(http.Header)
    SetRequestURL(string)
    SetRequestMethod(string)
    SetHeader(key string, values ...string)
}
```

미들웨어에서 사용하며, 응답에 대한 읽기/쓰기 접근을 제공합니다. 내부 인터페이스 `ResponseReader`와 `ResponseWriter`로 구성됩니다.

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

요청 처리 함수 서명.

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

미들웨어 함수 서명으로, 다음 Handler를 받아 래핑된 Handler를 반환합니다.

## 관련 페이지

| 타입 | 상세 참조 |
|------|----------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](./result) |
| `SessionManager` 메서드 | [세션 관리](./session) |
| `DomainClient` 구현 | [도메인 클라이언트](./domain-client) |
| `DownloadConfig` / `DownloadResult` | [파일 다운로드](./download) |
| `ClientError` / `ErrorType` / 오류 변수 | [오류 타입](./errors) |
| `FormData` / `FileData` / `BodyKind` | [상수와 타입](./constants) |
