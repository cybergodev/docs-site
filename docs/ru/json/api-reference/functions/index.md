---
sidebar_label: "Обзор"
title: "Функции пакета - CyberGo JSON | Справочник API"
description: "Функции пакета CyberGo JSON: запросы Get/GetString/GetInt, изменения Set/Delete/MergeJSON, Marshal/Unmarshal и файловые операции без создания Processor."
sidebar_position: 1
---

# Функции пакета

Функции верхнего уровня пакета json, которые можно вызывать напрямую без создания экземпляра Processor. Сгруппированы по функциональности:

## [Запросы и получение](./get)

Функции запросов по пути, типобезопасного получения, массовых операций, парсинга и валидации.

**Основные функции**: [`Get`](./get#get) · [`GetWithContext`](./get#getwithcontext) · [`GetString`](./get#getstring) · [`GetInt`](./get#getint) · [`GetFloat`](./get#getfloat) · [`GetBool`](./get#getbool) · [`GetArray`](./get#getarray) · [`GetObject`](./get#getobject) · [`GetTyped[T]`](./get#gettyped-t) · [`SafeGet`](./get#safeget-функция-пакета) · [`GetMultiple`](./get#getmultiple-функция-пакета) · [`ProcessBatch`](./get#processor-processbatch) · [`Parse`](./get#parse) · [`ParseAny`](./get#parseany) · [`Valid`](./get#valid) · [`ValidWithConfig`](./get#validwithconfig) · [`ValidateSchema`](./get#validateschema)

## [Операции модификации](./modify)

Функции установки, удаления и объединения JSON-данных.

**Основные функции**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`Delete`](./modify#delete) · [`DeleteClean`](./modify#deleteclean) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [Кодирование/декодирование](./encode-decode)

Функции сериализации, десериализации и потокового кодирования/декодирования.

**Основные функции**: [`Marshal`](./encode-decode#marshal) · [`Unmarshal`](./encode-decode#unmarshal) · [`MarshalIndent`](./encode-decode#marshalindent) · [`Encode`](./encode-decode#encode) · [`EncodePretty`](./encode-decode#encodepretty) · [`EncodeWithConfig`](./encode-decode#encodewithconfig) · [`Prettify`](./encode-decode#prettify) · [`Compact`](./encode-decode#compact) · [`Indent`](./encode-decode#indent) · [`HTMLEscape`](./encode-decode#htmlescape) · [`NewEncoder`](../types#encoder-json-кодировщик) · [`NewDecoder`](../types#decoder-json-декодер) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [Файловые операции](./file-io)

Функции чтения/записи файлов и обработки JSONL.

**Основные функции**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter) · [`ParseJSONL`](./file-io#parsejsonl) · [`ToJSONL`](./file-io#tojsonl) · [`ToJSONLString`](./file-io#tojsonlstring) · [`StreamLinesInto[T]`](./file-io#streamlinesinto)

## [Итерация файлов](../../streaming/large-file)

Функции потоковой итерации файлов (функции уровня пакета, не требуют создания Processor).

**Основные функции**: [`ForeachFile`](../../streaming/large-file#foreachfile-функция-уровня-пакета) · [`ForeachFileWithPath`](../../streaming/large-file#foreachfilewithpath-функция-уровня-пакета) · [`ForeachFileChunked`](../../streaming/large-file#foreachfilechunked-функция-уровня-пакета) · [`ForeachFileNested`](../../streaming/large-file#foreachfilenested-функция-уровня-пакета)

## [Вспомогательные утилиты](../helpers)

Функции для преобразования типов, сравнения, управления кэшем и обработки ошибок.

**Основные функции**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-функция-уровня-пакета) · [`GetStats`](../helpers#getstats-функция-уровня-пакета) · [`GetHealthStatus`](../helpers#gethealthstatus-функция-уровня-пакета) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## Быстрая навигация

| Назначение | Рекомендуемая функция | Документация |
|------------|----------------------|--------------|
| Получение одного значения | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Запросы и получение](./get#функции-запроса-по-пути) |
| Получение любого типа | `Get`, `GetTyped[T]` | [Запросы и получение](./get#обобщённые-функции-получения) |
| Получение с значением по умолчанию | `GetString(data, path, "default")` | [Запросы и получение](./get#типобезопасные-функции-получения) |
| Обобщённое получение | `GetTyped[T](data, path, defaultValue...)` | [Запросы и получение](./get#обобщённые-функции-получения) |
| Массовое получение | `GetMultiple` | [Запросы и получение](./get#расширенные-методы-processor) |
| Модификация JSON | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [Операции модификации](./modify) |
| Сериализация | `Marshal`, `Encode` | [Кодирование/декодирование](./encode-decode#функции-сериализации) |
| Десериализация | `Unmarshal`, `Parse` | [Кодирование/декодирование](./encode-decode#функции-сериализации) · [Запросы и получение](./get#функции-парсинга) |
| Форматирование | `Prettify`, `Processor.Compact` | [Кодирование/декодирование](./encode-decode#функции-сериализации) |
| Печать вывода | `Encode` + `fmt.Println`, `EncodePretty` | [Функции вывода](../print) |
| Массовое кодирование | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Массовое кодирование](./encode-decode#функции-пакетного-кодирования) · [Вывод процессора](../processor/output) |
| Валидация | `Valid` | [Запросы и получение](./get#функции-валидации) |
| Чтение/запись файлов | `LoadFromFile`, `SaveToFile` | [Файловые операции](./file-io#функции-чтения-файлов) |
| Обработка JSONL | `ParseJSONL`, `ToJSONL` | [Файловые операции](./file-io#функции-обработки-jsonl) |
| Сравнение | `CompareJSON` | [Вспомогательные утилиты](../helpers#функции-сравнения-json) |
| Объединение | `MergeJSON`, `MergeMany` | [Операции модификации](./modify#функции-слияния) |
| Преобразование типов | Методы преобразования типа `AccessResult` | [Вспомогательные утилиты](../helpers#методы-преобразования-типов-accessresult) |
| Обработка ошибок | `JsonsError`, `errors.Is` | [Константы ошибок](../constants#переменные-ошибок) |

## Связанные разделы

- [Processor](../processor/) - Методы процессора
- [Config](../config) - Параметры конфигурации
- [Константы и ошибки](../constants) - Типы ошибок
- [Определения интерфейсов](../interfaces) - Расширяемые интерфейсы
- [Синтаксис выражений пути](../../getting-started/path-syntax) - Подробное описание синтаксиса пути
