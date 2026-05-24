---
title: "패키지 함수 - HTTPC"
description: "HTTPC 패키지 레벨 함수와 클라이언트 메서드 API 레퍼런스: Get/Post 등 7가지 HTTP 패키지 레벨 함수, New 클라이언트 생성, SetDefaultClient 기본 클라이언트 관리, DownloadFile 등 4개의 다운로드 함수, ReleaseResult 객체 풀 재사용, FormatBytes 보조 함수와 NewDomain 도메인 클라이언트."
---

# 패키지 함수

## 패키지 레벨 HTTP 메서드

클라이언트를 생성할 필요 없이 직접 요청을 전송합니다. 내부적으로 지연 초기화된 기본 클라이언트를 사용합니다.

### Get

```go
func Get(url string, options ...RequestOption) (*Result, error)
```

GET 요청을 전송합니다.

```go
result, err := httpc.Get("https://api.example.com/data",
    httpc.WithBearerToken(token),
    httpc.WithQuery("page", 1),
)
```

### Post

```go
func Post(url string, options ...RequestOption) (*Result, error)
```

POST 요청을 전송합니다.

```go
result, err := httpc.Post("https://api.example.com/users",
    httpc.WithJSON(map[string]any{"name": "test"}),
)
```

### Put / Patch / Delete / Head / Options

```go
func Put(url string, options ...RequestOption) (*Result, error)
func Patch(url string, options ...RequestOption) (*Result, error)
func Delete(url string, options ...RequestOption) (*Result, error)
func Head(url string, options ...RequestOption) (*Result, error)
func Options(url string, options ...RequestOption) (*Result, error)
```

### Request

```go
func Request(ctx context.Context, method, url string, options ...RequestOption) (*Result, error)
```

컨텍스트가 포함된 범용 요청 메서드로, 타임아웃과 취소 제어를 지원합니다.

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := httpc.Request(ctx, "GET", "https://api.example.com/data")
```

## 클라이언트 메서드

Client 인터페이스는 패키지 레벨 함수와 동일한 HTTP 메서드와 컨텍스트가 포함된 `Request` 메서드를 제공합니다.

### New

```go
func New(config ...*Config) (Client, error)
```

새로운 HTTP 클라이언트를 생성합니다. 구성을 전달하지 않거나 `nil`을 전달하면 `DefaultConfig()`를 사용합니다.

```go
client, err := httpc.New()
client, err := httpc.New(nil)
client, err := httpc.New(httpc.SecureConfig())

cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
client, err := httpc.New(cfg)
```

### 클라이언트 HTTP 메서드

```go
result, err := client.Get(url, options...)
result, err := client.Post(url, options...)
result, err := client.Put(url, options...)
result, err := client.Patch(url, options...)
result, err := client.Delete(url, options...)
result, err := client.Head(url, options...)
result, err := client.Options(url, options...)
result, err := client.Request(ctx, "GET", url, options...)
```

### Close

Client 인터페이스 메서드로, 클라이언트가 보유한 리소스(연결 풀, Transport)를 해제합니다. 호출 후에는 다시 사용할 수 없습니다.

```go
// Client 인터페이스 메서드
Close() error
```

```go
client, _ := httpc.New()
defer client.Close()
```

## 기본 클라이언트 관리

### SetDefaultClient

```go
func SetDefaultClient(client Client) error
```

사용자 정의 클라이언트를 기본 클라이언트로 설정하여 패키지 레벨 함수에서 사용합니다. 이전 기본 클라이언트는 자동으로 닫힙니다.

:::warning 제한
`httpc.New()`로 생성된 클라이언트만 허용하며, 이미 닫힌 클라이언트는 설정할 수 없습니다.
:::

```go
client, _ := httpc.New(httpc.PerformanceConfig())
httpc.SetDefaultClient(client)

