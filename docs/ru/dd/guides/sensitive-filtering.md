---
sidebar_label: "Фильтрация конфиденциальных данных"
title: "Фильтрация данных - CyberGo DD | Маскирование логов"
description: "Руководство по настройке фильтрации конфиденциальных данных CyberGo DD, охватывающее встроенные шаблоны фильтрации (пароли, API-ключи, кредитные карты, SSN, JWT и др.), пользовательские regex-шаблоны, пять уровней безопасности, отраслевые пресеты соответствия (HIPAA, PCI-DSS, правительственный стандарт), а также статистику и мониторинг фильтрации, помогая разработчикам создавать соответствующие требованиям схемы маскирования логов."
sidebar_position: 4
---

# Фильтрация конфиденциальных данных

DD имеет встроенную автоматическую фильтрацию конфиденциальных данных, которая перед записью лога заменяет пароли, API-ключи, номера кредитных карт и другую чувствительную информацию на `[REDACTED]`, предотвращая утечку конфиденциальных данных в логи.

## Быстрое включение

```go
logger, err := dd.New(dd.Config{
    Security: dd.DefaultSecurityConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// Поле password автоматически маскируется
logger.InfoWith("Пользователь вошёл",
    dd.String("username", "alice"),
    dd.String("password", "s3cr3t123"),    // Вывод: password=[REDACTED]
)
```

## Встроенные шаблоны фильтрации

`DefaultSecurityConfig()` включает базовую фильтрацию, охватывающую следующую конфиденциальную информацию:

| Категория | Цель сопоставления |
|----------|-------------------|
| Пароли | Поля `password`, `passwd`, `pwd` и т.д. |
| API-ключи | `api_key`, `apikey`, `access_token` и т.д. |
| Кредитные карты | Форматы номеров Visa, MasterCard и др. |
| SSN | Формат номера социального страхования США |
| Номера телефонов | Мировые форматы телефонных номеров (включая международные) |

`DefaultSecureConfig()` использует **полный набор шаблонов** (включая все базовые, плюс следующие распространённые категории):

| Категория | Цель сопоставления |
|----------|-------------------|
| Email | Формат адреса электронной почты |
| IP-адреса | Адреса IPv4/IPv6 |
| JWT-токены | JWT формат, начинающийся с `eyJ` |
| Строки подключения | Пароли в строках подключения к БД |

:::info Информация
В таблице выше приведены лишь примеры распространённых категорий. На самом деле `DefaultSecurityConfig()` включает около 36 шаблонов, а отраслевые предустановки (например, `HealthcareConfig()`) могут содержать до 71; они также охватывают ключи AWS, токены Stripe/GitHub/Slack, IBAN, налоговые номера разных стран, Log4Shell и др. Полный набор шаблонов см. в исходниках `internal/patterns.go`.
:::

## Пользовательские шаблоны фильтрации

### Добавление пользовательских шаблонов

