---
sidebar_label: "Handler와 미들웨어 체인"
title: "Handler와 미들웨어 체인 - CyberGo HTTPC | 요청 처리 파이프라인"
description: "HTTPC Handler 파이프라인 아키텍처 해설: 이중 계층 설계에서 Layer 1 패키지 함수가 MiddlewareFunc 양파 체인을 조립해 Handler를 실행하는 방식, Chain 결합기 원리와 커스텀 미들웨어 작성 예제."
sidebar_position: 1
---

# Handler와 미들웨어 체인

## 이중 계층 아키텍처

HTTPC의 요청 처리는 두 계층의 협력으로 이루어집니다. Layer 1의 메서드 API는 **얇은 래퍼**이며, 실제 요청을 처리하는 엔진은 Layer 2의 Handler 파이프라인입니다. 모든 요청 실행은 "Handler 체인을 조립하고 실행한다"는 것으로 귀결됩니다.

```text
HTTPC 이중 계층 아키텍처
├── Layer 1  메서드 API (얇은 래퍼)
│     패키지 함수 httpc.Get/Post/... + Client 메서드 + 요청 옵션
│     → 내부적으로 client.Request → executeRequest로 통일
│
└── Layer 2  Handler 파이프라인 (요청 처리 엔진)
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      MiddlewareFunc(Handler) 양파 체인 → 조립 → 실행
```

클라이언트에 미들웨어가 설정된 경우, `executeRequest`는 요청 옵션을 `RequestMutator`에 적용한 뒤 `clientImpl.middlewareChain`에 전달하여 실행합니다. 미들웨어가 없으면 엔진으로 직접 요청을 보냅니다. 이 체인이 바로 `buildMiddlewareChain`이 `New()` 시점에 한 번 조립하여 `clientImpl.middlewareChain` 필드에 캐시한 Handler입니다.

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

요청 처리의 핵심 함수 시그니처입니다. 컨텍스트와 요청 뮤테이터를 받아 응답 뮤테이터 또는 오류를 반환합니다. 체인의 끝에 있는 Handler(`finalHandler`)는 미들웨어가 다시 쓴 요청 필드를 하위 엔진으로 전달하여 실제 네트워크 요청을 보낼 책임을 집니다.

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

미들웨어 함수 시그니처로, "다음 Handler"를 받아 래핑된 Handler를 반환합니다. 미들웨어는 `next` 호출 전후에 로직을 삽입(요청 다시 쓰기, 응답 기록, panic 복구 등)하여 양파 모델을 형성합니다. 첫 번째 미들웨어가 가장 바깥 계층으로 가장 먼저 진입하고 가장 마지막에 빠져나옵니다.

```text
요청 진입 방향 →

[Middleware A] → [Middleware B] → [Middleware C] → finalHandler → 엔진
                                                                   ↓
응답 반환 방향 ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ↓
```

미들웨어는 `MiddlewareConfig.Middlewares` 슬라이스에 순서대로 설정되며, 슬라이스에서 **앞에 있는** 미들웨어가 체인의 **바깥 계층**에 위치합니다.

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

여러 미들웨어를 단일 미들웨어로 결합합니다. 반환된 결합기는 최종 Handler를 받아 미들웨어를 전달 순서대로 바깥에서 안쪽으로 중첩합니다. 슬라이스의 첫 번째 미들웨어가 가장 바깥 계층(가장 먼저 실행)을 감싸고, 마지막 미들웨어가 최종 Handler에 바로 맞닿습니다. HTTPC는 내부적으로 이것을 사용해 `MiddlewareConfig.Middlewares`를 체인으로 조립합니다.

```go
// 두 형태는 동일합니다: Chain으로 조합한 뒤 한 번에 주입하거나
// 수동으로 계층별로 중첩하거나 결과가 같습니다
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// 수동 중첩과 동일
chain := mwA(mwB(mwC(finalHandler)))
```

## 커스텀 미들웨어 예제

요청 전후의 소요 시간을 기록하는 완전한 타이밍 미들웨어로, `MiddlewareConfig.Middlewares`를 통해 클라이언트에 주입합니다.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware는 각 요청의 소요 시간을 기록합니다
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// 다음 Handler를 호출하여 요청이 체인을 따라 계속 전달되도록 합니다
			resp, err := next(ctx, req)
			fmt.Printf("%s %s -> 소요 %v\n", req.Method(), req.URL(), time.Since(start))
			return resp, err
		}
	}
}

func main() {
	client, err := httpc.New(&httpc.Config{
		Middleware: &httpc.MiddlewareConfig{
			Middlewares: []httpc.MiddlewareFunc{
				timingMiddleware(),
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
	fmt.Println(result.StatusCode())
	// 출력 예시:
	// GET https://httpbin.org/get -> 소요 123.456ms
	// 200
}
```

:::tip
미들웨어가 반환하는 `resp`는 그대로(또는 이후 `next` 호출을 통해) 다시 전달되어야 합니다. 그렇지 않으면 엔진 객체 풀의 응답이 누수됩니다. 해제되지 않은 응답을 보유한 채 `(nil, error)`를 반환하면 풀 누수가 발생합니다.
:::

## 참고

- [내장 미들웨어](../client-config/middleware) — Recovery/Logging/Timeout 등 8개의 바로 사용 가능한 미들웨어 팩토리
- [요청과 응답 뮤테이터](./mutators) — `RequestMutator`/`ResponseMutator`의 전체 메서드 계약
- [인터페이스](../types/interfaces) — `Handler`/`MiddlewareFunc`의 타입 별칭 정의
