---
sidebar_label: "Конфигурация"
title: "Конфигурация - CyberGo DD | Структура Config и пресеты"
description: "Руководство по конфигурации CyberGo DD: четыре пресета — DefaultConfig, DevelopmentConfig, JSONConfig, ProductionConfig, полный справочник по полям структуры Config, конфигурация нескольких целевых назначений вывода, настройка JSON-формата и использование Clone для глубокого копирования."
sidebar_position: 2
---

# Конфигурация

DD использует конфигурацию на основе структур (`Config`) с поддержкой автодополнения в IDE — не нужны цепочки билдеров или функции-опции. Это руководство охватывает все поля конфигурации и распространённые комбинации.

> **Справочник по API**: см. [Config](../../api-reference/core/config) для полного списка полей.

## Четыре пресета

| Пресет | Уровень | Формат | Фильтр безопасности | Типичное использование |
|--------|---------|--------|:-------------------:|----------------------|
| `DefaultConfig()` | Info | Текст | ✅ Базовый | По умолчанию для production |
| `DevelopmentConfig()` | Debug | Текст (короткое время) | ✅ Базовый | Локальная разработка |
| `JSONConfig()` | Debug | JSON (RFC3339) | ✅ Базовый | Системы агрегации логов |
| `ProductionConfig()` | Info | JSON (RFC3339) | ✅ Базовый | Продакшен (JSON-вывод) |

:::warning Предупреждение Фильтр безопасности включён по умолчанию
Все четыре пресета **включают** базовую фильтрацию конфиденциальных данных (пароли, API-ключи, номера кредитных карт и т.д.). Даже в режиме разработки она остаётся включённой — чтобы своевременно выявлять случайные утечки конфиденциальных данных. Для отключения явно установите `Security: &dd.SecurityConfig{}` или используйте `SecurityLevelDevelopment`.
:::

## Обзор полей Config

```go
type Config struct {
    // ─── Базовое ───
    Level         LogLevel     // Уровень логирования (LevelDebug ~ LevelFatal)
    Format        LogFormat    // Формат вывода (FormatText / FormatJSON)
    TimeFormat    string       // Формат времени (по умолчанию ISO 8601)
    IncludeTime   bool         // Включать временную метку
    IncludeLevel  bool         // Включать уровень логирования

    // ─── Информация о вызывающем ───
    DynamicCaller bool         // Динамическое определение вызывающего (file:line)
    FullPath      bool         // Использовать полный путь к файлу (по умолчанию: только имя файла)

    // ─── Целевые назначения вывода ───
    Targets       []OutputTarget // Целевые назначения вывода (ConsoleOutput/FileOutput/CustomOutput)

    // ─── Настройка формата ───
    JSON          *JSONOptions // Настройки JSON-формата (имена полей, отступы и т.д.)

    // ─── Безопасность ───
    Security      *SecurityConfig       // Конфигурация безопасности (фильтрация, ограничение частоты)
    FieldValidation *FieldValidationConfig // Проверка именования ключей Field

    // ─── Жизненный цикл ───
    FatalHandler      FatalHandler      // Пользовательский обработчик Fatal
    WriteErrorHandler WriteErrorHandler // Callback при ошибке записи
    LevelResolver     LevelResolver     // динамическое разрешение уровня (проверяется на каждую запись; nil — выключено)

    // ─── Расширения ───
    ContextExtractors []ContextExtractor // Экстракторы Field из контекста
    Hooks             *HookRegistry      // Хуки жизненного цикла
    Sampling          *SamplingConfig    // Сэмплирование логов

    // ─── Аудит ───
    Audit             *AuditConfig       // Логирование аудита безопасности
}
```

## Настройка целевых назначений вывода

Используйте `ConsoleOutput()`, `FileOutput()`, `CustomOutput()` для создания целевых назначений вывода:

```go
package main

import (
    "log"
    "os"
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    cfg := dd.DefaultConfig()
    cfg.Targets = []dd.OutputTarget{
        dd.ConsoleOutput(),                          // Консоль
        dd.FileOutput("logs/app.log"),               // Файл (по умолчанию 100МБ/10 резервных копий/30 дней)
        dd.CustomOutput(os.Stderr),                  // Пользовательский Writer
    }

    // Пользовательские параметры ротации файлов
    fileTarget := dd.FileOutput("logs/app.log")
    fileTarget.MaxSizeMB = 50              // Ротация при 50МБ
    fileTarget.MaxBackups = 5              // Хранить 5 резервных копий
    fileTarget.MaxAge = 7 * 24 * time.Hour // Хранить 7 дней (MaxAge — time.Duration, единица обязательна)

    logger, err := dd.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer logger.Close()
}
```

