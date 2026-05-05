---
title: ComponentFactory API - CyberGo env | Фабрика компонентов
description: CyberGo env библиотека ComponentFactory фабрика компонентов API справочная документация, для создания и управления общими экземплярами компонентов Loader и Parser, включая регистрацию обработчиков аудита, адаптеров файловой системы и пользовательских парсеров, управление жизненным циклом компонентов и поддержка внедрения зависимостей.
---

# ComponentFactory API

`ComponentFactory` создаёт и управляет общими компонентами для Loader и Parser, обеспечивая ясное управление жизненным циклом.

## Определение типа

```go
type ComponentFactory struct {
    // Содержит приватные поля
}
```

**Основные обязанности:**
- Создание общих валидаторов, аудиторов и расширителей переменных
- Управление жизненным циклом компонентов
- Поддержка доступа пользовательских парсеров к внутренним компонентам

**Потокобезопасность:** Все методы ComponentFactory потокобезопасны.

---

## Методы

### Validator

```go
func (f *ComponentFactory) Validator() Validator
```

Возвращает компонент валидатора для валидации имён ключей и значений.

```go
// Использование в пользовательском парсере
validator := factory.Validator()

if err := validator.ValidateKey("MY_KEY"); err != nil {
    // Недопустимое имя ключа
}

if err := validator.ValidateValue("some value"); err != nil {
    // Значение содержит недопустимое содержимое (например, нулевые байты, управляющие символы)
}
```

---

### Auditor

```go
func (f *ComponentFactory) Auditor() FullAuditLogger
```

Возвращает компонент аудитного журнала с полным функционалом.

```go
auditor := factory.Auditor()
_ = auditor.Log(env.ActionSet, "KEY", "value set", true)
_ = auditor.LogError(env.ActionSet, "KEY", "validation failed")
_ = auditor.LogWithFile(env.ActionLoad, "KEY", ".env", "loaded", true)
_ = auditor.LogWithDuration(env.ActionParse, "", "parsed", true, time.Since(start))
```

---

### Expander

```go
func (f *ComponentFactory) Expander() VariableExpander
```

Возвращает компонент расширителя переменных для подстановки синтаксиса `${VAR}`.

```go
expander := factory.Expander()
expanded, err := expander.Expand("${BASE_URL}/api")
```

---

### Close

```go
func (f *ComponentFactory) Close() error
```

Освобождает ресурсы, удерживаемые фабрикой. После закрытия фабрику и созданные через неё компоненты использовать не следует.

**Поведение:**
- Безопасное закрытие, повторные вызовы возвращают nil
- Освобождает ресурсы аудитора
- Использует атомарные операции для обеспечения потокобезопасности

```go
// Обычно автоматически управляется Loader
loader, _ := env.New(cfg)
defer loader.Close()  // Автоматически закрывает ComponentFactory
```

---

### IsClosed

```go
func (f *ComponentFactory) IsClosed() bool
```

Проверяет, закрыта ли фабрика.

```go
if factory.IsClosed() {
    // Фабрика закрыта, нельзя использовать
}
```

---

## Способ создания

### Автоматическое создание (рекомендуется)

ComponentFactory создаётся и управляется автоматически при создании Loader:

```go
cfg := env.DefaultConfig()
loader, _ := env.New(cfg)
// Loader автоматически создаёт ComponentFactory внутри
defer loader.Close()  // Автоматически закрывает фабрику
```

### Использование в пользовательском парсере

При регистрации пользовательского парсера можно получить валидатор и аудитор через ComponentFactory:

```go
type CustomParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func newCustomParser(cfg env.Config, factory *env.ComponentFactory) *CustomParser {
    return &CustomParser{
        cfg:       cfg,
        validator: factory.Validator(),
        auditor:   factory.Auditor(),
    }
}

// Определение константы пользовательского формата (рекомендуется использовать 100+ для предотвращения конфликтов)
const FormatCustom env.FileFormat = 100

// Регистрация парсера
env.RegisterParser(FormatCustom, func(cfg env.Config, factory *env.ComponentFactory) (env.EnvParser, error) {
    return newCustomParser(cfg, factory), nil
})
```

