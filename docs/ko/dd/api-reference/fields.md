---
title: "구조화된 필드 - CyberGo DD | Field 생성자"
description: "CyberGo DD 구조화된 필드 생성자 전체 API 문서. 20여 종의 타입 안전한 필드 생성을 지원하며, String/Int/Float/Bool 등 기본 필드, Time/Duration 시간 필드, Error 오류 필드, Any 객체 필드 및 커스텀 필드를 포함하여 편리한 체인 호출 조합 방식을 제공합니다."
---

# 구조화된 필드

DD는 20개 이상의 타입 안전한 필드 생성자를 제공하여 구조화된 로그 출력에 사용합니다.

## 기본 필드

| 생성자 | 서명 | 설명 |
|--------|------|------|
| `Any` | `(key string, value any) Field` | 임의 타입 |
| `String` | `(key, value string) Field` | 문자열 |
| `Bool` | `(key string, value bool) Field` | 불리언 |
| `Err` | `(err error) Field` | 오류 (key는 "error") |
| `ErrWithKey` | `(key string, err error) Field` | 커스텀 key의 오류 |
| `ErrWithStack` | `(err error) Field` | 스택 정보가 포함된 오류 |

## 숫자 필드

| 생성자 | 타입 | 예시 |
|--------|------|------|
| `Int` | `int` | `dd.Int("count", 42)` |
| `Int8` | `int8` | `dd.Int8("flags", 1)` |
| `Int16` | `int16` | `dd.Int16("port", 8080)` |
| `Int32` | `int32` | `dd.Int32("code", 200)` |
| `Int64` | `int64` | `dd.Int64("id", 123456789)` |
| `Uint` | `uint` | `dd.Uint("size", 1024)` |
| `Uint8` | `uint8` | `dd.Uint8("level", 3)` |
| `Uint16` | `uint16` | `dd.Uint16("year", 2026)` |
| `Uint32` | `uint32` | `dd.Uint32("seq", 1000)` |
| `Uint64` | `uint64` | `dd.Uint64("hash", 0xABCD)` |
| `Float32` | `float32` | `dd.Float32("rate", 0.95)` |
| `Float64` | `float64` | `dd.Float64("elapsed", 1.234)` |

## 시간 필드

| 생성자 | 서명 | 설명 |
|--------|------|------|
| `Time` | `(key string, value time.Time) Field` | 타임스탬프 |
| `Duration` | `(key string, value time.Duration) Field` | 기간 |

## 오류 필드

```go
// 표준 오류 필드 (key는 "error")
dd.Err(err)

// 커스텀 key
dd.ErrWithKey("db_error", err)

// 스택 정보 포함
dd.ErrWithStack(err)
```

## 사용 방법

### InfoWith와 조합

```go
dd.InfoWith("사용자 로그인",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### WithFields 체인 호출

```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("서비스 시작")
```

### Entry에 추가

```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("응답",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## 타입 정의

`Field`는 구조화된 로그 필드 타입으로, `Key`(문자열)와 `Value`(임의 값) 두 필드를 포함하며, 생성자를 통해 생성됩니다.

## 다음 단계

- [Logger](./logger) -- WithFields / InfoWith 메서드
- [LoggerEntry](./entry) -- 사전 설정 필드 체인 호출
- [컨텍스트 통합](./context) -- ContextExtractor로 필드 추출
