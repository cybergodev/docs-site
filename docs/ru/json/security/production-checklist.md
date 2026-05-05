---
title: Контрольный список для продакшена - CyberGo JSON | Безопасное развёртывание
description: "Контрольный список безопасности для развёртывания CyberGo JSON в продакшене: настройка безопасности, ресурсные ограничения MaxNestingDepthSecurity/MaxMemory, валидация входных данных, обработка ошибок, настройка мониторинга и оповещений, а также лучшие практики баланса производительности и безопасности."
---

# Контрольный список для продакшена

Перед развёртыванием в продакшен проверьте следующие пункты безопасности.

## Проверка конфигурации

### Ресурсные ограничения

- [ ] Установите `MaxNestingDepthSecurity` для предотвращения атак глубокой вложенности
- [ ] Установите `MaxJSONSize` для ограничения размера одного значения
- [ ] Установите `MaxMemory` для ограничения общего использования памяти

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## Валидация входных данных

### Обязательные поля

- [ ] Проверьте наличие всех обязательных полей
- [ ] Проверьте правильность типов полей

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

### Проверка формата

- [ ] Проверьте формат email
- [ ] Проверьте формат URL
- [ ] Проверьте пользовательские форматы

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

### Проверка диапазона

- [ ] Проверьте диапазон числовых значений
- [ ] Проверьте длину строк
- [ ] Проверьте длину массивов

```go
// Использование Schema для проверки диапазона
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

- [ ] Фильтруйте поля паролей
- [ ] Фильтруйте поля токенов
- [ ] Фильтруйте другие конфиденциальные данные

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

- [ ] Не записывайте конфиденциальные данные в журналы
- [ ] Сообщения об ошибках не должны содержать конфиденциальную информацию

## Обработка ошибок

### Безопасные ответы об ошибках

- [ ] Не раскрывайте внутренние детали ошибок
- [ ] Используйте обобщённые сообщения об ошибках
- [ ] Записывайте подробные ошибки в журнал

```go
if err != nil {
    log.Error("Подробная ошибка", "error", err)
    return errors.New("Операция не удалась, повторите попытку позже")
}
```

## Мониторинг и аудит

### Мониторинг производительности

- [ ] Отслеживайте время парсинга
- [ ] Отслеживайте использование памяти
- [ ] Установите пороги оповещений

```go
// Использование Hook для мониторинга производительности
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("операция", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### Журналы аудита

- [ ] Записывайте ключевые операции
- [ ] Записывайте аномальные входные данные
- [ ] Регулярно проверяйте журналы

## Покрытие тестами

### Тесты безопасности

- [ ] Тесты глубокой вложенности
- [ ] Тесты обработки больших файлов
- [ ] Тесты некорректных входных данных
- [ ] Тесты граничных условий

### Тесты производительности

- [ ] Тесты параллельной обработки
- [ ] Тесты с большими объёмами данных
- [ ] Тесты на утечки памяти

## Команды быстрой проверки

```bash
# Проверка конфиденциальных полей
grep -r "password\|token\|secret" --include="*.go"

# Проверка жёстко заданных конфигураций
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# Запуск тестов безопасности
go test -run Security ./...
```

## Шаблон контрольного списка

```go
// Шаблон конфигурации для продакшена
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // Ресурсные ограничения (SecurityConfig уже задает безопасные значения по умолчанию)
    cfg.MaxMemory = 100 * 1024 * 1024

    // Пользовательские валидаторы
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // Хуки аудита
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## Смотрите также

- [Обзор безопасности](./)
- [Конфигурация Config](../api-reference/config)
