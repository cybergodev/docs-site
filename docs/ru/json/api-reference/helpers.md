---
title: "Вспомогательные функции - CyberGo JSON | Справочник API"
description: "Вспомогательные функции CyberGo JSON: CompareJSON, ClearCache/GetStats, управление глобальным Processor и помощники безопасности для работы с JSON в Go."
---

# Вспомогательные функции

Пакет json предоставляет богатый набор вспомогательных функций для сравнения JSON, управления кэшем и утилит обработки.

## Функции сравнения JSON

### CompareJSON

Сигнатура: `func CompareJSON(json1, json2 string) (bool, error)`

Сравнивает две строки JSON на равенство. Обрабатывает различия в точности чисел и порядке ключей.

```go
// Разный порядок ключей, но одинаковое содержимое
equal, _ := json.CompareJSON(`{"a":1,"b":2}`, `{"b":2,"a":1}`)
fmt.Println(equal) // true

// Разная точность числа, но одинаковое значение
equal, _ = json.CompareJSON(`{"num":1}`, `{"num":1.0}`)
fmt.Println(equal) // true

// Разное содержимое
equal, _ = json.CompareJSON(`{"a":1}`, `{"a":2}`)
fmt.Println(equal) // false
```

---

## Функции слияния JSON

### MergeJSON

Сигнатура: `func MergeJSON(json1, json2 string, cfg ...Config) (string, error)`