---

## Управление жизненным циклом

```text
Создание Config
     ↓
env.New(cfg)
     ↓
Автоматическое создание ComponentFactory
     ↓
    ┌───────┼───────┐
    ↓       ↓       ↓
Validator  Auditor  Expander
    ↓       ↓       ↓
    └───────┼───────┘
            ↓
      Loader/Parser
            ↓
      Close() освобождение
```

::: warning Внимание
- Каждый Loader обычно владеет собственной ComponentFactory
- После вызова Close() все компоненты, созданные через эту фабрику, не должны использоваться
- Фабрика потокобезопасна, допускает параллельный доступ
:::

---

## Фабрики обработчиков аудита

### NewJSONAuditHandler

```go
func NewJSONAuditHandler(w io.Writer) *JSONAuditHandler
```

Создаёт обработчик аудита в формате JSON, выводящий структурированные журналы.

**Параметры:**
- `w` - целевой вывод (например, `os.Stdout`, файл)

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**Пример вывода:**
```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
```

---

### NewLogAuditHandler

```go
func NewLogAuditHandler(logger *log.Logger) *LogAuditHandler
```

Создаёт обработчик аудита в формате стандартного журнала.

**Параметры:**
- `logger` - экземпляр стандартного log.Logger

```go
import "log"

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**Пример вывода:**
```text
[AUDIT] 2024/01/15 10:30:00 load .env success (1.23ms)
```

---

### NewChannelAuditHandler

```go
func NewChannelAuditHandler(ch chan<- AuditEvent) *ChannelAuditHandler
```

Создаёт каналный обработчик аудита для асинхронной обработки событий.

**Параметры:**
- `ch` - канал событий аудита

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// Асинхронная обработка событий аудита
go func() {
    for event := range ch {
        fmt.Printf("Audit: %+v\n", event)
    }
}()
```

---

### NewNopAuditHandler

```go
func NewNopAuditHandler() *NopAuditHandler
```

Создаёт обработчик аудита без операций для отключения журналлирования аудита.

```go
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewNopAuditHandler() // Не записывать никаких журналов
```

---

## Файловая система

### OSFileSystem

Реализация файловой системы по умолчанию, оборачивающая файловые операции ОС:

```go
type OSFileSystem struct{}
```

**Реализует интерфейс:** `FileSystem`

```go
// Список методов
func (fs OSFileSystem) Open(name string) (File, error)
func (fs OSFileSystem) OpenFile(name string, flag int, perm os.FileMode) (File, error)
func (fs OSFileSystem) Stat(name string) (os.FileInfo, error)
func (fs OSFileSystem) MkdirAll(path string, perm os.FileMode) error
func (fs OSFileSystem) Remove(name string) error
func (fs OSFileSystem) Rename(oldpath, newpath string) error
func (fs OSFileSystem) Getenv(key string) string
func (fs OSFileSystem) Setenv(key, value string) error
func (fs OSFileSystem) Unsetenv(key string) error
func (fs OSFileSystem) LookupEnv(key string) (string, bool)
```

---

### DefaultFileSystem

```go
var DefaultFileSystem FileSystem = OSFileSystem{}
```

Глобальный экземпляр файловой системы по умолчанию.

---

### Использование пользовательской файловой системы

Имитация файловой системы при тестировании:

```go
type MockFileSystem struct {
    files map[string]string
    env   map[string]string
}

func (m *MockFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MockFile{content: content}, nil
}

func (m *MockFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MockFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MockFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MockFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
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

func (m *MockFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MockFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MockFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

// Использование
cfg := env.TestingConfig()
cfg.FileSystem = &MockFileSystem{
    files: map[string]string{".env": "KEY=value"},
    env:   make(map[string]string),
}
```

---

## Определение формата

### DetectFormat

```go
func DetectFormat(filename string) FileFormat
```

Определяет формат по расширению файла.

**Параметры:**
- `filename` - имя файла или путь

**Возвращает:**
- `FileFormat` - определённый формат

**Правила определения:**

