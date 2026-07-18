---
sidebar_label: "인터페이스 정의"
title: "인터페이스 정의 - CyberGo HTTPC | 핵심 인터페이스"
description: "HTTPC 핵심 인터페이스 API 레퍼런스: Client 전체 기능 인터페이스, Doer 최소 실행 인터페이스, DomainClienter, RetryPolicy 재시도 전략과 미들웨어 인터페이스 정의의 완전한 설명을 제공합니다."
sidebar_position: 1
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
    Download(ctx context.Context, url string, cfg *DownloadConfig, options ...RequestOption) (*DownloadResult, error)

    // 수명 주기
    Close() error
}
```

메인 클라이언트 인터페이스로, `New()`로 생성합니다. 자세한 내용은 [패키지 함수와 클라이언트 메서드](../core/functions)를 참조하세요.

## Doer

```go
type Doer interface {
    Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
}
```

최소 인터페이스로, 핵심 `Request` 메서드만 포함합니다. 커스텀 구현에 적합합니다.

```go
type MyDoer struct{}

func (d *MyDoer) Request(ctx context.Context, method, url string, options ...httpc.RequestOption) (*httpc.Result, error) {
    // 커스텀 구현
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

도메인 범위 클라이언트로, Cookie와 요청 헤더를 자동으로 관리합니다. 자세한 내용은 [도메인 클라이언트](../client-config/domain-client)와 [세션 관리](../client-config/session)를 참조하세요.

## RetryPolicy

```go
type RetryPolicy interface {
    ShouldRetry(resp ResponseReader, err error, attempt int) bool
    GetDelay(attempt int) time.Duration
    MaxRetries() int
}
```

커스텀 재시도 전략 인터페이스입니다.

| 메서드 | 설명 |
|--------|------|
| `ShouldRetry(resp, err, attempt)` | 재시도 여부 판단, `attempt`는 0부터 시작 |
| `GetDelay(attempt)` | 다음 재시도 전 대기 시간 반환 |
| `MaxRetries()` | 최대 재시도 횟수 반환 |

:::warning 내부 타입 제한
ShouldRetry의 `resp` 매개변수 타입 ResponseReader는 내부 인터페이스(`internal/types` 패키지에 위치)이므로 외부 코드에서 직접 참조할 수 없습니다. 따라서 `RetryPolicy`는 같은 모듈 내에서만 구현할 수 있습니다. 대부분의 시나리오는 `RetryConfig` 설정과 `WithMaxRetries` 옵션으로 재시도 요구사항을 충족할 수 있습니다. 커스텀 전략이 필요한 경우 프로젝트 내부 패키지에서 `RetryPolicy` 인터페이스를 구현하세요.
:::

다음 예제는 `RetryPolicy`의 구현 패턴을 보여줍니다. ResponseReader는 내부 타입이므로 이 코드는 `httpc` 모듈 내부에서만 컴파일됩니다:

```go
// 주의: ResponseReader는 내부 타입(internal/types 패키지)입니다.
// 이 코드는 httpc 모듈 외부에서 컴파일할 수 없습니다.
// 대부분의 사용자는 RetryConfig와 WithMaxRetries로 재시도를 설정해야 합니다.

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

미들웨어에서 사용하며, 요청에 대한 읽기/쓰기 접근을 제공합니다. 내부 인터페이스 RequestReader와 RequestWriter로 구성됩니다. 전체 메서드 계약과 읽기/쓰기 예제는 [요청과 응답 뮤테이터](../handler/mutators)를 참조하세요.

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

미들웨어에서 사용하며, 응답에 대한 읽기/쓰기 접근을 제공합니다. 내부 인터페이스 ResponseReader와 ResponseWriter로 구성됩니다. 전체 메서드 계약은 [요청과 응답 뮤테이터](../handler/mutators)를 참조하세요.

### Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

요청 처리 함수 서명입니다.

### MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

미들웨어 함수 서명으로, 다음 Handler를 받아 래핑된 Handler를 반환합니다.

## 인증서 고정

인증서 고정(Certificate Pinning)은 TLS 핸드셰이크 단계에서 서버 인증서가 사전에 고정된 공개키/인증서와 일치하는지 검증합니다. 신뢰할 수 있는 CA가 침해되더라도 핸드셰이크가 거부되어 중간자 공격을 방어할 수 있습니다.

### CertificatePinner

```go
type CertificatePinner = security.CertificatePinner
```

인증서 고정기 인터페이스. 아래 생성자로 생성한 후 `SecurityConfig.CertificatePinner` 필드(`Config.Security`로 접근)에 할당합니다:

```go
pinner, err := httpc.NewSPKIHashPinner(
    "YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2fuihg=", // 현재 키
    "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // 백업 키 (로테이션)
)
if err != nil {
    log.Fatal(err)
}

cfg := httpc.DefaultConfig()
cfg.Security.CertificatePinner = pinner
client, err := httpc.New(cfg)
```

:::tip
Pinner 구현은 동시에 안전하므로 동일한 `Config`로 생성된 여러 클라이언트가 공유할 수 있습니다(딥 카피 시 참조로 전달되며 복제되지 않음). 고급 사용자는 이 인터페이스를 직접 구현하여 커스텀 고정 전략(예: 공개키 대신 전체 인증서 고정)을 지원할 수도 있습니다.
:::

### NewSPKIHashPinner

```go
func NewSPKIHashPinner(hashes ...string) (CertificatePinner, error)
```

하나 이상의 base64 인코딩된 SHA-256 해시 값(DER 인코딩된 SubjectPublicKeyInfo/SPKI에 대한)으로 인증서 고정기를 생성합니다. 이는 가장 널리 사용되는 고정 형식(HPKP가 채택)이며 권장되는 방식입니다.

여러 해시를 전달하면 키 로테이션을 지원합니다 — 대상 공개키가 고정된 해시 중 **어느 하나**와 일치하기만 하면 핸드셰이크가 성공합니다.

다음 명령으로 인증서에서 해시를 생성합니다:

```bash
openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```

유효한 해시가 제공되지 않았거나, 해시가 유효한 base64가 아닌 경우 오류를 반환합니다.

### NewPublicKeyPinner

```go
func NewPublicKeyPinner(publicKeys ...[]byte) (CertificatePinner, error)
```

하나 이상의 DER 인코딩된 PKIX 공개키(`x509.MarshalPKIXPublicKey`가 반환)로 인증서 고정기를 생성합니다. 내부적으로 각 공개키에 대해 SHA-256 해시를 계산합니다; 원본 공개키 바이트를 이미 보유하고 있다면 `NewSPKIHashPinner`보다 편리한 선택입니다.

유효한 공개키가 제공되지 않은 경우 오류를 반환합니다.

### NewCertificatePinnerChain

```go
func NewCertificatePinnerChain(pinners ...CertificatePinner) CertificatePinner
```

여러 고정기를 하나로 조합합니다. 래핑된 고정기 중 **어느 하나**라도 해당 인증서를 수락하면 인증서가 수락됩니다. 여러 고정 전략을 동시에 지원하거나, 서로 다른 생성자로 구축한 로테이션 키를 조합할 때 사용합니다.

인수를 전달하지 않으면 no-op 고정기(모든 인증서 거부)를 반환합니다.

:::tip 더 읽어보기
인증서 고정의 완전한 가이드(해시 생성, 키 로테이션 전략, 프로덕션 배포)는 [TLS 인증서 고정](../../security/tls-certpin)을 참조하세요.
:::

## 관련 페이지

| 타입 | 상세 참조 |
|------|----------|
| `Result` / `RequestInfo` / `ResponseInfo` / `RequestMeta` | [Result](../core/result) |
| `SessionManager` 메서드 | [세션 관리](../client-config/session) |
| `DomainClient` 구현 | [도메인 클라이언트](../client-config/domain-client) |
| `DownloadConfig` / `DownloadResult` | [파일 다운로드](../client-config/download) |
| `ClientError` / `ErrorType` / 오류 변수 | [오류 타입](./errors) |
| `FormData` / `FileData` / `BodyKind` | [상수와 타입](./constants) |
