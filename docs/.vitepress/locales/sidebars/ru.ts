import type { DefaultTheme } from 'vitepress'

export const ruSidebars: Record<string, DefaultTheme.SidebarItem[]> = {
  '/ru/json/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/json/' },
        { text: 'Быстрый старт', link: '/ru/json/getting-started' },
        { text: 'Синтаксис путей', link: '/ru/json/path-syntax' },
        { text: 'Шпаргалка', link: '/ru/json/cheatsheet' }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/json/api-reference/' },
        {
          text: 'Функции пакета',
          collapsed: true,
          items: [
            { text: 'Обзор', link: '/ru/json/api-reference/functions' },
            { text: 'Запрос и получение', link: '/ru/json/api-reference/functions/get' },
            { text: 'Модификация', link: '/ru/json/api-reference/functions/modify' },
            { text: 'Кодирование и декодирование', link: '/ru/json/api-reference/functions/encode-decode' },
            { text: 'Файловый ввод-вывод', link: '/ru/json/api-reference/functions/file-io' }
          ]
        },
        {
          text: 'Processor',
          collapsed: true,
          items: [
            { text: 'Обзор', link: '/ru/json/api-reference/processor/' },
            { text: 'Путевой запрос', link: '/ru/json/api-reference/processor/query' },
            { text: 'Модификация данных', link: '/ru/json/api-reference/processor/modify' },
            { text: 'Методы вывода', link: '/ru/json/api-reference/processor/output' },
            { text: 'Парсинг и загрузка', link: '/ru/json/api-reference/processor/parse' },
            { text: 'Итерация', link: '/ru/json/api-reference/processor/iterate' },
            { text: 'Пакетная обработка', link: '/ru/json/api-reference/processor/batch' },
            { text: 'Обработка JSONL', link: '/ru/json/api-reference/processor/jsonl' },
            { text: 'Жизненный цикл', link: '/ru/json/api-reference/processor/lifecycle' }
          ]
        },
        { text: 'Config', link: '/ru/json/api-reference/config' },
        { text: 'Типы', link: '/ru/json/api-reference/types' },
        { text: 'Интерфейсы', link: '/ru/json/api-reference/interfaces' },
        { text: 'Константы и ошибки', link: '/ru/json/api-reference/constants' },
        { text: 'Вспомогательные функции', link: '/ru/json/api-reference/helpers' },
        { text: 'Итератор', link: '/ru/json/api-reference/iterator' },
        { text: 'Обобщённые функции', link: '/ru/json/api-reference/generics' },
        { text: 'Функции вывода', link: '/ru/json/api-reference/print' }
      ]
    },
    {
      text: 'Потоковая обработка',
      collapsed: true,
      items: [
        { text: 'Руководство по работе с большими файлами', link: '/ru/json/large-files' },
        { text: 'API для больших файлов', link: '/ru/json/api-reference/large-file' },
        { text: 'Обработчик JSONL', link: '/ru/json/api-reference/jsonl' }
      ]
    },
    {
      text: 'Расширяемые интерфейсы',
      collapsed: true,
      items: [
        { text: 'Система хуков', link: '/ru/json/api-reference/hooks' },
        { text: 'Валидатор', link: '/ru/json/api-reference/validator' },
        { text: 'Пользовательский кодировщик', link: '/ru/json/api-reference/custom-encoder' }
      ]
    },
    {
      text: 'Безопасность',
      collapsed: true,
      items: [
        { text: 'Обзор безопасности', link: '/ru/json/security/' },
        { text: 'Режим безопасности', link: '/ru/json/api-reference/security' },
        { text: 'Контрольный список для продакшена', link: '/ru/json/security/production-checklist' }
      ]
    },
    {
      text: 'Продвинутые темы',
      collapsed: true,
      items: [
        { text: 'Оптимизация производительности', link: '/ru/json/advanced/performance' },
        { text: 'Обработка ошибок', link: '/ru/json/advanced/error-handling' }
      ]
    },
    {
      text: 'Примеры',
      collapsed: true,
      items: [
        { text: 'Базовые примеры', link: '/ru/json/examples' },
        { text: 'Продвинутые примеры', link: '/ru/json/examples-advanced' }
      ]
    }
  ],

  '/ru/jwt/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/jwt/' },
        { text: 'Быстрый старт', link: '/ru/jwt/getting-started' }
      ]
    },
    {
      text: 'Руководства',
      collapsed: false,
      items: [
        { text: 'Алгоритмы подписи', link: '/ru/jwt/guides/signing-algorithms' },
        { text: 'Пользовательские Claims', link: '/ru/jwt/guides/custom-claims' },
        { text: 'Чёрный список токенов', link: '/ru/jwt/guides/blacklist' },
        { text: 'Ограничение скорости', link: '/ru/jwt/guides/rate-limiting' },
        { text: 'Обработка ошибок', link: '/ru/jwt/guides/error-handling' },
        { text: 'Тестирование и внедрение часов', link: '/ru/jwt/guides/testing' }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/jwt/api-reference/' },
        { text: 'Функции пакета', link: '/ru/jwt/api-reference/functions' },
        { text: 'Processor', link: '/ru/jwt/api-reference/processor' },
        { text: 'Config', link: '/ru/jwt/api-reference/config' },
        { text: 'Claims', link: '/ru/jwt/api-reference/claims' },
        { text: 'Определения интерфейсов', link: '/ru/jwt/api-reference/interfaces' },
        { text: 'Типы и константы', link: '/ru/jwt/api-reference/types' },
        { text: 'Ошибки', link: '/ru/jwt/api-reference/errors' }
      ]
    },
    {
      text: 'Примеры',
      collapsed: false,
      items: [
        { text: 'Базовые примеры', link: '/ru/jwt/examples/basic' },
        { text: 'Продвинутые примеры', link: '/ru/jwt/examples/advanced' }
      ]
    }
  ],

  '/ru/httpc/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/httpc/' },
        { text: 'Быстрый старт', link: '/ru/httpc/getting-started' },
        { text: 'Шпаргалка', link: '/ru/httpc/cheatsheet' }
      ]
    },
    {
      text: 'Руководства',
      collapsed: false,
      items: [
        { text: 'Практическое руководство', link: '/ru/httpc/guides/tutorial' },
        { text: 'Запросы и ответы', link: '/ru/httpc/guides/request-response' },
        { text: 'Доменный клиент и сессии', link: '/ru/httpc/guides/domain-session' },
        { text: 'Загрузка и скачивание файлов', link: '/ru/httpc/guides/file-transfer' },
        { text: 'Повторные попытки и отказоустойчивость', link: '/ru/httpc/guides/retry-fault-tolerance' },
        { text: 'Цепочки промежуточного ПО', link: '/ru/httpc/guides/middleware-chain' },
        { text: 'Руководство по тестированию', link: '/ru/httpc/guides/testing' }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/httpc/api-reference/' },
        {
          text: 'Ядро',
          collapsed: false,
          items: [
            { text: 'Функции пакета', link: '/ru/httpc/api-reference/functions' },
            { text: 'Параметры запроса', link: '/ru/httpc/api-reference/options' },
            { text: 'Result', link: '/ru/httpc/api-reference/result' }
          ]
        },
        {
          text: 'Клиент и конфигурация',
          collapsed: true,
          items: [
            { text: 'Конфигурация', link: '/ru/httpc/api-reference/config' },
            { text: 'Доменный клиент', link: '/ru/httpc/api-reference/domain-client' },
            { text: 'Управление сессиями', link: '/ru/httpc/api-reference/session' },
            { text: 'Скачивание файлов', link: '/ru/httpc/api-reference/download' },
            { text: 'Промежуточное ПО', link: '/ru/httpc/api-reference/middleware' }
          ]
        },
        {
          text: 'Определения типов',
          collapsed: true,
          items: [
            { text: 'Интерфейсы', link: '/ru/httpc/api-reference/interfaces' },
            { text: 'Константы и типы', link: '/ru/httpc/api-reference/constants' },
            { text: 'Типы ошибок', link: '/ru/httpc/api-reference/errors' }
          ]
        }
      ]
    },
    {
      text: 'Безопасность',
      collapsed: false,
      items: [
        { text: 'Обзор безопасности', link: '/ru/httpc/security/' },
        { text: 'Защита от SSRF', link: '/ru/httpc/security/ssrf' },
        { text: 'TLS и привязка сертификатов', link: '/ru/httpc/security/tls-certpin' },
        { text: 'Контрольный список для продакшена', link: '/ru/httpc/security/production-checklist' }
      ]
    },
    {
      text: 'Продвинутые темы',
      collapsed: true,
      items: [
        { text: 'Оптимизация производительности', link: '/ru/httpc/advanced/performance' },
        { text: 'Обработка ошибок', link: '/ru/httpc/advanced/error-handling' },
        { text: 'Пул соединений и прокси', link: '/ru/httpc/advanced/connection-pool' }
      ]
    },
    {
      text: 'Примеры',
      collapsed: true,
      items: [
        { text: 'Базовые примеры', link: '/ru/httpc/examples/basic-usage' },
        { text: 'Продвинутые примеры', link: '/ru/httpc/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'Часто задаваемые вопросы', link: '/ru/httpc/faq' }
      ]
    }
  ],

  '/ru/html/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/html/' },
        { text: 'Быстрый старт', link: '/ru/html/getting-started' },
        { text: 'Шпаргалка', link: '/ru/html/cheatsheet' }
      ]
    },
    {
      text: 'Руководства',
      collapsed: false,
      items: [
        {
          text: 'Основные возможности',
          collapsed: false,
          items: [
            { text: 'Извлечение контента на практике', link: '/ru/html/guides/content-extraction' },
            { text: 'Выбор формата вывода', link: '/ru/html/guides/output-formats' },
            { text: 'Извлечение и группировка ссылок', link: '/ru/html/guides/link-extraction' }
          ]
        },
        {
          text: 'Продвинутые паттерны',
          collapsed: false,
          items: [
            { text: 'Повторное использование Processor и кэш', link: '/ru/html/guides/processor-cache' },
            { text: 'Система аудита на практике', link: '/ru/html/guides/audit-pipeline' }
          ]
        },
        {
          text: 'Интеграция и расширение',
          collapsed: true,
          items: [
            { text: 'Интеграция с HTTP', link: '/ru/html/guides/http-integration' },
            { text: 'Тестирование и пользовательские расширения', link: '/ru/html/guides/testing-custom' }
          ]
        }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/html/api-reference/' },
        {
          text: 'Ядро',
          collapsed: false,
          items: [
            { text: 'Функции пакета', link: '/ru/html/api-reference/functions' },
            { text: 'Processor', link: '/ru/html/api-reference/processor' },
            { text: 'Конфигурация', link: '/ru/html/api-reference/config' }
          ]
        },
        {
          text: 'Функциональные модули',
          collapsed: false,
          items: [
            { text: 'Форматы вывода', link: '/ru/html/api-reference/output' },
            { text: 'Извлечение ссылок', link: '/ru/html/api-reference/links' },
            { text: 'Пакетная обработка', link: '/ru/html/api-reference/batch' },
            { text: 'Система аудита', link: '/ru/html/api-reference/audit' }
          ]
        },
        {
          text: 'Определения типов',
          collapsed: true,
          items: [
            { text: 'Интерфейсы', link: '/ru/html/api-reference/interfaces' },
            { text: 'Типы', link: '/ru/html/api-reference/types' },
            { text: 'Константы и ошибки', link: '/ru/html/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'Безопасность',
      collapsed: false,
      items: [
        { text: 'Обзор безопасности', link: '/ru/html/security/' },
        { text: 'Контрольный список для продакшена', link: '/ru/html/security/production-checklist' }
      ]
    },
    {
      text: 'Продвинутые темы',
      collapsed: true,
      items: [
        { text: 'Оптимизация производительности', link: '/ru/html/advanced/performance' },
        { text: 'Обработка ошибок', link: '/ru/html/advanced/error-handling' }
      ]
    },
    {
      text: 'Примеры',
      collapsed: true,
      items: [
        { text: 'Базовые примеры', link: '/ru/html/examples/basic-usage' },
        { text: 'Продвинутые примеры', link: '/ru/html/examples/advanced-usage' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'Часто задаваемые вопросы', link: '/ru/html/faq' }
      ]
    }
  ],

  '/ru/dd/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/dd/' },
        { text: 'Быстрый старт', link: '/ru/dd/getting-started' },
        { text: 'Шпаргалка', link: '/ru/dd/cheatsheet' }
      ]
    },
    {
      text: 'Руководства',
      collapsed: false,
      items: [
        { text: 'Основные концепции', link: '/ru/dd/guides/core-concepts' },
        { text: 'Структурированное логирование', link: '/ru/dd/guides/structured-logging' },
        { text: 'Вывод в файл и ротация', link: '/ru/dd/guides/file-output' },
        { text: 'Фильтрация конфиденциальных данных', link: '/ru/dd/guides/sensitive-filtering' },
        { text: 'Аудитные логи', link: '/ru/dd/guides/audit-logging' },
        { text: 'Система хуков', link: '/ru/dd/guides/hooks' },
        { text: 'Интеграция с распределённой трассировкой', link: '/ru/dd/guides/context-tracing' },
        { text: 'Руководство по миграции', link: '/ru/dd/guides/migration' }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/dd/api-reference/' },
        {
          text: 'Ядро',
          collapsed: false,
          items: [
            { text: 'Функции пакета', link: '/ru/dd/api-reference/functions' },
            { text: 'Logger', link: '/ru/dd/api-reference/logger' },
            { text: 'LoggerEntry', link: '/ru/dd/api-reference/entry' },
            { text: 'Конфигурация', link: '/ru/dd/api-reference/config' },
            { text: 'Определения интерфейсов', link: '/ru/dd/api-reference/interfaces' }
          ]
        },
        {
          text: 'Вывод и интеграция',
          collapsed: false,
          items: [
            { text: 'Цели вывода', link: '/ru/dd/api-reference/writers' },
            { text: 'Интеграция с контекстом', link: '/ru/dd/api-reference/context' },
            { text: 'Структурированные поля', link: '/ru/dd/api-reference/fields' }
          ]
        },
        {
          text: 'Безопасность и аудит',
          collapsed: true,
          items: [
            { text: 'Система хуков', link: '/ru/dd/api-reference/hooks' },
            { text: 'Фильтрация безопасности', link: '/ru/dd/api-reference/security' },
            { text: 'Аудитный журнал', link: '/ru/dd/api-reference/audit' },
            { text: 'Подписи целостности', link: '/ru/dd/api-reference/integrity' }
          ]
        },
        {
          text: 'Инструменты разработки',
          collapsed: false,
          items: [
            { text: 'Отладочный вывод', link: '/ru/dd/api-reference/debug-visual' },
            { text: 'Помощник тестирования', link: '/ru/dd/api-reference/recorder' },
            { text: 'Константы и ошибки', link: '/ru/dd/api-reference/constants' }
          ]
        }
      ]
    },
    {
      text: 'Примеры',
      collapsed: false,
      items: [
        { text: 'Базовое использование', link: '/ru/dd/examples/basic-usage' },
        { text: 'Интеграция с веб-сервисом', link: '/ru/dd/examples/web-service' },
        { text: 'Безопасность и аудит на практике', link: '/ru/dd/examples/security-audit' },
        { text: 'Паттерны тестирования', link: '/ru/dd/examples/testing-patterns' }
      ]
    },
    {
      text: 'Безопасность',
      collapsed: true,
      items: [
        { text: 'Обзор', link: '/ru/dd/security/' },
        { text: 'Настройка отраслевого соответствия', link: '/ru/dd/security/compliance' },
        { text: 'Контрольный список для продакшена', link: '/ru/dd/security/production-checklist' }
      ]
    },
    {
      text: 'Продвинутые темы',
      collapsed: true,
      items: [
        { text: 'Производительность', link: '/ru/dd/advanced/performance' },
        { text: 'Обработка ошибок', link: '/ru/dd/advanced/error-handling' },
        { text: 'Практика HMAC-подписей', link: '/ru/dd/advanced/integrity' }
      ]
    },
    {
      text: 'FAQ',
      collapsed: true,
      items: [
        { text: 'Часто задаваемые вопросы', link: '/ru/dd/faq' }
      ]
    }
  ],

  '/ru/env/': [
    {
      text: 'Начало работы',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/env/' },
        { text: 'Быстрый старт', link: '/ru/env/getting-started' },
        { text: 'Шпаргалка', link: '/ru/env/cheatsheet' }
      ]
    },
    {
      text: 'Руководства',
      collapsed: false,
      items: [
        { text: 'Структуры и маппинг', link: '/ru/env/guides/struct-mapping' },
        { text: 'Сериализация', link: '/ru/env/guides/serialization' },
        { text: 'Мультиформатные конфиги', link: '/ru/env/guides/multi-format' },
        { text: 'Подстановка переменных', link: '/ru/env/guides/variable-expansion' },
        { text: 'Аудитные логи', link: '/ru/env/guides/audit-logging' },
        { text: 'Тестирование', link: '/ru/env/guides/testing' },
        { text: 'Пользовательский парсер', link: '/ru/env/guides/custom-parser' }
      ]
    },
    {
      text: 'Справочник API',
      collapsed: false,
      items: [
        { text: 'Обзор', link: '/ru/env/api-reference/' },
        { text: 'Функции пакета', link: '/ru/env/api-reference/functions' },
        { text: 'Loader API', link: '/ru/env/api-reference/loader' },
        { text: 'Config API', link: '/ru/env/api-reference/config' },
        { text: 'SecureValue API', link: '/ru/env/api-reference/secure-value' },
        { text: 'Интерфейсы', link: '/ru/env/api-reference/interfaces' },
        { text: 'Константы и ошибки', link: '/ru/env/api-reference/constants' },
        { text: 'ComponentFactory API', link: '/ru/env/api-reference/factory' }
      ]
    },
    {
      text: 'Безопасность',
      collapsed: false,
      items: [
        { text: 'Обзор безопасности', link: '/ru/env/security/' },
        { text: 'Контрольный список для продакшена', link: '/ru/env/security/production-checklist' }
      ]
    },
    {
      text: 'Продвинутые темы',
      collapsed: false,
      items: [
        { text: 'Оптимизация производительности', link: '/ru/env/advanced/performance' },
        { text: 'Обработка ошибок', link: '/ru/env/advanced/error-handling' }
      ]
    },
    {
      text: 'Справочные материалы',
      collapsed: false,
      items: [
        { text: 'Форматы файлов', link: '/ru/env/reference/file-format' }
      ]
    }
  ]
}
