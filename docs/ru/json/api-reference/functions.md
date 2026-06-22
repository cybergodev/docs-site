---
title: "Функции пакета - CyberGo JSON | Справочник API"
description: "Функции пакета CyberGo JSON: запросы Get/GetString/GetInt, изменения Set/Delete/MergeJSON, Marshal/Unmarshal и файловые операции без создания Processor."
---

# Функции пакета

Функции верхнего уровня пакета json, которые можно вызывать напрямую без создания экземпляра Processor. Сгруппированы по функциональности:

## [Запросы и получение](./functions/get)

Функции запросов по пути, типобезопасного получения, массовых операций, парсинга и валидации.

**Основные функции**: [`Get`](./functions/get#get) · [`GetWithContext`](./functions/get#getwithcontext) · [`GetString`](./functions/get#getstring) · [`GetInt`](./functions/get#getint) · [`GetFloat`](./functions/get#getfloat) · [`GetBool`](./functions/get#getbool) · [`GetArray`](./functions/get#getarray) · [`GetObject`](./functions/get#getobject) · [`GetTyped[T]`](./functions/get#gettyped-t) · [`SafeGet`](./functions/get#safeget-функция-пакета) · [`GetMultiple`](./functions/get#getmultiple-функция-пакета) · [`ProcessBatch`](./functions/get#processor-processbatch) · [`Parse`](./functions/get#parse) · [`ParseAny`](./functions/get#parseany) · [`Valid`](./functions/get#valid) · [`ValidWithConfig`](./functions/get#validwithconfig) · [`ValidateSchema`](./functions/get#validateschema)

## [Операции модификации](./functions/modify)

Функции установки, удаления и объединения JSON-данных.

**Основные функции**: [`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [Кодирование/декодирование](./functions/encode-decode)

Функции сериализации, десериализации и потокового кодирования/декодирования.

**Основные функции**: [`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder-json-кодировщик) · [`NewDecoder`](./types#decoder-json-декодер) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [Файловые операции](./functions/file-io)

Функции чтения/записи файлов и обработки JSONL.

**Основные функции**: [`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesinto)

## [Итерация файлов](./large-file)

Функции потоковой итерации файлов (функции уровня пакета, не требуют создания Processor).

**Основные функции**: [`ForeachFile`](./large-file#foreachfile-функция-уровня-пакета) · [`ForeachFileWithPath`](./large-file#foreachfilewithpath-функция-уровня-пакета) · [`ForeachFileChunked`](./large-file#foreachfilechunked-функция-уровня-пакета) · [`ForeachFileNested`](./large-file#foreachfilenested-функция-уровня-пакета)

## [Вспомогательные утилиты](./helpers)

Функции для преобразования типов, сравнения, управления кэшем и обработки ошибок.

**Основные функции**: [`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcache-функция-уровня-пакета) · [`GetStats`](./helpers#getstats-функция-уровня-пакета) · [`GetHealthStatus`](./helpers#gethealthstatus-функция-уровня-пакета) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## Быстрая навигация

| Назначение | Рекомендуемая функция | Документация |
|------------|----------------------|--------------|
| Получение одного значения | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Запросы и получение](./functions/get#функции-запроса-по-пути) |
| Получение любого типа | `Get`, `GetTyped[T]` | [Запросы и получение](./functions/get#обобщённые-функции-получения) |
| Получение с значением по умолчанию | `GetString(data, path, "default")` | [Запросы и получение](./functions/get#типобезопасные-функции-получения) |
| Обобщённое получение | `GetTyped[T](data, path, defaultValue...)` | [Запросы и получение](./functions/get#обобщённые-функции-получения) |
| Массовое получение | `GetMultiple` | [Запросы и получение](./functions/get#расширенные-методы-processor) |
| Модификация JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [Операции модификации](./functions/modify) |
| Сериализация | `Marshal`, `Encode` | [Кодирование/декодирование](./functions/encode-decode#функции-сериализации) |
| Десериализация | `Unmarshal`, `Parse` | [Кодирование/декодирование](./functions/encode-decode#функции-сериализации) · [Запросы и получение](./functions/get#функции-парсинга) |
| Форматирование | `Prettify`, `Processor.Compact` | [Кодирование/декодирование](./functions/encode-decode#функции-сериализации) |
| Печать вывода | `Encode` + `fmt.Println`, `EncodePretty` | [Функции вывода](./print) |
| Массовое кодирование | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Массовое кодирование](./functions/encode-decode#функции-пакетного-кодирования) · [Вывод процессора](./processor/output) |
| Валидация | `Valid` | [Запросы и получение](./functions/get#функции-валидации) |
| Чтение/запись файлов | `LoadFromFile`, `SaveToFile` | [Файловые операции](./functions/file-io#функции-чтения-файлов) |
| Обработка JSONL | `ParseJSONL`, `ToJSONL` | [Файловые операции](./functions/file-io#функции-обработки-jsonl) |
| Сравнение | `CompareJSON` | [Вспомогательные утилиты](./helpers#функции-сравнения-json) |
| Объединение | `MergeJSON`, `MergeMany` | [Операции модификации](./functions/modify#функции-слияния) |
| Преобразование типов | Методы преобразования типа `AccessResult` | [Вспомогательные утилиты](./helpers#методы-преобразования-типов-accessresult) |
| Обработка ошибок | `JsonsError`, `errors.Is` | [Константы ошибок](./constants#переменные-ошибок) |

## Связанные разделы

- [Processor](./processor/) - Методы процессора
- [Config](./config) - Параметры конфигурации
- [Константы и ошибки](./constants) - Типы ошибок
- [Определения интерфейсов](./interfaces) - Расширяемые интерфейсы
- [Синтаксис выражений пути](../path-syntax) - Подробное описание синтаксиса пути
