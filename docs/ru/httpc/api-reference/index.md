---
sidebar_label: "Обзор"
title: "Справочник API - CyberGo HTTPC | Полный указатель"
description: "Индекс справочника API HTTPC: навигация по группам ядро, запросы/ответы и продвинутые функции — функции, опции, пресеты, middleware, загрузки и ошибки."
sidebar_position: 1
---

# Справочник API

HTTPC предоставляет 28 функций параметров запроса, 5 предустановок конфигурации, 8 встроенных промежуточных ПО и полную поддержку загрузки файлов.

## Основная архитектура

HTTPC использует двухслойную архитектуру: метод API Layer 1 — тонкая обёртка, а настоящий движок обработки запросов — конвейер Handler на Layer 2.

```text
Двухслойная архитектура HTTPC
├── Layer 1  Метод API (тонкая обёртка)
│     Функции пакета httpc.Get/Post/... + методы Client + параметры запроса → Result
│
└── Layer 2  Конвейер Handler (движок обработки запросов)
      Луковая цепочка MiddlewareFunc(Handler)
      → сборка clientImpl.middlewareChain
      → выполнение (каждый запрос = сборка и запуск цепочки Handler)
```

## Навигация по модулям

### Ядро

| Модуль | Описание |
|--------|----------|
| [Функции пакета и методы клиента](./core/functions) | Функции уровня пакета Get/Post/Put/Patch/Delete и др., методы клиента и вспомогательные функции |
| [Конфигурация](./client-config/config) | Структура Config, 5 предустановок конфигурации, функции валидации и безопасность Cookie |
| [Интерфейсы](./types/interfaces) | Основные интерфейсы Client, Doer, DomainClienter, RetryPolicy и др. |
| [Result](./core/result) | Типы Result, RequestInfo, ResponseInfo, RequestMeta и все методы |
| [Конвейер обработчиков](./handler/handler-chain) | Конвейер Handler, луковая цепочка MiddlewareFunc, комбинатор Chain и контракты мутаторов |

### Запросы и ответы

| Модуль | Описание |
|--------|----------|
| [Параметры запроса](./core/options) | 28 функций параметров запроса WithXxx (заголовки, тело, аутентификация, Cookie, обратные вызовы и др.) |
| [Промежуточное ПО](./client-config/middleware) | Композиция Chain, 8 встроенных фабрик промежуточного ПО и типы событий аудита |
| [Типы ошибок](./types/errors) | ClientError, 12 типов перечисления ErrorType и 12 переменных ошибок |

### Продвинутые функции

| Модуль | Описание |
|--------|----------|
| [Доменный клиент](./client-config/domain-client) | Создание DomainClient, HTTP-методы, методы загрузки и правила объединения URL |
| [Управление сессиями](./client-config/session) | Управление Cookie/заголовками SessionManager и проверка безопасности |
| [Загрузка файлов](./client-config/download) | Функции загрузки, DownloadConfig, докачка и защита |
| [Константы и типы](./types/constants) | Перечисление BodyKind, FormData/FileData и ключи контекста аудита |

## Краткий справочник

### Создание клиента

```go
client, err := httpc.New()                    // конфигурация по умолчанию
client, err := httpc.New(httpc.SecureConfig()) // безопасная предустановка
client, err := httpc.New(customConfig)         // пользовательская конфигурация
```

### Отправка запросов

```go
// Функции пакета
result, err := httpc.Get(url, options...)

// Методы клиента
result, err := client.Get(url, options...)

// С контекстом
result, err := client.Request(ctx, "GET", url, options...)
```

### Обработка ответов

```go
result.StatusCode()           // код состояния
result.Body()                 // тело ответа (строка)
result.RawBody()              // тело ответа (байты)
result.Unmarshal(&data)       // парсинг JSON
result.IsSuccess()            // является ли 2xx
result.Meta.Duration          // время выполнения запроса
result.Meta.Attempts          // количество повторных попыток
```
