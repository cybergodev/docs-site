---
title: "Оптимизация производительности - CyberGo env | Настройка параллельного чтения и записи"
description: "Руководство по оптимизации производительности и настройке высокого параллелизма библиотеки CyberGo env — безопасный параллельный доступ через sync.RWMutex, стратегия повторного использования пула объектов sync.Pool, паттерны использования и влияние блокировки памяти mlock, методы потокового разбора больших файлов, сравнение данных бенчмарков и рекомендации по настройке параметров безопасности LimitsConfig."
---

# Оптимизация производительности

Библиотека env оптимизирована для высокопроизводительных сценариев. В этом документе описаны вопросы производительности, включая потокобезопасность, пул объектов и управление памятью.

## Потокобезопасность

### Гарантии потокобезопасности

Все методы `Loader` потокобезопасны:

```go
loader, _ := env.New(env.DefaultConfig())
defer loader.Close()

var wg sync.WaitGroup

// Параллельное чтение
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        loader.GetString("KEY")
    }()
}

// Параллельная запись
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func(n int) {
        defer wg.Done()
        loader.Set(fmt.Sprintf("KEY_%d", n), "value")
    }(i)
}

wg.Wait()
```

### Потокобезопасность функций уровня пакета

Функции уровня пакета используют глобальный загрузчик и также потокобезопасны:

```go
var wg sync.WaitGroup

for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        env.GetString("KEY", "default")
    }()
}

wg.Wait()
```

### Внутренняя реализация

Библиотека использует сегментированное хранилище (Sharded Storage) для уменьшения конкуренции за блокировки:

```text
┌─────────────────────────────────────────┐
│          Loader (8 сегментов)            │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    ┌────────┐ │
│  │ Shard 0 │ │ Shard 1 │... │ Shard 7│ │
│  │  Lock   │ │  Lock   │    │  Lock  │ │
│  │  Data   │ │  Data   │    │  Data  │ │
│  └─────────┘ └─────────┘    └────────┘ │
└─────────────────────────────────────────┘
```

- Ключи распределяются по разным сегментам на основе хеша
- Каждый сегмент имеет независимую блокировку
- Это снижает конкуренцию за блокировки и повышает производительность при параллельной работе

## Пул объектов

### Зачем использовать пул объектов

Частое создание и уничтожение объектов увеличивает нагрузку на GC:

```text
Без пула объектов:
Создание объекта -> Использование -> GC-утилизация -> Создание объекта -> Использование -> GC-утилизация ...

С пулом объектов:
Создание объекта -> Использование -> Возврат в пул -> Получение -> Использование -> Возврат в пул ...
```

### Пул SecureValue

Объекты `SecureValue` используют пулизированное управление:

```go
// Получение SecureValue (возможно повторное использование из пула)
secret := env.GetSecure("API_KEY")

// Использование
value := secret.String()

// Возврат в пул
secret.Close()  // или secret.Release()
```

### Правильное использование пула объектов

**Своевременное освобождение:**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Close()  // Обеспечение освобождения

    // Использование secret...
}
```

**Не сохраняйте ссылки:**

```go
// Неправильно: сохранение ссылки на освобождённый объект
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // После освобождения объект может быть повторно использован
}

func later() {
    // Опасно: globalSecret может уже использоваться другим кодом
    globalSecret.String()
}

// Правильно: получение при каждой необходимости
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.String()
}
```

**Проверка состояния закрытия:**

```go
secret := env.GetSecure("KEY")

// Проверка перед использованием
if secret.IsClosed() {
    // Объект закрыт, использовать нельзя
}

// Закрытие после использования
secret.Close()

// Проверка после закрытия
if secret.IsClosed() {
    // Закрыт
}
```

## Безопасность памяти

### Блокировка памяти

Включение блокировки памяти предотвращает swapping конфиденциальных данных на диск:

```go
// Проверка поддержки платформы
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**Поддержка платформ:**

