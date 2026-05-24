---
title: "Аудитные логи - CyberGo DD | AuditLogger"
description: "Полная документация API аудитных логов CyberGo DD, включая асинхронный регистратор аудитных событий AuditLogger, параметры конфигурации AuditConfig (цель вывода, формат, подписи) и структурированное форматирование записей аудита, поддерживает отслеживание событий, связанных с безопасностью, удовлетворяющая различным требованиям корпоративного аудита соответствия и надзора за безопасностью данных."
---

# Аудитные логи

DD предоставляет функцию асинхронных аудитных логов для записи событий, связанных с безопасностью, с поддержкой подписей целостности и цепочной проверки.

## AuditLogger

Асинхронный регистратор событий аудита безопасности.

### Создание

```go
func NewAuditLogger(cfg AuditConfig) (*AuditLogger, error)
```

```go
// С конфигурацией по умолчанию
auditLogger, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())

// С пользовательской конфигурацией
cfg := dd.DefaultAuditConfig()
cfg.JSONFormat = true
cfg.MinimumSeverity = dd.AuditSeverityWarning
auditLogger, _ := dd.NewAuditLogger(cfg)
```

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Log` | `(event AuditEvent)` | Записать аудитное событие (асинхронно) |
| `LogSensitiveDataRedaction` | `(pattern, field, message string)` | Событие маскирования конфиденциальных данных |
| `LogRateLimitExceeded` | `(message string, metadata map[string]any)` | Событие ограничения скорости |
| `LogSecurityViolation` | `(violationType, message string, metadata map[string]any)` | Событие нарушения безопасности |
| `LogReDoSAttempt` | `(pattern, message string)` | Событие атаки ReDoS |
| `LogIntegrityViolation` | `(message string, metadata map[string]any)` | Событие нарушения целостности |
| `LogPathTraversalAttempt` | `(path, message string)` | Событие обхода пути |
| `Stats` | `() AuditStats` | Статистика аудита |
| `Close` | `() error` | Закрытие и сброс оставшихся событий |

### Пример использования

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

// Запись маскирования конфиденциальных данных
audit.LogSensitiveDataRedaction("password", "login_form", "Обнаружено открытое поле пароля")

// Запись ограничения скорости
audit.LogRateLimitExceeded("Превышен лимит API-запросов", map[string]any{
    "client_ip": "192.168.1.100",
    "limit":     100,
    "current":   150,
})

// Запись нарушения безопасности
audit.LogSecurityViolation("sql_injection", "Попытка SQL-инъекции", map[string]any{
    "input": "' OR 1=1 --",
})
```

## AuditConfig

Конфигурация аудитных логов.

```go
type AuditConfig struct {
    Enabled          bool             // Включить аудит (по умолчанию true)
    Output           *os.File         // Файл вывода (по умолчанию os.Stderr)
    BufferSize       int              // Размер буфера (по умолчанию 1000)
    IncludeTimestamp  bool            // Включать временную метку (по умолчанию true)
    JSONFormat       bool             // Вывод в формате JSON (по умолчанию true)
    MinimumSeverity  AuditSeverity    // Минимальный уровень серьёзности (по умолчанию AuditSeverityInfo)
    IntegritySigner  *IntegritySigner // Подписывающее устройство целостности
}
```

### Конфигурация по умолчанию

```go
func DefaultAuditConfig() AuditConfig
```

Возвращает конфигурацию аудита по умолчанию, аудитные логи включены по умолчанию.

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `Validate` | `() error` | Проверить корректность конфигурации |
| `Clone` | `() AuditConfig` | Копировать конфигурацию |

## AuditEvent

Структура аудитного события.

```go
type AuditEvent struct {
    Type     AuditEventType    `json:"type"`
    Timestamp time.Time        `json:"timestamp"`
    Message  string            `json:"message"`
    Pattern  string            `json:"pattern,omitempty"`
    Field    string            `json:"field,omitempty"`
    Metadata map[string]any    `json:"metadata,omitempty"`
    Severity AuditSeverity     `json:"severity"`
}
```

### AuditStats

Структура статистики аудита.

```go
type AuditStats struct {
    TotalEvents int64                      // Общее количество событий
    Dropped     int64                      // Количество отброшенных событий
    ByType      map[AuditEventType]int64   // Статистика по типам
    BufferSize  int                        // Размер буфера
    BufferUsage int                        // Использование буфера
}
```

### AuditVerificationResult

Результат проверки аудита.

```go
type AuditVerificationResult struct {
    Valid    bool         // Прошла ли проверка
    Event    *AuditEvent  // Распарсенное событие
    RawEvent string       // Исходная строка события
    Error    error        // Ошибка проверки
}
```

## Типы аудитных событий

| Константа | String() | Описание |
|-----------|----------|----------|
| `AuditEventSensitiveDataRedacted` | `"SENSITIVE_DATA_REDACTED"` | Конфиденциальные данные замаскированы |
| `AuditEventRateLimitExceeded` | `"RATE_LIMIT_EXCEEDED"` | Превышение ограничения скорости |
| `AuditEventReDoSAttempt` | `"REDOS_ATTEMPT"` | Попытка атаки ReDoS |
| `AuditEventSecurityViolation` | `"SECURITY_VIOLATION"` | Нарушение безопасности |
| `AuditEventIntegrityViolation` | `"INTEGRITY_VIOLATION"` | Нарушение целостности |
| `AuditEventInputSanitized` | `"INPUT_SANITIZED"` | Входные данные очищены |
| `AuditEventPathTraversalAttempt` | `"PATH_TRAVERSAL_ATTEMPT"` | Попытка обхода пути |
| `AuditEventLog4ShellAttempt` | `"LOG4SHELL_ATTEMPT"` | Попытка атаки Log4Shell |
| `AuditEventNullByteInjection` | `"NULL_BYTE_INJECTION"` | Инъекция null-байта |
| `AuditEventOverlongEncoding` | `"OVERLONG_ENCODING"` | Атака сверхдлинной кодировкой |
| `AuditEventHomographAttack` | `"HOMOGRAPH_ATTACK"` | Атака гомоглифами |

## Уровни серьёзности аудита

| Константа | String() | Описание |
|-----------|----------|----------|
| `AuditSeverityInfo` | `"INFO"` | Информация |
| `AuditSeverityWarning` | `"WARNING"` | Предупреждение |
| `AuditSeverityError` | `"ERROR"` | Ошибка |
| `AuditSeverityCritical` | `"CRITICAL"` | Критический |

### MarshalJSON

```go
func (s AuditSeverity) MarshalJSON() ([]byte, error)
```

`AuditSeverity` реализует интерфейс `json.Marshaler`, при JSON-сериализации выводит строку, а не число:

```go
event := dd.AuditEvent{
    Type:     dd.AuditEventSecurityViolation,
    Severity: dd.AuditSeverityCritical,
}
data, _ := json.Marshal(event)
// Severity сериализуется как "CRITICAL", а не 3
```

## Проверка аудитных записей

```go
func VerifyAuditEvent(entry string, signer *IntegritySigner) *AuditVerificationResult
```

Проверка целостности записи аудитного лога.

```go
cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
result := dd.VerifyAuditEvent(logEntry, signer)
if result != nil && result.Valid {
    fmt.Println("Аудитная запись прошла проверку")
}
```

## Следующие шаги

- [Подписи целостности](./integrity) -- подробное описание IntegritySigner
- [Фильтрация безопасности](./security) -- фильтрация конфиденциальных данных
- [Система хуков](./hooks) -- хук OnError
