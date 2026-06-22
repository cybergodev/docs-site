---
title: "요청 옵션 - CyberGo HTTPC | WithXxx 옵션"
description: "HTTPC 요청 옵션 API 레퍼런스: WithHeader 헤더, WithBearerToken 인증, WithJSON/WithForm 요청 본문, WithQuery 매개변수와 콜백 함수의 완전한 사용법을 제공합니다."
---

# 요청 옵션

요청 옵션은 함수형 설정 항목으로, `RequestOption` 타입을 통해 요청 메서드에 전달하여 세밀한 요청 제어를 구현합니다.

```go
result, err := client.Post(url,
    httpc.WithJSON(data),
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

모든 옵션은 자유롭게 조합할 수 있으며, 전달된 순서대로 적용됩니다.

## 요청 헤더

### WithHeader

```go
func WithHeader(key, value string) RequestOption
```

단일 요청 헤더를 설정합니다. 키와 값은 보안 검증을 거칩니다(CRLF 주입 방지).

```go
result, err := client.Get(url,
    httpc.WithHeader("X-Custom", "value"),
)
```

### WithHeaderMap

```go
func WithHeaderMap(headers map[string]string) RequestOption
```

요청 헤더를 일괄 설정합니다.

```go
result, err := client.Get(url,
    httpc.WithHeaderMap(map[string]string{
        "Accept":        "application/json",
        "X-Request-ID":  "abc123",
    }),
)
```

### WithUserAgent

```go
func WithUserAgent(userAgent string) RequestOption
```

User-Agent 헤더를 설정합니다. `WithHeader("User-Agent", ...)`의 편의 래퍼입니다.

## 인증

### WithBasicAuth

```go
func WithBasicAuth(username, password string) RequestOption
```

HTTP Basic 인증을 설정합니다. 사용자 이름은 비워둘 수 없으며, 자격 증명 길이에 제한이 있습니다.

```go
result, err := client.Get(url,
    httpc.WithBasicAuth("admin", "password"),
)
```

### WithBearerToken

```go
func WithBearerToken(token string) RequestOption
```

`Authorization: Bearer <token>` 헤더를 설정합니다. Token은 비워둘 수 없습니다.

```go
result, err := client.Get(url,
    httpc.WithBearerToken("eyJhbGciOiJIUzI1NiIs..."),
)
```

## 요청 본문

### WithJSON

```go
func WithJSON(data any) RequestOption
```

JSON 요청 본문을 설정하고, 자동으로 `Content-Type: application/json`을 추가합니다.

```go
result, err := client.Post(url,
    httpc.WithJSON(map[string]any{
        "name":  "test",
        "email": "test@example.com",
    }),
)
```

### WithXML

```go
func WithXML(data any) RequestOption
```

XML 요청 본문을 설정하고, 자동으로 `Content-Type: application/xml`을 추가합니다.

### WithForm

```go
func WithForm(data map[string]string) RequestOption
```

URL 인코딩 폼 요청 본문을 설정하고, 자동으로 `Content-Type: application/x-www-form-urlencoded`을 추가합니다.

```go
result, err := client.Post(url,
    httpc.WithForm(map[string]string{
        "username": "admin",
        "password": "secret",
    }),
)
```

### WithFormData

```go
func WithFormData(data *FormData) RequestOption
```

`multipart/form-data` 요청 본문을 설정하며, 파일과 필드 혼합 업로드를 지원합니다.

```go
result, err := client.Post(url,
    httpc.WithFormData(&httpc.FormData{
        Fields: map[string]string{"description": "upload"},
        Files: map[string]*httpc.FileData{
            "file": {Filename: "doc.pdf", Content: fileBytes},
        },
    }),
)
```

### WithFile

```go
func WithFile(fieldName, filename string, content []byte) RequestOption
```

편의 파일 업로드. 자동으로 multipart 요청 본문을 구성하며, 파일명은 경로 순회 방지 처리를 거칩니다.

```go
result, err := client.Post(url,
    httpc.WithFile("upload", "report.csv", csvBytes),
)
```

### WithBinary

```go
func WithBinary(data []byte, contentType ...string) RequestOption
```

바이너리 요청 본문을 설정합니다. 기본 Content-Type은 `application/octet-stream`이며, 커스텀할 수 있습니다.

```go
result, err := client.Post(url,
    httpc.WithBinary(imageBytes, "image/png"),
)
```

### WithBody

```go
func WithBody(data any, kind ...BodyKind) RequestOption
```

범용 요청 본문 설정으로, 자동 감지와 명시적 타입 지정을 지원합니다.

**자동 감지 규칙** (기본값 `BodyAuto`):

| 입력 타입 | Content-Type |
|-----------|-------------|
| `string` | text/plain; charset=utf-8 |
| `[]byte` | application/octet-stream |
| `map[string]string` | application/x-www-form-urlencoded |
| `*FormData` | multipart/form-data |
| `io.Reader` | 설정하지 않음 (호출자가 처리) |
| 기타 타입 | application/json |

**명시적 타입 지정**:

```go
// 자동 감지 (기본값)
result, _ := client.Post(url, httpc.WithBody(data))

