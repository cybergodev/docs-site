---
title: "Функции пакета - CyberGo JSON | Справочник API"
description: "Справочник функций уровня пакета CyberGo JSON: включает Get/GetString/GetInt/GetTyped запросы по пути, Set/Delete/MergeJSON модификацию, Marshal/Unmarshal кодирование/декодирование и LoadFromFile/SaveToFile файловые операции, вызываемые напрямую без создания экземпляра Processor."
---

# Функции пакета

Функции верхнего уровня, предоставляемые пакетом json, которые можно вызывать напрямую без создания экземпляра Processor. Классификация по функциональности:

## [Запросы и получение](./functions/get)

Функции запросов по пути, типобезопасного получения, пакетных операций, разбора и валидации.

**Основные функции**: [`Get`](./functions/get) · [`GetString`](./functions/get) · [`GetInt`](./functions/get) · [`GetFloat`](./functions/get) · [`GetBool`](./functions/get) · [`GetArray`](./functions/get) · [`GetObject`](./functions/get) · [`GetTyped[T]`](./functions/get) · [`SafeGet`](./functions/get) · [`GetMultiple`](./functions/get) · [`ProcessBatch`](./functions/get) · [`Parse`](./functions/get) · [`ParseAny`](./functions/get) · [`Valid`](./functions/get) · [`ValidWithConfig`](./functions/get)

## [Операции модификации](./functions/modify)

Функции установки, удаления и слияния JSON данных.

**Основные функции**: [`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [Кодирование/декодирование](./functions/encode-decode)

Функции сериализации, десериализации и потокового кодирования/декодирования.

**Основные функции**: [`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder) · [`NewDecoder`](./types#decoder) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [Файловые операции](./functions/file-io)

Функции чтения/записи файлов и обработки JSONL.

**Основные функции**: [`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesintot)

## [Итерация файлов](./large-file)

Функции потоковой итерации файлов (функции уровня пакета, не требуют создания Processor).

**Основные функции**: [`ForeachFile`](./large-file) · [`ForeachFileWithPath`](./large-file) · [`ForeachFileChunked`](./large-file) · [`ForeachFileNested`](./large-file)

## [Вспомогательные инструменты](./helpers)

Инструментальные функции для преобразования типов, сравнения, управления кэшем и обработки ошибок.

**Основные функции**: [`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcache) · [`GetStats`](./helpers#getstats) · [`GetHealthStatus`](./helpers#gethealthstatus) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## Быстрая навигация

| Назначение | Рекомендуемая функция | Документация |
|------------|-----------------------|--------------|
| Получение одного значения | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Запросы и получение](./functions/get) |
| Получение любого типа | `Get`, `GetTyped[T]` | [Запросы и получение](./functions/get) |
| Получение со значением по умолчанию | `GetString(data, path, "default")` | [Запросы и получение](./functions/get) |
| Обобщённое получение | `GetTyped[T](data, path, defaultValue...)` | [Запросы и получение](./functions/get) |
| Пакетное получение | `GetMultiple` | [Запросы и получение](./functions/get) |
| Модификация JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [Операции модификации](./functions/modify) |
| Сериализация | `Marshal`, `Encode` | [Кодирование/декодирование](./functions/encode-decode) |
| Десериализация | `Unmarshal`, `Parse` | [Кодирование/декодирование](./functions/encode-decode) |
| Форматирование | `Prettify`, `Processor.Compact` | [Кодирование/декодирование](./functions/encode-decode) |
| Печать вывода | `Encode` + `fmt.Println`, `EncodePretty` | [Функции печати](./print) |
| Пакетное кодирование | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Пакетное кодирование](./functions/encode-decode) · [Вывод обработчика](./processor/output) |
| Валидация | `Valid` | [Запросы и получение](./functions/get) |
| Чтение/запись файлов | `LoadFromFile`, `SaveToFile` | [Файловые операции](./functions/file-io) |
| Обработка JSONL | `ParseJSONL`, `ToJSONL` | [Файловые операции](./functions/file-io) |
| Сравнение | `CompareJSON` | [Вспомогательные инструменты](./helpers) |
| Слияние | `MergeJSON`, `MergeMany` | [Операции модификации](./functions/modify) |
| Преобразование типов | Методы преобразования типов `AccessResult` | [Вспомогательные инструменты](./helpers) |
| Обработка ошибок | `JsonsError`, `errors.Is` | [Константы и ошибки](./constants) |

## Связанные разделы

- [Processor](./processor/) - Методы обработчика
- [Config](./config) - Параметры конфигурации
- [Константы и ошибки](./constants) - Типы ошибок
- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
- [Синтаксис выражений пути](../path-syntax) - Подробное описание синтаксиса путей
