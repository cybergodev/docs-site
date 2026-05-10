---
title: 치트시트 - HTTPC
description: HTTPC 치트시트, 클라이언트 생성, 7가지 HTTP 메서드, 요청 옵션, 응답 처리, 구성 프리셋, 미들웨어 및 오류 유형 빠른 참조.
---

# 치트시트

## 클라이언트 생성

```go
// 기본 구성
client, _ := httpc.New()
defer client.Close()

// 사용자 정의 구성
cfg := httpc.DefaultConfig()
cfg.Timeouts.Request = 60 * time.Second
cfg.Retry.MaxRetries = 5
client, _ = httpc.New(cfg)
```

## HTTP 메서드

```go
// 패키지 함수 (기본 클라이언트 사용)
result, _ := httpc.Get(url)
result, _ := httpc.Post(url)
result, _ := httpc.Put(url)
result, _ := httpc.Patch(url)
result, _ := httpc.Delete(url)
result, _ := httpc.Head(url)
result, _ := httpc.Options(url)

// 인스턴스 메서드
result, _ := client.Get(url)

// 컨텍스트 포함
result, _ := httpc.Request(ctx, "GET", url)
result, _ := client.Request(ctx, "POST", url)
```

## 요청 옵션

### 요청 헤더

```go
httpc.WithHeader("Authorization", "Bearer token")
httpc.WithHeaderMap(map[string]string{"Key": "Value"})
httpc.WithUserAgent("my-app/1.0")
```

### 요청 본문

```go
httpc.WithJSON(data)                    // application/json
httpc.WithXML(data)                     // application/xml
httpc.WithForm(map[string]string{...})  // x-www-form-urlencoded
httpc.WithFormData(formData)            // multipart/form-data
httpc.WithFile("file", "doc.pdf", data) // 파일 업로드
httpc.WithBinary([]byte{...})           // application/octet-stream
httpc.WithBinary([]byte{...}, "image/png") // 유형 지정
httpc.WithBody(data)                    // 자동 감지 유형
httpc.WithBody(data, httpc.BodyJSON)    // 명시적 지정: BodyJSON/BodyXML/BodyForm/BodyBinary/BodyMultipart
```

### 쿼리 매개변수

```go
httpc.WithQuery("page", 1)
httpc.WithQueryMap(map[string]any{"page": 1, "limit": 10})
```

### 인증

```go
httpc.WithBearerToken(token)
httpc.WithBasicAuth("user", "pass")
```

### Cookie

```go
httpc.WithCookie(http.Cookie{Name: "session", Value: "abc"})
httpc.WithCookies([]http.Cookie{{Name: "a", Value: "1"}, {Name: "b", Value: "2"}})
httpc.WithCookieMap(map[string]string{"session": "abc"})
httpc.WithCookieString("session=abc; token=xyz")
httpc.WithSecureCookie(httpc.StrictCookieSecurityConfig())
```

### 제어

```go
httpc.WithContext(ctx)
httpc.WithTimeout(30 * time.Second)
httpc.WithMaxRetries(3)
httpc.WithFollowRedirects(false)
httpc.WithMaxRedirects(5)
httpc.WithStreamBody(true)
```

### 콜백

```go
httpc.WithOnRequest(func(req httpc.RequestMutator) error {
    log.Printf("전송 %s %s", req.Method(), req.URL())
    return nil
})
httpc.WithOnResponse(func(resp httpc.ResponseMutator) error {
    log.Printf("응답 수신: %d", resp.StatusCode())
    return nil
})
```

## 응답 처리

```go
result.StatusCode()                    // int
result.Body()                          // string
result.RawBody()                       // []byte
result.Proto()                         // "HTTP/1.1"
result.IsSuccess()                     // 2xx
result.IsRedirect()                    // 3xx
result.IsClientError()                 // 4xx
result.IsServerError()                 // 5xx
result.Unmarshal(&data)                // JSON 파싱
result.GetCookie("name")               // 응답 Cookie 가져오기
result.HasCookie("name")               // 응답 Cookie 확인
result.ResponseCookies()               // 모든 응답 Cookie
result.RequestCookies()                // 모든 요청 Cookie
result.GetRequestCookie("name")        // 요청 Cookie 가져오기
result.HasRequestCookie("name")        // 요청 Cookie 확인
result.SaveToFile("/path/to/file")     // 파일로 저장
result.String()                        // 사람이 읽을 수 있는 표현 (민감한 헤더 마스킹)
httpc.ReleaseResult(result)            // 객체 풀로 반환
```

