---
title: "SecureValue API - CyberGo env | Безопасное хранение значений"
description: "Полный справочник API SecureValue библиотеки CyberGo env: безопасное создание через NewSecureValueStrict, блокировка памяти mlock, уничтожение с обнулением Release, маскирование Masked, обнаружение конфиденциальных ключей IsSensitiveKey и функции инструментов ClearBytes для безопасного хранения паролей и токенов."
---

# SecureValue API

Тип `SecureValue` используется для безопасного хранения конфиденциальных данных, обеспечивает блокировку памяти, автоматическую очистку и маскирование.

## Потокобезопасность

Все методы `SecureValue` потокобезопасны и могут параллельно вызываться из нескольких goroutine:

- **Методы чтения** (`String()`, `Bytes()`, `Length()`, `Masked()`) используют блокировку чтения, поддерживают параллельное чтение
- **Методы закрытия** (`Close()`, `Release()`) используют блокировку записи, обеспечивая безопасное обнуление
- **Проверка состояния** (`IsClosed()`, `IsMemoryLocked()`) использует атомарные операции

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()

    // Параллельное чтение безопасно
    go func() { fmt.Println(secret.Masked()) }()
    go func() { fmt.Println(secret.Length()) }()
}
```

:::warning Внимание
`Close()` и `Release()` следует вызывать только один раз. Повторные вызовы безопасны, но не дают эффекта.
:::

## Создание

### NewSecureValue

```go
func NewSecureValue(value string) *SecureValue
```

Создаёт обёртку безопасного значения.

**Параметры:**
- `value` - Защищаемое строковое значение

**Возвращает:**
- `*SecureValue` - Объект безопасного значения

**Поведение:**
- Использует пул объектов для уменьшения выделения памяти
- Устанавливает финализатор GC для автоматического обнуления
- Если блокировка памяти включена, пытается заблокировать память (при неудаче тихо игнорируется)

```go
secret := env.NewSecureValue("my-secret-password")
defer secret.Release()  // или Close()
```

---

### NewSecureValueStrict

```go
func NewSecureValueStrict(value string) (*SecureValue, error)
```

Создаёт безопасное значение, возвращает ошибку если блокировка памяти не удалась.

**Параметры:**
- `value` - Защищаемое строковое значение

**Возвращает:**
- `*SecureValue` - Объект безопасного значения
- `error` - Ошибка блокировки памяти (только строгий режим)

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("my-secret")
if err != nil {
    // Неудачная блокировка памяти
    log.Printf("Warning: %v", err)
}
if secret != nil {
    defer secret.Release()
}
```

---

### GetSecure (Метод Loader)

```go
func (l *Loader) GetSecure(key string) *SecureValue
```

Получает безопасное значение из загрузчика.

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `*SecureValue` - **Защитная копия** безопасного значения; вызывающий ответственен за освобождение; nil если ключ не существует или загрузчик закрыт

```go
secret := loader.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    // Использование secret
}
```

:::tip Защитная копия
`GetSecure` возвращает копию исходного значения, независимую от родительского Loader. Вызывающий ответственен за вызов `Release()` или `Close()` для освобождения.
:::

---

## Методы

### String

```go
func (sv *SecureValue) String() string
```

Возвращает маскированное представление, безопасное для логов и форматирования. Реализует интерфейс `fmt.Stringer`, предотвращая случайную утечку ключей через `fmt.Printf`, `log.Println` или обёртку ошибок.

**Возвращает:**
- `string` - Маскированное представление (например, `[SECURE:32 bytes locked]`); nil возвращает `[NIL]`

```go
secret := env.GetSecure("PASSWORD")
if secret != nil {
    log.Printf("Password: %s", secret)  // Безопасно, выводит маскированное представление
    // Эквивалентно log.Printf("Password: %s", secret.Masked())
}
```

:::warning Внимание
`String()` возвращает **маскированное представление**, а не открытое значение. Для получения открытого значения используйте `Reveal()`.
:::

---

### Reveal

```go
func (sv *SecureValue) Reveal() string
```

Возвращает открытое значение. Вызывающий ответственен за безопасную обработку возвращённой строки — избегайте логирования, сериализации или сохранения в постоянное хранилище. Используйте только когда необходимо фактическое значение для криптографических операций, вызовов API или аналогичной безопасной обработки.

