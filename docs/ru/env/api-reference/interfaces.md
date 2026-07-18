---
sidebar_label: "Определения интерфейсов"
title: "Определения интерфейсов - CyberGo env | Иерархия интерфейсов"
description: "Интерфейсы CyberGo env с детализированным дизайном для DI: EnvLoader, EnvFileLoader, EnvGetter, EnvSetter, Validator, FullAuditLogger, EnvParser и FileSystem."
sidebar_position: 6
---

# Определения интерфейсов

Библиотека env использует детализированный дизайн интерфейсов, поддерживая внедрение зависимостей и гибкую композицию.

## Основные интерфейсы

### EnvLoader

Полный интерфейс загрузчика, объединяющий все под-интерфейсы:

```go
type EnvLoader interface {
    EnvFileLoader
    EnvGetter
    EnvSetter
    EnvApplicator
    EnvCloser
}
```

---

### EnvFileLoader

Интерфейс загрузки файлов:

```go
type EnvFileLoader interface {
    LoadFiles(filenames ...string) error
}
```

**Назначение:** Сценарии, требующие только возможности загрузки файлов.

```go
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}
```

---

### EnvGetter

Интерфейс доступа для чтения:

```go
type EnvGetter interface {
    GetString(key string, defaultValue ...string) string
    Lookup(key string) (string, bool)
    Keys() []string
    All() map[string]string
}
```

**Назначение:** Доступ к конфигурации только для чтения (минимальный интерфейс).

```go
func readConfig(getter env.EnvGetter) {
    host := getter.GetString("HOST", "localhost")
    value, exists := getter.Lookup("API_KEY")
    keys := getter.Keys()
}
```

:::warning Внимание
`GetInt`, `GetBool`, `GetUint64`, `GetFloat64`, `GetDuration`, `GetSecure`, `Len` **не являются** частью интерфейса `EnvGetter`.
Эти методы реализованы на типе `*Loader`, но не входят в минимальный интерфейс.

Для полного доступа на чтение используйте непосредственно тип `*Loader`:

```go
func readFullConfig(loader *env.Loader) {
    port := loader.GetInt("PORT", 8080)      // Доступно
    debug := loader.GetBool("DEBUG", false)  // Доступно
    count := loader.Len()                     // Доступно
}
```
:::

---

### EnvSetter

Интерфейс доступа для записи:

```go
type EnvSetter interface {
    Set(key, value string) error
    Delete(key string) error
}
```

**Назначение:** Сценарии, требующие только возможности установки/удаления.

```go
func updateConfig(setter env.EnvSetter) error {
    if err := setter.Set("KEY", "value"); err != nil {
        return err
    }
    return setter.Delete("TEMP_KEY")
}
```

---

### EnvApplicator

Интерфейс применения к системному окружению:

```go
type EnvApplicator interface {
    Apply() error
}
```

**Назначение:** Применение загруженных переменных к `os.Environ`.

```go
func applyToSystem(applicator env.EnvApplicator) error {
    return applicator.Apply()
}
```

---

### EnvCloser

Интерфейс освобождения ресурсов:

```go
type EnvCloser interface {
    Close() error
}
```

**Назначение:** Освобождение ресурсов загрузчика.

---

## Интерфейсы валидации

### Validator

Объединённый интерфейс валидации:

```go
type Validator interface {
    KeyValidator
    ValueValidator
    RequiredValidator
}
```

:::tip Внимание
`Validator` через встраивание `RequiredValidator` предоставляет метод `ValidateRequired`. Пользовательский валидатор, реализующий только `KeyValidator`, при вызове `ValidateRequired` вернёт `ErrValidateRequiredUnsupported`.
:::

---

### RequiredValidator

Интерфейс валидации обязательных ключей:

```go
type RequiredValidator interface {
    ValidateRequired(keys map[string]bool) error
}
```

Валидирует наличие всех обязательных ключей.

---

### KeyValidator

Интерфейс валидации ключей:

```go
type KeyValidator interface {
    ValidateKey(key string) error
}
```

Валидирует, соответствует ли имя ключа правилам (длина, формат, запрещённые ключи и т.д.).

