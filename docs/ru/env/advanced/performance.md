---
title: Оптимизация производительности - CyberGo env | Настройка параллельного чтения и записи
description: CyberGo env библиотека полное руководство по оптимизации производительности, включая механизмы потокобезопасного чтения и записи с sync.RWMutex, стратегию повторного использования пула объектов для сокращения аллокаций памяти, шаблоны использования блокировки памяти, обработку больших файлов потоковым способом и сравнение данных бенчмарков.
---

# Оптимизация производительности

Библиотека env оптимизирована для сценариев с высокой производительностью. В этом документе описываются потокобезопасность, пул объектов, управление памятью и другие характеристики, связанные с производительностью.

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

### Потокобезопасность пакетных функций

Пакетные функции используют глобальный загрузчик и также потокобезопасны:

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

Библиотека использует сегментированное хранилище (Sharded Storage) для снижения конкуренции за блокировки:

```text
+-------------------------------------------+
|          Loader (8 сегментов)              |
+-------------------------------------------+
|  +---------+ +---------+    +--------+   |
|  | Shard 0 | | Shard 1 |... | Shard 7|   |
|  |  Lock   | |  Lock   |    |  Lock  |   |
|  |  Data   | |  Data   |    |  Data  |   |
|  +---------+ +---------+    +--------+   |
+-------------------------------------------+
```

- Ключи распределяются по разным сегментам на основе хеша
- Каждый сегмент имеет собственную блокировку
- Снижает конкуренцию за блокировки, повышает производительность при параллельном доступе

## Пул объектов

### Зачем использовать пул объектов

Частое создание и уничтожение объектов увеличивает нагрузку на GC:

```text
Без пула объектов:
Создание объекта -> Использование -> GC сборка -> Создание объекта -> Использование -> GC сборка ...

С пулом объектов:
Создание объекта -> Использование -> Возврат в пул -> Получение -> Использование -> Возврат в пул ...
```

### Пул SecureValue

Объекты `SecureValue` управляются через пул:

```go
// Получить SecureValue (возможно повторное использование из пула)
secret := env.GetSecure("API_KEY")

// Использовать
value := secret.String()

// Вернуть в пул
secret.Close()  // или secret.Release()
```

### Правильное использование пула объектов

**Своевременное освобождение:**

```go
func processData() {
    secret := env.GetSecure("SECRET")
    defer secret.Close()  // Обеспечить освобождение

    // Использовать secret...
}
```

**Не сохранять ссылки:**

```go
// Неправильно: сохранение ссылки на освобождённый объект
var globalSecret *env.SecureValue

func init() {
    globalSecret = env.GetSecure("KEY")
    globalSecret.Close()  // После освобождения объект может быть повторно использован
}

func later() {
    // Опасно: globalSecret может быть использован другим кодом
    globalSecret.String()
}

// Правильно: получать каждый раз при необходимости
func getSecret() string {
    secret := env.GetSecure("KEY")
    defer secret.Close()
    return secret.String()
}
```

**Проверка состояния закрытия:**

```go
secret := env.GetSecure("KEY")

// Проверить перед использованием
if secret.IsClosed() {
    // Объект закрыт, нельзя использовать
}

// Закрыть после использования
secret.Close()

// Проверить после закрытия
if secret.IsClosed() {
    // Закрыт
}
```

## Безопасность памяти

### Блокировка памяти

Включение блокировки памяти предотвращает своппинг конфиденциальных данных на диск:

```go
// Проверить поддержку платформы
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

**Поддержка платформ:**

| Платформа | Поддержка |
|-----------|-----------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: tip Подробнее
См. [SecureValue API - Конфигурация блокировки памяти](/ru/env/api-reference/secure-value#конфигурация-блокировки-памяти) для полного описания конфигурации.
:::

### Строгий режим

В строгом режиме неудача блокировки памяти приводит к ошибке:

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

Ручное обнуление среза байтов:

```go
sensitiveBytes := []byte("secret")
env.ClearBytes(sensitiveBytes)
// sensitiveBytes теперь содержит только нули
```

## Шаблоны производительности

### Только чтение после инициализации

Наиболее эффективный шаблон: загрузка конфигурации при запуске, только чтение во время выполнения:

```go
var config *Config

func init() {
    env.Load(".env")

    config = &Config{}
    env.ParseInto(config)
}

// Безопасное чтение из любой goroutine
func getValue() string {
    return config.Key
}
```

### Динамическое обновление конфигурации

Шаблон при необходимости динамического обновления конфигурации:

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
// Получить все необходимые значения за один раз
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
    // Использовать кэшированное значение напрямую
    // ...
}
```

## Влияние на производительность

### Выгода от пула объектов

| Операция | Без пула | С пулом |
|----------|----------|---------|
| Количество аллокаций | N | ~Константа |
| Нагрузка на GC | Высокая | Низкая |
| Задержка | Нестабильная | Стабильная |

### Накладные расходы блокировки памяти

| Операция | Без блокировки | С блокировкой |
|----------|---------------|---------------|
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

### Смешанное чтение и запись

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

## Замечания

### Избегайте блокировки внутри блокировки

```go
// Опасно: может привести к взаимоблокировке
func (l *Loader) BadMethod() {
    // Вызов потенциально блокирующей операции внутри блокировки
    l.Set("KEY", computeValue())  // computeValue может быть медленным
}

// Безопасно: сначала вычислить, затем установить
func GoodMethod() {
    value := computeValue()  // Вычисление вне блокировки
    loader.Set("KEY", value)  // Быстрая установка
}
```

### Параллельный доступ после Close

```go
loader, _ := env.New(cfg)

// Запустить goroutine
go func() {
    time.Sleep(1 * time.Second)
    loader.GetString("KEY")  // Может вернуть ErrClosed
}()

loader.Close()  // Главная goroutine закрывает
```

### Сброс глобального загрузчика

```go
// НЕ потокобезопасно: не вызывать во время выполнения
env.ResetDefaultLoader()

// Безопасно: вызывать только в тестах или при запуске
func init() {
    env.ResetDefaultLoader()
    env.Load(".env")
}
```

## Связанная документация

- [SecureValue API](/ru/env/api-reference/secure-value) - Безопасная обработка значений и блокировка памяти
- [Loader API](/ru/env/api-reference/loader) - Методы загрузчика
- [Сценарии тестирования](/ru/env/guides/testing) - Примеры бенчмарков
