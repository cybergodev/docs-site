---
sidebar_label: "Обзор"
title: "Справочник API - CyberGo DD | Обзор"
description: "Обзор полной справочной документации API библиотеки структурированного логирования CyberGo DD, всесторонне охватывающей ключевые функциональные модули: основной логгер Logger, конфигурацию Config, цели вывода Writers, фильтрацию безопасности Security, аудитные логи Audit, систему хуков Hooks и подписи целостности Integrity."
sidebar_position: 1
---

# Справочник API

Библиотека логирования DD предоставляет богатый API, организованный по функциональным модулям:

## Основные компоненты

| Модуль | Описание | Документация |
|--------|----------|-------------|
| **Пакетные функции** | Глобальные функции логирования, удобные конструкторы | [Пакетные функции](./core/functions) |
| **Logger** | Основной логгер и его методы | [Logger](./core/logger) |
| **LoggerEntry** | Запись лога с предустановленными полями | [LoggerEntry](./core/entry) |
| **Config** | Структура конфигурации и предустановки | [Конфигурация](./core/config) |
| **Интерфейсы** | CoreLogger, LogProvider и другие интерфейсы | [Определения интерфейсов](./core/interfaces) |

## Вывод и запись

| Модуль | Описание | Документация |
|--------|----------|-------------|
| **Writers** | FileWriter, BufferedWriter, MultiWriter | [Цели вывода](./output-integration/writers) |
| **Контекст** | Интеграция с Context и ContextExtractor | [Интеграция с контекстом](./output-integration/context) |

## Расширенные возможности

| Модуль | Описание | Документация |
|--------|----------|-------------|
| **Fields** | Конструкторы структурированных полей (20 типов) | [Структурированные поля](./output-integration/fields) |
| **Hooks** | Система хуков жизненного цикла | [Система хуков](./security-audit/hooks) |
| **Security** | Фильтрация конфиденциальных данных и конфигурация безопасности | [Фильтрация безопасности](./security-audit/security) |
| **Audit** | Аудитные логи и аудитные события | [Аудитные логи](./security-audit/audit) |
| **Integrity** | Подписи целостности логов и проверка | [Подписи целостности](./security-audit/integrity) |

## Вспомогательные инструменты

| Модуль | Описание | Документация |
|--------|----------|-------------|
| **Debug Visual** | Функции отладки Print/JSON/Text/Exit | [Отладочный вывод](./dev-tools/debug-visual) |
| **Recorder** | Вспомогательный логгер для тестирования | [Тестовые утилиты](./dev-tools/recorder) |
| **Constants** | Уровни логирования, форматы, коды ошибок | [Константы и ошибки](./dev-tools/constants) |

## Быстрая навигация

```go
// Базовое использование
dd.Info("message")                        // → Пакетные функции
dd.InfoWith("msg", dd.String("k", "v"))   // → Пакетные функции + Fields

// Создание пользовательского логгера
logger, _ := dd.New(dd.DefaultConfig())    // → Пакетные функции + Config
logger.WithFields(fields).Info("msg")      // → Logger + Entry

// Вывод в файл
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // → Writers

// Безопасность
sec := dd.DefaultSecurityConfig()          // → Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // → Audit
```

## Следующие шаги

- [Пакетные функции](./core/functions) -- глобальные функции и конструкторы
- [Logger](./core/logger) -- подробное описание основного логгера
- [Конфигурация](./core/config) -- параметры конфигурации
