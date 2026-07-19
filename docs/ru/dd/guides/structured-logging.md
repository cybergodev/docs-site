---
sidebar_label: "Структурированное логирование"
title: "Структурированное логирование - CyberGo DD | Поля и цепочки"
description: "Руководство по структурированному логированию CyberGo DD с подробным описанием 20 типобезопасных конструкторов полей, шаблонов цепочной передачи Field, принципов неизменяемого дизайна LoggerEntry, соглашений об именовании полей и правил валидации, а также лучших практик и распространённых паттернов структурированного логирования, помогая разработчикам эффективно использовать высокопроизводительное решение структурированного логирования в проектах."
sidebar_position: 2
---

# Структурированное логирование

Структурированное логирование записывает контекстную информацию через поля с парами ключ-значение, делая логи доступными для программного разбора, поиска и анализа. DD предоставляет типобезопасные конструкторы полей и гибкий механизм цепочных вызовов.

## Конструкторы полей

DD предоставляет 20+ типобезопасных конструкторов полей:

### Базовые типы

```go
dd.InfoWith("Регистрация пользователя",
    dd.String("username", "alice"),
    dd.Int("age", 25),
    dd.Float64("score", 98.5),
    dd.Bool("verified", true),
)
```

### Временные типы

```go
dd.InfoWith("Выполнение запланированной задачи",
    dd.Time("scheduled_at", time.Now()),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

### Семейство целочисленных типов

```go
dd.InfoWith("Обработка пакета данных",
    dd.Int8("flags", 0x0F),
    dd.Int32("seq", 1001),
    dd.Int64("total_bytes", 1<<20),
    dd.Uint16("port", 8080),
    dd.Uint32("src_ip", 0xC0A80101),
)
```

### Обработка ошибок

```go
// Ключ по умолчанию "error"
dd.ErrorWith("Ошибка запроса", dd.Err(err))

// Пользовательский ключ
dd.ErrorWith("Ошибка БД", dd.ErrWithKey("db_error", dbErr))

// С информацией о стеке вызовов
dd.ErrorWith("Критическая ошибка", dd.ErrWithStack(err))
```

### Произвольный тип

```go
// Любой тип, форматируется через fmt.Sprintf
dd.InfoWith("Полезная нагрузка запроса", dd.Any("body", requestBody))
```

:::warning Замечание о производительности
Сам по себе `Any` не использует рефлексию; она применяется только на этапах фильтрации и форматирования сложных типов (struct/map/slice). Для примитивов (int/string/bool/time и т.п.) дополнительных накладных расходов нет; для сложных типов производительность ниже, чем у типизированных конструкторов. На высокочастотных путях предпочитайте конкретные типы.
:::

## Цепочные вызовы

### Logger → Entry

```go
// Создание Entry с предустановленными полями
reqLog := logger.WithFields(
    dd.String("service", "api"),
    dd.String("version", "1.0"),
)

// Entry автоматически несёт предустановленные поля
reqLog.Info("Сервис запущен")
reqLog.Warn("Высокое использование памяти")
reqLog.ErrorWith("Ошибка запроса",
    dd.String("path", "/api/users"),
    dd.Err(err),
)
```

### Entry → Entry (многоуровневое вложение)

```go
// Уровень сервиса
svcLog := logger.WithFields(dd.String("service", "order"))

// Уровень модуля (наследует поля уровня сервиса)
dbLog := svcLog.WithFields(dd.String("module", "database"))

// Уровень операции (наследует все поля верхних уровней)
queryLog := dbLog.WithFields(dd.String("operation", "query"))

queryLog.InfoWith("Запрос выполнен",
    dd.Int("rows", 42),
    dd.Duration("elapsed", 10*time.Millisecond),
)
// Поля: service=order module=database operation=query rows=42 elapsed=10ms
```

### Цепочные вызовы через пакетные функции

```go
dd.WithFields(
    dd.String("app", "myapp"),
    dd.String("env", "production"),
).Info("Приложение запущено")
```

## Соглашения об именовании полей

DD поддерживает настройку соглашений об именовании полей с автоматической проверкой на этапе разработки:

### Встроенные соглашения

```go
// snake_case (рекомендуется, наиболее универсальный)
cfg := dd.StrictSnakeCaseConfig()

