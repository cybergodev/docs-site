---
title: "Структурированные поля - CyberGo DD | Конструкторы Field"
description: "Полная документация API конструкторов структурированных полей CyberGo DD, поддерживает создание типобезопасных полей для 20+ типов, включая базовые поля String/Int/Float/Bool, временные поля Time/Duration, поля ошибок Error, поля объектов Any и пользовательские поля, предоставляет удобные способы цепочной комбинации."
---

# Структурированные поля

DD предоставляет 20+ типобезопасных конструкторов полей для структурированного вывода логов.

## Базовые поля

| Конструктор | Сигнатура | Описание |
|-------------|-----------|----------|
| `Any` | `(key string, value any) Field` | Произвольный тип |
| `String` | `(key, value string) Field` | Строка |
| `Bool` | `(key string, value bool) Field` | Логическое значение |
| `Err` | `(err error) Field` | Ошибка (ключ "error") |
| `ErrWithKey` | `(key string, err error) Field` | Ошибка с пользовательским ключом |
| `ErrWithStack` | `(err error) Field` | Ошибка со стеком вызовов |

## Числовые поля

| Конструктор | Тип | Пример |
|-------------|-----|--------|
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

## Временные поля

| Конструктор | Сигнатура | Описание |
|-------------|-----------|----------|
| `Time` | `(key string, value time.Time) Field` | Временная метка |
| `Duration` | `(key string, value time.Duration) Field` | Длительность |

## Поля ошибок

```go
// Стандартное поле ошибки (ключ "error")
dd.Err(err)

// Пользовательский ключ
dd.ErrWithKey("db_error", err)

// С информацией о стеке вызовов
dd.ErrWithStack(err)
```

## Способы использования

### Комбинация с InfoWith

```go
dd.InfoWith("Пользователь вошёл",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### Цепочные вызовы с WithFields

```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("Сервис запущен")
```

### Добавление к Entry

```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("Ответ",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## Определение типа

`Field` — тип структурированного поля лога, содержит два поля: `Key` (строка) и `Value` (любое значение), создаётся через конструкторы.

## Следующие шаги

- [Logger](./logger) -- методы WithFields / InfoWith
- [LoggerEntry](./entry) -- цепочные вызовы с предустановленными полями
- [Интеграция с контекстом](./context) -- извлечение полей через ContextExtractor