| Платформа | Поддержка |
|------|------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip Подробнее
Полное описание конфигурации см. в [SecureValue API - Конфигурация блокировки памяти](/ru/env/api-reference/secure-value#memory-lock-configuration).
:::

### Строгий режим

В строгом режиме неудачная блокировка памяти приводит к ошибке:

```go
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive_data")
if err != nil {
    // Ошибка блокировки памяти
}
```

### Безопасное обнуление

`SecureValue` автоматически обнуляет память при закрытии:

```go
secret := env.GetSecure("PASSWORD")
// Внутреннее хранилище: ['p', 'a', 's', 's', ...]

secret.Close()
// Внутреннее хранилище: [0, 0, 0, 0, ...]
```

Ручное обнуление байтового среза:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes теперь содержит все нули
```

## Паттерны производительности

### Только чтение после инициализации

Наиболее эффективный паттерн: загрузка конфигурации при запуске, только чтение во время выполнения:

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// Безопасное чтение из любой горутины
func getValue() string {
    return config.Key
}
```

### Динамическое обновление конфигурации

Паттерн при необходимости динамического обновления конфигурации:

```go
type ConfigManager struct {
    loader *env.Loader
    mu     sync.RWMutex
}

func (m *ConfigManager) Refresh() error {
    m.mu.Lock()
    defer m.mu.Unlock()

    return m.loader.LoadFiles(".env")
}

func (m *ConfigManager) Get(key string) string {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.loader.GetString(key)
}
```

### Сокращение времени удержания блокировки

```go
// Не рекомендуется: выполнение длительных операций внутри блокировки
func (l *Loader) ProcessValue(key string) {
    value := l.GetString(key)
    // Длительная операция...
    processValue(value)
}

// Рекомендуется: быстрое чтение, обработка вне блокировки
func ProcessValue(key string) {
    value := loader.GetString(key)  // Быстрое получение
    go processValue(value)          // Асинхронная обработка
}
```

### Пакетные операции

```go
// Однократное получение всех необходимых значений
func LoadAllConfig(loader *env.Loader) *Config {
    return &Config{
        Host:    loader.GetString("HOST"),
        Port:    loader.GetInt("PORT"),
        Debug:   loader.GetBool("DEBUG"),
        Timeout: loader.GetDuration("TIMEOUT"),
    }
}
```

### Избегание частых вызовов

```go
// Не рекомендуется: чтение при каждом запросе
func Handler(w http.ResponseWriter, r *http.Request) {
    apiKey := env.GetString("API_KEY")  // Блокировка при каждом запросе
    // ...
}

// Рекомендуется: кэширование при запуске
var apiKey string

func init() {
    env.Load(".env")
    apiKey = env.GetString("API_KEY")
}

func Handler(w http.ResponseWriter, r *http.Request) {
    // Прямое использование кэшированного значения
    // ...
}
```

## Влияние на производительность

### Выгода от пула объектов

| Операция | Без пула | С пулом |
|------|------|------|
| Количество аллокаций | N | ~постоянно |
| Нагрузка на GC | Высокая | Низкая |
| Задержка | Нестабильная | Стабильная |

### Накладные расходы блокировки памяти

| Операция | Без блокировки | С блокировкой |
|------|--------|--------|
| Создание | ~100ns | ~1μs |
| Чтение | ~10ns | ~10ns |

## Бенчмарки

### Производительность чтения

```go
func BenchmarkConcurrentRead(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            loader.GetString("KEY")
        }
    })
}
```

### Производительность записи

```go
func BenchmarkConcurrentWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())

    var i int64
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            n := atomic.AddInt64(&i, 1)
            loader.Set(fmt.Sprintf("KEY_%d", n), "value")
        }
    })
}
```

### Смешанное чтение/запись

```go
func BenchmarkMixedReadWrite(b *testing.B) {
    loader, _ := env.New(env.DefaultConfig())
    loader.Set("KEY", "value")

    b.RunParallel(func(pb *testing.PB) {
        i := 0
        for pb.Next() {
            if i%10 == 0 {
                loader.Set("KEY", "new_value")
            } else {
                loader.GetString("KEY")
            }
            i++
        }
    })
}
```

## Примечания

### Избегайте блокировок внутри блокировки

```go
// Опасно: может привести к взаимной блокировке
func (l *Loader) BadMethod() {
    // Вызов потенциально блокирующей операции внутри блокировки
    l.Set("KEY", computeValue())  // computeValue может быть медленной
}

// Безопасно: сначала вычисление, затем установка
func GoodMethod() {
    value := computeValue()  // Вычисление вне блокировки
    loader.Set("KEY", value)  // Быстрая установка
}
```

### Параллельный доступ после Close

```go
loader, _ := env.New(cfg)

// Запуск горутины
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // Может вернуть ErrClosed
}()

loader.Close()  // Закрытие в основной горутине
```

### Сброс глобального загрузчика

```go
// Не потокобезопасно: не вызывайте во время выполнения
env.ResetDefaultLoader()

// Безопасно: вызывайте только в тестах или при запуске
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## Связанная документация

- [SecureValue API](/ru/env/api-reference/secure-value) - Безопасная обработка значений и блокировка памяти
- [Loader API](/ru/env/api-reference/loader) - Методы загрузчика
- [Сценарии тестирования](/ru/env/guides/testing) - Примеры бенчмарков