// camelCase
cfg := dd.StrictCamelCaseConfig()

// Без ограничений (по умолчанию)
cfg := dd.DefaultFieldValidationConfig()
```

### Включение в конфигурации

```go
logger, err := dd.New(dd.Config{
    FieldValidation: dd.StrictSnakeCaseConfig(),
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
```

После включения несоответствующие имена полей будут вызывать ошибку в **stderr** (режим Strict) или предупреждение (режим Warn), сама строка лога не затрагивается:

```go
logger.InfoWith("Тест",
    dd.String("UserName", "alice"),   // PascalCase → ошибка в stderr (лог всё равно пишется)
    dd.String("user_name", "alice"),  // snake_case → нормально
)
```

## Распространённые паттерны

### Логирование HTTP-запросов

```go
func loggingMiddleware(logger *dd.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            reqLog := logger.WithFields(
                dd.String("method", r.Method),
                dd.String("path", r.URL.Path),
                dd.String("remote_addr", r.RemoteAddr),
                dd.String("user_agent", r.UserAgent()),
            )

            next.ServeHTTP(w, r)

            reqLog.InfoWith("Запрос завершён",
                dd.Duration("elapsed", time.Since(start)),
            )
        })
    }
}
```

### Многоуровневое логирование сервиса

```go
type UserService struct {
    log *dd.LoggerEntry
}

func NewUserService(logger *dd.Logger) *UserService {
    return &UserService{
        log: logger.WithFields(dd.String("component", "user_service")),
    }
}

func (s *UserService) CreateUser(ctx context.Context, name string) error {
    s.log.InfoWith("Создание пользователя",
        dd.String("name", name),
    )

    if err := s.validate(name); err != nil {
        s.log.ErrorWith("Ошибка создания пользователя",
            dd.String("name", name),
            dd.Err(err),
        )
        return err
    }

    return nil
}
```

### Условное логирование (избегание ненужных вычислений)

```go
// Способ 1: сначала проверить уровень
if logger.IsDebugEnabled() {
    data := computeExpensiveDebugInfo()
    logger.DebugWith("Отладочные данные", dd.Any("data", data))
}

// Способ 2: использование отложенного вычисления WithFields
reqLog := logger.WithFields(dd.String("request_id", reqID))
// WithFields только конструирует поля, не создаёт накладных расходов I/O
// Фактическая запись лога происходит только при вызове Info/Error и т.д.
```

## Формат вывода

### Текстовый формат (по умолчанию)

```text
[2026-04-16T21:16:48+08:00   INFO] logger.go:1567 Запрос завершён method=GET status=200 elapsed=150ms
```

:::info Подсказка о поле caller
Поле `caller` фиксирует место вызова: при использовании методов `*Logger` (например `logger.InfoWith(...)`) caller разрешается во внутренний кадр библиотеки (например `logger.go:1567`) — это разрешение недетерминировано и в простом `main` может разрешиться в `main.go`; при использовании функций уровня пакета (например `dd.InfoWith`) надёжно разрешается в пользовательский код.
:::

### Формат JSON

```go
logger, err := dd.New(dd.JSONConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()
logger.InfoWith("Запрос завершён",
    dd.String("method", "GET"),
    dd.Int("status", 200),
)
```

```json
{"timestamp":"2026-04-16T21:16:48+08:00","level":"INFO","caller":"logger.go:1567","message":"Запрос завершён","fields":{"method":"GET","status":200}}
```

## Следующие шаги

- [Вывод в файл и ротация](./file-output) -- запись логов в файл
- [Фильтрация конфиденциальных данных](./sensitive-filtering) -- автоматическое маскирование конфиденциальной информации
- [Справочник API - Поля](../api-reference/output-integration/fields) -- все конструкторы полей
- [Справочник API - LoggerEntry](../api-reference/core/entry) -- полные методы Entry