**Возвращает:**
- `string` - Открытое значение; закрыто или nil возвращает пустую строку

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    defer secret.Release()
    plaintext := secret.Reveal()  // Получение открытого значения
    // Использование plaintext для вызовов API и подобных безопасных операций
    _ = plaintext
}
```

:::danger Предупреждение безопасности
`Reveal()` возвращает **строку в открытом виде**. Строки Go неизменяемы и не могут быть очищены вручную. Используйте только при необходимости и избегайте логирования или хранения возвращённого значения.
:::

---

### Bytes

```go
func (sv *SecureValue) Bytes() []byte
```

Возвращает копию байтового среза значения. Вызывающий ответственен за очистку с помощью `ClearBytes`.

**Возвращает:**
- `[]byte` - Байтовая копия значения; nil если закрыт

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    data := secret.Bytes()
    defer env.ClearBytes(data)  // Обнуление после использования
    // Использование data
}
```

---

### Length

```go
func (sv *SecureValue) Length() int
```

Возвращает длину значения без раскрытия содержимого.

**Возвращает:**
- `int` - Длина значения; 0 если закрыт

```go
secret := env.GetSecure("API_KEY")
if secret != nil {
    fmt.Printf("API Key length: %d\n", secret.Length())
}
```

---

### Masked

```go
func (sv *SecureValue) Masked() string
```

Возвращает маскированное значение для вывода в лог.

**Возвращает:**
- `string` - Маскированное представление

**Формат вывода:**
- Закрыто: `[CLOSED]`
- Пустое значение: `[SECURE:0 bytes]`
- Нормально: `[SECURE:N bytes]` или `[SECURE:N bytes locked]` или `[SECURE:N bytes lock-failed]` или `[SECURE:N bytes unlocked]`

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

Безопасно очищает память и закрывает объект.

**Возвращает:**
- `error` - Всегда возвращает nil

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
- Удаляет финализатор GC
- Возвращает в пул объектов для повторного использования

```go
secret := env.GetSecure("KEY")
if secret != nil {
    defer secret.Release()
    // После Release память обнулена и объект возвращён в пул
}
```

:::tip Close vs Release
- `Close()` - Только обнуляет, не возвращает в пул
- `Release()` - Обнуляет и возвращает в пул (рекомендуется для высокочастотных сценариев)
:::

---

### IsClosed

```go
func (sv *SecureValue) IsClosed() bool
```

Проверяет, закрыт ли объект.

**Возвращает:**
- `bool` - Закрыт ли

```go
if secret.IsClosed() {
    // Объект закрыт, не может использоваться
}
```

---

### IsMemoryLocked

```go
func (sv *SecureValue) IsMemoryLocked() bool
```

Проверяет, заблокирована ли память (предотвращение подкачки на диск).

**Возвращает:**
- `bool` - Заблокирована ли

```go
if secret.IsMemoryLocked() {
    fmt.Println("Memory is locked, protected from swapping")
}
```

---

### MemoryLockError

```go
func (sv *SecureValue) MemoryLockError() error
```

Возвращает ошибку попытки блокировки памяти (если есть).

**Возвращает:**
- `error` - Ошибка блокировки; nil при успехе или если попытка не производилась

```go
if err := secret.MemoryLockError(); err != nil {
    log.Printf("Memory lock failed: %v", err)
}
```

---

## Конфигурация блокировки памяти

### SetMemoryLockEnabled

```go
func SetMemoryLockEnabled(enabled bool)
```

Глобальное включение/выключение блокировки памяти. Влияет на все новые создаваемые SecureValue.

**Параметры:**
- `enabled` - Включить ли

```go
func main() {
    // Включение при запуске приложения
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
- `bool` - Включена ли

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

Устанавливает строгий режим. При включении `NewSecureValueStrict` возвращает ошибку при неудачной блокировке.

**Параметры:**
- `strict` - Включить ли строгий режим

```go
env.SetMemoryLockEnabled(true)
env.SetMemoryLockStrict(true)

