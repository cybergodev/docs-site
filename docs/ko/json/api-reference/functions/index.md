---
sidebar_label: "개요"
title: "패키지 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 패키지 함수: Get/GetString/GetInt 쿼리, Set/Delete/MergeJSON 수정, Marshal/Unmarshal, LoadFromFile/SaveToFile을 Processor 없이 호출 가능합니다."
sidebar_position: 1
---

# 패키지 함수

json 패키지가 제공하는 최상위 함수로, Processor 인스턴스를 생성하지 않고도 직접 호출할 수 있습니다. 기능별로 분류하면 다음과 같습니다:

## [쿼리와 가져오기](./get)

경로 쿼리, 타입 안전 가져오기, 배치 작업, 파싱 및 검증 함수입니다.

**주요 함수**: [`Get`](./get#get) · [`GetWithContext`](./get#getwithcontext) · [`GetString`](./get#getstring) · [`GetInt`](./get#getint) · [`GetFloat`](./get#getfloat) · [`GetBool`](./get#getbool) · [`GetArray`](./get#getarray) · [`GetObject`](./get#getobject) · [`GetTyped[T]`](./get#gettyped-t) · [`SafeGet`](./get#safeget-패키지-레벨-함수) · [`GetMultiple`](./get#getmultiple-패키지-레벨-함수) · [`ProcessBatch`](./get#processor-processbatch) · [`Parse`](./get#parse) · [`ParseAny`](./get#parseany) · [`Valid`](./get#valid) · [`ValidWithConfig`](./get#validwithconfig) · [`ValidateSchema`](./get#validateschema)

## [수정 작업](./modify)

설정, 삭제, 병합 JSON 데이터 함수입니다.

**주요 함수**: [`Set`](./modify#set) · [`SetMultiple`](./modify#setmultiple) · [`SetCreate`](./modify#setcreate) · [`SetMultipleCreate`](./modify#setmultiplecreate) · [`Delete`](./modify#delete) · [`DeleteClean`](./modify#deleteclean) · [`MergeJSON`](./modify#mergejson) · [`MergeMany`](./modify#mergemany)

## [인코딩/디코딩](./encode-decode)

직렬화, 역직렬화, 스트리밍 인코딩/디코딩 함수입니다.

**주요 함수**: [`Marshal`](./encode-decode#marshal) · [`Unmarshal`](./encode-decode#unmarshal) · [`MarshalIndent`](./encode-decode#marshalindent) · [`Encode`](./encode-decode#encode) · [`EncodePretty`](./encode-decode#encodepretty) · [`EncodeWithConfig`](./encode-decode#encodewithconfig) · [`Prettify`](./encode-decode#prettify) · [`Compact`](./encode-decode#compact) · [`Indent`](./encode-decode#indent) · [`HTMLEscape`](./encode-decode#htmlescape) · [`NewEncoder`](../types#encoder-json-인코더) · [`NewDecoder`](../types#decoder-json-디코더) · [`EncodeBatch`](../processor/output#encodebatch) · [`EncodeFields`](../processor/output#encodefields) · [`EncodeStream`](../processor/output#encodestream) · [`SaveToWriter`](./file-io#savetowriter)

## [파일 작업](./file-io)

파일 읽기/쓰기 및 JSONL 처리 함수입니다.

**주요 함수**: [`LoadFromFile`](./file-io#loadfromfile) · [`LoadFromReader`](./file-io#loadfromreader) · [`SaveToFile`](./file-io#savetofile) · [`MarshalToFile`](./file-io#marshaltofile) · [`UnmarshalFromFile`](./file-io#unmarshalfromfile) · [`SaveToWriter`](./file-io#savetowriter) · [`ParseJSONL`](./file-io#parsejsonl) · [`ToJSONL`](./file-io#tojsonl) · [`ToJSONLString`](./file-io#tojsonlstring) · [`StreamLinesInto[T]`](./file-io#streamlinesinto)

## [파일 반복](../../streaming/large-file)

파일 스트리밍 반복 함수 (패키지 레벨 함수, Processor 생성 불필요)입니다.

**주요 함수**: [`ForeachFile`](../../streaming/large-file#foreachfile-패키지-레벨-함수) · [`ForeachFileWithPath`](../../streaming/large-file#foreachfilewithpath-패키지-레벨-함수) · [`ForeachFileChunked`](../../streaming/large-file#foreachfilechunked-패키지-레벨-함수) · [`ForeachFileNested`](../../streaming/large-file#foreachfilenested-패키지-레벨-함수)

## [보조 도구](../helpers)

타입 변환, 비교, 캐시 관리, 오류 처리 등 유틸리티 함수입니다.

**주요 함수**: [`CompareJSON`](../helpers#comparejson) · [`MergeJSON`](../helpers#mergejson) · [`MergeMany`](../helpers#mergemany) · [`ClearCache`](../helpers#clearcache-패키지-레벨-함수) · [`GetStats`](../helpers#getstats-패키지-레벨-함수) · [`GetHealthStatus`](../helpers#gethealthstatus-패키지-레벨-함수) · [`SetGlobalProcessor`](../helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](../helpers#shutdownglobalprocessor) · [`SafeError`](../helpers#safeerror) · [`RedactedPath`](../helpers#redactedpath) · [`WarmupCache`](../helpers#warmupcache)

---

## 빠른 탐색

| 용도 | 추천 함수 | 문서 |
|------|----------|------|
| 단일 값 가져오기 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [쿼리와 가져오기](./get#경로-쿼리-함수) |
| 임의 타입 가져오기 | `Get`, `GetTyped[T]` | [쿼리와 가져오기](./get#제네릭-가져오기-함수) |
| 기본값으로 가져오기 | `GetString(data, path, "default")` | [쿼리와 가져오기](./get#타입-안전-가져오기-함수) |
| 제네릭 가져오기 | `GetTyped[T](data, path, defaultValue...)` | [쿼리와 가져오기](./get#제네릭-가져오기-함수) |
| 배치 가져오기 | `GetMultiple` | [쿼리와 가져오기](./get#processor-확장-메서드) |
| JSON 수정 | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [수정 작업](./modify) |
| 직렬화 | `Marshal`, `Encode` | [인코딩/디코딩](./encode-decode#직렬화-함수) |
| 역직렬화 | `Unmarshal`, `Parse` | [인코딩/디코딩](./encode-decode#직렬화-함수) · [쿼리와 가져오기](./get#파싱-함수) |
| 포맷팅 | `Prettify`, `Processor.Compact` | [인코딩/디코딩](./encode-decode#직렬화-함수) |
| 출력 인쇄 | `Encode` + `fmt.Println`, `EncodePretty` | [인쇄 함수](../print) |
| 배치 인코딩 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [배치 인코딩](./encode-decode#배치-인코딩-함수) · [프로세서 출력](../processor/output) |
| 검증 | `Valid` | [쿼리와 가져오기](./get#검증-함수) |
| 파일 읽기/쓰기 | `LoadFromFile`, `SaveToFile` | [파일 작업](./file-io#파일-읽기-함수) |
| JSONL 처리 | `ParseJSONL`, `ToJSONL` | [파일 작업](./file-io#jsonl-처리-함수) |
| 비교 | `CompareJSON` | [보조 도구](../helpers#json-비교-함수) |
| 병합 | `MergeJSON`, `MergeMany` | [수정 작업](./modify#병합-함수) |
| 타입 변환 | `AccessResult` 타입 변환 메서드 | [보조 도구](../helpers#accessresult-타입-변환-메서드) |
| 오류 처리 | `JsonsError`, `errors.Is` | [상수 오류](../constants#오류-변수) |

## 관련 문서

- [Processor](../processor/) - 프로세서 메서드
- [Config](../config) - 설정 옵션
- [상수와 오류](../constants) - 오류 타입
- [인터페이스 정의](../interfaces) - 확장 인터페이스
- [경로 표현식 문법](../../getting-started/path-syntax) - 경로 문법 자세히
