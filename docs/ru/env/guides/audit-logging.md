---
sidebar_label: "Аудитные логи"
title: "Аудитный журнал - CyberGo env | Настройка аудита"
description: "Аудит CyberGo env: обработчики JSONAuditHandler, LogAuditHandler, ChannelAuditHandler и пользовательский AuditHandler для записи операций над переменными."
sidebar_position: 5
---

# Аудитный журнал

Функция аудитного журнала записывает все операции с переменными окружения для проведения аудита безопасности, проверок соответствия и устранения неполадок.

## Включение аудита

### Конфигурация

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### Предустановки конфигурации

| Предустановка | Состояние аудита |
|------|----------|
| `DefaultConfig()` | Отключён |
| `DevelopmentConfig()` | Отключён |
| `TestingConfig()` | Отключён |
| `ProductionConfig()` | Включён |

---

## Обработчики аудита

### JSONAuditHandler

Вывод журналов в формате JSON:

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Пример вывода:**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration_ns":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"set","key":"[MASKED:7 chars]","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

Чувствительные ключи (например, `API_KEY`) автоматически маскируются в поле `key` аудитного журнала как `[MASKED:N chars]` (N — длина ключа); нечувствительные ключи (например, `CUSTOM_VAR`) отображаются как есть.

---

### LogAuditHandler

Вывод через стандартный пакет log:

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Пример вывода:**

```text
[AUDIT] 2024/01/15 10:30:00 action=load success=true reason="" file=.env duration=1.23ms
[AUDIT] 2024/01/15 10:30:01 action=set key=[MASKED:7 chars] success=true reason=""
[AUDIT] 2024/01/15 10:30:02 action=set key=CUSTOM_VAR success=true reason=""
```

---

### ChannelAuditHandler

Отправка в канал для асинхронной обработки:

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// Асинхронная обработка событий аудита
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**Сценарии использования:**
- Отправка в удалённый сервис логирования
- Запись в базу данных
- Мониторинг и оповещения в реальном времени

---

### NopAuditHandler

Обработчик без операций, отбрасывающий все события:

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**Сценарии использования:**
- Временное отключение аудита
- Тестовая среда

---

## События аудита

### Структура AuditEvent

```go
type AuditEvent struct {
    Timestamp time.Time   // Метка времени
    Action    AuditAction // Тип операции
    Key       string      // Имя ключа
    File      string      // Имя файла
    Reason    string      // Причина
    Success   bool        // Успешность
    Masked    bool        // Маскировка
    Details   string      // Подробности
    Duration  int64       // Длительность (наносекунды)
}
```

### Типы операций AuditAction

| Константа | Значение | Описание |
|------|---|------|
| `ActionLoad` | `load` | Загрузка файла |
| `ActionParse` | `parse` | Операция парсинга |
| `ActionGet` | `get` | Чтение переменной |
| `ActionSet` | `set` | Установка переменной |
| `ActionDelete` | `delete` | Удаление переменной |
| `ActionValidate` | `validate` | Операция валидации |
| `ActionExpand` | `expand` | Подстановка переменной |
| `ActionSecurity` | `security` | Событие безопасности |
| `ActionError` | `error` | Событие ошибки |
| `ActionFileAccess` | `file_access` | Доступ к файлу |

---

## Пользовательский обработчик

### Реализация интерфейса FullAuditLogger

`FullAuditLogger` — это полный интерфейс аудитного журнала, расширяющий минимальный интерфейс `AuditLogger` (содержащий только метод LogError):

```go
type FullAuditLogger interface {
    AuditLogger  // Встроенный минимальный интерфейс (LogError)
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### Пример: обработчик аудита с базой данных

```go
package myhandler

import (
    "database/sql"
    "time"
    "github.com/cybergodev/env"
)

type DatabaseAuditHandler struct {
    db *sql.DB
}

func NewDatabaseAuditHandler(db *sql.DB) *DatabaseAuditHandler {
    return &DatabaseAuditHandler{db: db}
}

