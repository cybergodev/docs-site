---
sidebar_label: "Обзор"
title: "Справочник API - CyberGo JWT | Полная документация"
description: "Обзор API CyberGo JWT: навигация по функциям пакета, методам Processor, Config, Claims, RegisteredClaims, интерфейсам, типам и 19 ошибкам."
sidebar_position: 1
---

# Справочник API

Библиотека CyberGo JWT предоставляет полный API для управления жизненным циклом JWT токенов.

## Структура модулей

| Модуль | Описание | Подробности |
|--------|----------|-------------|
| [Функции пакета](./functions) | `New`, `DefaultConfig`, `NewRateLimiter` и другие фабричные функции | Создание и инициализация |
| [Processor](./processor) | Основные методы создания, проверки, обновления и отзыва токенов | Основные операции |
| [Config](./config) | Структуры конфигурации `Config`, `BlacklistConfig` | Управление конфигурацией |
| [Claims](./claims) | Типы утверждений `Claims`, `RegisteredClaims` | Утверждения токена |
| [Определения интерфейсов](./interfaces) | `TokenManager`, `CustomClaims`, `BlacklistStore` и другие | Интерфейсы расширения |
| [Типы и константы](./types) | Константы алгоритмов подписи, `NumericDate`, `StringOrSlice` и другие | Вспомогательные типы |
| [Ошибки](./errors) | **19** сигнальных ошибок, `ValidationError` | Обработка ошибок |

## Быстрый поиск

### По сценарию использования

| Сценарий | Связанный API |
|----------|---------------|
| Создание Processor | [`jwt.New()`](./functions#new), [`jwt.DefaultConfig()`](./functions#defaultconfig) |
| Выпуск токена | [`Processor.Create()`](./processor#create), [`Processor.CreateRefresh()`](./processor#createrefresh) |
| Проверка токена | [`Processor.Validate()`](./processor#validate), [`Processor.ValidateInto()`](./processor#validateinto) |
| Обновление токена | [`Processor.Refresh()`](./processor#refresh), [`Processor.RefreshInto()`](./processor#refreshinto) |
| Отзыв токена | [`Processor.Revoke()`](./processor#revoke), [`Processor.IsRevoked()`](./processor#isrevoked) |
| Настройка алгоритма подписи | [`Config.SigningMethod`](./config#config) |
| Пользовательские Claims | Интерфейс [`CustomClaims`](./interfaces#customclaims) |
| Управление чёрным списком | Интерфейс [`BlacklistStore`](./interfaces#blackliststore) |
| Ограничение скорости | Интерфейс [`RateLimitProvider`](./interfaces#ratelimitprovider) |
| Обработка ошибок | [`Сигнальные ошибки`](./errors#сигнальные-ошибки) |
