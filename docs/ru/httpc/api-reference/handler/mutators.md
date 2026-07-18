---
sidebar_label: "Мутаторы запросов и ответов"
title: "Мутаторы запросов и ответов - CyberGo HTTPC | Интерфейсы"
description: "Контракты middleware: RequestMutator и ResponseMutator — составные интерфейсы со всеми методами чтения и записи, с компилируемым примером установки заголовка и чтения статуса."
sidebar_position: 2
---

# Мутаторы запросов и ответов

Middleware не взаимодействует с низкоуровневыми объектами запроса/ответа напрямую, а читает и пишет через **мутаторы** (Mutator). Middleware всегда получает полный мутатор чтения-записи (`RequestMutator` / `ResponseMutator`); группировка методов чтения/записи ниже служит только для удобства чтения и не является отдельным экспортируемым интерфейсом.

```text
RequestMutator  = Методы чтения  + Методы записи
ResponseMutator = Методы чтения + Методы записи
        ↑                                    ↑
  middleware переписывает запрос       middleware читает/переписывает ответ
  через RequestMutator                 через ResponseMutator
```

Сигнатура `Handler` `func(ctx, RequestMutator) (ResponseMutator, error)` открывает именно эти два мутатора как точку входа и выхода для middleware.

## Мутатор запроса

### Методы чтения

Следующие методы читают данные запроса. Вызывайте их, когда middleware нужно лишь **инспектировать** свойства запроса.

| Метод | Возвращаемый тип | Описание |
|-------|------------------|----------|
| `Method()` | `string` | HTTP-метод |
| `URL()` | `string` | URL запроса |
| `Headers()` | `map[string]string` | Все заголовки запроса |
| `QueryParams()` | `map[string]any` | Параметры запроса |
| `Body()` | `any` | Тело запроса |
| `Timeout()` | `time.Duration` | Таймаут запроса |
| `MaxRetries()` | `int` | Максимальное число повторов |
| `Context()` | `context.Context` | Контекст запроса |
| `Cookies()` | `[]http.Cookie` | Cookie запроса |
| `FollowRedirects()` | `*bool` | Следовать ли перенаправлениям |
| `MaxRedirects()` | `*int` | Максимальное число перенаправлений |
| `StreamBody()` | `bool` | Потоковая передача тела запроса |

### Методы записи

Следующие методы изменяют данные запроса. Вызывайте их, когда middleware нужно лишь **изменить** свойства запроса.

| Метод | Описание |
|-------|----------|
| `SetMethod(string)` | Установить HTTP-метод |
| `SetURL(string)` | Установить URL |
| `SetHeaders(map[string]string)` | Установить все заголовки запроса |
| `SetHeader(key, value string)` | Установить одиночный заголовок запроса |
| `SetQueryParams(map[string]any)` | Установить параметры запроса |
| `SetBody(any)` | Установить тело запроса |
| `SetTimeout(time.Duration)` | Установить таймаут |
| `SetMaxRetries(int)` | Установить максимальное число повторов |
| `SetContext(context.Context)` | Установить контекст |
| `SetCookies([]http.Cookie)` | Установить Cookie |
| `SetFollowRedirects(*bool)` | Установить следование перенаправлениям |
| `SetMaxRedirects(*int)` | Установить максимальное число перенаправлений |
| `SetStreamBody(bool)` | Установить потоковую передачу |

### RequestMutator

Мутатор запроса с чтением и записью, охватывающий все методы из таблиц «Методы чтения» и «Методы записи» выше. Внутренние подынтерфейсы чтения/записи находятся в пакете `internal/types` и не экспортируются отдельно — извне они доступны единообразно как `RequestMutator`. Middleware инспектирует и переписывает свойства запроса через него до отправки запроса.

## Мутатор ответа

### Методы чтения

Следующие методы читают данные ответа.

