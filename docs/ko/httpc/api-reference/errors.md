---
title: "오류 타입 - HTTPC"
description: "HTTPC 오류 타입 API 레퍼런스: ClientError 구조체 8개 필드 및 Code, IsRetryable, Unwrap 등 5개 메서드, ErrorTypeNetwork 등 12가지 ErrorType 열거형, ErrNilConfig 등 13개 센티넬 오류 변수와 errors.Is/As 매칭 예제."
---

# 오류 타입

## ClientError

```go
type ClientError = engine.ClientError
```

분류된 HTTP 클라이언트 오류로, `errors.As`로 추출합니다.

### 구조체 필드

```go
type ClientError struct {
    Type       ErrorType  // 오류 분류
    Message    string     // 오류 설명
    Cause      error      // 기저 오류
    URL        string     // 요청 URL (마스킹됨)
    Method     string     // HTTP 메서드
    Attempts   int        // 시도한 횟수
    StatusCode int        // HTTP 상태 코드 (해당하는 경우)
    Host       string     // 호스트 이름 (서킷 브레이커용)
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `Type` | `ErrorType` | 오류 분류, switch 판단에 사용 |
| `Message` | `string` | 오류 설명 정보 |
| `Cause` | `error` | 기저 오류, `Unwrap()`으로 가져올 수 있음 |
| `URL` | `string` | 요청 URL (자격 증명 마스킹됨) |
| `Method` | `string` | HTTP 메서드 (GET, POST 등) |
| `Attempts` | `int` | 재시도한 횟수 |
| `StatusCode` | `int` | HTTP 상태 코드 (HTTP 오류가 아닌 경우 0) |
| `Host` | `string` | 요청 호스트 이름 |

### 메서드

| 메서드 | 반환값 | 설명 |
|------|--------|------|
| `Error()` | `string` | `METHOD URL: Message: Cause (attempt N)` 형식 |
| `Code()` | `string` | 읽을 수 있는 오류 코드, 예: `"NETWORK_ERROR"`, `"TIMEOUT"` |
| `IsRetryable()` | `bool` | 재시도 가능 여부 |
| `Unwrap()` | `error` | 기저 오류 언래핑 |
| `WithType(t ErrorType)` | `*ClientError` | 오류 타입이 설정된 사본 반환 (원본 수정 없음) |

```go
var clientErr *httpc.ClientError
if errors.As(err, &clientErr) {
    fmt.Println("오류 코드:", clientErr.Code())
    fmt.Println("요청 URL:", clientErr.URL)
    fmt.Println("재시도 횟수:", clientErr.Attempts)
    fmt.Println("재시도 가능:", clientErr.IsRetryable())
    fmt.Println("기저 오류:", clientErr.Unwrap())
}
```

## ErrorType

```go
type ErrorType = engine.ErrorType
```

오류 분류 열거형.

| 상수 | 설명 | 재시도 가능 |
|------|------|--------|
| `ErrorTypeUnknown` | 알 수 없음/미분류 오류 | 아니요 |
| `ErrorTypeNetwork` | 네트워크 오류 (연결 거부, DNS 실패 등) | 상황에 따라 |
| `ErrorTypeTimeout` | 요청 시간 초과 | 예 |
| `ErrorTypeContextCanceled` | 컨텍스트 취소 | 아니요 |
| `ErrorTypeResponseRead` | 응답 본문 읽기 오류 | 상황에 따라 |
| `ErrorTypeTransport` | 전송 계층 오류 | 예 |
| `ErrorTypeRetryExhausted` | 재시도 소진 | 아니요 |
| `ErrorTypeTLS` | TLS 오류 | 아니요 |
| `ErrorTypeCertificate` | 인증서 검증 오류 | 아니요 |
| `ErrorTypeDNS` | DNS 해석 오류 | 상황에 따라 |
| `ErrorTypeValidation` | 요청 검증 오류 | 아니요 |
| `ErrorTypeHTTP` | HTTP 계층 오류 | 상황에 따라 |

### 타입 판별

```go
result, err := client.Get(url)
if err != nil {
    var clientErr *httpc.ClientError
    if errors.As(err, &clientErr) {
        switch clientErr.Type {
        case httpc.ErrorTypeTimeout:
            log.Println("요청 시간 초과")
        case httpc.ErrorTypeNetwork:
            log.Println("네트워크 오류")
        case httpc.ErrorTypeTLS:
            log.Println("TLS 오류")
        case httpc.ErrorTypeCertificate:
            log.Println("인증서 검증 실패")
        case httpc.ErrorTypeDNS:
            log.Println("DNS 해석 실패")
        case httpc.ErrorTypeRetryExhausted:
            log.Println("재시도 소진")
        case httpc.ErrorTypeContextCanceled:
            log.Println("요청 취소됨")
        case httpc.ErrorTypeValidation:
            log.Println("요청 검증 실패")
        }
    }
}
```

## 오류 변수

### 구성 오류

| 변수 | 설명 |
|------|------|
| `ErrNilConfig` | 구성이 nil |
| `ErrInvalidTimeout` | 타임아웃 값이 유효하지 않음 |
| `ErrInvalidRetry` | 재시도 구성이 유효하지 않음 |
| `ErrInvalidConnection` | 연결 구성이 유효하지 않음 |
| `ErrInvalidSecurity` | 보안 구성이 유효하지 않음 |
| `ErrInvalidMiddleware` | 미들웨어 구성이 유효하지 않음 |

### 요청 오류

| 변수 | 설명 |
|------|------|
| `ErrInvalidURL` | URL 검증 실패 |
| `ErrInvalidHeader` | 요청 헤더 검증 실패 |

### 응답 오류

| 변수 | 설명 |
|------|------|
| `ErrResponseBodyEmpty` | 응답 본문이 비어 있음 |
| `ErrResponseBodyTooLarge` | 응답 본문이 크기 제한 초과 |

### 파일 오류

| 변수 | 설명 |
|------|------|
| `ErrEmptyFilePath` | 파일 경로가 비어 있음 |
| `ErrFileExists` | 파일이 이미 존재함 |

### 클라이언트 오류

| 변수 | 설명 |
|------|------|
| `ErrClientClosed` | 클라이언트가 이미 닫힘 |

### 변수 매칭

```go
if errors.Is(err, httpc.ErrClientClosed) {
    // 클라이언트가 이미 닫힘
}
if errors.Is(err, httpc.ErrResponseBodyEmpty) {
    // 응답 본문이 비어 있음
}
```

## 참고

- [오류 처리](../advanced/error-handling) - 완전한 오류 처리 가이드
- [상수와 열거형](./constants) - BodyKind 등 상수 참조
- [재시도와 장애 허용](../guides/retry-fault-tolerance) - 재시도 전략 가이드