:::tip Подсказка Подводный камень нулевого значения Config
Использование `dd.Config{Targets: ...}` напрямую пропускает временные метки, уровень и информацию о вызывающем. Всегда начинайте с `dd.DefaultConfig()` и изменяйте нужные поля.
:::

## Настройка JSON-формата

```go
cfg := dd.JSONConfig()

// Пользовательские имена полей JSON
cfg.JSON = &dd.JSONOptions{
    PrettyPrint: true,
    Indent:      "  ",
    FieldNames: &dd.JSONFieldNames{
        Timestamp: "@timestamp",
        Level:     "severity",
        Message:   "msg",
        Caller:    "source",
        Fields:    "ctx",
    },
}
```

## Конфигурация безопасности

```go
cfg := dd.DefaultConfig()

// Вариант A: по уровню безопасности (рекомендуется)
cfg.Security = dd.SecurityConfigForLevel(dd.SecurityLevelStandard)

// Вариант B: отраслевые пресеты
cfg.Security = dd.HealthcareConfig()   // HIPAA
cfg.Security = dd.FinancialConfig()    // PCI-DSS
cfg.Security = dd.GovernmentConfig()   // Государственный сектор

// Вариант C: пользовательская конфигурация
cfg.Security = &dd.SecurityConfig{
    MaxMessageSize: 1024 * 1024, // 1МБ
    SensitiveFilter: dd.NewSensitiveDataFilter(),
}
```

См. [Фильтрация конфиденциальных данных](../security/sensitive-filtering) и [Обзор безопасности](../security/).

## Валидация Field

```go
cfg := dd.DefaultConfig()
cfg.FieldValidation = dd.StrictSnakeCaseConfig()
// Все ключи Field должны быть snake_case; при ошибке валидации выводится диагностика в stderr,
// но поле всё равно записывается (методы логирования не возвращают ошибку)
```

См. [Валидация Field](../security/field-validation).

## Сэмплирование логов

```go
cfg := dd.DefaultConfig()
cfg.Sampling = &dd.SamplingConfig{
    Enabled:    true,
    Initial:    100,            // Первые 100 записей всегда логируются
    Thereafter: 10,             // Затем логируется 1 из каждых 10
    Tick:       time.Second,    // Сброс счётчика каждую секунду
}
```

См. [Сэмплирование логов](../operations/sampling).

## Хуки и аудит

```go
// Хуки
registry := dd.NewHooksFromConfig(dd.HooksConfig{
    AfterLog: []dd.Hook{func(ctx context.Context, hc *dd.HookContext) error {
        // Отправка в систему метрик
        return nil
    }},
})
cfg.Hooks = registry

// Аудит
cfg.Audit = &dd.AuditConfig{
    Enabled:     true,
    Output:      auditFile,
    JSONFormat:  true,
    MinimumSeverity: dd.AuditSeverityWarning,
}
```

См. [Система Hook](../operations/hooks) и [Логирование аудита](../security/audit-logging).

## Clone: глубокое копирование конфигурации

`Clone()` создаёт копию конфигурации, что полезно для создания разных конфигураций на основе одной базовой:

```go
base := dd.DefaultConfig()
base.Format = dd.FormatJSON

// Вариант 1: конфигурация для production
prodCfg := base.Clone()
prodCfg.Level = dd.LevelInfo
prodCfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/prod.log")}

// Вариант 2: конфигурация для отладки
debugCfg := base.Clone()
debugCfg.Level = dd.LevelDebug
debugCfg.Targets = []dd.OutputTarget{dd.ConsoleOutput()}

// base остаётся без изменений
```

:::tip Подсказка Глубина копирования Clone
Глубокое копирование: JSON, Security, Hooks, Sampling, Audit, срез Targets. Поверхностное копирование: FatalHandler, WriteErrorHandler, FieldValidation (функции/указатели разделяются). Срез ContextExtractors копируется, но экземпляры экстракторов разделяются.
:::

## Следующие шаги

- [Базовые концепции](./core-concepts) -- Иерархия Logger и конвейер обработки
- [Структурированное логирование](./structured-logging) -- Конструкторы Field и цепочки
- [Справочник по API - Config](../../api-reference/core/config) -- Полная документация полей
