---
title: "Безопасный режим - CyberGo JSON | Справочник API"
description: "API безопасности CyberGo JSON: конфигурация, опасные паттерны AddDangerousPattern и валидация от JSON-инъекций, вложенности и исчерпания ресурсов."
---

# Безопасный режим

Безопасный режим предоставляет функциональность обнаружения опасных паттернов для предотвращения инъекций JSON, загрязнения прототипа и других угроз безопасности.

## Структура DangerousPattern

DangerousPattern представляет паттерн угрозы безопасности. Это структура.

```go
type DangerousPattern struct {
    Pattern string       // Подстрока для обнаружения во входных данных
    Name    string       // Описательное имя паттерна
    Level   PatternLevel // Уровень серьёзности, определяющий способ обработки паттерна
}
```

### Описание полей

| Поле | Тип | Описание |
|------|------|------|
| `Pattern` | `string` | Подстрока для обнаружения во входных данных |
| `Name` | `string` | Описательное имя паттерна |
| `Level` | `PatternLevel` | Уровень серьёзности, определяющий способ обработки паттерна |

---

## Тип PatternLevel

PatternLevel представляет уровень серьёзности опасного паттерна.

```go
type PatternLevel int
```

### Константы

```go
const (
    // PatternLevelCritical всегда блокирует операцию
    // Используется для паттернов, представляющих немедленную угрозу безопасности (например, загрязнение прототипа)
    PatternLevelCritical PatternLevel = iota

    // PatternLevelWarning блокирует в строгом режиме, записывает предупреждение в мягком режиме
    // Используется для паттернов, которые могут указывать на злонамеренность, но имеют легитимное применение
    PatternLevelWarning

    // PatternLevelInfo только записывает в лог, никогда не блокирует
    // Используется для целей аудита/отслеживания без прерывания операций
    PatternLevelInfo
)
```

### Метод String

```go
func (pl PatternLevel) String() string
```

Возвращает строковое представление PatternLevel.

---

## Встроенные опасные паттерны

### Паттерны по умолчанию

::: warning Внутренний API
Список встроенных паттернов управляется внутренними функциями и больше не экспортируется как публичный API. Пользовательские паттерны можно управлять через поле `AdditionalDangerousPatterns` в Config.
:::

Ниже приведён список встроенных опасных паттернов, все уровня Critical:

| Паттерн | Название | Категория |
|------|------|------|
| `__proto__` | prototype pollution | Загрязнение прототипа |
| `constructor[` | constructor access | Доступ к конструктору |
| `prototype.` | prototype manipulation | Манипуляция прототипом |
| `<script` | script tag injection | HTML-инъекция |
| `<iframe` | iframe injection | HTML-инъекция |
| `<object` | object injection | HTML-инъекция |
| `<embed` | embed injection | HTML-инъекция |
| `<svg` | svg injection | HTML-инъекция |
| `javascript:` | javascript protocol | Инъекция протокола |
| `vbscript:` | vbscript protocol | Инъекция протокола |
| `eval(` | dynamic code execution | Выполнение кода |
| `setTimeout(` | timer manipulation | Манипуляция таймерами |
| `setInterval(` | interval manipulation | Манипуляция интервалами |
| `require(` | code injection | Инъекция кода |
| `new function(` | dynamic function creation | Создание динамических функций |
| `document.cookie` | cookie access | Доступ к DOM |
| `window.location` | redirect manipulation | Манипуляция перенаправлением |
| `innerhtml` | DOM manipulation | Манипуляция DOM |
| `onerror`, `onload`, `onclick`, `onmouseover`, `onfocus` | event handler injection | Инъекция обработчиков событий |
| `fromcharcode(` | character encoding bypass | Обход кодировки |
| `atob(` | base64 decoding | Декодирование base64 |
| `expression(` | CSS expression injection | CSS-инъекция |
| `__defineGetter__` | getter definition | Загрязнение прототипа |
| `__defineSetter__` | setter definition | Загрязнение прототипа |

### Ключевые паттерны

::: warning Внутренний API
`GetCriticalPatterns` стал внутренней функцией и больше не экспортируется как публичный API. Ключевые паттерны (`__proto__`, `constructor[`, `prototype.`) всегда проверяются принудительно и не могут быть отключены.
:::

Следующие ключевые паттерны всегда полностью сканируются независимо от размера JSON:

| Паттерн | Описание |
|------|------|
| `__proto__` | prototype pollution |
| `constructor[` | constructor access |
| `prototype.` | prototype manipulation |

---

## Методы регистрации паттернов

Опасные паттерны настраиваются через структуру `Config`, а не через глобальные функции регистрации.

### Config.AddDangerousPattern

Сигнатура: `func (c *Config) AddDangerousPattern(pattern DangerousPattern)`

Добавление пользовательского опасного паттерна в конфигурацию.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Пользовательский опасный паттерн",
    Level:   json.PatternLevelCritical,
})

processor, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer processor.Close()
```

### Config.AdditionalDangerousPatterns

Также можно напрямую установить поле `Config.AdditionalDangerousPatterns`:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "eval(", Name: "eval-call", Level: json.PatternLevelCritical},
    {Pattern: "exec(", Name: "exec-call", Level: json.PatternLevelWarning},
}
```