| Расширение | Возвращаемый формат |
|------------|---------------------|
| `.env` | `FormatEnv` |
| `.json` | `FormatJSON` |
| `.yaml`, `.yml` | `FormatYAML` |
| Другое | `FormatAuto` |

```go
format := env.DetectFormat("config.json")   // FormatJSON
format := env.DetectFormat("settings.yaml") // FormatYAML
format := env.DetectFormat("app.yml")       // FormatYAML
format := env.DetectFormat(".env")          // FormatEnv
format := env.DetectFormat(".env.local")    // FormatAuto (фактически обрабатывается как .env)
format := env.DetectFormat("unknown.txt")   // FormatAuto
```

**Применение в LoadFiles:**

```go
loader.LoadFiles("config.env", "settings.json", "secrets.yaml")
// Автоматически определяет формат каждого файла и использует соответствующий парсер
```

---

### Константы FileFormat

```go
const (
    FormatAuto  FileFormat = iota  // Автоматическое обнаружение
    FormatEnv                      // Формат .env
    FormatJSON                     // Формат JSON
    FormatYAML                     // Формат YAML
)
```

**Пользовательские форматы:**

```go
// Определение констант пользовательского формата (рекомендуется использовать значения 100+ для предотвращения конфликтов)
const (
    FormatTOML  env.FileFormat = 100
    FormatINI   env.FileFormat = 101
    FormatXML   env.FileFormat = 102
)
```

---

### FileFormat.String

```go
func (f FileFormat) String() string
```

Возвращает строковое представление формата.

```go
fmt.Println(env.FormatJSON.String())  // "json"
fmt.Println(env.FormatYAML.String())  // "yaml"
fmt.Println(env.FormatEnv.String())   // "dotenv"
fmt.Println(env.FormatAuto.String())  // "auto"
fmt.Println(env.FileFormat(999).String())  // "unknown"
```

---

## Регистрация парсеров

### RegisterParser

```go
func RegisterParser(format FileFormat, factory ParserFactory) error
```

Регистрирует парсер пользовательского формата.

**Параметры:**
- `format` - константа формата файла
- `factory` - фабричная функция парсера

**Возвращает:**
- `error` - ошибка при неудачной регистрации

**Случаи ошибок:**
- Встроенные форматы (FormatEnv, FormatJSON, FormatYAML) не могут быть переопределены
- Формат уже зарегистрирован

**Примечания:**
- Регистрация должна быть выполнена до вызова `env.New()`
- Рекомендуется использовать значения формата 100+ для предотвращения конфликтов с встроенными форматами
- Фабричная функция должна возвращать потокобезопасный парсер

```go
// 1. Определить константу пользовательского формата
const FormatTOML env.FileFormat = 100

// 2. Реализовать интерфейс парсера
type TOMLParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *TOMLParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    // Реализовать логику парсинга TOML
    result := make(map[string]string)
    // ... код парсинга
    return result, nil
}

// 3. Зарегистрировать парсер
err := env.RegisterParser(FormatTOML, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &TOMLParser{
        cfg:       cfg,
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
if err != nil {
    panic(err)
}

// 4. Использовать пользовательский формат
func main() {
    // Регистрация должна быть завершена до New
    loader, _ := env.New(env.DefaultConfig())
    defer loader.Close()

    // Теперь можно загружать .toml файлы
    loader.LoadFiles("config.toml")
}
```

---

### ForceRegisterParser

```go
func ForceRegisterParser(format FileFormat, factory ParserFactory) error
```

Принудительно регистрирует парсер, позволяя переопределить встроенные парсеры.

**Параметры:**
- `format` - константа формата файла
- `factory` - фабричная функция парсера

**Возвращает:**
- `error` - ошибка при неудачной регистрации (когда `factory` равен nil)

::: danger Опасность
Используйте с осторожностью. Переопределение встроенных парсеров может создать уязвимости безопасности, если заменяющий парсер не реализует те же проверки безопасности (валидация ключей, валидация значений, ограничения размера и т.д.).

Применимо для следующих расширенных сценариев:
- Добавление пользовательских проверок безопасности к встроенным парсерам
- Реализация расширений формата (например, HEREDOC, многострочные значения)
- Использование имитирующих парсеров для тестирования
:::