---

### ValueValidator

Интерфейс валидации значений:

```go
type ValueValidator interface {
    ValidateValue(value string) error
}
```

Валидирует, является ли значение безопасным (отсутствие нулевых байтов, управляющих символов и т.д.).

---

## Интерфейсы аудита

### AuditLogger

Минимальный интерфейс аудитного лога (псевдоним `internal.AuditLogger`):

```go
type AuditLogger interface {
    LogError(action AuditAction, key, errMsg string) error
}
```

**Назначение:** Минимизированный интерфейс для удобной реализации пользовательского аудитного лога. Для полного функционала аудита используйте `FullAuditLogger`.

---

### FullAuditLogger

Расширенный интерфейс аудитного лога, предоставляющий полный функционал:

```go
type FullAuditLogger interface {
    AuditLogger
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

**Назначение:** Полные возможности аудитного лога. `ComponentFactory.Auditor()` возвращает этот интерфейс.

**Описание методов:**

| Метод | Назначение |
|-------|------------|
| LogError | Регистрация события ошибки (наследуется от AuditLogger) |
| `Log` | Регистрация общего события аудита |
| `LogWithFile` | Регистрация события с информацией о файле |
| `LogWithDuration` | Регистрация события с информацией о продолжительности |
| `Close` | Закрытие аудитного лога |

---

### AuditHandler

Интерфейс обработчика аудита (для конфигурации Config.AuditHandler):

```go
type AuditHandler interface {
    Log(event AuditEvent) error
    Close() error
}
```

**Назначение:** Реализация этого интерфейса позволяет настроить способ обработки событий аудита. В отличие от интерфейса `AuditLogger`, `AuditHandler` требует методы `Log` и `Close` для приёма обработки событий аудита и освобождения ресурсов.

**Встроенные реализации:**
- `JSONAuditHandler` - Вывод логов в формате JSON
- `LogAuditHandler` - Вывод с использованием стандартного пакета log
- `ChannelAuditHandler` - Отправка в канал
- `CloseableChannelHandler` - Закрываемый обработчик с собственным буферизованным каналом
- `NopAuditHandler` - Обработчик с пустой операцией

---

## Интерфейс подстановки переменных

### VariableExpander

Интерфейс подстановки переменных:

```go
type VariableExpander interface {
    Expand(s string) (string, error)
}
```

**Назначение:** Пользовательская логика подстановки переменных, поддержка синтаксиса `${VAR}`, `${VAR:-default}` и т.д.

```go
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

## Интерфейс разбора

### EnvParser

Интерфейс парсера:

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

**Параметры:**
- `r` - Читатель содержимого файла
- `filename` - Имя файла (для сообщений об ошибках)

**Возвращает:**
- `map[string]string` - Разобранные пары ключ-значение
- `error` - Ошибка разбора

**Назначение:** Пользовательские парсеры файловых форматов.

---

## Интерфейс хранения

### EnvStorage

Интерфейс хранения переменных окружения:

```go
type EnvStorage interface {
    Get(key string) (string, bool)
    Set(key, value string)
    Delete(key string)
    Keys() []string
    Len() int
    ToMap() map[string]string
    Clear()
}
```

**Назначение:** Пользовательский бэкенд хранения.

**Описание методов:**

| Метод | Назначение |
|-------|------------|
| `Get` | Получить значение, возвращает значение и наличие |
| `Set` | Установить пару ключ-значение |
| `Delete` | Удалить ключ |
| `Keys` | Возвращает все имена ключей |
| `Len` | Возвращает количество пар ключ-значение |
| `ToMap` | Возвращает копию всех пар ключ-значение |
| `Clear` | Очистить все данные |

---

## Интерфейсы сериализации

### Marshaler

Интерфейс пользовательской сериализации:

```go
type Marshaler interface {
    MarshalEnv() ([]byte, error)
}
```

**Назначение:** Сериализация пользовательских типов.

```go
type LogLevel string

func (l LogLevel) MarshalEnv() ([]byte, error) {
    return []byte(string(l)), nil
}

// Использование
level := LogLevel("debug")
env.Marshal(level)  // Вызывает MarshalEnv
```

