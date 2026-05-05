---
title: Константы и ошибки - CyberGo env | Сторожевые ошибки и константы безопасности
description: CyberGo env библиотека управления переменными окружения полная справочная документация констант и ошибок, включая константы ограничений безопасности, определения сторожевых ошибок, структурированные типы ошибок, предопределённые переменные и служебные функции безопасности.
---

# Константы и ошибки

Определённые библиотекой константы, типы ошибок, сторожевые ошибки и предопределённые переменные.

## Константы ограничений безопасности

### Ограничения по умолчанию

```go
const (
    // DefaultMaxFileSize - максимальное количество байт на файл
    DefaultMaxFileSize int64 = 2 * 1024 * 1024  // 2 МБ

    // DefaultMaxLineLength - максимальная длина строки
    DefaultMaxLineLength int = 1024  // 1 КБ

    // DefaultMaxKeyLength - максимальная длина имени ключа
    DefaultMaxKeyLength int = 64

    // DefaultMaxValueLength - максимальная длина значения
    DefaultMaxValueLength int = 4096  // 4 КБ

    // DefaultMaxVariables - максимальное количество переменных на файл
    DefaultMaxVariables int = 500

    // DefaultMaxExpansionDepth - максимальная глубина подстановки переменных
    DefaultMaxExpansionDepth int = 5
)
```

### Жёсткие пределы

::: warning Внимание
Ниже приведены внутренние жёсткие пределы библиотеки (не экспортируются), используемые в `Config.Validate()` для внутренних проверок. Пользователь не может напрямую ссылаться на эти константы, но `cfg.Validate()` автоматически проверяет, не превышает ли конфигурация эти ограничения.
:::

| Константа | Значение | Описание |
|-----------|----------|----------|
| HardMaxFileSize | 100 МБ | Жёсткий предел размера файла |
| HardMaxLineLength | 64 КБ | Жёсткий предел длины строки |
| HardMaxKeyLength | 1024 | Жёсткий предел длины ключа |
| HardMaxValueLength | 1 МБ | Жёсткий предел длины значения |
| HardMaxVariables | 10000 | Жёсткий предел количества переменных |
| HardMaxExpansionDepth | 20 | Жёсткий предел глубины подстановки |

Валидация конфигурации проверяет превышение жёстких ограничений:

```go
cfg := env.DefaultConfig()
cfg.MaxFileSize = 200 * 1024 * 1024  // Превышает предел 100 МБ

if err := cfg.Validate(); err != nil {
    // Возвращает ошибку: MaxFileSize exceeds hard limit
}
```

## Сторожевые ошибки

### Ошибки файлов

```go
var ErrFileNotFound = errors.New("file not found")
var ErrFileTooLarge = errors.New("file exceeds maximum size limit")
```

Способ проверки:

```go
err := loader.LoadFiles(".env")
if errors.Is(err, env.ErrFileNotFound) {
    // Файл не найден
}
if errors.Is(err, env.ErrFileTooLarge) {
    // Файл слишком большой
}
```

### Ошибки парсинга

```go
var ErrLineTooLong = errors.New("line exceeds maximum length limit")
var ErrInvalidKey = errors.New("invalid key format")
var ErrDuplicateKey = errors.New("duplicate key encountered")
```

### Ошибки безопасности

```go
var ErrForbiddenKey = errors.New("key is forbidden for security reasons")
var ErrSecurityViolation = errors.New("security policy violation")
var ErrNullByte = errors.New("null byte detected in input")
var ErrControlChar = errors.New("control character detected in input")
var ErrInvalidValue = errors.New("invalid value content")
```

Проверка запрещённых ключей:

```go
err := loader.Set("PATH", "value")
if errors.Is(err, env.ErrForbiddenKey) {
    // Попытка установить запрещённый ключ
}
```

### Ошибки подстановки

```go
var ErrExpansionDepth = errors.New("variable expansion depth exceeded")
```

### Ошибки ограничений

```go
var ErrMaxVariables = errors.New("maximum number of variables exceeded")
```

### Ошибки состояния

