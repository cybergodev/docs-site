---
sidebar_label: "Структурированные поля"
title: "Структурированные поля - CyberGo DD | Конструкторы Field и валидация"
description: "API структурированных полей CyberGo DD: 20 типобезопасных конструкторов (String/Int/Float/Bool/Time/Duration/Err и др.), тип Field и валидация ключей полей (именование и безопасность Log4Shell), поддержка пользовательских режимов валидации и предустановленных конфигураций."
sidebar_position: 3
---

# Структурированные поля

DD предоставляет 20 типобезопасных конструкторов полей, единый тип `Field` и опциональный механизм валидации ключей полей для структурированного вывода логов.

## Тип Field

`Field` — тип структурированного поля лога, экспортируемый как **псевдоним типа** `internal.Field`:

```go
type Field = internal.Field

// Фактическая структура (internal/fields.go)
type Field struct {
    Key   string  // Ключ поля
    Value any     // Значение поля (произвольный тип)
}
```

Все конструкторы полей возвращают значения `Field`; форматтер (`internal.FormatFields`) выводит их в формате `Key=Value`. Базовые типы (string / числа / bool / `time.Duration` / `time.Time` / nil) проходят быстрый путь; «сложные типы» — срезы, массивы, map, struct — fallback'ят к JSON-сериализации (определяется `internal.IsComplexValue`), прочие типы (например, значения, реализующие интерфейс `fmt.Stringer` или `error`) проходят через `fmt.Fprint`.

## Базовые поля

| Конструктор | Сигнатура | Описание |
|-------------|-----------|----------|
| `Any` | `(key string, value any) Field` | Произвольный тип |
| `String` | `(key, value string) Field` | Строка |
| `Bool` | `(key string, value bool) Field` | Логическое значение |
| `Err` | `(err error) Field` | Ошибка (ключ фиксирован `"error"`; при `err == nil` Value равно `nil`, иначе `err.Error()`) |
| `ErrWithKey` | `(key string, err error) Field` | Ошибка с пользовательским ключом (как у `Err`: при `err == nil` Value равно `nil`) |
| `ErrWithStack` | `(err error) Field` | Ошибка со стеком вызовов (ключ `"error"`, при `err == nil` Value равно `nil`; кадры стека фильтруются от runtime/ и собственных кадров dd, захват несёт небольшие накладные расходы) |

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
| `Time` | `(key string, value time.Time) Field` | Временная метка (форматируется по RFC3339) |
| `Duration` | `(key string, value time.Duration) Field` | Длительность (вызывает `Duration.String()`) |

## Поля ошибок

<!-- check-code: skip -->
```go
// Стандартное поле ошибки (ключ фиксирован "error", nil error → Value равно nil)
dd.Err(err)

// Пользовательский ключ
dd.ErrWithKey("db_error", err)

// С информацией о стеке вызовов (кадры стека фильтруются от runtime/ и собственных кадров dd)
dd.ErrWithStack(err)
```

## Способы использования

### Комбинация с InfoWith

<!-- check-code: skip -->
```go
dd.InfoWith("Пользователь вошёл",
    dd.String("username", "admin"),
    dd.Time("login_at", time.Now()),
    dd.Bool("mfa", true),
    dd.String("ip", "192.168.1.1"),
)
```

### Цепочные вызовы с WithFields

<!-- check-code: skip -->
```go
entry := logger.WithFields(
    dd.String("service", "api"),
    dd.Int("pid", os.Getpid()),
)
entry.Info("Сервис запущен")
```

### Добавление к Entry

<!-- check-code: skip -->
```go
base := logger.WithFields(dd.String("req_id", id))
base.InfoWith("Ответ",
    dd.Int("status", 200),
    dd.Duration("elapsed", took),
    dd.Err(err),
)
```

## Валидация полей

DD предоставляет механизм валидации ключей полей, поддерживающий проверку соглашений об именовании и проверку безопасности (инъекция Log4Shell, атаки гомоглифами, overlong UTF-8). Конфигурация валидации `FieldValidationConfig` может быть привязана к [`Config.FieldValidation`](../core/config) и применена при конструировании, либо динамически заменена во время выполнения через [`Logger.SetFieldValidation`](../core/logger). При каждом вызове `*With` для ключа каждого поля вызывается `ValidateFieldKey`; в режиме Strict при неудаче ошибка протоколируется как лог (сам метод логирования не возвращает error).

### FieldValidationMode

Режим валидации, определяет поведение при неудаче валидации.

```go
type FieldValidationMode int

const (
    FieldValidationNone   FieldValidationMode = iota // Отключить валидацию (по умолчанию, сокращает все проверки)
    FieldValidationWarn                              // При несоответствии именования записывает один warning-лог
    FieldValidationStrict                            // При несоответствии именования записывает один error-лог
)
```

Метод `String()` типа `FieldValidationMode` возвращает: `"none"` / `"warn"` / `"strict"` (при неизвестном значении — `"unknown"`).

