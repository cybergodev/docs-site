---
title: SecureValue API - CyberGo env | Безопасное хранение значений
description: CyberGo env библиотека SecureValue полная справочная документация API типа безопасного значения, SecureValue обеспечивает защиту блокировкой памяти от своппинга на диск, автоматическое обнуление при уничтожении, обработку маскирования данных, автоматическое обнаружение конфиденциальных ключей и служебные функции безопасности.
---

# SecureValue API

Тип `SecureValue` используется для безопасного хранения конфиденциальных данных, обеспечивая блокировку памяти, автоматическое обнуление и маскирование.

## Потокобезопасность

Все методы `SecureValue` потокобезопасны и могут использоваться параллельно из нескольких goroutine:

- **Методы чтения** (`String()`, `Bytes()`, `Length()`, `Masked()`) используют блокировку чтения, поддерживая параллельное чтение
- **Методы закрытия** (`Close()`, `Release()`) используют блокировку записи, обеспечивая безопасное обнуление
- **Проверка состояния** (`IsClosed()`, `IsMemoryLocked()`) используют атомарные операции

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Параллельное чтение безопасно
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

::: warning Внимание
`Close()` и `Release()` следует вызывать только один раз. Повторные вызовы безопасны, но не дают эффекта.
:::

## Создание

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

Создаёт обёртку безопасного значения.

**Параметры:**
- `value` - строковое значение для защиты

**Возвращает:**
- `*SecureValue` - объект безопасного значения

**Поведение:**
- Использует пул объектов для сокращения аллокаций
- Устанавливает GC-финализатор для автоматического обнуления
- Если включена блокировка памяти, пытается заблокировать память (при неудаче тихо игнорирует)

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // или Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

Создаёт безопасное значение, возвращает ошибку при неудаче блокировки памяти.

**Параметры:**
- `value` - строковое значение для защиты

**Возвращает:**
- `*SecureValue` - объект безопасного значения
- `error` - ошибка блокировки памяти (только в строгом режиме)

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // Ошибка блокировки памяти
    log.Printf("Предупреждение: %v", err)
}
if secret != nil {
    defer secret.Release()
}
```

---

### GetSecure (метод Loader)

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Получает безопасное значение из загрузчика.

**Параметры:**
- `key` - имя ключа

**Возвращает:**
- `*SecureValue` - **защитная копия** безопасного значения, вызывающий отвечает за освобождение; возвращает nil если ключ не существует или загрузчик закрыт

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // Использовать secret
}
```

::: tip Защитная копия
`GetSecure` возвращает копию исходного значения, независимую от родительского Loader. Вызывающий отвечает за вызов `Release()` или `Close()` для освобождения.
:::

---

## Методы

### String

```go
func (sv *SecureValue) String() string
```

Возвращает копию значения в виде строки.

**Возвращает:**
- `string` - копия значения, возвращает пустую строку если объект закрыт

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    value := secret.String()  // Создаёт копию
    // Использовать value
}
```

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

Возвращает копию значения в виде среза байтов. Вызывающий отвечает за обнуление с помощью `ClearBytes`.

**Возвращает:**
- `[]byte` - байтовая копия значения, возвращает nil если объект закрыт

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    data := secret.Bytes()
    defer env.ClearBytes(data)  // Обнулить после использования
    // Использовать data
}
```

---

### Length

```go
func (sv *SecureValue) Length() int
```

Возвращает длину значения без раскрытия содержимого.

**Возвращает:**
- `int` - длина значения, возвращает 0 если объект закрыт

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    fmt.Printf("Длина API Key: %d\n", secret.Length())
}
```

---

### Masked

```go
func (sv *SecureValue) Masked() string
```

Возвращает маскированное значение для вывода в журнал.

**Возвращает:**
- `string` - маскированное представление

**Формат вывода:**
- Закрыт: `[CLOSED]`
- Пустое значение: `[SECURE:0 bytes]`
- Обычное: `[SECURE:N bytes]` или `[SECURE:N bytes locked]` или `[SECURE:N bytes lock-failed]` или `[SECURE:N bytes unlocked]`

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    log.Printf("API Key: %s", secret.Masked())
    // Вывод: API Key: [SECURE:32 bytes locked]
}
```

---

### Close

```go
func (sv *SecureValue) Close() error
```

Безопасно обнуляет память и закрывает объект.

**Возвращает:**
- `error` - всегда возвращает nil

