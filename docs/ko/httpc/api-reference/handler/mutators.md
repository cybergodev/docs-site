---
sidebar_label: "요청과 응답 뮤테이터"
title: "요청과 응답 뮤테이터 - CyberGo HTTPC | Mutator 인터페이스"
description: "HTTPC 미들웨어 읽기/쓰기 계약 해설: RequestMutator와 ResponseMutator는 모든 읽기/쓰기 메서드를 노출하는 합성 인터페이스로, 헤더 설정과 상태 코드 읽기 예제를 컴파일 가능한 형태로 제공합니다."
sidebar_position: 2
---

# 요청과 응답 뮤테이터

미들웨어는 기저의 요청/응답 객체를 직접 다루지 않고 **뮤테이터** 인터페이스를 통해 읽고 씁니다. 미들웨어는 항상 완전한 읽기/쓰기 뮤테이터(`RequestMutator` / `ResponseMutator`)를 전달받으며, 아래의 읽기/쓰기 그룹화는 가독성을 위한 것일 뿐 별도로 내보낸 인터페이스는 아닙니다.

```text
RequestMutator  = 읽기 메서드  + 쓰기 메서드
ResponseMutator = 읽기 메서드 + 쓰기 메서드
        ↑                                    ↑
  미들웨어가 RequestMutator로      미들웨어가 ResponseMutator로
  요청을 다시 씀                    응답을 읽거나 다시 씀
```

`Handler` 시그니처 `func(ctx, RequestMutator) (ResponseMutator, error)`가 정확히 이 두 뮤테이터를 미들웨어의 진입점과 출구로 노출합니다.

## 요청 뮤테이터

### 읽기 메서드

다음 메서드는 요청 데이터를 읽습니다. 미들웨어가 요청 속성을 **검사**만 할 때 호출합니다.

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `Method()` | `string` | HTTP 메서드 |
| `URL()` | `string` | 요청 URL |
| `Headers()` | `map[string]string` | 전체 요청 헤더 |
| `QueryParams()` | `map[string]any` | 쿼리 매개변수 |
| `Body()` | `any` | 요청 본문 |
| `Timeout()` | `time.Duration` | 요청 타임아웃 |
| `MaxRetries()` | `int` | 최대 재시도 횟수 |
| `Context()` | `context.Context` | 요청 컨텍스트 |
| `Cookies()` | `[]http.Cookie` | 요청 Cookie |
| `FollowRedirects()` | `*bool` | 리다이렉트 따를지 여부 |
| `MaxRedirects()` | `*int` | 최대 리다이렉트 횟수 |
| `StreamBody()` | `bool` | 요청 본문 스트리밍 여부 |

### 쓰기 메서드

다음 메서드는 요청 데이터를 수정합니다. 미들웨어가 요청 속성을 **수정**만 할 때 호출합니다.

| 메서드 | 설명 |
|--------|------|
| `SetMethod(string)` | HTTP 메서드 설정 |
| `SetURL(string)` | URL 설정 |
| `SetHeaders(map[string]string)` | 전체 요청 헤더 설정 |
| `SetHeader(key, value string)` | 단일 요청 헤더 설정 |
| `SetQueryParams(map[string]any)` | 쿼리 매개변수 설정 |
| `SetBody(any)` | 요청 본문 설정 |
| `SetTimeout(time.Duration)` | 타임아웃 설정 |
| `SetMaxRetries(int)` | 최대 재시도 횟수 설정 |
| `SetContext(context.Context)` | 컨텍스트 설정 |
| `SetCookies([]http.Cookie)` | Cookie 설정 |
| `SetFollowRedirects(*bool)` | 리다이렉트 따를지 여부 설정 |
| `SetMaxRedirects(*int)` | 최대 리다이렉트 횟수 설정 |
| `SetStreamBody(bool)` | 스트리밍 여부 설정 |

### RequestMutator

httpc가 노출하는 읽기/쓰기 겸용 요청 뮤테이터로, 위의 「읽기 메서드」와 「쓰기 메서드」 두 표의 모든 메서드를 포함합니다. 내부 읽기/쓰기 분할 인터페이스는 `internal/types` 패키지에 있으며 별도로 내보내지 않고, 외부에서는 `RequestMutator`로 통일되어 참조됩니다. 미들웨어가 요청이 전송되기 전에 이를 통해 요청 속성을 검사하고 다시 씁니다.

## 응답 뮤테이터

### 읽기 메서드

다음 메서드는 응답 데이터를 읽습니다.