---

### Unmarshaler

Интерфейс пользовательской десериализации:

```go
type Unmarshaler interface {
    UnmarshalEnv(data map[string]string) error
}
```

**Назначение:** Десериализация пользовательских типов.

```go
type Config struct {
    Host string
    Port int
}

func (c *Config) UnmarshalEnv(data map[string]string) error {
    c.Host = data["HOST"]
    port, _ := strconv.Atoi(data["PORT"])
    c.Port = port
    return nil
}

// Использование
var cfg Config
env.UnmarshalInto(data, &cfg)  // Вызывает UnmarshalEnv
```

---

## Интерфейс файловой системы

### FileSystem

Интерфейс абстракции файловой системы:

```go
type FileSystem interface {
    Open(name string) (File, error)
    OpenFile(name string, flag int, perm os.FileMode) (File, error)
    Stat(name string) (os.FileInfo, error)
    MkdirAll(path string, perm os.FileMode) error
    Remove(name string) error
    Rename(oldpath, newpath string) error
    Getenv(key string) string
    Setenv(key, value string) error
    Unsetenv(key string) error
    LookupEnv(key string) (string, bool)
}
```

**Назначение:** Имитация файловой системы при тестировании.

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

// MockFile реализует интерфейс env.File (для тестирования)
type MockFile struct {
    reader *strings.Reader
}

func (f *MockFile) Read(p []byte) (n int, err error)   { return f.reader.Read(p) }
func (f *MockFile) Write(p []byte) (n int, err error)  { return 0, errors.ErrUnsupported }
func (f *MockFile) Close() error                       { return nil }
func (f *MockFile) Stat() (os.FileInfo, error)         { return nil, errors.ErrUnsupported }
func (f *MockFile) Sync() error                        { return nil }

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{reader: strings.NewReader(content)}, nil
}

func (m *MockFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MockFileSystem) Stat(name string) (os.FileInfo, error) {
    if _, ok := m.files[name]; !ok {
        return nil, os.ErrNotExist
    }
    return nil, nil
}

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error { return nil }
func (m *MockFileSystem) Remove(name string) error                     { delete(m.files, name); return nil }
func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MockFileSystem) Getenv(key string) string            { return m.env[key] }
func (m *MockFileSystem) Setenv(key, value string) error      { m.env[key] = value; return nil }
func (m *MockFileSystem) Unsetenv(key string) error           { delete(m.env, key); return nil }
func (m *MockFileSystem) LookupEnv(key string) (string, bool) { val, ok := m.env[key]; return val, ok }

// Использование
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

### File

Интерфейс файла:

```go
type File interface {
    io.Reader
    io.Writer
    io.Closer
    Stat() (os.FileInfo, error)
    Sync() error
}
```

**Описание методов:**

| Метод | Назначение |
|-------|------------|
| Read | Чтение данных |
| Write | Запись данных |
| Close | Закрытие файла |
| Stat | Получение информации о файле |
| Sync | Синхронизация на диск |

---

### DefaultFileSystem

Реализация файловой системы по умолчанию:

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Использует реальную файловую систему ОС и переменные окружения:

```go
cfg := env.DefaultConfig()
cfg.FileSystem = env.DefaultFileSystem  // Значение по умолчанию
```

---

## Обработчики аудита

### JSONAuditHandler

Вывод аудитного лога в формате JSON:

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

**Параметры:**
- `w` - Цель вывода (например, `os.Stdout`, файл)

```go
handler := env.NewJSONAuditHandler(os.Stdout)
```

**Пример вывода:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","key":"API_KEY","success":true}
```

---

### LogAuditHandler

Вывод с использованием стандартного пакета log:

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

**Параметры:**
- `logger` - Экземпляр стандартного log.Logger

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
handler := env.NewLogAuditHandler(logger)
```

**Пример вывода:**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success
```

---

### ChannelAuditHandler

Отправка в канал:

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

**Параметры:**
- `ch` - Канал событий аудита

```go
ch := make(chan env.AuditEvent, 100)
handler := env.NewChannelAuditHandler(ch)