**Поведение:**
- Безопасно обнуляет внутренние данные
- Помечает как закрытый
- **Не** возвращает в пул объектов

```go
secret := env.GetSecure("TOKEN")
if secret != nil {
    defer secret.Close()
    // После Close память обнулена
}
```

---

### Release

```go
func (sv *SecureValue) Release()
```

Обнуляет память и возвращает в пул объектов.

**Поведение:**
- Безопасно обнуляет внутренние данные
- Очищает GC-финализатор
- Возвращает в пул объектов для повторного использования

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // После Release память обнулена и объект возвращён в пул
}
```

::: tip Close vs Release
- `Close()` - только обнуляет, не возвращает в пул
- `Release()` - обнуляет и возвращает в пул (рекомендуется для высокочастотных сценариев)
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

Проверяет, закрыт ли объект.

**Возвращает:**
- `bool` - закрыт ли объект

```go
if secret.IsClosed() {
    // Объект закрыт, нельзя использовать
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

Проверяет, заблокирована ли память (от своппинга на диск).

**Возвращает:**
- `bool` - заблокирована ли память

```go
if secret.IsMemoryLocked() {
    fmt.Println("Память заблокирована, защищена от своппинга")
}
```

---

### MemoryLockError

```go
func (sv *SecureValue) MemoryLockError() error
```

Возвращает ошибку попытки блокировки памяти (если была).

**Возвращает:**
- `error` - ошибка блокировки, nil при успехе или если попытка не производилась

```go
if err := secret.MemoryLockError(); err != nil {
    log.Printf("Ошибка блокировки памяти: %v", err)
}
```

---

## Конфигурация блокировки памяти

### SetMemoryLockEnabled

```go
func SetMemoryLockEnabled(enabled bool)
```

Глобально включает/отключает блокировку памяти. Влияет на все новые создаваемые SecureValue.

**Параметры:**
- `enabled` - включить ли блокировку

```go
func main() {
    // Включить при запуске приложения
    env.SetMemoryLockEnabled(true)

    // Все последующие SecureValue будут пытаться заблокировать
}
```

---

### IsMemoryLockEnabled

```go
func IsMemoryLockEnabled() bool
```

Проверяет, включена ли блокировка памяти.

**Возвращает:**
- `bool` - включена ли

```go
if env.IsMemoryLockEnabled() {
    // Блокировка памяти включена
}
```

---

### SetMemoryLockStrict

```go
func SetMemoryLockStrict(strict bool)
```

Устанавливает строгий режим. При включении `NewSecureValueStrict` возвращает ошибку при неудаче блокировки.

**Параметры:**
- `strict` - включить ли строгий режим

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive-data")
if err != nil {
    // Ошибка блокировки
}
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

Проверяет, включён ли строгий режим.

**Возвращает:**
- `bool` - включён ли

```go
strict := env.IsMemoryLockStrict()
```

---

### IsMemoryLockSupported

```go
func IsMemoryLockSupported() bool
```

Проверяет, поддерживает ли текущая платформа блокировку памяти.

**Возвращает:**
- `bool` - поддерживается ли

| Платформа | Поддержка |
|-----------|-----------|
| Linux | ✅ |
| macOS | ✅ |
| Windows | ✅ |
| FreeBSD | ✅ |
| wasm | ❌ |

::: warning Внимание
Возвращаемое значение `true` означает только поддержку платформой, но не то, что процесс имеет достаточные полномочия. Linux требует `CAP_IPC_LOCK` или root-права.
:::

```go
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

---

## Служебные функции безопасности

### ClearBytes

```go
func ClearBytes(b []byte)
```

Безопасно обнуляет срез байтов. Используйте для немедленного обнуления конфиденциальных данных после использования.

**Параметры:**
- `b` - срез байтов для обнуления

```go
sensitive := []byte("secret-data")
// Использование...
env.ClearBytes(sensitive)
// sensitive теперь содержит только нули
```

---

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Проверяет, соответствует ли имя ключа шаблону конфиденциальности.

**Параметры:**
- `key` - имя ключа

**Возвращает:**
- `bool` - является ли конфиденциальным

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Конфиденциальный ключ, обрабатывать безопасно
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

**Шаблоны конфиденциальности:** password, secret, token, key, api_key, credential и др.

---

### MaskValue

```go
func MaskValue(key, value string) string
```

Возвращает маскированное значение в зависимости от конфиденциальности ключа.

**Параметры:**
- `key` - имя ключа
- `value` - исходное значение

**Возвращает:**
- `string` - маскированное значение

```go
// Конфиденциальный ключ - возвращает формат [MASKED:N chars]
masked := env.MaskValue("API_KEY", "secret123")
// Возвращает: [MASKED:9 chars]

// Неконфиденциальный ключ - возвращает исходное значение (обрезается свыше 20 символов)
masked := env.MaskValue("APP_NAME", "myapp")
// Возвращает: myapp
```

---

### MaskKey

```go
func MaskKey(key string) string
```

Маскирует имя ключа для журнала.

**Параметры:**
- `key` - имя ключа

**Возвращает:**
- `string` - маскированное имя ключа

```go
masked := env.MaskKey("DB_PASSWORD")
// Возвращает: DB***
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Очищает строку от конфиденциальной информации в парах ключ-значение. Автоматически обнаруживает и маскирует конфиденциальные значения в формате `key=value`.

**Параметры:**
- `s` - исходная строка

**Возвращает:**
- `string` - очищенная строка

```go
// Автоматическое маскирование конфиденциальных пар ключ-значение
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// Возвращает: "Connected with password=[MASKED] api_key=[MASKED]"
```

---

### MaskSensitiveInString

```go
func MaskSensitiveInString(s string) string
```

Маскирует потенциально конфиденциальное содержимое в строке. Обрезает строки длиннее 50 символов.

**Параметры:**
- `s` - исходная строка

**Возвращает:**
- `string` - маскированная строка

```go
// Длинная строка будет обрезана
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// Возвращает: "This is a very long string that exceeds 50..."
```

::: tip Сценарии использования
Используется для обрезки длинных строк, которые могут содержать конфиденциальные данные. Для автоматического маскирования конфиденциальных пар ключ-значение используйте `SanitizeForLog`.
:::

---

## Полный пример

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/env"
)