```go
var ErrClosed = errors.New("loader has been closed")
var ErrInvalidConfig = errors.New("invalid configuration")
var ErrAlreadyInitialized = errors.New("default loader already initialized")
var ErrMissingRequired = errors.New("required key is missing")
```

**Способ проверки:**

```go
// Проверить, закрыт ли загрузчик
if errors.Is(err, env.ErrClosed) {
    // Загрузчик закрыт
}

// Проверить, инициализирован ли загрузчик по умолчанию
if errors.Is(err, env.ErrAlreadyInitialized) {
    // Загрузчик по умолчанию уже существует, нельзя повторно вызвать Load()
}

// Проверить, отсутствует ли обязательный ключ
if errors.Is(err, env.ErrMissingRequired) {
    // Отсутствует обязательный ключ
}
```

### Ошибки адаптера

```go
var ErrValidateRequiredUnsupported = errors.New(
    "custom validator does not implement ValidateRequired; " +
    "implement Validator interface for required key validation",
)
```

Возвращается при вызове `ValidateRequired`, если пользовательский валидатор реализует только интерфейс `KeyValidator`, а не полный интерфейс `Validator`.

**Способ проверки:**

```go
if errors.Is(err, env.ErrValidateRequiredUnsupported) {
    // Пользовательский валидатор не поддерживает валидацию обязательных ключей
    // Необходимо реализовать полный интерфейс Validator
}
```

::: tip Решение
Реализуйте интерфейс `Validator` (включающий методы `ValidateKey`, `ValidateValue`, `ValidateRequired`), а не только `KeyValidator`.
:::

## Типы ошибок

### ParseError

Ошибка парсинга с информацией о позиции:

```go
type ParseError struct {
    File    string  // Имя файла
    Line    int     // Номер строки
    Content string  // Содержимое ошибки (маскированное)
    Err     error   // Исходная ошибка
}
```

Пример использования:

```go
err := loader.LoadFiles(".env")
var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("Ошибка парсинга %s:%d: %v\n",
        parseErr.File, parseErr.Line, parseErr.Err)
}
```

### ValidationError

Ошибка валидации:

```go
type ValidationError struct {
    Field   string  // Имя поля
    Value   string  // Значение (маскированное)
    Rule    string  // Правило
    Message string  // Сообщение
}
```

### SecurityError

Ошибка безопасности:

```go
type SecurityError struct {
    Action  string  // Действие
    Reason  string  // Причина
    Key     string  // Имя ключа (маскированное)
    Details string  // Дополнительные подробности
}
```

Пример использования:

```go
var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Ошибка безопасности: %s - %s\n", secErr.Action, secErr.Reason)
}
```

### FileError

Ошибка файловой операции:

```go
type FileError struct {
    Path  string  // Путь к файлу
    Op    string  // Операция (open, stat, size_check)
    Err   error   // Исходная ошибка
    Size  int64   // Размер файла (при проверке размера)
    Limit int64   // Ограничение (при проверке размера)
}
```

Пример использования:

```go
var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("Файл %s размер %d превышает ограничение %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}
```

### ExpansionError

Ошибка подстановки переменных:

```go
type ExpansionError struct {
    Key   string  // Имя ключа
    Depth int     // Текущая глубина
    Limit int     // Ограничение
    Chain string  // Цепочка подстановки
}
```

### JSONError

Ошибка парсинга JSON:

```go
type JSONError struct {
    Path    string  // Путь к файлу
    Message string  // Сообщение об ошибке
    Err     error   // Исходная ошибка
}
```

### YAMLError

Ошибка парсинга YAML:

```go
type YAMLError struct {
    Path    string  // Путь к файлу
    Line    int     // Номер строки
    Column  int     // Номер столбца
    Message string  // Сообщение об ошибке
    Err     error   // Исходная ошибка
}
```

### MarshalError

Ошибка сериализации:

```go
type MarshalError struct {
    Field   string  // Имя поля
    Message string  // Сообщение об ошибке
}

func IsMarshalError(err error) bool  // Функция проверки
```

## Предопределённые переменные

### DefaultForbiddenKeys

Встроенный список запрещённых ключей для предотвращения изменения системных переменных:

::: warning Внимание
`defaultForbiddenKeys` является внутренней переменной библиотеки (не экспортируется), недоступна напрямую через `env.DefaultForbiddenKeys`. Ниже приведён полный внутренний список для справки.
:::

