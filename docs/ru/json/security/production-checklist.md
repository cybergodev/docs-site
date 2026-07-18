---
sidebar_label: "Контрольный список для продакшена"
title: "Продакшен чек-лист - CyberGo JSON | Безопасность"
description: "Чек-лист безопасности продакшена CyberGo JSON: SecurityConfig, лимиты ресурсов, валидация, обработка ошибок и мониторинг."
sidebar_position: 3
---

# Контрольный список для продакшена

Перед развёртыванием в продакшен убедитесь, что выполнены следующие пункты безопасности.

## Проверка конфигурации

### Ограничения ресурсов

- [ ] Установить `MaxNestingDepthSecurity` для предотвращения атак глубокой вложенности
- [ ] Установить `MaxJSONSize` для ограничения размера одного значения
- [ ] Установить `MaxMemory` для ограничения общего использования памяти

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## Валидация входных данных

### Обязательные поля

- [ ] Проверить наличие всех обязательных полей
- [ ] Проверить правильность типов полей

```go
// Пример пользовательского валидатора
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // Проверка наличия обязательных полей
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}
```

### Валидация формата

- [ ] Проверить формат email
- [ ] Проверить формат URL
- [ ] Проверить пользовательские форматы

```go
// Пользовательский валидатор формата
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = append(cfg.CustomValidators, &EmailValidator{})
```

### Валидация диапазона

- [ ] Проверить диапазон числовых значений
- [ ] Проверить длину строк
- [ ] Проверить длину массивов

```go
// Использование Schema для валидации диапазона
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## Обработка конфиденциальных данных

### Фильтрация конфиденциальных полей

- [ ] Фильтровать поля паролей
- [ ] Фильтровать поля токенов
- [ ] Фильтровать другие конфиденциальные данные

```go
// Использование Hook для фильтрации конфиденциальных полей
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

### Обезличивание журналов

- [ ] Не записывать конфиденциальные данные в журналы
- [ ] Сообщения об ошибках не должны содержать конфиденциальную информацию

## Обработка ошибок

### Безопасные ответы об ошибках

- [ ] Не раскрывать внутренние детали ошибок
- [ ] Использовать общие сообщения об ошибках
- [ ] Записывать подробности ошибок в журнал

```go
if err != nil {
    log.Error("Подробная ошибка", "error", err)
    return errors.New("Операция не удалась, попробуйте позже")
}
```

## Мониторинг и аудит

### Мониторинг производительности

- [ ] Отслеживать время парсинга
- [ ] Отслеживать использование памяти
- [ ] Установить пороги оповещений

```go
// Использование Hook для мониторинга производительности
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("operation", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### Аудиторский журнал

- [ ] Записывать ключевые операции
- [ ] Записывать аномальный ввод
- [ ] Регулярно проверять журналы

## Покрытие тестами

### Тесты безопасности

- [ ] Тесты глубокой вложенности
- [ ] Тесты обработки больших файлов
- [ ] Тесты некорректного ввода
- [ ] Тесты граничных условий

### Тесты производительности

- [ ] Тесты параллельной обработки
- [ ] Тесты больших объёмов данных
- [ ] Тесты на утечки памяти

## Команды быстрой проверки

```bash
# Проверка конфиденциальных полей
grep -r "password\|token\|secret" --include="*.go"

# Проверка захардкоженной конфигурации
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# Запуск тестов безопасности
go test -run Security ./...
```

## Шаблон контрольного списка

```go
// Шаблон конфигурации для продакшена
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // Ограничения ресурсов (SecurityConfig уже задаёт безопасные значения по умолчанию)
    cfg.MaxMemory = 100 * 1024 * 1024

    // Пользовательские валидаторы
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // Аудиторский Hook
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## Связанные разделы

- [Обзор безопасности](./)
- [Конфигурация Config](../api-reference/config)
