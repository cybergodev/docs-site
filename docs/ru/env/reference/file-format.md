---
title: Форматы файлов - CyberGo env | Синтаксис .env/JSON/YAML
description: CyberGo env библиотека управления переменными окружения полная справочная документация поддерживаемых форматов конфигурационных файлов, включая правила синтаксиса формата пар ключ-значение .env, формата объектов JSON и формата иерархий YAML, комментарии, поддержку типов данных, обработку кодировки и механизм автоматического определения формата.
---

# Форматы файлов

Библиотека env поддерживает несколько форматов конфигурационных файлов: `.env`, JSON и YAML.

## Формат .env

### Базовый синтаксис

```bash
# Комментарий
KEY=value

# Знак равенства в значении
URL=https://example.com?foo=bar

# Пустые строки игнорируются

# Недопустимо: ключ не может содержать пробелы
# MY KEY=value
```

### Кавычки

```bash
# Двойные кавычки: сохраняют пробелы, поддерживают экранирование
MESSAGE="Hello World"
PATH="/usr/local/bin"

# Одинарные кавычки: сохраняют как есть, без экранирования
LITERAL='no ${expansion} here'

# Без кавычек
SIMPLE=value

# Пустое значение
EMPTY=
EMPTY=""
EMPTY=''
```

### Управляющие символы

В двойных кавычках поддерживается экранирование:

```bash
# Перевод строки
MULTILINE="line1\nline2"

# Табуляция
TABBED="col1\tcol2"

# Кавычки
QUOTED="He said \"Hello\""

# Обратная косая черта
PATH="C:\\Users\\name"

# Знак доллара
PRICE="Price: \$100"
```

### Подстановка переменных

Поддерживается при включённом `ExpandVariables`:

```bash
# Ссылка на другую переменную
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Краткий синтаксис
URL=$BASE_URL/path

# Значение по умолчанию
HOST=${HOST:-localhost}
PORT=${PORT:-8080}

# Вложенная подстановка
SERVICE=${CLUSTER:-default}-${REGION:-us-east}
```

### Синтаксис export

Поддерживается при включённом `AllowExportPrefix`:

```bash
# Экспорт в стиле Bash
export KEY=value
export ANOTHER="quoted value"
```

### Стиль YAML

Поддерживается при включённом `AllowYamlSyntax`:

```bash
# Пары ключ-значение в стиле YAML
KEY: value
ANOTHER: "quoted value"
```

### Многострочные значения

```bash
# Перевод строки внутри двойных кавычек
PRIVATE_KEY="-----BEGIN KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END KEY-----"

# Использование \n для экранирования
LINES="line1\nline2\nline3"
```

## Формат JSON

### Базовая структура

```json
{
    "APP_NAME": "my-app",
    "APP_VERSION": "1.0.0",
    "DEBUG": true,
    "PORT": 8080
}
```

### Вложенные объекты

Вложенные объекты преобразуются в плоский вид:

```json
{
    "database": {
        "host": "localhost",
        "port": 5432
    }
}
```

Результат:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

### Массивы

Массивы преобразуются в индексированные ключи:

```json
{
    "ALLOWED_HOSTS": ["localhost", "example.com"],
    "PORTS": [80, 443, 8080]
}
```

Результат:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
PORTS_0=80
PORTS_1=443
PORTS_2=8080
```

::: tip Доступ к элементам массива
Используйте функцию `GetSlice[T]` или путь через точку для доступа к индексированным ключам:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
Подробнее в [документации GetSlice](/ru/env/api-reference/functions#getslice-t).
:::

### Параметры преобразования типов

```go
cfg := env.DefaultConfig()

// null преобразуется в пустую строку
cfg.JSONNullAsEmpty = true

// Числа преобразуются в строки
cfg.JSONNumberAsString = true

// Булевы значения преобразуются в строки
cfg.JSONBoolAsString = true
```

### Ограничение глубины

```go
cfg.JSONMaxDepth = 10  // Максимальная глубина вложенности
```

## Формат YAML

### Базовая структура

```yaml
APP_NAME: my-app
APP_VERSION: "1.0.0"
DEBUG: true
PORT: 8080
```

### Вложенные структуры

```yaml
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
    password: secret
```

Результат преобразования в плоский вид:

```text
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_CREDENTIALS_USER=admin
DATABASE_CREDENTIALS_PASSWORD=secret
```

### Списки

Списки преобразуются в индексированные ключи:

```yaml
allowed_hosts:
  - localhost
  - example.com
  - api.example.com
```

Результат:

```text
ALLOWED_HOSTS_0=localhost
ALLOWED_HOSTS_1=example.com
ALLOWED_HOSTS_2=api.example.com
```

### Многострочные строки

```yaml
# Литеральный блок (сохраняет переводы строк)
description: |
  Line 1
  Line 2
  Line 3

# Свёрнутый блок (переводы строк становятся пробелами)
summary: >
  This is a long
  summary that will
  be on one line.
```

### Параметры преобразования типов

```go
cfg := env.DefaultConfig()

cfg.YAMLNullAsEmpty = true
cfg.YAMLNumberAsString = true
cfg.YAMLBoolAsString = true
cfg.YAMLMaxDepth = 10
```

## Определение формата

### Автоматическое определение

```go
// Определение по расширению
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// При отсутствии подходящего расширения возвращается FormatAuto (по умолчанию используется парсер .env)
format = env.DetectFormat("config")  // FormatAuto
```

### Константы форматов

```go
const (
    FormatAuto  FileFormat = iota  // Автоматическое обнаружение
    FormatEnv                      // Формат .env
    FormatJSON                     // Формат JSON
    FormatYAML                     // Формат YAML
)
```

### Строка формата

```go
format := env.FormatJSON
fmt.Println(format.String())  // Вывод: json
```

## Лучшие практики

### Выбор формата

| Сценарий | Рекомендуемый формат |
|----------|---------------------|
| Простая конфигурация | `.env` |
| Сложная вложенная конфигурация | JSON или YAML |
| Совместное использование с другими инструментами | JSON |
| Приоритет читаемости для людей | YAML |
| Среда Docker/K8s | `.env` |

### Именование файлов

```bash
.env              # Конфигурация по умолчанию
.env.local        # Локальные переопределения (не коммитируется)
.env.development  # Среда разработки
.env.staging      # Предпродуктивная среда
.env.production   # Продакшен
.env.test         # Тестовая среда
```

### Смешанное использование

```go
// Можно смешивать различные форматы
loader.LoadFiles(
    "base.env",           // Базовая конфигурация
    "database.json",      // Конфигурация базы данных
    "secrets.yaml",       // Конфиденциальная конфигурация
    ".env.local",         // Локальные переопределения
)
```

### Исключение из Git

```bash
# Исключить конфиденциальную конфигурацию
.env.local
.env.*.local
.env.production
secrets.yaml

# Сохранить шаблоны
!.env.example
```

## Связанная документация

- [Многоформатная конфигурация](/ru/env/guides/multi-format) - Руководство по загрузке нескольких форматов
- [ComponentFactory API](/ru/env/api-reference/factory) - Справка по функции DetectFormat
- [Config API](/ru/env/api-reference/config) - Параметры парсинга JSON/YAML