// 이후 패키지 레벨 함수는 PerformanceConfig 사용
result, _ := httpc.Get(url)
```

### CloseDefaultClient

```go
func CloseDefaultClient() error
```

기본 클라이언트를 닫고 초기화합니다. 다음에 패키지 레벨 함수를 호출하면 새 클라이언트가 생성됩니다.

## 결과 관리

### ReleaseResult

```go
func ReleaseResult(r *Result)
```

Result를 객체 풀로 반환하여 GC 부하를 줄입니다. 호출 후 Result를 다시 사용할 수 없습니다.

```go
result, _ := httpc.Get(url)
defer httpc.ReleaseResult(result)
```

:::warning 주의
`ReleaseResult` 호출 후 Result에 접근하지 마세요. 내부 데이터가 초기화됩니다.
:::

## 다운로드 함수

패키지 다운로드 함수는 기본 클라이언트를 사용하며, Client 인터페이스도 동일한 이름의 메서드를 제공합니다.

### DownloadFile

```go
func DownloadFile(url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

기본 클라이언트를 사용하여 파일을 지정된 경로에 다운로드합니다.

```go
// 패키지 레벨 함수
result, err := httpc.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")

// Client 인터페이스 메서드
result, err := client.DownloadFile("https://example.com/file.zip", "/tmp/file.zip")
```

### DownloadWithOptions

```go
func DownloadWithOptions(url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

구성이 포함된 파일 다운로드로, 이어받기와 진행률 콜백을 지원합니다.

```go
cfg := httpc.DefaultDownloadConfig()
cfg.FilePath = "/tmp/file.zip"
cfg.Overwrite = true
cfg.ResumeDownload = true
cfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%%", float64(downloaded)/float64(total)*100)
}

// 패키지 레벨 함수
result, err := httpc.DownloadWithOptions(url, cfg)
// Client 인터페이스 메서드
result, err = client.DownloadWithOptions(url, cfg)
```

### DownloadFileWithContext

```go
func DownloadFileWithContext(ctx context.Context, url string, filePath string, options ...RequestOption) (*DownloadResult, error)
```

컨텍스트 제어가 포함된 파일 다운로드로, 타임아웃과 취소를 지원합니다.

```go
// 패키지 레벨 함수
result, err := httpc.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
// Client 인터페이스 메서드
result, err = client.DownloadFileWithContext(ctx, url, "/tmp/file.zip")
```

### DownloadWithOptionsWithContext

```go
func DownloadWithOptionsWithContext(ctx context.Context, url string, downloadOpts *DownloadConfig, options ...RequestOption) (*DownloadResult, error)
```

구성과 컨텍스트 제어가 포함된 파일 다운로드입니다.

```go
// 패키지 레벨 함수
result, err := httpc.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
// Client 인터페이스 메서드
result, err = client.DownloadWithOptionsWithContext(ctx, url, downloadOpts)
```

## 보조 함수

### FormatBytes

```go
func FormatBytes(bytes int64) string
```

바이트 수를 사람이 읽을 수 있는 문자열로 포맷합니다.

```go
httpc.FormatBytes(1536)      // "1.50 KB"
httpc.FormatBytes(1048576)   // "1.00 MB"
```

### FormatSpeed

```go
func FormatSpeed(bytesPerSecond float64) string
```

전송 속도를 사람이 읽을 수 있는 문자열로 포맷합니다.

```go
httpc.FormatSpeed(1536.0)    // "1.50 KB/s"
httpc.FormatSpeed(1048576.0) // "1.00 MB/s"
```

## 도메인 클라이언트

### NewDomain

```go
func NewDomain(baseURL string, config ...*Config) (DomainClienter, error)
```

도메인 범위 클라이언트를 생성하여 Cookie와 요청 헤더를 자동으로 관리합니다.

```go
dc, err := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, err := dc.Get("/users")
```

## 참고

- [Result](./result) - 응답 결과 타입과 메서드
- [요청 옵션](./options) - 요청 구성 옵션
- [도메인 클라이언트](./domain-client) - 도메인 범위 클라이언트
- [파일 다운로드](./download) - 다운로드 함수와 타입