func main() {
    // Проверить и включить блокировку памяти
    if env.IsMemoryLockSupported() {
        env.SetMemoryLockEnabled(true)
        fmt.Println("Блокировка памяти включена")
    }

    // Загрузить переменные окружения
    if err := env.Load(".env"); err != nil {
        log.Printf("Предупреждение: %v", err)
    }

    // Безопасно получить конфиденциальное значение
    apiKey := env.GetSecure("API_KEY")
    if apiKey == nil {
        log.Fatal("API_KEY не найден")
    }
    defer apiKey.Release()

    // Безопасное использование
    fmt.Printf("Длина API Key: %d\n", apiKey.Length())
    fmt.Printf("API Key (маскированный): %s\n", apiKey.Masked())

    // Проверить состояние блокировки памяти
    if apiKey.IsMemoryLocked() {
        fmt.Println("Память заблокирована")
    }

    // Проверить ошибку блокировки
    if err := apiKey.MemoryLockError(); err != nil {
        fmt.Printf("Предупреждение блокировки памяти: %v\n", err)
    }

    // Передать в другую функцию
    connectAPI(apiKey.String())

    // Использовать служебные функции безопасности
    logMessage := "Processing with API_KEY=secret"
    safeMessage := env.SanitizeForLog(logMessage)
    fmt.Println(safeMessage)  // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
    // Подключение с использованием ключа...
    fmt.Printf("Подключение с ключом длиной %d\n", len(key))
}
```

---

## Внутренняя реализация

### Пул объектов

`SecureValue` использует `sync.Pool` для сокращения аллокаций памяти:

```go
var secureValuePool = sync.Pool{
    New: func() interface{} {
        return &SecureValue{}
    },
}
```

### GC-финализатор

При создании устанавливается GC-финализатор, обеспечивающий автоматическое обнуление при сборке мусора:

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### Безопасное обнуление

Использует `unsafe.Pointer` для предотвращения оптимизации компилятора:

```go
func (sv *SecureValue) clearData() {
    dataPtr := unsafe.Pointer(&sv.data[0])
    for i := range sv.data {
        *(*byte)(unsafe.Pointer(uintptr(dataPtr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(sv.data)
    sv.data = nil
}
```

---

## Связанная документация

- [Константы и ошибки](/ru/env/api-reference/constants) - Запрещённые ключи, шаблоны конфиденциальности, типы ошибок
- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и основные возможности
- [Чеклист для продакшена](/ru/env/security/production-checklist) - Проверка безопасности перед запуском
- [Loader API](/ru/env/api-reference/loader) - Метод GetSecure
