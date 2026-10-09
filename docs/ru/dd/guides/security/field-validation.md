---
sidebar_label: "Валидация Field"
title: "Валидация Field - CyberGo DD | Соглашения об именовании и проверки безопасности"
description: "Руководство по валидации Field в CyberGo DD: проверки соглашений об именовании snake_case, camelCase, PascalCase, kebab-case, три режима валидации (off/warn/strict), встроенная защита от инъекций Log4Shell и обнаружение гомографов."
sidebar_position: 3
---

# Валидация Field

Подсистема валидации Field в DD проверяет **имена ключей** структурированных полей перед записью лога, обеспечивая соблюдение соглашений об именовании и защиту безопасности. Она предотвращает трудности парсинга логов из-за несогласованных ключей и перехватывает вредоносный контент, внедряемый через ключи Field.

## Режимы валидации

| Режим | Константа | Поведение |
|------|-----------|-----------|
| Отключён (по умолчанию) | `FieldValidationNone` | Без валидации; все ключи принимаются |
| Предупреждение | `FieldValidationWarn` | Несоответствующие ключи выводят предупреждение в stderr; лог записывается |
| Строгий | `FieldValidationStrict` | Несоответствующие ключи выводят ошибку в stderr; лог записывается |

:::warning Предупреждение Методы логирования не возвращают ошибки
Поскольку методы логирования (`InfoWith` и т.д.) не возвращают ошибку, неудачная валидация может быть сообщена только через stderr. Строгий режим **не предотвращает запись лога**, но чётко сообщает об ошибках в stderr.
:::

## Соглашения об именовании

| Соглашение | Константа | Примеры |
|------------|-----------|---------|
| Любое (по умолчанию) | `NamingConventionAny` | Без проверки стиля |
| snake_case | `NamingConventionSnakeCase` | `user_id`, `created_at` |
| camelCase | `NamingConventionCamelCase` | `userId`, `createdAt` |
| PascalCase | `NamingConventionPascalCase` | `UserId`, `CreatedAt` |
| kebab-case | `NamingConventionKebabCase` | `user-id`, `created-at` |

## Быстрый старт

### Вариант A: готовая конфигурация

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.FieldValidation = dd.StrictSnakeCaseConfig()
    // Эквивалентно:
    // &dd.FieldValidationConfig{
    //     Mode:                     dd.FieldValidationStrict,
    //     Convention:               dd.NamingConventionSnakeCase,
    //     AllowCommonAbbreviations: true,
    //     EnableSecurityValidation: true,
    // }

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()

    logger.InfoWith("user action",
        dd.String("user_id", "123"),    // ✅ корректный snake_case
        dd.String("userName", "alice"), // ⚠️ некорректно, ошибка в stderr
    )
}
```

### Вариант B: пользовательская конфигурация

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = &dd.FieldValidationConfig{
    Mode:                     dd.FieldValidationWarn,
    Convention:               dd.NamingConventionCamelCase,
    AllowCommonAbbreviations: true,
    EnableSecurityValidation: true,
}
```

### Вариант C: переключение во время выполнения

```go
// Включить строгий snake_case
logger.SetFieldValidation(dd.StrictSnakeCaseConfig())

// Отключить валидацию
logger.SetFieldValidation(nil)

// Запросить текущую конфигурацию
fv := logger.GetFieldValidation()
```

## Исключения для распространённых аббревиатур

С `AllowCommonAbbreviations: true` (значение по умолчанию для пресетов) следующие аббревиатуры разрешены, даже если они не строго соответствуют соглашению об именовании:

| Аббревиатура | Описание |
|--------------|----------|
| `id`, `url`, `uri`, `ip` | Базовые идентификаторы |
| `http`, `https`, `api` | Протоколы и интерфейсы |
| `json`, `xml`, `html`, `sql` | Форматы данных |
| `tcp`, `udp`, `ssl`, `tls` | Сетевые протоколы |
| `jwt`, `oauth` | Аутентификация |
| `*_id`, `*_url`, `*_api` и т.д. | Комбинации с суффиксами (например, `user_id`) |

## Проверки безопасности

`EnableSecurityValidation: true` (значение по умолчанию для пресетов) выполняет следующие проверки безопасности перед валидацией соглашения об именовании:

| Проверка | Перехватываемый контент | Описание |
|----------|------------------------|----------|
| Обнаружение Log4Shell | `${jndi:ldap://...}` | Предотвращает JNDI-инъекции через ключи логов |
| Обнаружение гомографов | Кириллическая `а` вместо латинской `a` | Предотвращает атаки визуального подмены |
| Избыточное кодирование UTF-8 | Кодирование не в кратчайшей форме | Предотвращает обход фильтров безопасности |

:::danger Опасность Подводный камень нулевого значения
Использование `&dd.FieldValidationConfig{Mode: dd.FieldValidationStrict}` без установки `EnableSecurityValidation` оставляет его `false` (нулевое значение), **молча пропуская** проверки безопасности. Всегда используйте `DefaultFieldValidationConfig()` или функции пресетов (`StrictSnakeCaseConfig()` и т.д.), которые устанавливают это поле в `true`.
:::

## Проекты с несколькими соглашениями

Если в вашем проекте есть как Go-бэкенд (snake_case), так и JavaScript-фронтенд (camelCase) для логирования, используйте разные Logger с разными соглашениями:

```go
// Backend Logger: snake_case
backendCfg := dd.DefaultConfig()
backendCfg.FieldValidation = dd.StrictSnakeCaseConfig()
backendLogger, _ := dd.New(backendCfg)

// Logger агрегации логов фронтенда: camelCase
frontendCfg := dd.DefaultConfig()
frontendCfg.FieldValidation = dd.StrictCamelCaseConfig()
frontendLogger, _ := dd.New(frontendCfg)
```

## Правила валидации

Конкретные правила для каждого соглашения об именовании:

| Соглашение | Правила |
|------------|---------|
| snake_case | строчные буквы + цифры + подчёркивания; **первый символ — обязательно строчная буква** (не цифра и не `_`); не заканчивается на `_`; без подряд идущих `__` |
| camelCase | буквы + цифры; первый символ — строчная буква |
| PascalCase | буквы + цифры; первый символ — заглавная буква |
| kebab-case | строчные буквы + цифры + дефисы; **первый символ — обязательно строчная буква** (не цифра и не `-`); не заканчивается на `-`; без подряд идущих `--` |

## Следующие шаги

- [Структурированное логирование](../basics/structured-logging) -- Конструкторы Field и цепочки
- [Конфигурация](../basics/configuration) -- Полный справочник по полям Config
- [Обзор безопасности](../security/) -- Полный обзор функций безопасности