Объединяет два объекта JSON с поддержкой настройки режима слияния через Config. Подробности в разделе [Функции модификации](./functions/modify#mergejson).

---

### MergeMany

Сигнатура: `func MergeMany(jsons []string, cfg ...Config) (string, error)`

Объединяет несколько объектов JSON. Подробности в разделе [Функции модификации](./functions/modify#mergemany).

---

## Кэш и статистика

### ClearCache (функция уровня пакета)

Сигнатура: `func ClearCache()`

Очищает внутренний кэш глобального процессора.

```go
json.ClearCache()
```

---

### GetStats (функция уровня пакета)

Сигнатура: `func GetStats() Stats`

Получает статистику глобального процессора.

```go
stats := json.GetStats()
fmt.Printf("Коэффициент попаданий в кэш: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Размер кэша: %d\n", stats.CacheSize)
```

---

### GetHealthStatus (функция уровня пакета)

Сигнатура: `func GetHealthStatus() HealthStatus`

Получает статус работоспособности глобального процессора.

```go
status := json.GetHealthStatus()
if status.Healthy {
    fmt.Println("Процессор работоспособен")
}
```

---

### Processor.ClearCache

Сигнатура: `func (p *Processor) ClearCache()`

Очищает внутренний кэш процессора.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

p.ClearCache()
```

### Processor.GetStats

Сигнатура: `func (p *Processor) GetStats() Stats`

Получает статистику процессора.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

stats := p.GetStats()
fmt.Printf("Коэффициент попаданий в кэш: %.2f%%\n", stats.HitRatio * 100)
fmt.Printf("Размер кэша: %d\n", stats.CacheSize)
```

### Processor.GetHealthStatus

Сигнатура: `func (p *Processor) GetHealthStatus() HealthStatus`

Получает статус работоспособности процессора.

```go
p, err := json.New()
if err != nil {
    panic(err)
}
defer p.Close()

status := p.GetHealthStatus()
if status.Healthy {
    fmt.Println("Процессор работоспособен")
}
```

### WarmupCache

Сигнатура: `func WarmupCache(jsonStr string, paths []string, cfg ...Config) (*WarmupResult, error)`

Прогревает кэш для повышения производительности последующих операций.

```go
data := `{"user": {"name": "Alice", "email": "alice@example.com"}, "items": [{"id": 1}]}`
paths := []string{"user.name", "user.email", "items[*].id"}
result, err := json.WarmupCache(data, paths)
if err != nil {
    panic(err)
}
fmt.Printf("Успешно прогрето %d путей\n", result.Successful)
```

---

## Управление глобальным процессором

Глобальный процессор используется всеми функциями уровня пакета (такими как `Get`, `GetString` и т.д.).

### SetGlobalProcessor

Сигнатура: `func SetGlobalProcessor(processor *Processor)`

Устанавливает пользовательский глобальный процессор.

```go
cfg := json.SecurityConfig()
p, err := json.New(cfg)
if err != nil {
    panic(err)
}

json.SetGlobalProcessor(p)

// Теперь все функции уровня пакета используют этот процессор
val := json.GetString(data, "user.name")
```

---

### ShutdownGlobalProcessor

Сигнатура: `func ShutdownGlobalProcessor()`

Завершает работу глобального процессора и освобождает ресурсы.

```go
package main

import (
    "github.com/cybergodev/json"
)

func main() {
    cfg := json.DefaultConfig()
    p, err := json.New(cfg)
    if err != nil {
        panic(err)
    }
    json.SetGlobalProcessor(p)

    defer json.ShutdownGlobalProcessor()

    // Логика приложения...
}
```

---

## Функции вывода

::: warning
`Print`, `PrintPretty`, `PrintE`, `PrintPrettyE` удалены из библиотеки и больше не предоставляются. Используйте [Encode](./functions/encode-decode#encode), [EncodePretty](./functions/encode-decode#encodepretty) или [Prettify](./functions/encode-decode#prettify) вместе с `fmt.Println`. Подробности в разделе [Функции печати](./print).
:::

---

## Функции совместимости с Buffer

::: tip
Следующие функции полностью совместимы со стандартной библиотекой `encoding/json` и при этом поддерживают дополнительную конфигурацию через параметр `cfg`.
:::

### Compact

Сигнатура: `func Compact(dst *bytes.Buffer, src []byte, cfg ...Config) error`

Сжимает JSON и записывает в Buffer. На 100% совместима с `encoding/json.Compact`.

```go
var buf bytes.Buffer
err := json.Compact(&buf, []byte(`{"name": "test"}`))
```

### Indent

Сигнатура: `func Indent(dst *bytes.Buffer, src []byte, prefix, indent string, cfg ...Config) error`

Форматирует JSON и записывает в Buffer. На 100% совместима с `encoding/json.Indent`.

```go
var buf bytes.Buffer
err := json.Indent(&buf, []byte(`{"name":"test"}`), "", "  ")
```

---

### HTMLEscape

Сигнатура: `func HTMLEscape(dst *bytes.Buffer, src []byte, cfg ...Config)`

Экранирует HTML-символы в JSON и записывает в Buffer. На 100% совместима с `encoding/json.HTMLEscape`.

```go
var buf bytes.Buffer
json.HTMLEscape(&buf, []byte(`{"html":"<script>alert(1)</script>"}`))
```

---

## Функции безопасного режима

### Config.AddDangerousPattern

Регистрация пользовательских опасных шаблонов через метод `AddDangerousPattern` объекта Config или поле `AdditionalDangerousPatterns`.

```go
cfg := json.DefaultConfig()
cfg.AddDangerousPattern(json.DangerousPattern{
    Pattern: "malicious_keyword",
    Name:    "Пользовательское опасное ключевое слово",
    Level:   json.PatternLevelCritical,
})
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

Также можно установить поле `AdditionalDangerousPatterns` после создания Config:

```go
cfg := json.DefaultConfig()
cfg.AdditionalDangerousPatterns = []json.DangerousPattern{
    {Pattern: "malicious_keyword", Name: "Пользовательское опасное ключевое слово", Level: json.PatternLevelCritical},
}
p, err := json.New(cfg)
if err != nil {
    panic(err)
}
defer p.Close()
```

**Структура DangerousPattern**

| Поле | Тип | Описание |
|------|------|------|
| `Pattern` | `string` | Подстрока для обнаружения |
| `Name` | `string` | Читаемое описание риска |
| `Level` | `PatternLevel` | Уровень серьёзности |

**Уровни PatternLevel**

| Уровень | Описание |
|------|------|
| `PatternLevelCritical` | Всегда блокирует операцию |
| `PatternLevelWarning` | Блокирует в строгом режиме, записывает предупреждение в мягком режиме |
| `PatternLevelInfo` | Только запись в журнал, никогда не блокирует |

---

## Функции обработки ошибок

### SafeError

Сигнатура: `func SafeError(err error) string`

Возвращает безопасное для клиента сообщение об ошибке без внутренней информации. Подходит для использования в ответах API.

```go
val, err := json.Get(data, "user.name")
if err != nil {
    // Возвращает безопасное сообщение об ошибке (без пути, внутреннего состояния и другой чувствительной информации)
    fmt.Println(json.SafeError(err))
}
```

---

### RedactedPath

Сигнатура: `func RedactedPath(path string) string`

Возвращает отредактированный путь для безопасного логирования. Скрывает чувствительные части пути.

```go
path := "users[0].ssn"
fmt.Println(json.RedactedPath(path)) // Безопасное представление пути
```

---

## Методы преобразования типов AccessResult

`AccessResult` — это тип возвращаемого значения `Processor.SafeGet()` и функции уровня пакета `SafeGet()`, предоставляющий типобезопасные методы преобразования.

### AccessResult.AsString

Сигнатура: `func (r AccessResult) AsString() (string, error)`

Безопасное преобразование в строку. Успешно только если само значение является строкой.

```go
result := json.SafeGet(data, "user.name")
name, err := result.AsString()
if err != nil {
    return
}
fmt.Println(name)
```

---

### AccessResult.AsStringConverted

Сигнатура: `func (r AccessResult) AsStringConverted() (string, error)`

Преобразует любое значение в строку (используя форматирование fmt.Sprintf).

```go
result := json.SafeGet(data, "user.age")
ageStr, err := result.AsStringConverted()
// "30" (строковое представление)
```

---

### AccessResult.AsInt

Сигнатура: `func (r AccessResult) AsInt() (int, error)`

Безопасное преобразование в целое число. Не поддерживает преобразование bool в int.

```go
result := json.SafeGet(data, "user.age")
age, err := result.AsInt()
```

---

### AccessResult.AsFloat64

Сигнатура: `func (r AccessResult) AsFloat64() (float64, error)`

Безопасное преобразование в float64. Не поддерживает преобразование bool в float64.

```go
result := json.SafeGet(data, "item.price")
price, err := result.AsFloat64()
```

---

### AccessResult.AsBool

Сигнатура: `func (r AccessResult) AsBool() (bool, error)`

Безопасное преобразование в логическое значение. Поддерживает только типы bool и string.

```go
result := json.SafeGet(data, "feature.enabled")
enabled, err := result.AsBool()
```

---

## Связанные разделы

- [Функции запросов](./functions/get) - Операции запросов Get, GetString и др.
- [Функции модификации](./functions/modify) - Операции изменения Set, Delete и др.
- [Определения типов](./types) - Типы, такие как AccessResult
- [Параметры конфигурации](./config) - Подробное описание Config