secret, err := env.NewSecureValueStrict("sensitive-data")
if err != nil {
    // Блокировка не удалась
}
```

---

### IsMemoryLockStrict

```go
func IsMemoryLockStrict() bool
```

Проверяет, включён ли строгий режим.

**Возвращает:**
- `bool` - Включён ли

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
- `bool` - Поддерживается ли

| Платформа | Поддержка |
|-----------|-----------|
| Linux | Да |
| macOS | Да |
| Windows | Да |
| FreeBSD | Да |
| wasm | Нет |

:::warning Внимание
Возвращение `true` означает только поддержку платформой, но не наличие достаточных прав у процесса. Linux требует `CAP_IPC_LOCK` или права root.
:::

```go
if env.IsMemoryLockSupported() {
    env.SetMemoryLockEnabled(true)
}
```

---

## Функции инструментов безопасности

### ClearBytes

```go
func ClearBytes(b []byte)
```

Безопасно обнуляет байтовый срез. Используйте для немедленного обнуления конфиденциальных данных после использования.

**Параметры:**
- `b` - Байтовый срез для обнуления

```go
sensitive := []byte("secret-data")
// Использование...
env.ClearBytes(sensitive)
// sensitive теперь содержит нули
```

---

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Проверяет, соответствует ли ключ шаблону конфиденциальности.

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `bool` - Является ли конфиденциальным

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Конфиденциальный ключ, используйте безопасный метод обработки
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

Возвращает маскированное значение в зависимости от чувствительности ключа.

**Параметры:**
- `key` - Имя ключа
- `value` - Исходное значение

**Возвращает:**
- `string` - Маскированное значение

```go
// Конфиденциальный ключ — возвращает формат [MASKED:N chars]
masked := env.MaskValue("API_KEY", "secret123")
// Возвращает: [MASKED:9 chars]

// Неконфиденциальный ключ — возвращает исходное значение (обрезается свыше 20 символов)
masked := env.MaskValue("APP_NAME", "myapp")
// Возвращает: myapp
```

---

### MaskKey

```go
func MaskKey(key string) string
```

Маскирует имя ключа для логирования.

**Параметры:**
- `key` - Имя ключа

**Возвращает:**
- `string` - Маскированное имя ключа

```go
masked := env.MaskKey("DB_PASSWORD")
// Возвращает: DB***
```

---

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Очищает строку от конфиденциальных пар ключ-значение. Автоматически обнаруживает и маскирует конфиденциальные значения в формате `key=value`.

**Параметры:**
- `s` - Исходная строка

**Возвращает:**
- `string` - Очищенная строка

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
- `s` - Исходная строка

**Возвращает:**
- `string` - Маскированная строка

```go
// Длинные строки будут усечены
long := "This is a very long string that exceeds 50 characters"
clean := env.MaskSensitiveInString(long)
// Возвращает: "This is a very long string that exceeds 50..."
```

:::tip Сценарии использования
Используется для усечения длинных строк, которые могут содержать конфиденциальные данные. Для автоматического маскирования конфиденциальных пар ключ-значение используйте `SanitizeForLog`.
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
    // Проверка и включение блокировки памяти
    if env.IsMemoryLockSupported() {
        env.SetMemoryLockEnabled(true)
        fmt.Println("Memory locking enabled")
    }

    // Загрузка переменных окружения
    if err := env.Load(".env"); err != nil {
        log.Printf("Warning: %v", err)
    }

    // Безопасное получение конфиденциального значения
    apiKey := env.GetSecure("API_KEY")
    if apiKey == nil {
        log.Fatal("API_KEY not found")
    }
    defer apiKey.Release()

    // Безопасное использование
    fmt.Printf("API Key length: %d\n", apiKey.Length())
    fmt.Printf("API Key (masked): %s\n", apiKey.Masked())

    // Проверка состояния блокировки памяти
    if apiKey.IsMemoryLocked() {
        fmt.Println("Memory is locked")
    }

    // Проверка ошибки блокировки
    if err := apiKey.MemoryLockError(); err != nil {
        fmt.Printf("Memory lock warning: %v\n", err)
    }

    // Передача другим функциям
    connectAPI(apiKey.Reveal())

    // Использование функций безопасности
    logMessage := "Processing with API_KEY=secret"
    safeMessage := env.SanitizeForLog(logMessage)
    fmt.Println(safeMessage)  // Processing with API_KEY=[MASKED]
}

func connectAPI(key string) {
    // Подключение с использованием ключа...
    fmt.Printf("Connecting with key of length %d\n", len(key))
}
```

---

## Внутренняя реализация

### Пул объектов

`SecureValue` использует `sync.Pool` для уменьшения выделения памяти:

```go
var secureValuePool = sync.Pool{
    New: func() interface{} {
        return &SecureValue{}
    },
}
```

### Финализатор GC

При создании устанавливается финализатор GC, обеспечивающий автоматическое обнуление при сборке мусора:

```go
runtime.SetFinalizer(sv, (*SecureValue).finalize)
```

### Безопасная очистка

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

- [Константы и ошибки](/ru/env/api-reference/constants) - Запрещённые ключи, шаблоны конфиденциальных ключей, типы ошибок
- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и основные функции
- [Контрольный список для производства](/ru/env/security/production-checklist) - Проверка безопасности перед развёртыванием
- [Loader API](/ru/env/api-reference/loader) - Метод GetSecure
