---
title: "패키지 함수 - CyberGo JSON | API 레퍼런스"
description: "CyberGo JSON 패키지 레벨 함수 레퍼런스: Get/GetString/GetInt/GetTyped 경로 쿼리, Set/Delete/MergeJSON 수정, Marshal/Unmarshal 인코딩/디코딩 및 LoadFromFile/SaveToFile 파일 작업을 포함하며 Processor 인스턴스를 생성하지 않고 직접 호출할 수 있습니다."
---

# 패키지 함수

json 패키지가 제공하는 최상위 함수로, Processor 인스턴스를 생성하지 않고도 직접 호출할 수 있습니다. 기능별로 분류하면 다음과 같습니다:

## [쿼리와 가져오기](./functions/get)

경로 쿼리, 타입 안전 가져오기, 배치 작업, 파싱 및 검증 함수입니다.

**주요 함수**: [`Get`](./functions/get#get) · [`GetWithContext`](./functions/get#getwithcontext) · [`GetString`](./functions/get#getstring) · [`GetInt`](./functions/get#getint) · [`GetFloat`](./functions/get#getfloat) · [`GetBool`](./functions/get#getbool) · [`GetArray`](./functions/get#getarray) · [`GetObject`](./functions/get#getobject) · [`GetTyped[T]`](./functions/get#gettyped-t) · [`SafeGet`](./functions/get#safeget-패키지-레벨-함수) · [`GetMultiple`](./functions/get#getmultiple-패키지-레벨-함수) · [`ProcessBatch`](./functions/get#processor-processbatch) · [`Parse`](./functions/get#parse) · [`ParseAny`](./functions/get#parseany) · [`Valid`](./functions/get#valid) · [`ValidWithConfig`](./functions/get#validwithconfig) · [`ValidateSchema`](./functions/get#validateschema)

## [수정 작업](./functions/modify)

설정, 삭제, 병합 JSON 데이터 함수입니다.

**주요 함수**: [`Set`](./functions/modify#set) · [`SetMultiple`](./functions/modify#setmultiple) · [`SetCreate`](./functions/modify#setcreate) · [`SetMultipleCreate`](./functions/modify#setmultiplecreate) · [`Delete`](./functions/modify#delete) · [`DeleteClean`](./functions/modify#deleteclean) · [`MergeJSON`](./functions/modify#mergejson) · [`MergeMany`](./functions/modify#mergemany)

## [인코딩/디코딩](./functions/encode-decode)

직렬화, 역직렬화, 스트리밍 인코딩/디코딩 함수입니다.

**주요 함수**: [`Marshal`](./functions/encode-decode#marshal) · [`Unmarshal`](./functions/encode-decode#unmarshal) · [`MarshalIndent`](./functions/encode-decode#marshalindent) · [`Encode`](./functions/encode-decode#encode) · [`EncodePretty`](./functions/encode-decode#encodepretty) · [`EncodeWithConfig`](./functions/encode-decode#encodewithconfig) · [`Prettify`](./functions/encode-decode#prettify) · [`Compact`](./functions/encode-decode#compact) · [`Indent`](./functions/encode-decode#indent) · [`HTMLEscape`](./functions/encode-decode#htmlescape) · [`NewEncoder`](./types#encoder-json-인코더) · [`NewDecoder`](./types#decoder-json-디코더) · [`EncodeBatch`](./processor/output#encodebatch) · [`EncodeFields`](./processor/output#encodefields) · [`EncodeStream`](./processor/output#encodestream) · [`SaveToWriter`](./functions/file-io#savetowriter)

## [파일 작업](./functions/file-io)

파일 읽기/쓰기 및 JSONL 처리 함수입니다.

**주요 함수**: [`LoadFromFile`](./functions/file-io#loadfromfile) · [`LoadFromReader`](./functions/file-io#loadfromreader) · [`SaveToFile`](./functions/file-io#savetofile) · [`MarshalToFile`](./functions/file-io#marshaltofile) · [`UnmarshalFromFile`](./functions/file-io#unmarshalfromfile) · [`SaveToWriter`](./functions/file-io#savetowriter) · [`ParseJSONL`](./functions/file-io#parsejsonl) · [`ToJSONL`](./functions/file-io#tojsonl) · [`ToJSONLString`](./functions/file-io#tojsonlstring) · [`StreamLinesInto[T]`](./functions/file-io#streamlinesinto)

## [파일 반복](./large-file)

파일 스트리밍 반복 함수 (패키지 레벨 함수, Processor 생성 불필요)입니다.

**주요 함수**: [`ForeachFile`](./large-file#foreachfile-패키지-레벨-함수) · [`ForeachFileWithPath`](./large-file#foreachfilewithpath-패키지-레벨-함수) · [`ForeachFileChunked`](./large-file#foreachfilechunked-패키지-레벨-함수) · [`ForeachFileNested`](./large-file#foreachfilenested-패키지-레벨-함수)

## [보조 도구](./helpers)

타입 변환, 비교, 캐시 관리, 오류 처리 등 유틸리티 함수입니다.

**주요 함수**: [`CompareJSON`](./helpers#comparejson) · [`MergeJSON`](./helpers#mergejson) · [`MergeMany`](./helpers#mergemany) · [`ClearCache`](./helpers#clearcache-패키지-레벨-함수) · [`GetStats`](./helpers#getstats-패키지-레벨-함수) · [`GetHealthStatus`](./helpers#gethealthstatus-패키지-레벨-함수) · [`SetGlobalProcessor`](./helpers#setglobalprocessor) · [`ShutdownGlobalProcessor`](./helpers#shutdownglobalprocessor) · [`SafeError`](./helpers#safeerror) · [`RedactedPath`](./helpers#redactedpath) · [`WarmupCache`](./helpers#warmupcache)

---

## 빠른 탐색

| 용도 | 추천 함수 | 문서 |
|------|----------|------|
| 단일 값 가져오기 | `GetString`, `GetInt`, `GetFloat`, `GetBool` | [쿼리와 가져오기](./functions/get#경로-쿼리-함수) |
| 임의 타입 가져오기 | `Get`, `GetTyped[T]` | [쿼리와 가져오기](./functions/get#제네릭-가져오기-함수) |
| 기본값으로 가져오기 | `GetString(data, path, "default")` | [쿼리와 가져오기](./functions/get#타입-안전-가져오기-함수) |
| 제네릭 가져오기 | `GetTyped[T](data, path, defaultValue...)` | [쿼리와 가져오기](./functions/get#제네릭-가져오기-함수) |
| 배치 가져오기 | `GetMultiple` | [쿼리와 가져오기](./functions/get#processor-확장-메서드) |
| JSON 수정 | `Set`, `Delete`, `SetCreate`, `DeleteClean` | [수정 작업](./functions/modify) |
| 직렬화 | `Marshal`, `Encode` | [인코딩/디코딩](./functions/encode-decode#직렬화-함수) |
| 역직렬화 | `Unmarshal`, `Parse` | [인코딩/디코딩](./functions/encode-decode#직렬화-함수) · [쿼리와 가져오기](./functions/get#파싱-함수) |
| 포맷팅 | `Prettify`, `Processor.Compact` | [인코딩/디코딩](./functions/encode-decode#직렬화-함수) |
| 출력 인쇄 | `Encode` + `fmt.Println`, `EncodePretty` | [인쇄 함수](./print) |
| 배치 인코딩 | `EncodeBatch`, `EncodeFields`, `EncodeStream` | [배치 인코딩](./functions/encode-decode#배치-인코딩-함수) · [프로세서 출력](./processor/output) |
| 검증 | `Valid` | [쿼리와 가져오기](./functions/get#검증-함수) |
| 파일 읽기/쓰기 | `LoadFromFile`, `SaveToFile` | [파일 작업](./functions/file-io#파일-읽기-함수) |
| JSONL 처리 | `ParseJSONL`, `ToJSONL` | [파일 작업](./functions/file-io#jsonl-처리-함수) |
| 비교 | `CompareJSON` | [보조 도구](./helpers#json-비교-함수) |
| 병합 | `MergeJSON`, `MergeMany` | [수정 작업](./functions/modify#병합-함수) |
| 타입 변환 | `AccessResult` 타입 변환 메서드 | [보조 도구](./helpers#accessresult-타입-변환-메서드) |
| 오류 처리 | `JsonsError`, `errors.Is` | [상수 오류](./constants#오류-변수) |

## 관련 문서

- [Processor](./processor/) - 프로세서 메서드
- [Config](./config) - 설정 옵션
- [상수와 오류](./constants) - 오류 타입
- [인터페이스 정의](./interfaces) - 확장 인터페이스
- [경로 표현식 문법](../path-syntax) - 경로 문법 자세히
