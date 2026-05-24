---
title: "Фильтрация безопасности - CyberGo DD | Фильтрация конфиденциальных данных"
description: "Полная документация API фильтрации конфиденциальных данных CyberGo DD, включая настройку правил фильтрации SensitiveDataFilter, параметры политики безопасности SecurityConfig и предустановленные конфигурации безопасности, автоматически обнаруживает и маскирует пароли, API-ключи, токены, номера телефонов и идентификационные номера в логах, эффективно предотвращая риски утечки через логи."
---

# Фильтрация безопасности

DD имеет встроенную функцию фильтрации конфиденциальных данных, которая автоматически обнаруживает и маскирует пароли, ключи, токены и другую чувствительную информацию в логах.

## SensitiveDataFilter

Фильтр конфиденциальных данных на основе regex, поддерживает динамические шаблоны и кэширование.

### Создание

| Функция | Сигнатура | Описание |
|---------|-----------|----------|
| `NewSensitiveDataFilter` | `() *SensitiveDataFilter` | Полный набор шаблонов |
| `NewEmptySensitiveDataFilter` | `() *SensitiveDataFilter` | Пустой фильтр |
| `NewCustomSensitiveDataFilter` | `(patterns ...string) (*SensitiveDataFilter, error)` | Пользовательские шаблоны |

### Методы

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `AddPattern` | `(pattern string) error` | Добавить regex-шаблон |
| `AddPatterns` | `(patterns ...string) error` | Массовое добавление шаблонов |
| `ClearPatterns` | `()` | Очистить все шаблоны |
| `PatternCount` | `() int` | Количество шаблонов |
| `Enable` | `()` | Включить фильтрацию |
| `Disable` | `()` | Отключить фильтрацию |
| `IsEnabled` | `() bool` | Включена ли фильтрация |
| `Filter` | `(input string) string` | Отфильтровать строку |
| `FilterFieldValue` | `(key string, value any) any` | Отфильтровать значение одного поля |
| `FilterValueRecursive` | `(key string, value any) any` | Рекурсивная фильтрация вложенных структур |
| `GetFilterStats` | `() FilterStats` | Получить статистику фильтрации |
| `ActiveGoroutineCount` | `() int32` | Количество активных фильтрующих горутин |
| `WaitForGoroutines` | `(timeout time.Duration) bool` | Ожидание завершения фильтрующих горутин |
| `Close` | `() bool` | Закрыть фильтр и освободить кэш |

### Пользовательские шаблоны

```go
filter, _ := dd.NewCustomSensitiveDataFilter(
    `(?i)password\s*[:=]\s*\S+`,     // Пароль
    `(?i)api[_-]?key\s*[:=]\s*\S+`,  // API Key
    `\b\d{16,19}\b`,                  // Номер кредитной карты
)
```

## SecurityConfig

Структура конфигурации безопасности, управляющая поведением фильтрации и уровнем безопасности.

```go
type SecurityConfig struct {
    MaxMessageSize  int                  // Макс. размер сообщения (байт, 0 = без ограничения, по умолчанию 5МБ в предустановках)
    MaxWriters      int                  // Макс. количество Writer (по умолчанию 100 в предустановках)
    SensitiveFilter *SensitiveDataFilter // Фильтр конфиденциальных данных
}
```

### FilterStats

Структура статистики фильтрации для мониторинга и наблюдаемости.

```go
type FilterStats struct {
    ActiveGoroutines  int32         // Текущее количество активных фильтрующих горутин
    PatternCount      int32         // Количество зарегистрированных шаблонов конфиденциальных данных
    SemaphoreCapacity int           // Макс. количество параллельных операций фильтрации
    MaxInputLength    int           // Порог усечения длины входных данных
    Enabled           bool          // Включена ли фильтрация
    TotalFiltered     int64         // Общее количество операций фильтрации
    TotalRedactions   int64         // Общее количество маскирований
    TotalTimeouts     int64         // Общее количество таймаутов
    AverageLatency    time.Duration // Средняя задержка фильтрации
    CacheHits         int64         // Количество попаданий в кэш
    CacheMiss         int64         // Количество промахов кэша
}
```

