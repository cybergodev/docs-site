---
sidebar_label: "Контрольный список для продакшена"
title: "Чек-лист продакшена - CyberGo env | Проверка безопасности"
description: "Чек-лист CyberGo env для продакшена: права .env (600) и .gitignore, RequiredKeys/AllowedKeys, аудит, SecureValue и тюнинг производительности."
sidebar_position: 2
---

# Контрольный список для продакшена

Контрольный список проверок перед развёртыванием приложения в производственную среду.

::: tip Концепции безопасности
Архитектура безопасности и основные возможности подробно описаны в [Обзоре безопасности](/ru/env/security/).
:::

## Проверки перед развёртыванием

### Безопасность файлов

- [ ] Файл `.env.production` существует
- [ ] Права доступа к файлу установлены в `600` или строже
- [ ] Конфиденциальные файлы добавлены в `.gitignore`
- [ ] Конфигурационные файлы не содержат плейсхолдеров (например, `change-me`, `xxx`)

```bash
# Проверка прав доступа
ls -la .env.production
# Должно отображаться: -rw------- (600)

# Исправление прав доступа
chmod 600 .env.production
```

### Валидация конфигурации

- [ ] Все обязательные ключи установлены
- [ ] Чувствительные значения не пусты
- [ ] Формат значений корректен (URL, порты и т.д.)
- [ ] Отсутствуют захардкоженные ключи

```go
cfg := env.ProductionConfig()
cfg.RequiredKeys = []string{
    "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
    "API_KEY", "API_URL",
}
cfg.FailOnMissingFile = true
```

## Проверки конфигурации безопасности

### Аудитный журнал

- [ ] Аудитный журнал включён
- [ ] Директория логов доступна для записи
- [ ] Права доступа к файлу логов корректны

```go
auditFile, _ := os.OpenFile("/var/log/app/audit.log",
    os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
```

### Обработка чувствительных данных

- [ ] Чувствительные значения получаются через `GetSecure`
- [ ] Своевременно вызывается `Close()` для освобождения ресурсов
- [ ] Логи не содержат исходных чувствительных значений

```go
secret := loader.GetSecure("DB_PASSWORD")
defer secret.Close()
log.Printf("Password length: %d", secret.Length())
```

### Управление доступом

- [ ] Установлен белый список `AllowedKeys` (рекомендуется)
- [ ] Включена `ValidateValues`
- [ ] Разумно установлены ограничения размеров

```go
cfg.AllowedKeys = []string{"APP_NAME", "DB_HOST", "API_KEY"}
cfg.ValidateValues = true
cfg.MaxVariables = 100
```

## Проверки при развёртывании

- [ ] Конфигурационные файлы загружаются из безопасного расположения
- [ ] При запуске приложения выполняется валидация конфигурации
- [ ] При ошибках конфигурации приложение отказывается запускаться
- [ ] Конфиденциальная информация не выводится в логи

## Проверки после развёртывания

- [ ] Приложение работает корректно
- [ ] Аудитный журнал корректно записывается
- [ ] Нет утечек конфиденциальной информации
- [ ] Отслеживаются ошибки, связанные с конфигурацией

## Скрипт быстрой проверки

```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "=== Pre-deployment Config Check ==="

# Проверка существования файла
[ -f ".env.production" ] || { echo "ERROR: .env.production not found"; exit 1; }

# Проверка прав доступа
PERMS=$(stat -c %a .env.production 2>/dev/null || stat -f %Lp .env.production)
[ "$PERMS" = "600" ] || [ "$PERMS" = "400" ] || echo "WARNING: permissions are $PERMS"

# Проверка плейсхолдеров
grep -qE "(change-?me|placeholder|xxx|YOUR_)" .env.production && \
    { echo "ERROR: Found placeholder values"; exit 1; }

# Проверка обязательных ключей
for key in DB_HOST DB_PORT DB_USER DB_PASSWORD API_KEY; do
    grep -q "^$key=" .env.production || { echo "ERROR: Missing $key"; exit 1; }
done

echo "=== All checks passed ==="
```

## Связанная документация

- [Обзор безопасности](/ru/env/security/) - Архитектура безопасности и основные возможности
- [SecureValue API](/ru/env/api-reference/secure-value) - Безопасная обработка значений
- [Константы и ошибки](/ru/env/api-reference/constants) - Список запрещённых ключей
