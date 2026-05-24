---
title: "Быстрый старт - CyberGo DD | Руководство за 5 минут"
description: "Полное руководство для быстрого старта с высокопроизводительной библиотекой структурированного логирования CyberGo DD, от установки зависимостей до первого вывода логов, с пошаговым изучением создания логгера, настройки целей вывода и стратегий ротации файлов, использования структурированных полей для записи контекстной информации запросов и расширения функциональности через систему хуков, освоение основных возможностей за 5 минут для применения в реальных проектах."
---

# Быстрый старт

## 1. Создание логгера

DD предоставляет множество удобных конструкторов для различных сценариев:

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    // Способ 1: Глобальный логгер по умолчанию (нулевая конфигурация)
    dd.Info("Использование глобального логгера")

    // Способ 2: Режим разработки (уровень DEBUG, с caller)
    dev, _ := dd.New(dd.DevelopmentConfig())
    defer dev.Close()
    dev.Info("Вывод в режиме разработки")

    // Способ 3: Вывод в файл
    file, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    defer file.Close()
    file.Info("Вывод в файл")

    // Способ 4: Одновременный вывод в консоль и файл
    all, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    defer all.Close()
    all.Info("Вывод в две цели")

    // Способ 5: Двойной вывод в формате JSON
    jsonLogger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    defer jsonLogger.Close()
    jsonLogger.Info("Вывод в формате JSON")
}
```

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

:::tip Вывод в формате JSON
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

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})

logger.Info("hello world")
```

## 6. Фильтрация конфиденциальных данных

DD по умолчанию включает базовую фильтрацию конфиденциальных данных (автоматическое маскирование паролей, API-ключей, номеров кредитных карт и т.д.):

```go
// Конфигурация по умолчанию уже включает базовую фильтрацию безопасности
logger, _ := dd.New(dd.DefaultConfig())

// Поле password автоматически маскируется
logger.InfoWith("Пользователь вошёл",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // Вывод: [REDACTED]
)
```

## Следующие шаги

- [Основные концепции](./guides/core-concepts) -- понимание архитектуры Logger и конвейера обработки
- [Структурированное логирование](./guides/structured-logging) -- подробное описание использования полей
- [Вывод в файл и ротация](./guides/file-output) -- подробное описание FileWriter
- [Фильтрация конфиденциальных данных](./guides/sensitive-filtering) -- практикум по фильтрации безопасности
- [Шпаргалка](./cheatsheet) -- краткий справочник по API
