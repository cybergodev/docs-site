---
sidebar_label: "Обзор безопасности"
title: "Обзор безопасности - CyberGo JSON | Лучшие практики безопасности"
description: "Лучшие практики безопасности CyberGo JSON: валидация входных данных, ограничения ресурсов MaxNestingDepthSecurity/MaxMemory, защита от обхода пути и JSON-инъекций, фильтрация конфиденциальных данных."
sidebar_position: 1
---

# Обзор безопасности

Соображения безопасности и лучшие практики при обработке данных JSON.

## Распространённые угрозы безопасности

### 1. Атаки исчерпания ресурсов

Злонамеренно сконструированный JSON может привести к исчерпанию памяти или перегрузке CPU.

**Защитные меры:**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // Ограничение глубины вложенности
cfg.MaxJSONSize = 10 * 1024 * 1024             // Ограничение размера JSON (10MB)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // Увеличить лимит безопасности до 100MB (по умолчанию 10MB)
```

### 2. Атаки обхода пути

Злонамеренные пути могут получить доступ к непредусмотренным данным.

**Защитные меры:**

```go
// Проверка пути, введённого пользователем
func safePath(path string) bool {
    // Запрет специальных символов
    if strings.ContainsAny(path, `<>:"|\`) {
        return false
    }
    return true
}
```

### 3. JSON-инъекции

Злонамеренные данные могут нарушить структуру JSON.

**Защитные меры:**

```go
// Всегда используйте библиотечные функции для сериализации, не конкатенируйте строки
data := map[string]any{
    "user": userInput, // Библиотека автоматически экранирует
}
bytes, _ := json.Marshal(data)
```

### 4. Утечка конфиденциальных данных

Журналы или сообщения об ошибках могут раскрыть конфиденциальные данные.

**Защитные меры:**

```go
// Использование пользовательского Hook для фильтрации конфиденциальных полей
type FilterFieldsHook struct {
    fields map[string]bool
}

func (h *FilterFieldsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *FilterFieldsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&FilterFieldsHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "secret":   true,
}})
```

## Рекомендации по конфигурации безопасности

### Управление опасными паттернами

Библиотека имеет встроенное обнаружение опасных паттернов по умолчанию, а также поддерживает регистрацию, отмену регистрации и запрос пользовательских паттернов.

#### RegisterDangerousPattern

Сигнатура: `func RegisterDangerousPattern(pattern DangerousPattern)`

Регистрирует глобальный опасный паттерн. После регистрации паттерн будет действовать во всех операциях, использующих конфигурацию безопасности по умолчанию.

```go
json.RegisterDangerousPattern(json.DangerousPattern{
    Pattern: "eval(",
    Name:    "eval-call",
    Level:   json.PatternLevelCritical,
})
```

#### UnregisterDangerousPattern

Сигнатура: `func UnregisterDangerousPattern(pattern string)`

Отменяет регистрацию глобального опасного паттерна по строке паттерна. Параметр `pattern` — подстрока опасного паттерна для отмены (соответствует полю `DangerousPattern.Pattern`).

```go
json.UnregisterDangerousPattern("eval(")
```

#### ListDangerousPatterns

Сигнатура: `func ListDangerousPatterns() []DangerousPattern`

Перечисляет все зарегистрированные опасные паттерны (включая паттерны по умолчанию и пользовательские).

```go
patterns := json.ListDangerousPatterns()
for _, p := range patterns {
    fmt.Printf("Паттерн: %s, Имя: %s, Уровень: %s\n", p.Pattern, p.Name, p.Level)
}
```

#### Уровни опасных паттернов

| Константа | Тип | Значение | Описание |
|-----------|-----|----------|----------|
| `PatternLevelCritical` | `int` | `0` | Критический уровень, при совпадении операция отклоняется |
| `PatternLevelWarning` | `int` | `1` | Уровень предупреждения, в строгом режиме операция отклоняется |
| `PatternLevelInfo` | `int` | `2` | Информационный уровень, только запись в журнал |

::: tip
Метод `String()` типа `PatternLevel` возвращает соответствующее строковое представление (`"critical"`, `"warning"`, `"info"`), удобное для вывода в журнал.
:::

#### Отключение паттернов по умолчанию

Через `Config.DisableDefaultPatterns` можно отключить встроенные паттерны по умолчанию:

```go
cfg := json.DefaultConfig()
cfg.DisableDefaultPatterns = true // Отключить встроенные паттерны по умолчанию
```

::: warning Примечание
При `DisableDefaultPatterns=true` все встроенные паттерны, кроме 3 критических (`__proto__`, `constructor[`, `prototype.` — всегда принудительно сканируются), будут отключены. Примечание: все встроенные паттерны относятся к уровню Critical.
:::

### Конфигурация для продакшена

```go
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()
    cfg.AddHook(&AuditHook{logger: prodLogger})
    return cfg
}
```

### Конфигурация для разработки

```go
func DevelopmentConfig() json.Config {
    cfg := json.DefaultConfig()
    cfg.MaxNestingDepthSecurity = 100
    cfg.AddHook(json.LoggingHook(devLogger))
    return cfg
}
```

## Валидация входных данных

### Пользовательский валидатор

Реализуйте интерфейс `Validator` (`Validate(jsonStr string) error`) для валидации входных данных:

```go
// Реализация пользовательского валидатора
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    // Проверка содержимого строки JSON
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return err
    }
    email, ok := data["email"].(string)
    if !ok {
        return nil
    }
    if !strings.Contains(email, "@") {
        return errors.New("invalid email format")
    }
    return nil
}

// Использование пользовательского валидатора
cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&EmailValidator{}}
```

### Schema-валидация

Schema — тип структуры, который можно использовать для валидации структуры JSON:

```go
schema := &json.Schema{
    Type:     "object",
    Required: []string{"id", "name", "email"},
    Properties: map[string]*json.Schema{
        "id":    {Type: "string", Pattern: `^[a-zA-Z0-9]+$`},
        "name":  {Type: "string", MinLength: 1},
        "email": {Type: "string", Format: "email"},
        "age":   {Type: "number", Minimum: 0, Maximum: 150},
    },
}
```

## Обработка ошибок

### Безопасные сообщения об ошибках

```go
val, err := json.Get(data, path)
if err != nil {
    // Не раскрывайте внутренние детали ошибки
    return errors.New("Неверный формат данных")
}
```

## Аудиторский журнал

### Запись ключевых операций

Используйте интерфейс `Hook` (`Before` возвращает `error`, `After` принимает `(HookContext, any, error)` и возвращает `(any, error)`) для записи аудиторского журнала:

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("Начало JSON-операции", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("Завершение JSON-операции", "op", ctx.Operation)
    return result, err
}
```

## Связанные разделы

- [Контрольный список для продакшена](./production-checklist)
- [Конфигурация Config](../api-reference/config)
- [Валидатор](../extensions/validator)
