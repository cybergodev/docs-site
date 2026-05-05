---
title: Обзор безопасности - CyberGo JSON | Лучшие практики безопасности
description: "Руководство по лучшим практикам безопасности CyberGo JSON: валидация и очистка входных данных, защита ресурсных ограничений MaxNestingDepthSecurity/MaxMemory, предотвращение атак с обходом пути, защита от JSON-инъекций, фильтрация конфиденциальных данных и настройка журналов аудита для безопасной обработки JSON в продакшене."
---

# Обзор безопасности

Вопросы безопасности и лучшие практики при обработке JSON данных.

## Основные риски безопасности

### 1. Атаки на исчерпание ресурсов

Злонамеренно сформированный JSON может привести к исчерпанию памяти или перегрузке процессора.

**Меры защиты:**

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50                       // Ограничение глубины вложенности
cfg.MaxJSONSize = 10 * 1024 * 1024             // Ограничение размера JSON (10МБ)
cfg.MaxSecurityValidationSize = 100 * 1024 * 1024 // Увеличить лимит безопасности до 100МБ (по умолчанию 10МБ)
```

### 2. Атаки с обходом пути

Злонамеренные пути могут получить доступ к непредусмотренным данным.

**Меры защиты:**

```go
// Проверка пользовательского пути
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

**Меры защиты:**

```go
// Всегда используйте функции библиотеки для сериализации, не конкатенируйте строки
data := map[string]any{
    "user": userInput, // Библиотека автоматически экранирует
}
bytes, _ := json.Marshal(data)
```

### 4. Утечка конфиденциальных данных

Журналы или сообщения об ошибках могут раскрыть конфиденциальные данные.

**Меры защиты:**

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

## Рекомендации по настройке безопасности

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
    // Проверка содержимого JSON строки
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

### Валидация по схеме

Schema — это тип структуры, который можно использовать для валидации структуры JSON:

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

## Журналы аудита

### Запись ключевых операций

Используйте интерфейс `Hook` (`Before` возвращает `error`, `After` принимает `(HookContext, any, error)` и возвращает `(any, error)`) для записи журналов аудита:

```go
type AuditHook struct {
    logger *slog.Logger
}

func (h *AuditHook) Before(ctx json.HookContext) error {
    h.logger.Info("Начало JSON операции", "op", ctx.Operation, "path", ctx.Path)
    return nil
}

func (h *AuditHook) After(ctx json.HookContext, result any, err error) (any, error) {
    h.logger.Info("Завершение JSON операции", "op", ctx.Operation)
    return result, err
}
```

## Смотрите также

- [Контрольный список для продакшена](./production-checklist)
- [Конфигурация Config](../api-reference/config)
- [Validator](../api-reference/validator)
