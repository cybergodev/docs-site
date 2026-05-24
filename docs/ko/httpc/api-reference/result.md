---
title: "Result - HTTPC"
description: "HTTPC Result 응답 타입 API 레퍼런스: StatusCode/Body/RawBody 기본 메서드, IsSuccess/IsClientError 상태 판별, Cookie 조작, Unmarshal JSON 파싱, SaveToFile 파일 저장과 RequestInfo/ResponseInfo/RequestMeta 하위 타입."
---

# Result

Result는 HTTP 응답과 요청 메타데이터를 래핑하며, 편리한 접근 메서드를 제공합니다. `Client.Request()` 또는 패키지 레벨 함수를 통해 얻을 수 있습니다.

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
defer httpc.ReleaseResult(result)

fmt.Println(result.StatusCode()) // 200
fmt.Println(result.Body())       // {"id":1,"name":"test"}
```

:::warning 주의
사용 후 반드시 `ReleaseResult(result)`를 호출하여 객체 풀로 반환해야 합니다. 호출 후에는 Result에 접근할 수 없습니다.
:::

## 기본 메서드

### StatusCode

```go
func (r *Result) StatusCode() int
```

HTTP 상태 코드를 반환합니다. nil 안전하며, 0을 반환합니다.

### Body

```go
func (r *Result) Body() string
```

응답 본문 문자열을 반환합니다. nil 안전하며, 빈 문자열을 반환합니다.

### RawBody

```go
func (r *Result) RawBody() []byte
```

응답 본문 원시 바이트를 반환합니다. nil 안전하며, nil을 반환합니다.

### Proto

```go
func (r *Result) Proto() string
```

HTTP 프로토콜 버전을 반환합니다. 예: `"HTTP/1.1"`, `"HTTP/2.0"`.

## 상태 판별

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

요청에서 전송된 모든 Cookie를 반환합니다.

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

JSON 응답 본문을 대상 변수에 파싱합니다. `json.Unmarshal` 규약을 따릅니다.

| 오류 | 발생 조건 |
|------|-----------|
| `ErrResponseBodyEmpty` | 응답 본문이 비어 있음 |
| `ErrResponseBodyTooLarge` | 응답 본문이 50MB JSON 파싱 크기 제한을 초과함 |

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

응답 본문을 파일로 저장합니다. 파일 경로는 보안 검증을 거칩니다 (경로 순회 방지, 심볼릭 링크 검사, 시스템 경로 보호).

| 오류 | 발생 조건 |
|------|-----------|
| `ErrResponseBodyEmpty` | 응답 본문이 비어 있음 |

```go
result, _ := client.Get("https://example.com/data.csv")
defer httpc.ReleaseResult(result)

if err := result.SaveToFile("/tmp/data.csv"); err != nil {
    log.Fatal(err)
}
```

## 문자열 표현

### String

```go
func (r *Result) String() string
```

사람이 읽을 수 있는 문자열 표현을 반환합니다. 민감한 헤더는 자동으로 마스킹되며, 응답 본문은 200자로 잘립니다.

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

요청 상세 정보입니다. `result.Request`를 통해 접근합니다.

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

응답 데이터입니다. `result.Response`를 통해 접근합니다.

### RequestMeta

```go
type RequestMeta struct {
    Duration      time.Duration
    Attempts      int
    RedirectChain []string
    RedirectCount int
}
```

요청 실행 메타데이터입니다. `result.Meta`를 통해 접근합니다.

```go
result, _ := client.Get(url)

fmt.Println(result.Meta.Duration)      // 125ms
fmt.Println(result.Meta.Attempts)       // 2 (1회 재시도)
fmt.Println(result.Meta.RedirectCount)  // 1 (1회 리다이렉트 따름)
```

## ReleaseResult

```go
func ReleaseResult(r *Result)
```

Result를 객체 풀로 반환합니다. 응답 본문 데이터는 안전하게 삭제되며 (민감한 데이터 잔존을 방지하기 위해 전체 블록을 0으로 초기화), 모든 내부 데이터가 초기화됩니다. 호출 후에는 Result의 어떤 필드나 메서드에도 접근할 수 없습니다.

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
// result 사용...
```

## 참고

- [패키지 함수](./functions) - Result를 얻는 요청 메서드
- [요청 옵션](./options) - 요청 동작 설정
- [파일 다운로드](./download) - 다운로드 결과 타입 DownloadResult
