---
sidebar_label: "Форматы файлов"
title: "Формат файла - CyberGo env | Синтаксис .env/JSON/YAML"
description: "Форматы CyberGo env: .env/JSON/YAML, кавычки и export, ${VAR}, многострочные значения, плоская вложенность, UTF-8 и автоопределение через DetectFormat."
sidebar_position: 1
---

# Формат файла

Библиотека env поддерживает несколько конфигурационных форматов: `.env`, JSON и YAML.

## Формат .env

### Базовый синтаксис

```bash
# Комментарии
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

# Одинарные кавычки: без обработки экранирования (буквально сохраняются последовательности с обратной косой чертой)
# Внимание: одинарные кавычки не блокируют подстановку переменных — она выполняется единообразно после снятия кавычек
LITERAL='no escaping here: \n stays literal'

# Без кавычек
SIMPLE=value

# Пустое значение
EMPTY=
EMPTY=""
EMPTY=''
```

### Управляющие символы

Экранирование поддерживается в двойных кавычках:

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
# Ссылка на другие переменные
BASE_URL=https://api.example.com
API_URL=${BASE_URL}/v1

# Краткий синтаксис
URL=$BASE_URL/path

# Значения по умолчанию
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

Парсер `.env` сканирует построчно, каждая строка разбирается независимо, **значения в кавычках, пересекающие несколько строк, не поддерживаются** — значение в двойных кавычках должно быть замкнуто в пределах одной строки, иначе возвращается `ErrInvalidValue`. Для перевода строки используйте escape-последовательность `\n` (действует только в двойных кавычках; одинарные кавычки не обрабатывают экранирование):

```bash
# \n внутри двойных кавычек преобразуется в символ перевода строки
LINES="line1\nline2\nline3"
# Фактическое значение состоит из трёх строк: line1 / line2 / line3

# Многострочные сертификаты наподобие PRIVATE_KEY рекомендуется собирать через \n
PRIVATE_KEY="-----BEGIN KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END KEY-----"
```

Если нужны настоящие многострочные строки, используйте [формат JSON или YAML](#определение-формата) или расширьте поддержку многострочности через пользовательский парсер.

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

Массивы преобразуются в ключи с индексом:

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
Используйте функцию `GetSlice[T]` или точечный путь для доступа к индексированным ключам:
```go
hosts := env.GetSlice[string]("ALLOWED_HOSTS")
port0 := env.GetInt("PORTS_0")  // 80
```
Подробнее см. [Документацию GetSlice](/ru/env/api-reference/functions#getslice-t).
:::

### Параметры преобразования типов

```go
cfg := env.DefaultConfig()

// null преобразуется в пустую строку
cfg.JSONNullAsEmpty = true

// Числа преобразуются в строки
cfg.JSONNumberAsString = true

// Логические значения преобразуются в строки
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

Списки преобразуются в ключи с индексом:

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

:::warning Внимание
Блочные скаляры YAML (литеральный блок `|` и свёрнутый блок `>`) **в настоящее время не поддерживаются**. Парсер сохраняет `|`/`>` как обычные скалярные символы, а последующие строки с отступом нарушат разбор пар ключ-значение.
:::

Для значений, в которых нужно сохранить перевод строки, используйте двойные кавычки с escape-последовательностью `\n`:

```yaml
description: "Line1\nLine2\nLine3"
```

Либо расширьте поддержку блочных скаляров через пользовательский парсер.

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
// Определение по расширению файла
format := env.DetectFormat("config.json")   // FormatJSON
format = env.DetectFormat("settings.yaml")  // FormatYAML
format = env.DetectFormat(".env")           // FormatEnv

// При отсутствии подходящего расширения возвращается FormatAuto (по умолчанию используется парсер .env)
format = env.DetectFormat("config")  // FormatAuto
```

### Константы форматов

```go
const (
    FormatAuto  FileFormat = iota  // Автоматическое определение
    FormatEnv                      // Формат .env
    FormatJSON                     // Формат JSON
    FormatYAML                     // Формат YAML
)
```

### Строковое представление формата

```go
format := env.FormatJSON
fmt.Println(format.String())  // Вывод: json
```

## Лучшие практики

### Выбор формата

| Сценарий | Рекомендуемый формат |
|------|----------|
| Простая конфигурация | `.env` |
| Сложная вложенная конфигурация | JSON или YAML |
| Совместное использование с другими инструментами | JSON |
| Приоритет читаемости | YAML |
| Окружение Docker/K8s | `.env` |

### Именование файлов

```bash
.env              # Конфигурация по умолчанию
.env.local        # Локальные переопределения (не коммитить)
.env.development  # Среда разработки
.env.staging      # Предпродуктивная среда
.env.production   # Производственная среда
.env.test         # Тестовая среда
```

### Смешанное использование

```go
// Можно смешивать разные форматы
loader.LoadFiles(
    "base.env",           // Базовая конфигурация
    "database.json",      // Конфигурация базы данных
    "secrets.yaml",       // Конфиденциальная конфигурация
    ".env.local",         // Локальные переопределения
)
```

### Игнорирование в Git

```bash
# Игнорировать конфиденциальную конфигурацию
.env.local
.env.*.local
.env.production
secrets.yaml

# Сохранить шаблон
!.env.example
```

## Связанная документация

- [Мультиформатная конфигурация](/ru/env/guides/multi-format) - Руководство по загрузке нескольких форматов
- [ComponentFactory API](/ru/env/api-reference/factory) - Справка по функции DetectFormat
- [Config API](/ru/env/api-reference/config) - Параметры парсинга JSON/YAML