### FieldNamingConvention

Соглашение об именовании.

```go
type FieldNamingConvention int

const (
    NamingConventionAny         FieldNamingConvention = iota // Принимать любой валидный ключ (по умолчанию)
    NamingConventionSnakeCase                                // snake_case: user_id
    NamingConventionCamelCase                                // camelCase: userId
    NamingConventionPascalCase                               // PascalCase: UserId
    NamingConventionKebabCase                                // kebab-case: user-id
)
```

Метод `String()` типа `FieldNamingConvention` возвращает: `"any"` / `"snake_case"` / `"camelCase"` / `"PascalCase"` / `"kebab-case"` (при неизвестном значении — `"unknown"`).

### FieldValidationConfig

Конфигурация валидации полей.

```go
type FieldValidationConfig struct {
    Mode                     FieldValidationMode    // Режим валидации
    Convention               FieldNamingConvention  // Соглашение об именовании
    AllowCommonAbbreviations bool                   // Разрешить распространённые сокращения (ID, URL, HTTP, JSON и др.)
    EnableSecurityValidation bool                   // Включить проверку безопасности (Log4Shell / гомоглифы / overlong UTF-8)
}
```

:::warning Ловушка нулевого значения
Литерал `FieldValidationConfig{}` приведёт к `EnableSecurityValidation=false`, что **молча отключит проверку безопасности** — предпочитайте конструктор [`DefaultFieldValidationConfig`](#предустановленные-конфигурации) (он устанавливает этот пункт в `true`). Кроме того, при `Mode == FieldValidationNone` выполнение прерывается до проверки безопасности: даже если включён `EnableSecurityValidation`, она не выполняется.
:::

### Предустановленные конфигурации

```go
// Конфигурация по умолчанию: отключает валидацию именования, но включает проверку безопасности
func DefaultFieldValidationConfig() *FieldValidationConfig

// Строгий snake_case
func StrictSnakeCaseConfig() *FieldValidationConfig

// Строгий camelCase
func StrictCamelCaseConfig() *FieldValidationConfig
```

Все три пресета устанавливают `AllowCommonAbbreviations=true` и `EnableSecurityValidation=true`; у двух последних `Mode=FieldValidationStrict`.

### ValidateFieldKey

```go
func (c *FieldValidationConfig) ValidateFieldKey(key string) error
```

Проверяет, соответствует ли ключ поля конфигурации. При неудаче возвращает error с описанием причины, при успехе возвращает `nil`. Если получатель `nil` или `Mode == FieldValidationNone`, сразу возвращает `nil`. Порядок проверки:

1. Пустой ключ → вернуть `"field key cannot be empty"`
2. При включённом `EnableSecurityValidation` выполняется `internal.ValidateFieldKeyStrict` (Log4Shell / гомоглифы / overlong UTF-8)
3. `Convention == NamingConventionAny` → пропустить проверку именования
4. Если `AllowCommonAbbreviations` включён и ключ попадает в таблицу распространённых сокращений (`id`/`url`/`http`/`json`/`jwt` и др., либо оканчивается на `_id`/`_url`/`_uri`/`_ip`/`_api`) → проходит
5. Построчная проверка по соглашению: snake_case / camelCase / PascalCase / kebab-case

```go
package main

import (
    "fmt"

    "github.com/cybergodev/dd"
)

func main() {
    // Пресет строгого snake_case
    cfg := dd.StrictSnakeCaseConfig()

    if err := cfg.ValidateFieldKey("user_id"); err != nil {
        fmt.Println("user_id:", err)
    } else {
        fmt.Println("user_id OK")
        // Вывод: user_id OK
    }

    if err := cfg.ValidateFieldKey("userId"); err != nil {
        fmt.Println("userId:", err)
        // Вывод: userId: field key "userId" does not match snake_case convention
    }

    // Освобождение от распространённых сокращений: URL не соответствует snake_case, но попадает в таблицу сокращений, поэтому проходит
    if err := cfg.ValidateFieldKey("URL"); err != nil {
        fmt.Println("URL:", err)
    } else {
        fmt.Println("URL OK (освобождение по сокращению)")
        // Вывод: URL OK (освобождение по сокращению)
    }

    // В конфигурации по умолчанию Mode=None, именование не проверяется
    defaultCfg := dd.DefaultFieldValidationConfig()
    if err := defaultCfg.ValidateFieldKey("anyKey"); err != nil {
        fmt.Println("anyKey:", err)
    } else {
        fmt.Println("anyKey OK (Mode=None)")
        // Вывод: anyKey OK (Mode=None)
    }
}
```

## Следующие шаги

- [Logger](../core/logger) -- `WithFields` / `InfoWith` / `SetFieldValidation`
- [LoggerEntry](../core/entry) -- цепочные вызовы с предустановленными полями
- [Интеграция с контекстом](./context) -- извлечение полей через `ContextExtractor`
- [Конфигурация](../core/config) -- `Config.FieldValidation`
