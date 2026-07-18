---
sidebar_label: "개요"
title: "패키지 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 패키지 레벨 함수: Get/GetString/GetInt 경로 조회, Set/Delete/MergeJSON 수정, Marshal/Unmarshal 인코딩과 ParseJSONL/ProcessBatch 배치 처리."
sidebar_position: 1
---

# 패키지 함수

json 패키지가 제공하는 최상위 함수로, Processor 인스턴스를 생성하지 않고도 직접 호출할 수 있습니다. 기능별로 분류하면 다음과 같습니다:

## [조회 및 가져오기](./query)

경로 쿼리, 타입 안전 가져오기, 안전한 가져오기 및 배치 가져오기 함수입니다.

**주요 함수**: [`Get`](./query#get) · [`GetWithContext`](./query#getwithcontext) · [`GetString`](./query#getstring) · [`GetInt`](./query#getint) · [`GetFloat`](./query#getfloat) · [`GetBool`](./query#getbool) · [`GetArray`](./query#getarray) · [`GetObject`](./query#getobject) · [`GetTyped[T]`](./query#gettyped-t) · [`SafeGet`](./query#safeget-패키지-레벨-함수) · [`GetMultiple`](./query#getmultiple-패키지-레벨-함수)

## [수정](./modify)

설정, 병합 JSON 데이터 함수입니다.

**주요 함수**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [삭제 작업](./delete)

JSON 데이터 노드를 삭제하는 함수입니다.

**주요 함수**: [`Delete`](./delete#delete) · [`DeleteClean`](./delete#deleteclean)

## [인코딩 출력](./output)

직렬화, 역직렬화, 스트리밍 인코딩/디코딩 함수입니다.

**주요 함수**: [`Marshal`](./output#marshal) · [`Unmarshal`](./output#unmarshal) · [`MarshalIndent`](./output#marshalindent) · [`Encode`](./output#encode) · [`EncodePretty`](./output#encodepretty) · [`EncodeWithConfig`](./output#encodewithconfig) · [`Prettify`](./output#prettify) · [`Compact`](./output#compact) · [`CompactString`](./output#compactstring) · [`Indent`](./output#indent) · [`HTMLEscape`](./output#htmlescape) · [`NewEncoder`](../types#encoder-json-인코더) · [`NewDecoder`](../types#decoder-json-디코더) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [파싱 및 검증](./parse)

JSON을 대상 객체로 파싱, Processor 인스턴스 파싱 및 JSON 유효성/Schema 검증 함수입니다.

**주요 함수**: [`Parse`](./parse#parse) · [`ParseAny`](./parse#parseany) · [`Processor.Parse`](./parse#processor-parse) · [`Processor.ParseAny`](./parse#processor-parseany) · [`Valid`](./parse#valid) · [`ValidWithConfig`](./parse#validwithconfig) · [`ValidateSchema`](./parse#validateschema)

## [배치 작업](./batch)

여러 JSON 작업(get/set/delete/validate)을 배치로 처리하는 함수입니다.

**주요 함수**: [`ProcessBatch`](./batch#processbatch) · [`BatchOperation`](./batch#batchoperation) · [`BatchResult`](./batch#batchresult)

## [JSONL](./jsonl)

JSONL(JSON Lines) 파싱, 스트리밍 읽기, 변환 및 쓰기 함수입니다.

**주요 함수**: [`ParseJSONL`](./jsonl#parsejsonl) · [`ToJSONL`](./jsonl#tojsonl) · [`ToJSONLString`](./jsonl#tojsonlstring) · [`StreamLinesInto[T]`](./jsonl#streamlinesinto) · [`NewJSONLWriter`](./jsonl#newjsonlwriter)

## [파일 I/O](./file-io)

파일 읽기/쓰기 및 스트리밍 I/O 함수입니다.

**주요 함수**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter)

## [반복 메서드](./iterate)

JSON 배열, 객체, 중첩 구조 및 파일을 순회하는 반복 함수입니다.

**주요 함수**: [`Foreach`](./iterate#foreach) · [`ForeachWithPath`](./iterate#foreachwithpath) · [`ForeachNested`](./iterate#foreachnested) · [`ForeachReturn`](./iterate#foreachreturn) · [`ForeachWithError`](./iterate#foreachwitherror) · [`ForeachNestedWithError`](./iterate#foreachnestedwitherror) · [`ForeachWithPathAndIterator`](./iterate#foreachwithpathanditerator) · [`ForeachWithPathAndControl`](./iterate#foreachwithpathandcontrol) · [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [파일 반복](../../streaming/large-files)

파일 스트리밍 반복 사례 가이드와 실무입니다(패키지 레벨 `ForeachFile*` 함수의 API 레퍼런스는 [반복 메서드](./iterate#파일-반복-함수) 참조).

**주요 함수**: [`ForeachFile`](./iterate#foreachfile) · [`ForeachFileWithPath`](./iterate#foreachfilewithpath) · [`ForeachFileChunked`](./iterate#foreachfilechunked) · [`ForeachFileNested`](./iterate#foreachfilenested)

## [보조 도구](../helpers)

타입 변환, 비교, 캐시 관리, 오류 처리 등 유틸리티 함수입니다.

**주요 함수**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-패키지-레벨-함수) · [`GetStats`](../helpers#getstats-패키지-레벨-함수) · [`GetHealthStatus`](../helpers#gethealthstatus-패키지-레벨-함수) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## 빠른 탐색

| 용도 | 추천 함수 | 문서 |
|------|----------|------|
| 단일 값 가져오기 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [조회 및 가져오기](./query#경로-쿼리-함수) |
| 임의 타입 가져오기 | `Get`, `GetTyped[T]` | [조회 및 가져오기](./query#제네릭-가져오기-함수) |
| 기본값으로 가져오기 | `GetString(data, path, "default")` | [조회 및 가져오기](./query#타입-안전-가져오기-함수) |
| 제네릭 가져오기 | `GetTyped[T](data, path, defaultValue...)` | [조회 및 가져오기](./query#제네릭-가져오기-함수) |
| 배치 가져오기 | `GetMultiple` | [조회 및 가져오기](./query#processor-확장-메서드) |
| JSON 수정 | `Set`, `SetCreate` | [수정](./modify) |
| JSON 삭제 | `Delete`, `DeleteClean` | [삭제 작업](./delete) |
| 직렬화 | `Marshal`, `Encode` | [인코딩 출력](./output#직렬화-함수) |
| 역직렬화 | `Unmarshal`, `Parse` | [인코딩 출력](./output#직렬화-함수) · [파싱 및 검증](./parse#파싱-함수) |
| 포맷팅 | `Prettify`, `CompactString`, `Processor.Compact` | [인코딩 출력](./output#직렬화-함수) |
| 출력 인쇄 | `Encode` + `fmt.Println`, `EncodePretty` | [인쇄 함수](../print) |
| 배치 인코딩 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [배치 인코딩](./output#배치-인코딩-함수) · [프로세서 출력](../processor/output) |
| 배치 작업 | `ProcessBatch` | [배치 작업](./batch) |
| 검증 | `Valid` | [파싱 및 검증](./parse#검증-함수) |
| JSON Schema 검증 | `ValidateSchema` | [파싱 및 검증](./parse#validateschema) |
| 파일 읽기/쓰기 | `LoadFromFile`, `SaveToFile` | [파일 I/O](./file-io#파일-읽기-함수) |
| 반복 순회 | `Foreach`, `ForeachWithPath`, `ForeachNested` | [반복 메서드](./iterate#메서드-비교) |
| 파일 반복 | `ForeachFile`, `ForeachFileChunked` | [반복 메서드](./iterate#파일-반복-메서드-비교) |
| JSONL 처리 | `ParseJSONL`, `ToJSONL` | [JSONL](./jsonl#jsonl-처리-함수) |
| 비교 | `CompareJSON` | [보조 도구](../helpers#json-비교-함수) |
| 병합 | `MergeJSON`, `MergeMany` | [수정](./modify#병합-함수) |
| 타입 변환 | `AccessResult` 타입 변환 메서드 | [보조 도구](../helpers#accessresult-타입-변환-메서드) |
| 오류 처리 | `JsonsError`, `errors.Is` | [상수 오류](../constants#오류-변수) |

## 관련 문서

- [Processor](../processor/) - 프로세서 메서드
- [Config](../config) - 설정 옵션
- [상수와 오류](../constants) - 오류 타입
- [인터페이스 정의](../interfaces) - 확장 인터페이스
- [반복기 타입](../iterator) - Iterator/IterableValue/Stream/Batch/Parallel 타입 정의
- [경로 표현식 문법](../../getting-started/path-syntax) - 경로 문법 자세히
