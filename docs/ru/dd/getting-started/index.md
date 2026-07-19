---
sidebar_label: "Быстрый старт"
title: "Быстрый старт - CyberGo DD | Руководство за 5 минут"
description: "Полное руководство для быстрого старта с высокопроизводительной библиотекой структурированного логирования CyberGo DD: от установки зависимостей до первой записи лога, с пошаговым изучением создания логгера, настройки целей вывода и стратегий ротации файлов, использования структурированных полей для записи контекстной информации запросов и расширений через систему хуков — освоить ключевые приёмы за 5 минут и применять в реальных проектах."
sidebar_position: 1
---

# Быстрый старт

## 1. Создание логгера

DD предоставляет множество удобных конструкторов для различных сценариев:

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    // Способ 1: Глобальный логгер по умолчанию (нулевая конфигурация)
    dd.Info("Использование глобального логгера")

    // Способ 2: Режим разработки (уровень DEBUG, с caller)
    dev, err := dd.New(dd.DevelopmentConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer dev.Close()
    dev.Info("Вывод в режиме разработки")

    // Способ 3: Вывод в файл
    file, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer file.Close()
    file.Info("Вывод в файл")

    // Способ 4: Одновременный вывод в консоль и файл
    all, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer all.Close()
    all.Info("Вывод в две цели")

    // Способ 5: Двойной вывод в формате JSON
    jsonLogger, err := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer jsonLogger.Close()
    jsonLogger.Info("Вывод в формате JSON")
}
```

:::warning Ловушка нулевого Config
Выше способы 3/4/5 используют литерал `dd.Config{...}` напрямую, явно задавая только `Targets`/`Format`, остальные поля остаются нулевыми: `Level=Debug` (без фильтрации), `IncludeTime=false` (без временной метки), `IncludeLevel=false` (без уровня), `DynamicCaller=false` (без caller), `Security=nil` (откатывается к `DefaultSecurityConfig()` — базовая фильтрация остаётся включённой, около 36 категорий маскирования; чтобы отключить, явно укажите `&dd.SecurityConfig{}` или `SecurityLevelDevelopment`). В выводе будут отсутствовать временная метка, уровень и другая ключевая информация.

**Рекомендация для production**: используйте `dd.DefaultConfig()` как основу и изменяйте нужные поля — это сразу даёт временную метку, уровень, caller и фильтрацию безопасности по умолчанию:

```go
cfg := dd.DefaultConfig()                 // Level=Info, Format=Text, со временем/уровнем/caller/Security
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}
logger, err := dd.New(cfg)
```

Аналогично `dd.DevelopmentConfig()` (DEBUG+caller) и `dd.JSONConfig()` (DEBUG+JSON+RFC3339) — готовые отправные точки с полным набором полей.
:::

## 2. Уровни логирования

DD поддерживает 5 уровней логирования, от низшего к высшему:

```go
dd.Debug("Отладочная информация")   // LevelDebug
dd.Info("Общая информация")    // LevelInfo (по умолчанию)
dd.Warn("Предупреждение")    // LevelWarn
dd.Error("Ошибка")   // LevelError
dd.Fatal("Фатальная ошибка")   // LevelFatal (вызывает os.Exit)
```

Форматированные версии:

```go
dd.Debugf("Пользователь %s вошёл, затрачено %dмс", name, elapsed)
dd.Infof("Запрос обработан: status=%d", status)
dd.Warnf("Использование пула соединений %d%%", usage)
dd.Errorf("Ошибка запроса к БД: %v", err)
```

## 3. Структурированное логирование

Используйте типобезопасные конструкторы полей:

```go
dd.InfoWith("Запрос обработан",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

Пример вывода (текстовый формат по умолчанию):

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 Запрос обработан method=GET path=/api/users status=200 elapsed=150ms
```

:::tip Подсказка
Вывод в формате JSON
Глобальный логгер по умолчанию использует текстовый формат. Для вывода в формате JSON используйте `dd.New(dd.JSONConfig())` для создания логгера с форматом JSON.
:::

## 4. Цепочная передача полей

```go
// Создание Entry с предустановленными полями
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// Каждый лог автоматически несёт предустановленные поля
requestLogger.Info("Сервис запущен")
requestLogger.InfoWith("Маршруты зарегистрированы",
    dd.Int("routes", 42),
)
```

## 5. Ротация файлов

Настройка стратегии ротации через `FileWriter`:

```go
// По умолчанию 100МБ, 30 дней, 10 резервных копий
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

logger.Info("hello world")
```

## 6. Фильтрация конфиденциальных данных

DD по умолчанию включает базовую фильтрацию конфиденциальных данных (автоматическое маскирование паролей, API-ключей, номеров кредитных карт и т.д.):

```go
// Конфигурация по умолчанию уже включает базовую фильтрацию безопасности
logger, err := dd.New(dd.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// Поле password автоматически маскируется
logger.InfoWith("Пользователь вошёл",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // Вывод: [REDACTED]
)
```

## Следующие шаги

- [Основные концепции](../guides/core-concepts) -- понимание архитектуры Logger и конвейера обработки
- [Структурированное логирование](../guides/structured-logging) -- подробное описание использования полей
- [Вывод в файл и ротация](../guides/file-output) -- подробное описание FileWriter
- [Фильтрация конфиденциальных данных](../guides/sensitive-filtering) -- практикум по фильтрации безопасности
- [Шпаргалка](./cheatsheet) -- краткий справочник по API
