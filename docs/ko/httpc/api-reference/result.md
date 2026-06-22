---
title: "Result - CyberGo HTTPC | Result 응답 타입"
description: "HTTPC Result 응답 타입 API 레퍼런스: StatusCode/Body 기본 메서드, 상태 판단, Cookie 조작, Unmarshal JSON 파싱과 SaveToFile 파일 저장의 완전한 사용법을 제공합니다."
---

# Result

Result는 HTTP 응답과 요청 메타데이터를 래핑하여 편리한 접근 메서드를 제공합니다. `Client.Request()` 또는 패키지 함수로 얻을 수 있습니다.

```go
type Result struct {
    Request  *RequestInfo
    Response *ResponseInfo
    Meta     *RequestMeta
}
```

```go
result, err := httpc.Get("https://api.example.com/users/1")
if err != nil {
    log.Fatal(err)
}

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::tip
Result는 매 요청마다 새로 생성되며, GC가 자동으로 회수하므로 수동 해제가 필요 없습니다.
:::

## 기본 메서드

### StatusCode

```go
func (r *Result) StatusCode() int
```

HTTP 상태 코드를 반환합니다. nil 안전, 0을 반환합니다.

### Body

```go
func (r *Result) Body() string
```

응답 본문 문자열을 반환합니다. nil 안전, 빈 문자열을 반환합니다.

### RawBody

```go
func (r *Result) RawBody() []byte
```

응답 본문 원본 바이트를 반환합니다. nil 안전, nil을 반환합니다.

### Proto

```go
func (r *Result) Proto() string
```

HTTP 프로토콜 버전을 반환합니다. 예: `"HTTP/1.1"`, `"HTTP/2.0"`.

## 상태 판단

### IsSuccess

```go
func (r *Result) IsSuccess() bool
```

상태 코드가 2xx이면 true를 반환합니다.

### IsRedirect

```go
func (r *Result) IsRedirect() bool
```

상태 코드가 3xx이면 true를 반환합니다.

### IsClientError

```go
func (r *Result) IsClientError() bool
```

상태 코드가 4xx이면 true를 반환합니다.

### IsServerError

```go
func (r *Result) IsServerError() bool
```

상태 코드가 5xx이면 true를 반환합니다.

```go
result, _ := client.Get(url)
switch {
case result.IsSuccess():
    handleSuccess(result)
case result.IsClientError():
    handleClientError(result)
case result.IsServerError():
    handleServerError(result)
}
```

## Cookie 메서드

### ResponseCookies

```go
func (r *Result) ResponseCookies() []*http.Cookie
```

응답의 모든 Cookie를 반환합니다.

### GetCookie

```go
func (r *Result) GetCookie(name string) *http.Cookie
```

이름으로 응답 Cookie를 가져옵니다. 찾지 못하면 nil을 반환합니다.

```go
cookie := result.GetCookie("session")
if cookie != nil {
    fmt.Println(cookie.Value)
}
```

### HasCookie

```go
func (r *Result) HasCookie(name string) bool
```

응답에 지정된 이름의 Cookie가 있는지 확인합니다.

### RequestCookies

```go
func (r *Result) RequestCookies() []*http.Cookie
```

요청에서 전송한 모든 Cookie를 반환합니다.

### GetRequestCookie

```go
func (r *Result) GetRequestCookie(name string) *http.Cookie
```

이름으로 요청 Cookie를 가져옵니다.

### HasRequestCookie

```go
func (r *Result) HasRequestCookie(name string) bool
```

요청에 지정된 이름의 Cookie가 있는지 확인합니다.

## JSON 파싱

### Unmarshal

```go
func (r *Result) Unmarshal(v any) error
```

JSON 응답 본문을 대상 변수에 파싱합니다. `json.Unmarshal` 규칙을 따릅니다.

| 오류 | 트리거 조건 |
|------|------------|
| `ErrResponseBodyEmpty` | 응답 본문이 비어 있음 |
| `ErrResponseBodyTooLarge` | 응답 본문이 50MB JSON 파싱 크기 제한 초과 |

```go
var user User
if err := result.Unmarshal(&user); err != nil {
    log.Fatal(err)
}
fmt.Println(user.Name)
```

## 파일 저장

### SaveToFile

```go
func (r *Result) SaveToFile(filePath string) error
```

응답 본문을 파일로 저장합니다. 파일 경로는 보안 검증을 거칩니다(경로 순회 방지, 심볼릭 링크 검사, 시스템 경로 보호).

| 오류 | 트리거 조건 |
|------|------------|
| `ErrResponseBodyEmpty` | 응답 본문이 비어 있음 |

```go
result, _ := client.Get("https://example.com/data.csv")

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## 문자열 표현

### String

```go
func (r *Result) String() string
```

사람이 읽을 수 있는 문자열 표현을 반환합니다. 민감한 헤더는 자동 마스킹되며, 응답 본문은 200자로 잘립니다.

```go
result, _ := client.Get(url)
fmt.Println(result.String())
// Result{Status: 200 OK, ContentLength: 1024, Duration: 125ms, Attempts: 1, ...}
```

## 하위 타입

### RequestInfo

```go
type RequestInfo struct {
    URL     string
    Method  string
    Headers http.Header
    Cookies []*http.Cookie
}
```

요청 상세 정보. `result.Request`로 접근합니다.

### ResponseInfo

```go
type ResponseInfo struct {
    StatusCode    int
    Status        string
    Proto         string
    Headers       http.Header
    Body          string
    RawBody       []byte
    ContentLength int64
    Cookies       []*http.Cookie
}
```

응답 데이터. `result.Response`로 접근합니다.

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

요청 실행 메타데이터. `result.Meta`로 접근합니다.

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2 (1회 재시도)
fmt.Println(result.Meta.RedirectCount)  // 1 (1회 리다이렉트 따라감)
```

## 관련 항목

- [패키지 함수](./functions) - Result를 얻는 요청 메서드
- [요청 옵션](./options) - 요청 동작 설정
- [파일 다운로드](./download) - 다운로드 결과 타입 DownloadResult