| Категория | Запрещённые ключи |
|-----------|-------------------|
| Системные пути | `PATH` |
| Динамический компоновщик (Linux) | `LD_PRELOAD`, `LD_PRELOAD_32`, `LD_PRELOAD_64`, `LD_LIBRARY_PATH`, `LD_LIBRARY_PATH_32`, `LD_LIBRARY_PATH_64`, `LD_AUDIT`, `LD_DEBUG` |
| macOS | `DYLD_INSERT_LIBRARIES`, `DYLD_LIBRARY_PATH` |
| Shell | `SHELL`, `ENV`, `BASH_ENV`, `IFS` |
| Среды выполнения | `PYTHONPATH`, `NODE_PATH`, `PERL5OPT`, `RUBYLIB` |

**Описание рисков:**

| Ключ | Тип риска | Описание |
|------|-----------|----------|
| `PATH` | Перехват команд | Изменение пути поиска команд |
| `LD_PRELOAD` | Инъекция библиотек | Предзагрузка вредоносных динамических библиотек |
| `LD_LIBRARY_PATH` | Перехват библиотек | Изменение пути поиска библиотек |
| `DYLD_INSERT_LIBRARIES` | Инъекция библиотек | Инъекция библиотек на macOS |
| `PYTHONPATH` | Перехват модулей | Путь поиска модулей Python |
| `IFS` | Атака на парсинг | Изменение разделителя полей |

**Пример использования:**

```go
// Попытка установить запрещённый ключ вернёт ErrForbiddenKey
err := loader.Set("PATH", "/malicious/path")
if errors.Is(err, env.ErrForbiddenKey) {
    // Ключ запрещён
}

// Добавить дополнительные запрещённые ключи
cfg := env.DefaultConfig()
cfg.ForbiddenKeys = []string{"MY_SENSITIVE_VAR"}
```

### SensitiveKeyPatterns

Список шаблонов конфиденциальных ключей для автоматического обнаружения конфиденциальной конфигурации. Имя ключа, содержащее эти шаблоны (без учёта регистра), распознаётся как конфиденциальное:

::: warning Внимание
`sensitiveKeyPatterns` является внутренней переменной библиотеки (не экспортируется), доступ к ней осуществляется косвенно через функцию `IsSensitiveKey()`. Ниже приведены основные категории конфиденциальных шаблонов для справки.
:::

**Основные категории конфиденциальных шаблонов:**

| Категория | Примеры шаблонов |
|-----------|-----------------|
| Аутентификация и авторизация | `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, `PASSPHRASE`, `SESSION`, `COOKIE` |
| API и ключи | `API_KEY`, `APIKEY`, `ACCESS_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `PUBLIC_KEY` |
| Шифрование и безопасность | `PRIVATE`, `ENCRYPTION_KEY`, `ENCRYPT_KEY`, `DECRYPT_KEY`, `SIGNING_KEY`, `SIGN_KEY`, `VERIFY_KEY` |
| Финансы и PII | `SSN`, `SOCIAL_SECURITY`, `CREDIT_CARD`, `CARD_NUMBER`, `CVV`, `CVC`, `CCV`, `PAN` |
| Криптовалюта | `MNEMONIC`, `SEED`, `RECOVERY`, `WALLET`, `PRIVATE_ADDRESS` |
| Базы данных | `CONNECTION_STRING`, `CONN_STRING`, `DATABASE_URL`, `DB_PASSWORD` |
| Облачные сервисы | `AWS_SECRET`, `AZURE_KEY`, `GCP_KEY`, `SERVICE_ACCOUNT` |

**Правила соответствия:**
- Без учёта регистра
- Имя ключа, содержащее любой шаблон, распознаётся как конфиденциальное

**Пример использования:**

```go
// Проверить, является ли ключ конфиденциальным
if env.IsSensitiveKey("DB_PASSWORD") {
    // Использовать безопасный способ обработки
    secret := env.GetSecure("DB_PASSWORD")
    if secret != nil {
        defer secret.Release()
    }
}
```

### DefaultKeyPattern