| Метод | Возвращаемый тип | Описание |
|-------|------------------|----------|
| `StatusCode()` | `int` | Код состояния |
| `Status()` | `string` | Текст состояния |
| `Proto()` | `string` | Версия протокола |
| `Headers()` | `http.Header` | Заголовки ответа |
| `Body()` | `string` | Тело ответа (строка) |
| `RawBody()` | `[]byte` | Тело ответа (байты) |
| `ContentLength()` | `int64` | Длина содержимого |
| `Duration()` | `time.Duration` | Время выполнения запроса |
| `Attempts()` | `int` | Число попыток (включая повторы) |
| `Cookies()` | `[]*http.Cookie` | Cookie ответа |
| `RedirectChain()` | `[]string` | Цепочка перенаправлений |
| `RedirectCount()` | `int` | Число перенаправлений |
| `RequestHeaders()` | `http.Header` | Заголовки запроса |
| `RequestURL()` | `string` | URL запроса |
| `RequestMethod()` | `string` | Метод запроса |

### Методы записи

Следующие методы изменяют данные ответа.

| Метод | Описание |
|-------|----------|
| `SetStatusCode(int)` | Установить код состояния |
| `SetStatus(string)` | Установить текст состояния |
| `SetProto(string)` | Установить версию протокола |
| `SetHeaders(http.Header)` | Установить заголовки ответа |
| `SetBody(string)` | Установить тело ответа |
| `SetRawBody([]byte)` | Установить тело ответа (байты) |
| `SetContentLength(int64)` | Установить длину содержимого |
| `SetDuration(time.Duration)` | Установить время выполнения |
| `SetAttempts(int)` | Установить число попыток |
| `SetCookies([]*http.Cookie)` | Установить Cookie |
| `SetRedirectChain([]string)` | Установить цепочку перенаправлений |
| `SetRedirectCount(int)` | Установить число перенаправлений |
| `SetRequestHeaders(http.Header)` | Установить заголовки запроса |
| `SetRequestURL(string)` | Установить URL запроса |
| `SetRequestMethod(string)` | Установить метод запроса |
| `SetHeader(key string, values ...string)` | Установить одиночный заголовок ответа |

### ResponseMutator

Мутатор ответа с чтением и записью, охватывающий все методы из таблиц «Методы чтения» и «Методы записи» выше. Внутренние подынтерфейсы чтения/записи находятся в пакете `internal/types` и не экспортируются отдельно — извне они доступны единообразно как `ResponseMutator`. Middleware читает или переписывает ответ через него после завершения запроса — удобно для кэширования ответов, преобразования содержимого (например, форматирования JSON), кодирования/декодирования и фильтрации ответов.

## Пример: чтение и запись через мутаторы

Middleware аутентификации, который внедряет заголовок авторизации через `RequestMutator.SetHeader` и читает код состояния ответа через `ResponseMutator.StatusCode`.

```go
package main

import (
	"context"
	"fmt"

	"github.com/cybergodev/httpc"
)

// authMiddleware внедряет заголовок авторизации через RequestMutator
// и читает код состояния через ResponseMutator
func authMiddleware(token string) httpc.MiddlewareFunc {
	return func(next httpc.Handler) httpc.Handler {
		return func(ctx context.Context, req httpc.RequestMutator) (httpc.ResponseMutator, error) {
			// Запись: устанавливаем заголовок запроса через RequestMutator
			req.SetHeader("Authorization", "Bearer "+token)
			// Чтение: инспектируем метод запроса через RequestMutator
			fmt.Printf("Отправка %s-запроса\n", req.Method())

			resp, err := next(ctx, req)
			if err != nil {
				return nil, err
			}
			// Чтение: получаем код состояния через ResponseMutator
			fmt.Printf("Получен код состояния %d\n", resp.StatusCode())
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
	// Пример вывода:
	// Отправка GET-запроса
	// Получен код состояния 200
	// true
}
```

## См. также

- [Handler и цепочка middleware](./handler-chain) — обзор двухслойной архитектуры и луковой модели
- [Встроенное ПО](../client-config/middleware) — HeaderMiddleware и другие являются готовыми примерами, работающими через мутаторы
- [Интерфейсы](../types/interfaces) — определения псевдонимов типов для мутаторов
