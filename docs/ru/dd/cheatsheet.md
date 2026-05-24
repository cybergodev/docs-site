---
title: "Шпаргалка - CyberGo DD | Краткий справочник API"
description: "Краткий справочник API библиотеки логирования CyberGo DD, охватывающий создание и клонирование логгеров, управление уровнями логирования, конструкторы структурированных полей, конфигурацию ротации и буферизации вывода в файл, правила фильтрации конфиденциальных данных, регистрацию хуков и функции обратного вызова, аудитные логи и проверку подписей целостности для высокочастотных операций, удобный для быстрого ознакомления и использования разработчиками."
---

# Шпаргалка

## Создание логгера

| Способ | Код | Описание |
|--------|-----|----------|
| Глобальный по умолчанию | `dd.Info("msg")` | Использование без настройки |
| Режим разработки | `dd.New(dd.DevelopmentConfig())` | Уровень DEBUG, с caller |
| Пользовательский | `dd.New(dd.Config{Targets: ...})` | Полная конфигурация |
| Файл | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.FileOutput("path")}})` | Только вывод в файл |
| Двойной вывод | `dd.New(dd.Config{Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | Консоль + файл |
| JSON двойной вывод | `dd.New(dd.Config{Format: dd.FormatJSON, Targets: []dd.OutputTarget{dd.ConsoleOutput(), dd.FileOutput("path")}})` | Двойной вывод в формате JSON |

## Предустановленные конфигурации

```go
dd.DefaultConfig()       // Конфигурация по умолчанию: уровень INFO, текстовый формат
dd.DevelopmentConfig()   // Конфигурация разработки: уровень DEBUG, динамический caller
dd.JSONConfig()          // JSON конфигурация: вывод в формате JSON
```

## Уровни логирования

| Уровень | Константа | Метод | Форматированный |
|---------|-----------|-------|-----------------|
| Debug | `LevelDebug` | `Debug()` | `Debugf()` |
| Info | `LevelInfo` | `Info()` | `Infof()` |
| Warn | `LevelWarn` | `Warn()` | `Warnf()` |
| Error | `LevelError` | `Error()` | `Errorf()` |
| Fatal | `LevelFatal` | `Fatal()` | `Fatalf()` |

Структурированные версии: `DebugWith()`, `InfoWith()`, `WarnWith()`, `ErrorWith()`, `FatalWith()`

## Конструкторы полей

| Тип | Конструктор | Пример |
|-----|-------------|--------|
| Универсальный | `Any(key, val)` | `dd.Any("data", obj)` |
| Строка | `String(key, val)` | `dd.String("name", "test")` |
| Целое число | `Int(key, val)` | `dd.Int("count", 42)` |
| Логический | `Bool(key, val)` | `dd.Bool("ok", true)` |
| Время | `Time(key, val)` | `dd.Time("ts", time.Now())` |
| Длительность | `Duration(key, val)` | `dd.Duration("took", 100*time.Millisecond)` |
| Ошибка | `Err(err)` | `dd.Err(err)` |
| Ошибка + стек | `ErrWithStack(err)` | `dd.ErrWithStack(err)` |

## Цепочки полей

```go
// Предустановленные поля
entry := dd.WithFields(dd.String("svc", "api"))
entry.Info("Запуск")                    // Автоматически несёт svc=api

// Добавление полей
entry2 := entry.WithField("env", "prod")
entry2.Info("Среда готова")               // Несёт svc + env
```

## Цели вывода

```go
// Файловый writer (автоматическая ротация)
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())

// Буферизированный writer
bwCfg := dd.DefaultBufferedWriterConfig()
bwCfg.BufferSize = 4096
bw, _ := dd.NewBufferedWriter(os.Stdout, bwCfg)

// Множественный writer
mw := dd.NewMultiWriter(os.Stdout, fw)
```

## Интеграция с контекстом

```go
ctx = dd.WithTraceID(ctx, "trace-123")
ctx = dd.WithRequestID(ctx, "req-456")
dd.GetTraceID(ctx)     // "trace-123"
dd.GetRequestID(ctx)   // "req-456"
```

## Конфигурация безопасности

```go
dd.DefaultSecurityConfig()   // Базовая фильтрация (рекомендуется)
dd.DefaultSecureConfig()     // Полная фильтрация
dd.HealthcareConfig()        // Соответствие HIPAA
dd.FinancialConfig()         // Соответствие PCI-DSS
dd.GovernmentConfig()        // Правительственный стандарт
```

## Жизненный цикл

```go
logger.Flush()                           // Сброс буфера
logger.Close()                           // Закрытие логгера
logger.Shutdown(ctx)                     // Изящное завершение (с таймаутом)
dd.SetDefault(logger)                    // Замена глобального логгера
dd.InitDefault(cfg)                      // Инициализация глобального логгера
```

## Отладочный вывод

```go
// Через глобальный Logger (с фильтрацией безопасности)
dd.Print("Значение:", val)       // Быстрый вывод
dd.Printf("Формат: %v", val) // Форматированный вывод

// Прямой вывод (без фильтрации безопасности, только для отладки)
dd.JSON(data)              // Отладочный вывод в формате JSON
dd.Text(data)              // Отладочный вывод в текстовом формате
dd.Exit(data)              // Вывод и выход
```
