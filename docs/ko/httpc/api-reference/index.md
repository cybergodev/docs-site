---
title: "API 레퍼런스 - CyberGo HTTPC | API 전체 색인"
description: "HTTPC API 레퍼런스 색인: 핵심, 요청 응답, 고급 기능으로 분류된 탐색으로 패키지 함수, 요청 옵션, 설정 프리셋, 미들웨어, 도메인 클라이언트, 파일 다운로드, 오류 타입의 완전한 참조 진입점을 제공합니다."
---

# API 레퍼런스

HTTPC는 28개의 요청 옵션 함수, 5개의 설정 프리셋, 8개의 내장 미들웨어와 완전한 다운로드 지원을 제공합니다.

## 핵심 아키텍처

```text
httpc 패키지
├── Client 인터페이스 - 메인 클라이언트, 모든 HTTP 메서드 지원
├── DomainClienter 인터페이스 - 도메인 범위 클라이언트, 세션 관리 내장
├── Config - 설정 시스템 (타임아웃/연결/보안/재시도/미들웨어)
├── RequestOption - 28개 요청 옵션 함수
├── MiddlewareFunc - 미들웨어 체인
├── Result - 응답 결과 (요청 메타데이터 포함)
└── 패키지 함수 - 클라이언트 생성 없이 사용 가능
```

## 모듈 탐색

### 핵심

| 모듈 | 설명 |
|------|------|
| [패키지 함수](./functions) | Get/Post/Put/Patch/Delete 등 패키지 함수, 클라이언트 메서드와 보조 함수 |
| [설정](./config) | Config 구조체, 5가지 프리셋 설정, 검증 함수와 Cookie 보안 |
| [인터페이스](./interfaces) | Client, Doer, DomainClienter, RetryPolicy 등 핵심 인터페이스 |
| [Result](./result) | Result, RequestInfo, ResponseInfo, RequestMeta 타입과 모든 메서드 |

### 요청과 응답

| 모듈 | 설명 |
|------|------|
| [요청 옵션](./options) | 28개 WithXxx 요청 옵션 함수 (요청 헤더, 본문, 인증, Cookie, 콜백 등) |
| [미들웨어](./middleware) | Chain 조합, 8개 내장 미들웨어 팩토리와 감사 이벤트 타입 |
| [오류 타입](./errors) | ClientError, 12가지 ErrorType 열거와 12개 오류 변수 |

### 고급 기능

| 모듈 | 설명 |
|------|------|
| [도메인 클라이언트](./domain-client) | DomainClient 생성, HTTP 메서드, 다운로드 메서드와 URL 조합 규칙 |
| [세션 관리](./session) | SessionManager의 Cookie/요청 헤더 관리와 보안 검증 |
| [파일 다운로드](./download) | 다운로드 함수, DownloadConfig, 이어받기와 보안 보호 |
| [상수와 타입](./constants) | BodyKind 열거, FormData/FileData와 감사 컨텍스트 키 |

## 빠른 참조

### 클라이언트 생성

```go
client, err := httpc.New()                    // 기본 설정
client, err := httpc.New(httpc.SecureConfig()) // 보안 프리셋
client, err := httpc.New(customConfig)         // 커스텀 설정
```

### 요청 전송

```go
// 패키지 함수
result, err := httpc.Get(url, options...)

// 클라이언트 메서드
result, err := client.Get(url, options...)

// 컨텍스트 포함
result, err := client.Request(ctx, "GET", url, options...)
```

### 응답 처리

```go
result.StatusCode()           // 상태 코드
result.Body()                 // 응답 본문 (문자열)
result.RawBody()              // 응답 본문 (바이트)
result.Unmarshal(&data)       // JSON 파싱
result.IsSuccess()            // 2xx 여부
result.Meta.Duration          // 요청 소요 시간
result.Meta.Attempts          // 재시도 횟수
```