```go
// Переопределить парсер .env по умолчанию (расширенное использование)
err := env.ForceRegisterParser(env.FormatEnv, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
    return &MyCustomEnvParser{
        validator: f.Validator(),
        auditor:   f.Auditor(),
    }, nil
})
```

---

### Тип ParserFactory

```go
type ParserFactory func(cfg Config, factory *ComponentFactory) (EnvParser, error)
```

Сигнатура фабричной функции парсера.

**Параметры:**
- `cfg` - объект конфигурации, содержащий ограничения и настройки безопасности
- `factory` - фабрика компонентов, можно получить валидатор и аудитор

**Возвращает:**
- `EnvParser` - экземпляр парсера
- `error` - ошибка создания

---

### Интерфейс EnvParser

```go
type EnvParser interface {
    Parse(r io.Reader, filename string) (map[string]string, error)
}
```

Интерфейс, который должен реализовать парсер.

**Параметры:**
- `r` - читатель содержимого файла
- `filename` - имя файла (для сообщений об ошибках)

**Возвращает:**
- `map[string]string` - разобранные пары ключ-значение
- `error` - ошибка парсинга

---

## Встроенные парсеры

Библиотека включает три встроенных парсера форматов:

### DotEnv Parser

Парсер формата `.env`, поддерживает:
- Синтаксис `KEY=value`
- Синтаксис `export KEY=value`
- Одинарные кавычки `'value'` и двойные кавычки `"value"`
- Подстановку переменных `${VAR}` и `${VAR:-default}`
- Комментарии `#`

### JSON Parser

Парсер формата JSON, поддерживает:
- Объекты с парами ключ-значение
- Вложенные структуры (с преобразованием в плоский вид)
- Преобразование чисел, строк, булевых значений
- Массивы (преобразуются в `KEY_0`, `KEY_1`...)

### YAML Parser

Парсер формата YAML, поддерживает:
- Пары ключ-значение
- Вложенные структуры (с преобразованием в плоский вид)
- Множество скалярных типов
- Списки (преобразуются в индексированные ключи)

---

## Полный пример

### Регистрация пользовательского парсера

```go
package main

import (
    "fmt"
    "io"
    "strings"

    "github.com/cybergodev/env"
)

// Пользовательский INI парсер
type INIParser struct {
    cfg       env.Config
    validator env.Validator
    auditor   env.FullAuditLogger
}

func (p *INIParser) Parse(r io.Reader, filename string) (map[string]string, error) {
    content, err := io.ReadAll(r)
    if err != nil {
        return nil, err
    }

    result := make(map[string]string)
    lines := strings.Split(string(content), "\n")
    var section string

    for lineNum, line := range lines {
        line = strings.TrimSpace(line)

        // Пропустить пустые строки и комментарии
        if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
            continue
        }

        // Section [section]
        if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
            section = strings.Trim(line, "[]")
            continue
        }

        // Key=Value
        if idx := strings.Index(line, "="); idx > 0 {
            key := strings.TrimSpace(line[:idx])
            value := strings.TrimSpace(line[idx+1:])

            // Добавить префикс section
            if section != "" {
                key = section + "_" + key
            }

            // Валидация ключа
            if err := p.validator.ValidateKey(key); err != nil {
                _ = p.auditor.LogError(env.ActionParse, key, err.Error())
                return nil, fmt.Errorf("line %d: %w", lineNum+1, err)
            }

            result[strings.ToUpper(key)] = value
        }
    }

    _ = p.auditor.Log(env.ActionParse, "", fmt.Sprintf("parsed %d variables from %s", len(result), filename), true)
    return result, nil
}

func main() {
    // Определить пользовательский формат
    const FormatINI env.FileFormat = 101

    // Зарегистрировать парсер
    err := env.RegisterParser(FormatINI, func(cfg env.Config, f *env.ComponentFactory) (env.EnvParser, error) {
        return &INIParser{
            cfg:       cfg,
            validator: f.Validator(),
            auditor:   f.Auditor(),
        }, nil
    })
    if err != nil {
        panic(err)
    }

    // Использовать пользовательский формат
    cfg := env.DefaultConfig()
    loader, _ := env.New(cfg)
    defer loader.Close()

    // Теперь можно загружать .ini файлы
    // loader.LoadFiles("config.ini")

    fmt.Println("INI parser registered")
}
```