// Асинхронная обработка
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

---

### NopAuditHandler

Обработчик с пустой операцией (отбрасывает все события):

```go
func NewNopAuditHandler() *NopAuditHandler
```

```go
handler := env.NewNopAuditHandler()
```

---

## Типы аудита

### AuditAction

Константы типов операций:

```go
type AuditAction = internal.Action

const (
    ActionLoad       AuditAction = "load"        // Загрузка файла
    ActionParse      AuditAction = "parse"       // Операция разбора
    ActionGet        AuditAction = "get"         // Чтение переменной
    ActionSet        AuditAction = "set"         // Установка переменной
    ActionDelete     AuditAction = "delete"      // Удаление переменной
    ActionValidate   AuditAction = "validate"    // Операция валидации
    ActionExpand     AuditAction = "expand"      // Подстановка переменной
    ActionSecurity   AuditAction = "security"    // Событие безопасности
    ActionError      AuditAction = "error"       // Событие ошибки
    ActionFileAccess AuditAction = "file_access" // Доступ к файлу
)
```

---

### AuditEvent

Структура события аудита:

```go
type AuditEvent = internal.Event
```

**Поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| Timestamp | `time.Time` | Метка времени |
| Action | `AuditAction` | Тип операции |
| Key | `string` | Имя ключа (маскировано) |
| File | `string` | Имя файла |
| Reason | `string` | Причина/описание |
| Success | `bool` | Успешно ли |
| Masked | `bool` | Маскировано ли |
| Details | `string` | Подробности |
| Duration | `int64` | Продолжительность (наносекунды) |

---

## ComponentFactory

Компонентная фабрика, управляющая общими компонентами:

```go
type ComponentFactory struct {
    // Содержит приватные поля
}
```

### Методы

```go
func (f *ComponentFactory) Validator() Validator
func (f *ComponentFactory) Auditor() FullAuditLogger
func (f *ComponentFactory) Expander() VariableExpander
func (f *ComponentFactory) Close() error
func (f *ComponentFactory) IsClosed() bool
```

**Назначение:** Внутреннее использование, автоматически управляется при создании Loader. Подробнее в [ComponentFactory API](/ru/env/api-reference/factory).

---

## Полный пример

### Реализация пользовательского обработчика аудита

```go
package main

import (
    "fmt"

    "github.com/cybergodev/env"
)

// Пользовательский обработчик аудита
type CustomAuditHandler struct {
    events []env.AuditEvent
}

func (h *CustomAuditHandler) Log(event env.AuditEvent) error {
    h.events = append(h.events, event)
    return nil
}

func (h *CustomAuditHandler) Close() error {
    return nil
}

func main() {
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    handler := &CustomAuditHandler{}
    cfg.AuditHandler = handler

    loader, _ := env.New(cfg)
    defer loader.Close()
    // Использование loader...

    // Просмотр событий аудита
    for _, event := range handler.events {
        fmt.Printf("%s: %s - %s\n", event.Action, event.Key, event.Reason)
    }
}
```

### Использование детализированных интерфейсов

```go
package main

import (
    "fmt"
    "github.com/cybergodev/env"
)

// Требуется только возможность чтения
func printConfig(getter env.EnvGetter) {
    for _, key := range getter.Keys() {
        value, _ := getter.Lookup(key)
        fmt.Printf("%s = %s\n", key, value)
    }
}

// Требуется только возможность записи
func setDefaults(setter env.EnvSetter) error {
    return setter.Set("DEFAULT_KEY", "default_value")
}

// Требуется только возможность загрузки
func loadConfig(loader env.EnvFileLoader) error {
    return loader.LoadFiles(".env")
}

func main() {
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // Использование детализированных интерфейсов
    loadConfig(loader)
    setDefaults(loader)
    printConfig(loader)
}
```

## Связанная документация

- [Loader API](/ru/env/api-reference/loader) - Методы экземпляра Loader
- [ComponentFactory API](/ru/env/api-reference/factory) - Компонентная фабрика
- [Пользовательский парсер](/ru/env/guides/custom-parser) - Руководство по пользовательскому парсеру