Шаблон валидации имени ключа по умолчанию:

```go
var DefaultKeyPattern *regexp.Regexp = nil
```

::: tip Оптимизация производительности
Значение `nil` включает быструю побайтовую валидацию (примерно в 10 раз быстрее).
Правило валидации по умолчанию: начинается с буквы, содержит только буквы, цифры и подчёркивания.
:::

**Пользовательский шаблон:**

```go
import "regexp"

cfg := env.DefaultConfig()
// Разрешить только ключи, начинающиеся с заглавной буквы
cfg.KeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,63}$`)
```

## Служебные функции безопасности

### IsSensitiveKey

```go
func IsSensitiveKey(key string) bool
```

Проверяет, соответствует ли имя ключа шаблону конфиденциальности.

```go
if env.IsSensitiveKey("DB_PASSWORD") {
    // Конфиденциальный ключ, использовать безопасный способ обработки
    secret := env.GetSecure("DB_PASSWORD")
    defer secret.Release()
}
```

### MaskValue

```go
func MaskValue(key, value string) string
```

Возвращает маскированное значение в зависимости от конфиденциальности ключа.

```go
// Конфиденциальный ключ - возвращает формат [MASKED:N chars]
masked := env.MaskValue("API_KEY", "secret123")
// Возвращает: [MASKED:9 chars]

// Неконфиденциальный ключ - возвращает исходное значение (обрезается свыше 20 символов)
masked := env.MaskValue("APP_NAME", "myapp")
// Возвращает: myapp
masked := env.MaskValue("DESCRIPTION", "this is a very long description text")
// Возвращает: this is a very lo...
```

### MaskKey

```go
func MaskKey(key string) string
```

Маскирует имя ключа для журнала.

```go
masked := env.MaskKey("DB_PASSWORD")
// Возвращает: DB***
```

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
log := "This is a very long log message that exceeds 50 characters and will be truncated"
clean := env.MaskSensitiveInString(log)
// Возвращает: "This is a very long log message that exceeds 50..."

// Короткая строка остаётся без изменений
short := "Short message"
clean := env.MaskSensitiveInString(short)
// Возвращает: "Short message"
```

::: warning Внимание
Эта функция в основном используется для обрезки длинных строк. Для автоматического маскирования конфиденциальных пар ключ-значение используйте `SanitizeForLog`.
:::

### SanitizeForLog

```go
func SanitizeForLog(s string) string
```

Очищает строку от конфиденциальной информации в парах ключ-значение. Автоматически обнаруживает и маскирует конфиденциальные значения в формате `key=value`.

**Параметры:**
- `s` - исходная строка

**Возвращает:**
- `string` - очищенная строка

**Обнаруживаемые конфиденциальные шаблоны ключей:**
- `password=`, `secret=`, `token=`, `auth=`, `credential=`, `passphrase=`, `session=`, `cookie=`
- `api_key=`, `apikey=`, `access_key=`, `secret_key=`, `private_key=`, `public_key=`
- `encrypt_key=`, `decrypt_key=`, `signing_key=`
- `ssn=`, `credit_card=`, `card_number=`, `cvv=`, `cvc=`
- `mnemonic=`, `seed=`, `recovery=`, `wallet=`
- `connection_string=`, `database_url=`, `db_password=`

```go
// Автоматическое маскирование конфиденциальных пар ключ-значение
msg := "Connected with password=secret123 api_key=abc123"
clean := env.SanitizeForLog(msg)
// Возвращает: "Connected with password=[MASKED] api_key=[MASKED]"

// Неконфиденциальные пары ключ-значение остаются без изменений
msg := "Config loaded: app_name=myapp port=8080"
clean := env.SanitizeForLog(msg)
// Возвращает: "Config loaded: app_name=myapp port=8080"
```

::: tip Сценарии использования
Подходит для вывода в журналы, сообщений об ошибках, отладочной информации и других сценариев, где требуется автоматическая фильтрация конфиденциальных пар ключ-значение.
:::

### ClearBytes

```go
func ClearBytes(b []byte)
```

Безопасно обнуляет срез байтов.

```go
sensitive := []byte("secret-data")
// Использование...
env.ClearBytes(sensitive)
// sensitive теперь содержит только нули
```