// JSON 강제
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyJSON))

// XML 강제
result, _ := client.Post(url, httpc.WithBody(data, httpc.BodyXML))
```

| 상수 | 의미 |
|------|------|
| `BodyAuto` | 자동 감지 (기본값) |
| `BodyJSON` | JSON 강제 |
| `BodyXML` | XML 강제 |
| `BodyForm` | 폼 강제 |
| `BodyBinary` | 바이너리 강제 |
| `BodyMultipart` | multipart 강제 (`*FormData` 필요) |

## 쿼리 매개변수

### WithQuery

```go
func WithQuery(key string, value any) RequestOption
```

단일 쿼리 매개변수를 설정합니다.

```go
result, err := client.Get(url,
    httpc.WithQuery("page", 1),
    httpc.WithQuery("limit", 10),
)
```

### WithQueryMap

```go
func WithQueryMap(params map[string]any) RequestOption
```

쿼리 매개변수를 일괄 설정합니다.

```go
result, err := client.Get(url,
    httpc.WithQueryMap(map[string]any{
        "page":  1,
        "limit": 10,
        "sort":  "created_at",
    }),
)
```

## Cookie

### WithCookie

```go
func WithCookie(cookie http.Cookie) RequestOption
```

단일 Cookie를 추가하며, 보안 검증을 거칩니다.

```go
result, err := client.Get(url,
    httpc.WithCookie(http.Cookie{Name: "session", Value: "abc123"}),
)
```

### WithCookies

```go
func WithCookies(cookies []http.Cookie) RequestOption
```

Cookie를 일괄 추가합니다. `WithCookie`를 여러 번 호출하는 것보다 효율적입니다 -- 용량을 미리 할당하고 단일 순회에서 모든 Cookie를 검증합니다.

```go
cookies := []http.Cookie{
    {Name: "session_id", Value: "abc123"},
    {Name: "user_pref", Value: "dark_mode"},
    {Name: "lang", Value: "en"},
}
result, err := client.Get("https://api.example.com",
    httpc.WithCookies(cookies),
)
```

### WithCookieMap

```go
func WithCookieMap(cookies map[string]string) RequestOption
```

간단한 Cookie를 일괄 추가합니다. name-value만 필요한 시나리오에 적합합니다.

```go
result, err := client.Get(url,
    httpc.WithCookieMap(map[string]string{
        "session_id": "abc123",
        "lang":       "zh",
    }),
)
```

### WithCookieString

```go
func WithCookieString(cookieString string) RequestOption
```

원시 Cookie 헤더 문자열에서 Cookie를 추가합니다.

```go
result, err := client.Get(url,
    httpc.WithCookieString("session=abc123; lang=zh"),
)
```

### WithSecureCookie

```go
func WithSecureCookie(securityConfig *CookieSecurityConfig) RequestOption
```

요청 Cookie의 보안 속성(Secure, HttpOnly, SameSite)을 강제 검증합니다.

```go
result, err := client.Get(url,
    httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig()),
)
```

## 요청 제어

### WithContext

```go
func WithContext(ctx context.Context) RequestOption
```

요청 컨텍스트를 설정하여 타임아웃과 취소를 지원합니다. 컨텍스트는 nil일 수 없습니다.

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result, err := client.Get(url, httpc.WithContext(ctx))
```