func (h *DatabaseAuditHandler) Log(action env.AuditAction, key, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success)
        VALUES (?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogError(action env.AuditAction, key, errMsg string) error {
    return h.Log(action, key, errMsg, false)
}

func (h *DatabaseAuditHandler) LogWithFile(action env.AuditAction, key, file, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, file, reason, success)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, file, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogWithDuration(action env.AuditAction, key, reason string, success bool, duration time.Duration) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success, duration.Milliseconds())
    return err
}

func (h *DatabaseAuditHandler) Close() error {
    return nil
}
```

---

## Полный пример

### Конфигурация для производственной среды

```go
package main

import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // Создание файла аудитного журнала
    auditFile, err := os.OpenFile("/var/log/app/env-audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // Конфигурация
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // Создание загрузчика
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // Загрузка конфигурации
    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    // Валидация
    err = loader.Validate()
    if err != nil {
        log.Fatal(err)
    }

    // Использование конфигурации
    log.Println("Configuration loaded successfully")
}
```

### Асинхронная обработка аудита

```go
package main

import (
    "encoding/json"
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // Создание канала событий аудита
    auditChan := make(chan env.AuditEvent, 1000)

    // Запуск асинхронного обработчика
    go processAuditEvents(auditChan)

    // Конфигурация
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

    loader, _ := env.New(cfg)
    defer loader.Close()

    // Обычное использование...
}

func processAuditEvents(ch chan env.AuditEvent) {
    file, _ := os.OpenFile("/var/log/app/audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    defer file.Close()

    encoder := json.NewEncoder(file)

    for event := range ch {
        // Можно добавить фильтрацию, агрегацию и т.д.
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## Вопросы безопасности

### Записи аудита и маскирование

Аудитный журнал автоматически маскирует поле `key` для чувствительных ключей (по умолчанию отображается как `[MASKED:N chars]`, где N — количество символов в имени ключа; нечувствительные ключи отображаются как есть). **События аудита записываются только для операций записи**: `Set` / `Delete` / `LoadFiles` и т. п. вызывают события `ActionSet` / `ActionDelete` / `ActionLoad` и фиксируют ключ в маскированном виде.

Операции чтения не порождают аудит: `Get` / `GetString` / `GetInt` / `GetSecure` и т. п. **при успешном чтении не создают записей аудита**. Событие `ActionGet` возникает только на пути ошибки при **неудачном преобразовании типа** в `GetInt` / `GetBool` / `GetFloat64` и т. п. (`success=false`), например:

```go
// Операция записи: создаёт событие аудита (с маскированным чувствительным ключом)
_ = loader.Set("API_KEY", "sk-1234567890")
// Запись аудита: {"action":"set","key":"[MASKED:7 chars]","success":true,"masked":true}

// Операции чтения: нормальное чтение не порождает аудит
secret := loader.GetSecure("API_KEY") // не создаёт записи аудита
_ = loader.GetInt("PORT")             // успешный разбор — записи аудита нет
_ = loader.GetInt("API_KEY")          // при неудачном разборе возникает событие ActionGet (success=false)
```

### Права доступа к журналу аудита

```bash
# Установка прав доступа к файлу аудитного журнала
chmod 600 /var/log/app/env-audit.log

# Только пользователь приложения должен иметь доступ на чтение/запись
chown app:app /var/log/app/env-audit.log
```

### Ротация журналов

Рекомендуется использовать logrotate для управления журналами аудита:

```bash
# /etc/logrotate.d/app-env-audit
/var/log/app/env-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 app app
}
```

---

## Связанная документация

- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и основные возможности
- [Контрольный список для продакшена](/ru/env/security/production-checklist) - Проверка конфигурации аудита
- [Определение интерфейсов](/ru/env/api-reference/interfaces) - Интерфейс AuditLogger
- [Фабрика компонентов](/ru/env/api-reference/factory) - Фабрика обработчиков аудита