## Константы FileFormat

Типы форматов файлов:

```go
type FileFormat int

const (
    FormatAuto  FileFormat = iota  // Автоматическое обнаружение
    FormatEnv                      // Формат .env
    FormatJSON                     // Формат JSON
    FormatYAML                     // Формат YAML
)
```

Пример использования:

```go
// Определить формат
format := env.DetectFormat("config.json")  // FormatJSON

// Сериализовать с указанием формата
data, _ := env.Marshal(cfg, env.FormatJSON)

// Строка формата
fmt.Println(format.String())  // "json"
```

## Шаблоны проверки ошибок

### Шаблон errors.Is

Проверка сторожевых ошибок:

```go
err := loader.LoadFiles(".env")

switch {
case errors.Is(err, env.ErrFileNotFound):
    // Файл не найден
case errors.Is(err, env.ErrFileTooLarge):
    // Файл слишком большой
case errors.Is(err, env.ErrForbiddenKey):
    // Запрещённый ключ
case errors.Is(err, env.ErrClosed):
    // Загрузчик закрыт
}
```

### Шаблон errors.As

Извлечение подробной информации об ошибке:

```go
err := loader.LoadFiles(".env")

var parseErr *env.ParseError
if errors.As(err, &parseErr) {
    fmt.Printf("Ошибка парсинга в %s строка %d\n", parseErr.File, parseErr.Line)
}

var fileErr *env.FileError
if errors.As(err, &fileErr) {
    fmt.Printf("Файл %s размер %d превышает ограничение %d\n",
        fileErr.Path, fileErr.Size, fileErr.Limit)
}

var secErr *env.SecurityError
if errors.As(err, &secErr) {
    fmt.Printf("Ошибка безопасности: %s - %s\n", secErr.Action, secErr.Reason)
}
```

## Полный пример обработки ошибок

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "os"

    "github.com/cybergodev/env"
)

func main() {
    cfg := env.ProductionConfig()
    cfg.FailOnMissingFile = true

    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    err = loader.LoadFiles(".env")
    if err != nil {
        switch {
        case errors.Is(err, env.ErrFileNotFound):
            log.Fatal("Файл конфигурации не найден")

        case errors.Is(err, env.ErrFileTooLarge):
            log.Fatal("Файл конфигурации слишком большой")

        case errors.Is(err, env.ErrClosed):
            log.Fatal("Загрузчик закрыт")

        default:
            var parseErr *env.ParseError
            if errors.As(err, &parseErr) {
                log.Fatalf("Ошибка парсинга %s:%d - %v",
                    parseErr.File, parseErr.Line, parseErr.Err)
            }

            var fileErr *env.FileError
            if errors.As(err, &fileErr) {
                log.Fatalf("Ошибка файла %s - %v", fileErr.Path, fileErr.Err)
            }

            var secErr *env.SecurityError
            if errors.As(err, &secErr) {
                log.Fatalf("Ошибка безопасности: %s - %s", secErr.Action, secErr.Reason)
            }

            var jsonErr *env.JSONError
            if errors.As(err, &jsonErr) {
                log.Fatalf("Ошибка JSON %s: %s", jsonErr.Path, jsonErr.Message)
            }

            var yamlErr *env.YAMLError
            if errors.As(err, &yamlErr) {
                log.Fatalf("Ошибка YAML %s:%d:%d - %s",
                    yamlErr.Path, yamlErr.Line, yamlErr.Column, yamlErr.Message)
            }

            log.Fatal(err)
        }
    }

    // Валидация обязательных ключей
    if err := loader.Validate(); err != nil {
        var valErr *env.ValidationError
        if errors.As(err, &valErr) {
            log.Fatalf("Ошибка валидации: %s - %s", valErr.Field, valErr.Message)
        }
        log.Fatal(err)
    }
}
```

## Связанная документация

- [SecureValue API](/ru/env/api-reference/secure-value) - Полный API служебных функций безопасности
- [Config API](/ru/env/api-reference/config) - Настройка параметров и ограничений
- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и основные возможности
- [Чеклист для продакшена](/ru/env/security/production-checklist) - Проверка безопасности перед запуском