---

## Методы конфигурации Config

### AddDangerousPattern

Добавление паттерна безопасности в конфигурацию.

```go
func (c *Config) AddDangerousPattern(pattern DangerousPattern)
```

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "custom_dangerous_string",
    Name:    "Пользовательская опасная строка",
    Level:   json.PatternLevelWarning,
})
```

### Поля конфигурации

```go
type Config struct {
    // ... другие поля ...

    // AdditionalDangerousPatterns добавляет паттерны безопасности помимо паттернов по умолчанию
    AdditionalDangerousPatterns []DangerousPattern

    // DisableDefaultPatterns отключает встроенные паттерны безопасности уровня предупреждения
    // При значении true используются только AdditionalDangerousPatterns
    // Примечание: ключевые паттерны (__proto__, constructor[, prototype.) всегда применяются принудительно и не могут быть отключены
    DisableDefaultPatterns bool
}
```

---

## Глобальная регистрация паттернов

Помимо настройки паттернов на уровне экземпляра через `Config`, можно управлять глобальным реестром паттернов через функции уровня пакета. Паттерны в глобальном реестре действуют во всех экземплярах Processor.

### RegisterDangerousPattern

Сигнатура: `func RegisterDangerousPattern(pattern DangerousPattern)`

Добавление пользовательского опасного паттерна в глобальный реестр. Зарегистрированные паттерны действуют во всех экземплярах Processor.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Пользовательский опасный паттерн",
    Level:   json.PatternLevelCritical,
})
```

### UnregisterDangerousPattern

Сигнатура: `func UnregisterDangerousPattern(pattern string)`

Удаление указанного паттерна из глобального реестра.

```go
json.UnregisterDangerousPattern("malicious_keyword")
```

### ListDangerousPatterns

Сигнатура: `func ListDangerousPatterns() []DangerousPattern`

Возвращает все пользовательские паттерны из глобального реестра.

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Паттерн: %s, Имя: %s, Уровень: %s\n", p.Pattern, p.Name, p.Level)
}
```

::: tip Глобальные паттерны vs паттерны Config
- **Глобальные паттерны** (`RegisterDangerousPattern`): разделяются всеми экземплярами Processor, подходят для политик безопасности на уровне приложения
- **Паттерны Config** (`Config.AddDangerousPattern`): влияют только на Processor, использующий данный Config, подходят для настройки на уровне экземпляра
:::

---

## Полные примеры

### Пользовательская политика безопасности

```go
package main

import (
    "fmt"
    "github.com/cybergodev/json"
)

func main() {
    // Способ 1: через поле конфигурации
    cfg := json.DefaultConfig()
    cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
        {Pattern: "company_secret", Name: "Корпоративная конфиденциальная информация", Level: json.PatternLevelCritical},
    }

    // Способ 2: через метод конфигурации
    cfg.AddDangerousPattern(json.DangerousPattern{
        Pattern: "internal_api",
        Name:    "Ссылка на внутренний API",
        Level:   json.PatternLevelWarning,
    })

    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    defer p.Close()

    // Тестирование обнаружения опасных паттернов
    _, err = p.Get(`{"data": "company_secret_info"}`, "data")
    if err != nil {
        fmt.Println("Обнаружен опасный паттерн:", err)
    }

    // Просмотр зарегистрированных паттернов
    fmt.Printf("Количество пользовательских паттернов: %d\n", len(cfg.AdditionalDangerousPatterns))
}
```

### Отключение паттернов по умолчанию

```go
cfg := json.DefaultConfig()

// Отключение встроенных паттернов уровня предупреждения, использование только пользовательских паттернов
// Примечание: ключевые паттерны (__proto__, constructor[, prototype.) всегда применяются принудительно
cfg.DisableDefaultPatterns = true

// Добавление пользовательских паттернов
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "xss_payload",
    Name:    "Нагрузка XSS-атаки",
    Level:   json.PatternLevelCritical,
})

p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

### Обработка паттернов по уровню

```go
// Регистрация паттернов разных уровней
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "suspicious_but_allowed",
    Name:    "Подозрительно, но разрешено",
    Level:   json.PatternLevelInfo, // Только запись в лог, без блокировки
})

// Просмотр зарегистрированных пользовательских паттернов
for _, p := range cfg.AdditionalDangerousPatterns {
    fmt.Printf("Паттерн: %s, Имя: %s, Уровень: %s\n", p.Pattern, p.Name, p.Level)
}
```

---

## Стратегия сканирования безопасности

### Малый JSON (< 4 КБ)

Всегда выполняется полное сканирование безопасности.

### Средний JSON (>= 4 КБ)

Используется скользящее окно в 32 КБ для сканирования, чтобы не пропустить паттерны на границах.

### Большой JSON

- Ключевые паттерны всегда сканируются полностью
- Для остальных паттернов используется стратегия выборки
- Проверяется плотность подозрительных символов

---

## Смотрите также

- [Config](./config) - Параметры конфигурации
- [Validator](./validator) - Валидатор
- [Система хуков](./hooks) - Перехват операций