### WithTimeout

```go
func WithTimeout(timeout time.Duration) RequestOption
```

단일 요청 타임아웃을 설정하여 클라이언트 기본 타임아웃을 덮어씁니다. 범위: 0 ~ 30분.

```go
result, err := client.Get(url, httpc.WithTimeout(5*time.Second))
```

### WithMaxRetries

```go
func WithMaxRetries(maxRetries int) RequestOption
```

단일 요청의 최대 재시도 횟수를 설정하여 클라이언트 설정을 덮어씁니다. 범위: 0-10.

```go
result, err := client.Get(url, httpc.WithMaxRetries(3))
```

### WithFollowRedirects

```go
func WithFollowRedirects(follow bool) RequestOption
```

리다이렉트 따라가기 여부를 제어합니다.

```go
// 리다이렉트 따라가기 비활성화
result, err := client.Get(url, httpc.WithFollowRedirects(false))
```

### WithMaxRedirects

```go
func WithMaxRedirects(maxRedirects int) RequestOption
```

단일 요청의 최대 리다이렉트 횟수를 설정합니다. 범위: 0-50.

### WithAllowPrivateIPs

```go
func WithAllowPrivateIPs(allow bool) RequestOption
```

단일 요청에 대해 클라이언트의 SSRF 정책을 재정의합니다. `allow`가 `true`이면 해당 요청은 localhost와 사설/예약 IP 대역(127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 169.254.0.0/16 등)에 접근할 수 있으며, 이러한 주소로의 리다이렉트를 따를 수 있습니다. `false`이면 클라이언트가 `Security.AllowPrivateIPs=true`로 설정되어 있더라도 이 요청에 대해서는 SSRF 방어를 강제로 활성화합니다.

:::warning 보안 안내
이것은 SSRF 방어의 **단일 요청 이스케이프 해치**로, 기본적으로 안전한 클라이언트(`AllowPrivateIPs=false`)가 드물게 내부 서비스, 루프백 주소 또는 로컬 개발 서버에 접근해야 하는 시나리오를 위한 것입니다.

요청 URL이 신뢰할 수 있고 신뢰할 수 없는 사용자 입력에서 오지 **않은** 경우에만 활성화하세요. 클라이언트 전체가 내부 서비스에 접근해야 한다면 `Config`에서 직접 `Security.AllowPrivateIPs=true`를 설정하세요.
:::

```go
// 기본 클라이언트는 사설 IP를 차단; 이 호출은 요청별로 허용
result, err := httpc.Get("http://localhost:8080/health",
    httpc.WithAllowPrivateIPs(true),
)
```

### WithStreamBody

```go
func WithStreamBody(stream bool) RequestOption
```

스트리밍 모드를 활성화하여 응답 본문을 메모리에 캐시하지 않습니다. 파일 다운로드 시 내부적으로 사용되며, 대용량 파일의 메모리 점유를 방지합니다.

```go
result, err := client.Get(url, httpc.WithStreamBody(true))
```

## 콜백

### WithOnRequest

```go
func WithOnRequest(callback func(req RequestMutator) error) RequestOption
```

요청 전송 전 콜백을 등록합니다. 체인 등록이 가능하며, 추가된 순서대로 실행됩니다. 콜백이 오류를 반환하면 요청이 중단됩니다.

```go
result, err := client.Get(url,
    httpc.WithOnRequest(func(req httpc.RequestMutator) error {
        log.Printf("전송 %s %s", req.Method(), req.URL())
        return nil
    }),
)
```

### WithOnResponse

```go
func WithOnResponse(callback func(resp ResponseMutator) error) RequestOption
```

응답 수신 후 콜백을 등록합니다. 체인 등록이 가능하며, 추가된 순서대로 실행됩니다.

```go
result, err := client.Get(url,
    httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
        log.Printf("응답 수신: %d %s", resp.StatusCode(), resp.Status())
        return nil
    }),
)
```

## 관련 항목

- [상수와 타입](./constants) - BodyKind 상수와 타입 별칭
- [인터페이스 정의](./interfaces) - RequestMutator, ResponseMutator 인터페이스
- [요청과 응답](../guides/request-response) - 요청 옵션 사용 가이드