### Пользовательская файловая система

```go
package main

import (
    "fmt"
    "os"
    "strings"
    "time"

    "github.com/cybergodev/env"
)

// Файловая система в памяти (для тестирования)
type MemoryFileSystem struct {
    files map[string]string
    env   map[string]string
}

func NewMemoryFileSystem() *MemoryFileSystem {
    return &MemoryFileSystem{
        files: make(map[string]string),
        env:   make(map[string]string),
    }
}

func (m *MemoryFileSystem) Open(name string) (env.File, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFile{reader: strings.NewReader(content)}, nil
}

func (m *MemoryFileSystem) OpenFile(name string, flag int, perm os.FileMode) (env.File, error) {
    return m.Open(name)
}

func (m *MemoryFileSystem) Stat(name string) (os.FileInfo, error) {
    content, ok := m.files[name]
    if !ok {
        return nil, os.ErrNotExist
    }
    return &MemoryFileInfo{name: name, size: int64(len(content))}, nil
}

func (m *MemoryFileSystem) MkdirAll(path string, perm os.FileMode) error {
    return nil
}

func (m *MemoryFileSystem) Remove(name string) error {
    delete(m.files, name)
    return nil
}

func (m *MemoryFileSystem) Rename(oldpath, newpath string) error {
    m.files[newpath] = m.files[oldpath]
    delete(m.files, oldpath)
    return nil
}

func (m *MemoryFileSystem) Getenv(key string) string {
    return m.env[key]
}

func (m *MemoryFileSystem) Setenv(key, value string) error {
    m.env[key] = value
    return nil
}

func (m *MemoryFileSystem) Unsetenv(key string) error {
    delete(m.env, key)
    return nil
}

func (m *MemoryFileSystem) LookupEnv(key string) (string, bool) {
    val, ok := m.env[key]
    return val, ok
}

// MemoryFile реализует env.File
type MemoryFile struct {
    reader *strings.Reader
}

func (f *MemoryFile) Read(p []byte) (n int, err error)  { return f.reader.Read(p) }
func (f *MemoryFile) Write(p []byte) (n int, err error) { return 0, os.ErrUnsupported }
func (f *MemoryFile) Close() error                      { return nil }
func (f *MemoryFile) Stat() (os.FileInfo, error)        { return nil, os.ErrUnsupported }
func (f *MemoryFile) Sync() error                       { return nil }

// MemoryFileInfo реализует os.FileInfo
type MemoryFileInfo struct {
    name string
    size int64
}

func (i *MemoryFileInfo) Name() string       { return i.name }
func (i *MemoryFileInfo) Size() int64        { return i.size }
func (i *MemoryFileInfo) Mode() os.FileMode  { return 0644 }
func (i *MemoryFileInfo) ModTime() time.Time { return time.Time{} }
func (i *MemoryFileInfo) IsDir() bool        { return false }
func (i *MemoryFileInfo) Sys() interface{}   { return nil }

// Пример использования
func main() {
    // Создать файловую систему в памяти
    fs := NewMemoryFileSystem()
    fs.files[".env"] = "APP_NAME=myapp\nPORT=8080\n"

    // Настроить использование пользовательской файловой системы
    cfg := env.TestingConfig()
    cfg.FileSystem = fs

    loader, _ := env.New(cfg)
    defer loader.Close()

    loader.LoadFiles(".env")

    fmt.Println(loader.GetString("APP_NAME"))  // myapp
    fmt.Println(loader.GetInt("PORT"))         // 8080
}
```

---

## Связанная документация

- [Определения интерфейсов](/ru/env/api-reference/interfaces) - Все определения интерфейсов
- [Пользовательский парсер](/ru/env/guides/custom-parser) - Руководство по созданию пользовательских парсеров
- [Сценарии тестирования](/ru/env/guides/testing) - Тестирование с пользовательской файловой системой