```go
filter := dd.NewEmptySensitiveDataFilter()

// Добавление пользовательских regex-шаблонов (со встроенной защитой от ReDoS)
_ = filter.AddPattern(`(?i)credit_card\s*[:=]\s*\d+`)
_ = filter.AddPattern(`(?i)phone\s*[:=]\s*\d{11}`)

logger, err := dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: filter,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

### Создание пользовательского фильтра с нуля

```go
filter, err := dd.NewCustomSensitiveDataFilter(
    `(?i)secret_key\s*[:=]\s*\S+`,
    `(?i)private_token\s*[:=]\s*\S+`,
)
if err != nil {
    log.Fatal(err) // Ошибка проверки безопасности regex
}
```

:::warning Защита от ReDoS
`NewCustomSensitiveDataFilter` имеет встроенную проверку ReDoS. Если regex имеет риск катастрофического возврата, будет возвращена ошибка. Используйте нежадные совпадения и привязанные шаблоны для предотвращения этой проблемы.
:::

## Уровни безопасности

DD предоставляет пять уровней безопасности, каждый с соответствующей предустановленной конфигурацией:

```go
// Получение конфигурации по уровню
cfg := dd.SecurityConfigForLevel(dd.SecurityLevelStandard)
```

| Уровень | Описание | Сценарий применения |
|---------|----------|-------------------|
| `SecurityLevelDevelopment` | Наиболее мягкий | Локальная разработка |
| `SecurityLevelBasic` | Базовая фильтрация | Тестовая среда |
| `SecurityLevelStandard` | Стандартная фильтрация | Общая производственная среда |
| `SecurityLevelStrict` | Строгая фильтрация | Высокие требования к безопасности |
| `SecurityLevelParanoid` | Наиболее строгий | Чувствительные отрасли: финансы/медицина и др. |

## Отраслевые предустановки соответствия

DD предоставляет три отраслевые конфигурации соответствия:

### HIPAA (медицина)

```go
cfg := dd.HealthcareConfig()
```

Дополнительная фильтрация: коды ICD-10, номера медицинских карт (MRN), номера заявлений медицинского страхования (HICN), идентификаторы пациентов.

### PCI-DSS (финансовые платежи)

```go
cfg := dd.FinancialConfig()
```

Дополнительная фильтрация: SWIFT-коды, IBAN-счета, CVV/CVC, банковские маршрутные номера.

### Правительственный стандарт

```go
cfg := dd.GovernmentConfig()
```

Дополнительная фильтрация: номера паспортов, номера водительских удостоверений, налоговые ID, варианты SSN.

### Полный пример

```go
// Медицинская система: использование конфигурации соответствия HIPAA
logger, err := dd.New(dd.Config{
    Format:   dd.FormatJSON,
    Security: dd.HealthcareConfig(),
    Targets: []dd.OutputTarget{
        dd.FileOutput("logs/hipaa-audit.json"),
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// Лог-сообщения с конфиденциальной информацией автоматически маскируются
logger.Info("Запись пациента mrn=MRN-123456 diagnosis=J18.9 обновлена")
// MRN и код ICD-10 в сообщении будут маскированы

// Структурированные поля фильтруются по чувствительности имени ключа
logger.InfoWith("Пользователь вошёл",
    dd.String("password", "s3cr3t123"),    // → [REDACTED] (имя ключа чувствительное)
    dd.String("department", "Терапия"),         // Нормальный вывод
)
```

## Статистика фильтрации

Мониторинг состояния фильтра:

```go
filter := dd.NewSensitiveDataFilter()
stats := filter.GetFilterStats()
fmt.Printf("Активные goroutines: %d\n", stats.ActiveGoroutines)
fmt.Printf("Количество шаблонов: %d\n", stats.PatternCount)
fmt.Printf("Общее количество маскирований: %d\n", stats.TotalRedactions)
fmt.Printf("Количество таймаутов: %d\n", stats.TotalTimeouts)
```

## Отключение фильтрации

```go
// Использование уровня безопасности Development (без фильтрации конфиденциальных данных)
logger, err := dd.New(dd.Config{
    Security: dd.SecurityConfigForLevel(dd.SecurityLevelDevelopment),
})
if err != nil {
    log.Fatal(err)
}

// Или ручная установка пустого SensitiveFilter
logger, err = dd.New(dd.Config{
    Security: &dd.SecurityConfig{
        SensitiveFilter: nil,
    },
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

:::warning Фильтрация включена по умолчанию
`DefaultConfig()` по умолчанию включает базовую фильтрацию конфиденциальных данных (`DefaultSecurityConfig()`). Даже без установки поля `Security` используется конфигурация безопасности по умолчанию. Для отключения фильтрации необходимо явно установить `SensitiveFilter` в `nil`.
:::

## Следующие шаги

- [Аудитные логи](./audit-logging) -- аудит событий безопасности
- [Конфигурация отраслевого соответствия](../security/compliance) -- подробно о HIPAA/PCI-DSS
- [Справочник API - Security](../api-reference/security-audit/security) -- полная документация API безопасности
- [Контрольный список для продакшена](../security/production-checklist) -- проверка перед развёртыванием