## 구성

```go
cfg := httpc.DefaultConfig()

// 타임아웃
cfg.Timeouts.Request = 30 * time.Second
cfg.Timeouts.Dial = 10 * time.Second
cfg.Timeouts.TLSHandshake = 10 * time.Second
cfg.Timeouts.ResponseHeader = 30 * time.Second
cfg.Timeouts.IdleConn = 90 * time.Second

// 연결
cfg.Connection.MaxIdleConns = 50
cfg.Connection.MaxConnsPerHost = 10
cfg.Connection.ProxyURL = "http://proxy:8080"
cfg.Connection.EnableHTTP2 = true
cfg.Connection.EnableCookies = true

// 보안
cfg.Security.MinTLSVersion = tls.VersionTLS12
cfg.Security.MaxResponseBodySize = 10 * 1024 * 1024
cfg.Security.AllowPrivateIPs = false
cfg.Security.SSRFExemptCIDRs = []string{"10.0.0.0/8"}

// 재시도
cfg.Retry.MaxRetries = 3
cfg.Retry.Delay = 1 * time.Second
cfg.Retry.BackoffFactor = 2.0
cfg.Retry.EnableJitter = true
```

## 미들웨어

```go
cfg := httpc.DefaultConfig()
cfg.Middleware.Middlewares = []httpc.MiddlewareFunc{
    httpc.LoggingMiddleware(log.Printf),
    httpc.RecoveryMiddleware(),
    httpc.RequestIDMiddleware("X-Request-ID", nil),
    httpc.TimeoutMiddleware(30 * time.Second),
    httpc.MetricsMiddleware(func(method, url string, statusCode int, duration time.Duration, err error) {
        metrics.Record(method, statusCode, duration)
    }),
    httpc.AuditMiddleware(func(event httpc.AuditEvent) {
        log.Printf("[AUDIT] %s %s -> %d", event.Method, event.URL, event.StatusCode)
    }),
}
```

## 오류 처리

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            // 타임아웃
        case httpc.ErrorTypeNetwork:
            // 네트워크 오류
        case httpc.ErrorTypeTLS:
            // TLS 오류
        case httpc.ErrorTypeDNS:
            // DNS 해석 오류
        case httpc.ErrorTypeContextCanceled:
            // 컨텍스트 취소
        case httpc.ErrorTypeRetryExhausted:
            // 재시도 소진
        case httpc.ErrorTypeValidation:
            // 요청 검증 오류
        case httpc.ErrorTypeHTTP:
            // HTTP 계층 오류
        // 기타: ErrorTypeUnknown, ErrorTypeResponseRead,
        //       ErrorTypeTransport, ErrorTypeCertificate
        }
        if clientErr.IsRetryable() {
            // 재시도 가능
        }
    }
}
```

## 파일 다운로드

```go
dlResult, err := client.DownloadFile(url, "/path/to/file")

// 옵션 포함
dlCfg := httpc.DefaultDownloadConfig()
dlCfg.FilePath = "/path/to/file"
dlCfg.Overwrite = true
dlCfg.ResumeDownload = true
dlCfg.ProgressCallback = func(downloaded, total int64, speed float64) {
    fmt.Printf("\r%.1f%% (%s/s)", float64(downloaded)/float64(total)*100, httpc.FormatSpeed(speed))
}
dlResult, err := client.DownloadWithOptions(url, dlCfg)

// dlResult 유형은 *DownloadResult (*Result가 아님)
// 필드: FilePath, BytesWritten, Duration, AverageSpeed, StatusCode, ContentLength, Resumed, ResponseCookies, ActualChecksum
```

## 도메인 클라이언트

```go
dc, _ := httpc.NewDomain("https://api.example.com")
defer dc.Close()

dc.SetHeader("Authorization", "Bearer "+token)
result, _ := dc.Get("/users")
```