| 메서드 | 반환 타입 | 설명 |
|--------|-----------|------|
| `StatusCode()` | `int` | 상태 코드 |
| `Status()` | `string` | 상태 텍스트 |
| `Proto()` | `string` | 프로토콜 버전 |
| `Headers()` | `http.Header` | 응답 헤더 |
| `Body()` | `string` | 응답 본문 (문자열) |
| `RawBody()` | `[]byte` | 응답 본문 (바이트) |
| `ContentLength()` | `int64` | 콘텐츠 길이 |
| `Duration()` | `time.Duration` | 요청 소요 시간 |
| `Attempts()` | `int` | 시도 횟수 (재시도 포함) |
| `Cookies()` | `[]*http.Cookie` | 응답 Cookie |
| `RedirectChain()` | `[]string` | 리다이렉트 체인 |
| `RedirectCount()` | `int` | 리다이렉트 횟수 |
| `RequestHeaders()` | `http.Header` | 요청 헤더 |
| `RequestURL()` | `string` | 요청 URL |
| `RequestMethod()` | `string` | 요청 메서드 |

### 쓰기 메서드

다음 메서드는 응답 데이터를 수정합니다.

| 메서드 | 설명 |
|--------|------|
| `SetStatusCode(int)` | 상태 코드 설정 |
| `SetStatus(string)` | 상태 텍스트 설정 |
| `SetProto(string)` | 프로토콜 버전 설정 |
| `SetHeaders(http.Header)` | 응답 헤더 설정 |
| `SetBody(string)` | 응답 본문 설정 |
| `SetRawBody([]byte)` | 응답 본문 (바이트) 설정 |
| `SetContentLength(int64)` | 콘텐츠 길이 설정 |
| `SetDuration(time.Duration)` | 소요 시간 설정 |
| `SetAttempts(int)` | 시도 횟수 설정 |
| `SetCookies([]*http.Cookie)` | Cookie 설정 |
| `SetRedirectChain([]string)` | 리다이렉트 체인 설정 |
| `SetRedirectCount(int)` | 리다이렉트 횟수 설정 |
| `SetRequestHeaders(http.Header)` | 요청 헤더 설정 |
| `SetRequestURL(string)` | 요청 URL 설정 |
| `SetRequestMethod(string)` | 요청 메서드 설정 |
| `SetHeader(key string, values ...string)` | 단일 응답 헤더 설정 |

### ResponseMutator

httpc가 노출하는 읽기/쓰기 겸용 응답 뮤테이터로, 위의 「읽기 메서드」와 「쓰기 메서드」 두 표의 모든 메서드를 포함합니다. 내부 읽기/쓰기 분할 인터페이스는 `internal/types` 패키지에 있으며 별도로 내보내지 않고, 외부에서는 `ResponseMutator`로 통일되어 참조됩니다. 미들웨어가 요청 완료 후 이를 통해 응답을 읽거나 다시 씁니다. 응답 캐싱, 콘텐츠 변환(예: JSON pretty-print), 인코딩/디코딩, 응답 필터링에 유용합니다.

## 예제: 뮤테이터로 읽고 쓰기

`RequestMutator.SetHeader`로 인증 헤더를 주입하고 `ResponseMutator.StatusCode`로 응답 상태 코드를 읽는 인증 미들웨어입니다.

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// authMiddleware는 RequestMutator로 인증 헤더를 주입하고
// ResponseMutator로 상태 코드를 읽습니다
func authMiddleware(token string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// 쓰기: RequestMutator로 요청 헤더 설정
			req.SetHeader("Authorization", "Bearer "+token)
			// 읽기: RequestMutator로 요청 메서드 검사
			fmt.Printf("%s 요청 전송\n", req.Method())

			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// 읽기: ResponseMutator로 상태 코드 획득
			fmt.Printf("상태 코드 %d 수신\n", resp.StatusCode())
			return resp, nil
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				authMiddleware("my-secret-token"),
			},
		},
	})
	if err != nil {
		panic(err)
	}
	defer client.Close()

	result, err := client.Get("https://httpbin.org/get")
	if err != nil {
		panic(err)
	}
	fmt.Println(result.IsSuccess())
	// 출력 예시:
	// GET 요청 전송
	// 상태 코드 200 수신
	// true
}
```

## 참고

- [Handler와 미들웨어 체인](./handler-chain) — 이중 계층 아키텍처와 양파 모델 개요
- [내장 미들웨어](../client-config/middleware) — HeaderMiddleware 등은 뮤테이터로 동작하는 완성된 예제입니다
- [인터페이스](../types/interfaces) — 뮤테이터의 타입 별칭 정의
