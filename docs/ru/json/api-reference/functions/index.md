---
sidebar_label: "Обзор"
title: "Функции пакета - CyberGo JSON | Справочник API"
description: "Функции пакета CyberGo JSON: Get/GetString/GetInt запросы по пути, Set/Delete/MergeJSON модификация, Marshal/Unmarshal кодирование и ParseJSONL/ProcessBatch пакетная обработка."
sidebar_position: 1
---

# Функции пакета

Функции верхнего уровня пакета json, которые можно вызывать напрямую без создания экземпляра Processor. Сгруппированы по функциональности:

## [Запрос и получение](./query)

Функции запросов по пути, типобезопасного получения, безопасного доступа и массового получения.

**Основные функции**: [`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-функция-пакета) · [`GetMultiple`](./query#getmultiple-функция-пакета)

## [Модификация](./modify)

Функции установки и объединения JSON-данных.

**Основные функции**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [Операции удаления](./delete)

Функции удаления узлов JSON-данных.

**Основные функции**: [`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [Кодирование и вывод](./output)

Функции сериализации, десериализации и потокового кодирования/декодирования.

**Основные функции**: [`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-кодировщик) · [`NewDecoder`](../types#decoder-json-декодер) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [Парсинг и валидация](./parse)

Функции парсинга JSON в целевые объекты, парсинга через Processor и валидации JSON / JSON Schema.

**Основные функции**: [`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [Пакетные операции](./batch)

Функции пакетной обработки нескольких JSON-операций (get/set/delete/validate).

**Основные функции**: [`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

Функции парсинга, потокового чтения, преобразования и записи JSONL (JSON Lines).

**Основные функции**: [`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [Файловый ввод-вывод](./file-io)

Функции чтения/записи файлов и потокового ввода-вывода.

**Основные функции**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [Методы итерации](./iterate)

Итерационные функции для обхода JSON-массивов, объектов, вложенных структур и файлов.

**Основные функции**: [`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [Итерация файлов](../../streaming/large-files)

Руководство и практика сценариев потоковой итерации файлов (справочник API по функциям уровня пакета `ForeachFile*` см. в [Методы итерации](./iterate#функции-итерации-файлов)).

**Основные функции**: [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [Вспомогательные утилиты](../helpers)

Функции для преобразования типов, сравнения, управления кэшем и обработки ошибок.

**Основные функции**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-функция-уровня-пакета) · [`GetStats`](../helpers#getstats-функция-уровня-пакета) · [`GetHealthStatus`](../helpers#gethealthstatus-функция-уровня-пакета) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## Быстрая навигация

| Назначение | Рекомендуемая функция | Документация |
|------------|----------------------|--------------|
| Получение одного значения | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [Запрос и получение](./query#функции-запроса-по-пути) |
| Получение любого типа | `Get`, `GetTyped[T]` | [Запрос и получение](./query#обобщённые-функции-получения) |
| Получение с значением по умолчанию | `GetString(data, path, "default")` | [Запрос и получение](./query#типобезопасные-функции-получения) |
| Обобщённое получение | `GetTyped[T](data, path, defaultValue...)` | [Запрос и получение](./query#обобщённые-функции-получения) |
| Массовое получение | `GetMultiple` | [Запрос и получение](./query#расширенные-методы-processor) |
| Модификация JSON | `Set`, `SetCreate` | [Модификация](./modify) |
| Удаление JSON | `Delete`, `DeleteClean` | [Операции удаления](./delete) |
| Сериализация | `Marshal`, `Encode` | [Кодирование и вывод](./output#функции-сериализации) |
| Десериализация | `Unmarshal`, `Parse` | [Кодирование и вывод](./output#функции-сериализации) · [Парсинг и валидация](./parse#функции-парсинга) |
| Форматирование | `Prettify`, `CompactString`, `Processor.Compact` | [Кодирование и вывод](./output#функции-сериализации) |
| Печать вывода | `Encode` + `fmt.Println`, `EncodePretty` | [Функции вывода](../print) |
| Массовое кодирование | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [Массовое кодирование](./output#функции-пакетного-кодирования) · [Вывод процессора](../processor/output) |
| Пакетные операции | `ProcessBatch` | [Пакетные операции](./batch) |
| Валидация | `Valid` | [Парсинг и валидация](./parse#функции-валидации) |
| Валидация JSON Schema | `ValidateSchema` | [Парсинг и валидация](./parse#validateschema) |
| Чтение/запись файлов | `LoadFromFile`, `SaveToFile` | [Файловый ввод-вывод](./file-io#функции-чтения-файлов) |
| Итерационный обход | `Foreach`, `ForeachWithPath`, `ForeachNested` | [Методы итерации](./iterate#сравнение-методов) |
| Итерация файлов | `ForeachFile`, `ForeachFileChunked` | [Методы итерации](./iterate#сравнение-методов-итерации-файлов) |
| Обработка JSONL | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#функции-обработки-jsonl) |
| Сравнение | `CompareJSON` | [Вспомогательные утилиты](../helpers#функции-сравнения-json) |
| Объединение | `MergeJSON`, `MergeMany` | [Модификация](./modify#функции-слияния) |
| Преобразование типов | Методы преобразования типа `AccessResult` | [Вспомогательные утилиты](../helpers#методы-преобразования-типов-accessresult) |
| Обработка ошибок | `JsonsError`, `errors.Is` | [Константы ошибок](../constants#переменные-ошибок) |

## Связанные разделы

- [Processor](../processor/) - Методы процессора
- [Config](../config) - Параметры конфигурации
- [Константы и ошибки](../constants) - Типы ошибок
- [Определения интерфейсов](../interfaces) - Расширяемые интерфейсы
- [Синтаксис выражений пути](../../getting-started/path-syntax) - Подробное описание синтаксиса пути
