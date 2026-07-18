---
sidebar_label: "Handler и цепочка middleware"
title: "Handler и цепочка middleware - CyberGo HTTPC | Конвейер"
description: "Архитектура конвейера Handler в HTTPC: методы API Layer 1 собирают луковую цепочку MiddlewareFunc из Handler-ов, комбинатор Chain и пример middleware."
sidebar_position: 1
---

# Handler и цепочка middleware

## Двухслойная архитектура

Обработка запросов в HTTPC — это сотрудничество двух слоев: метод API Layer 1 — **тонкая обёртка**, а настоящий движок обработки запросов — конвейер Handler на Layer 2. Выполнение каждого запроса сводится к «собрать и выполнить цепочку Handler».

```text
Двухслойная архитектура HTTPC
├── Layer 1  Метод API (тонкая обёртка)
│     Функции пакета httpc.Get/Post/... + методы Client + параметры запроса
│     → внутренне единообразно через client.Request → executeRequest
│
└── Layer 2  Конвейер Handler (движок обработки запросов)
      clientImpl.middlewareChain = Chain(middlewares...)(finalHandler)
      Луковая цепочка MiddlewareFunc(Handler) → сборка → выполнение
```

Когда клиент настроен с middleware, `executeRequest` применяет параметры запроса к `RequestMutator` и передаёт его в `clientImpl.middlewareChain` для выполнения; без middleware запрос отправляется напрямую в движок. Эта цепочка — Handler, который `buildMiddlewareChain` собирает один раз при `New()` и кэширует в поле `clientImpl.middlewareChain`.

## Handler

```go
type Handler func(ctx context.Context, req RequestMutator) (ResponseMutator, error)
```

Базовая сигнатура функции обработки запроса. Она принимает контекст и мутатор запроса, возвращая мутатор ответа или ошибку. Терминальный Handler в конце цепочки (`finalHandler`) отвечает за перенаправление переписанных middleware полей запроса в низкоуровневый движок для фактической отправки сетевого запроса.

## MiddlewareFunc

```go
type MiddlewareFunc func(Handler) Handler
```

Сигнатура функции middleware: принимает «следующий Handler» и возвращает обёрнутый Handler. Middleware может вставлять логику до и после вызова `next` (переписывание запроса, логирование ответа, восстановление после panic и т. д.), образуя луковую модель: первое middleware — самый внешний слой, входит первым и выходит последним.

```text
Направление входа запроса →

[Middleware A] → [Middleware B] → [Middleware C] → finalHandler → движок
                                                                   ↓
Направление возврата ответа ←   ←   ←   ←   ←   ←   ←   ←   ←   ←   ↓
```

Middleware настраиваются в срезе `MiddlewareConfig.Middlewares`; middleware, находящийся **раньше** в срезе, располагается на **внешнем** слое цепочки.

## Chain

```go
func Chain(middlewares ...MiddlewareFunc) MiddlewareFunc
```

Объединяет несколько middleware в одно. Возвращаемый комбинатор принимает финальный Handler и вкладывает middleware снаружи внутрь в порядке передачи: первое middleware в срезе оборачивает самый внешний слой (выполняется первым), последнее прилегает непосредственно к финальному Handler. HTTPC использует это внутренне для сборки `MiddlewareConfig.Middlewares` в цепочку.

```go
// Две формы эквивалентны: Chain собирает и внедряет однократно,
// либо ручное вложение слой за слоем — результат одинаков
combined := httpc.Chain(mwA, mwB, mwC)
chain := combined(finalHandler)

// Эквивалентно ручному вложению
chain := mwA(mwB(mwC(finalHandler)))
```

## Пример собственного middleware

Полное middleware для замера времени: фиксирует затраченное время до и после запроса, внедряется в клиент через `MiddlewareConfig.Middlewares`.

```go
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/cybergodev/httpc"
)

// timingMiddleware фиксирует затраченное время каждого запроса
func timingMiddleware() httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			start := time.Now()
			// Вызываем следующий Handler, чтобы запрос продолжил движение по цепочке
			resp, err := next(ctx, req)
			fmt.Printf("%s %s -> затрачено %v\n", req.Method(), req.URL(), time.Since(start))
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
	// Пример вывода:
	// GET https://httpbin.org/get -> затрачено 123.456ms
	// 200
}
```

:::tip
`resp`, возвращаемое middleware, должен передаваться обратно без изменений (или через последующий вызов `next`); иначе ответ утекает из пула объектов движка. Возврат `(nil, error)` при удержании неосвобождённого ответа приводит к утечке пула.
:::

## См. также

- [Встроенное ПО](../client-config/middleware) — 8 готовых фабрик middleware, таких как Recovery/Logging/Timeout
- [Мутаторы запросов и ответов](./mutators) — полный контракт методов для `RequestMutator`/`ResponseMutator`
- [Интерфейсы](../types/interfaces) — определения псевдонимов типов для `Handler`/`MiddlewareFunc`