### SecurityLevel

Перечисление уровней безопасности, используется с `SecurityConfigForLevel` для быстрого получения предустановленной конфигурации.

```go
type SecurityLevel int
```

Реализует метод `String()`, возвращающий читаемое имя уровня.

| Константа | Описание |
|-----------|----------|
| `SecurityLevelDevelopment` | Среда разработки (без фильтрации, без ограничений, без аудита) |
| `SecurityLevelBasic` | Базовая фильтрация (пароли, API-ключи, кредитные карты) |
| `SecurityLevelStandard` | Стандартная фильтрация (рекомендуется для производственных сред) |
| `SecurityLevelStrict` | Строгая фильтрация (среды с PII/финансовыми данными) |
| `SecurityLevelParanoid` | Экстремальная фильтрация (высокорисковые среды) |

### Предустановленные конфигурации

| Функция | Описание | Сценарий |
|---------|----------|----------|
| `DefaultSecurityConfig()` | Базовая фильтрация конфиденциальных данных | Производственная среда (рекомендуется) |
| `DefaultSecureConfig()` | Полная фильтрация конфиденциальных данных | Высокие требования к безопасности |
| `HealthcareConfig()` | Соответствие HIPAA | Медицина |
| `FinancialConfig()` | Соответствие PCI-DSS | Финансы |
| `GovernmentConfig()` | Правительственный стандарт | Государственный сектор |

### Конфигурация по уровню

```go
func SecurityConfigForLevel(level SecurityLevel) *SecurityConfig
```

| Уровень | Константа | Описание |
|---------|-----------|----------|
| Development | `SecurityLevelDevelopment` | Среда разработки, наиболее мягкий |
| Basic | `SecurityLevelBasic` | Базовая фильтрация |
| Standard | `SecurityLevelStandard` | Стандартная фильтрация |
| Strict | `SecurityLevelStrict` | Строгая фильтрация |
| Paranoid | `SecurityLevelParanoid` | Экстремальная фильтрация |

### Clone

```go
func (c *SecurityConfig) Clone() *SecurityConfig
```

Создаёт глубокую копию конфигурации безопасности.

## Способы использования

### Через Config

```go
cfg := dd.DefaultConfig()
cfg.Security = dd.DefaultSecurityConfig()
logger, _ := dd.New(cfg)
```

### Изменение во время выполнения

```go
// Обновление конфигурации безопасности
logger.SetSecurityConfig(dd.DefaultSecureConfig())

// Чтение текущей конфигурации
sec := logger.GetSecurityConfig()
```

### Фильтрация вложенных структур

```go
filter := dd.NewSensitiveDataFilter()

// Фильтрация строки
filtered := filter.Filter("password=s3cr3t")
// → "password=[REDACTED]"

// Вложенные структуры (автоматическая рекурсия, поддерживает обнаружение циклических ссылок)
data := map[string]any{
    "user": map[string]any{
        "name":     "admin",
        "password": "s3cr3t",
        "token":    "eyJhbGciOi...",
    },
}
filtered := filter.FilterValueRecursive("data", data)
```

### Мониторинг статистики фильтрации

```go
filter := dd.NewSensitiveDataFilter()
// ... использование фильтрации ...
stats := filter.GetFilterStats()
fmt.Printf("Всего фильтраций: %d, маскирований: %d, средняя задержка: %v\n",
    stats.TotalFiltered, stats.TotalRedactions, stats.AverageLatency)
```

## Следующие шаги

- [Конфигурация](./config) -- конфигурация SecurityConfig
- [Logger](./logger) -- метод SetSecurityConfig
- [Аудитные логи](./audit) -- аудит событий безопасности
