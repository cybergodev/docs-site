---
title: API 참조 - CyberGo JSON | 전체 함수 문서
description: "CyberGo JSON 전체 API 참조 매뉴얼: GetString/GetInt 경로 쿼리, Set/Delete 수정 작업, Marshal/Unmarshal 직렬화, Processor 프로세서, Schema 검증, Hook 훅 및 보안 설정을 포함하며, encoding/json 표준 라이브러리와 100% 호환됩니다."
---

# API 참조

이 섹션은 `github.com/cybergodev/json` 라이브러리의 완전한 API 참조를 제공합니다.

## 모듈 인덱스

| 모듈 | 설명 |
|------|------|
| [패키지 함수](./functions) | 패키지 수준 함수 참조, 경로 쿼리, 타입 가져오기, 인코딩/디코딩 등 |
| [Processor](./processor/) | 프로세서 메서드 및 설정 |
| [Config](./config) | 설정 옵션 상세 |
| [타입 정의](./types) | 핵심 타입 정의 (Encoder/Decoder 포함) |
| [제네릭 작업](./generics) | 제네릭 API 참조 |
| [인터페이스 정의](./interfaces) | 확장 인터페이스 정의 |
| [스트림 처리](./large-file) | 스트림 프로세서 참조 |
| [NDJSON 처리](./jsonl) | JSONL/NDJSON 프로세서 |
| [이터레이터](./iterator) | 반복 순회 API |
| [유틸리티 함수](./helpers) | 타입 변환 및 도구 함수 |
| [포맷팅 출력](./print) | 포맷팅 및 이쁘게 출력 |
| [보안 검증](./security) | 보안 관련 API |
| [검증기](./validator) | Schema 검증기 |
| [훅 시스템](./hooks) | 작업 인터셉트 훅 |
| [커스텀 인코더](./custom-encoder) | 커스텀 인코더 |
| [상수와 오류](./constants) | 상수 및 오류 타입 |

## 빠른 찾기

### 기능별 분류

#### 경로 쿼리

| 함수 | 설명 |
|------|------|
| `Get`, `GetString`, `GetInt`, `GetFloat`, `GetBool`, `GetArray`, `GetObject` | 타입 안전 가져오기 |
| `GetTyped[T]` | 제네릭 가져오기 |
| `SafeGet` | 안전하게 AccessResult 가져오기 |
| `GetMultiple` | 배치 가져오기 |

#### 수정 작업

| 함수 | 설명 |
|------|------|
| `Set`, `SetMultiple` | 값 설정 |
| `SetCreate`, `SetMultipleCreate` | 값 설정 및 경로 자동 생성 |
| `Delete`, `DeleteClean` | 값 삭제 |
| `ProcessBatch` | 배치 작업 |

#### 인코딩/디코딩

| 함수 | 설명 |
|------|------|
| `Marshal`, `Unmarshal` | 표준 인코딩/디코딩 |
| `MarshalIndent` | 포맷팅 인코딩 |
| `Encode`, `EncodeWithConfig` | 문자열로 인코딩 |
| `NewEncoder`, `NewDecoder` | 스트림 인코딩/디코딩 |
| `Parse` | JSON 파싱 |

#### 포맷팅

| 함수 | 설명 |
|------|------|
| `Prettify` | JSON 포맷팅 |
| `Compact` | JSON 압축 |

#### 파일 작업

| 함수 | 설명 |
|------|------|
| `LoadFromFile`, `SaveToFile` | 파일 읽기/쓰기 |
| `LoadFromReader` | Reader에서 읽기 |
| `MarshalToFile`, `UnmarshalFromFile` | 파일 인코딩/디코딩 |

#### 스트림 처리

| 타입/메서드 | 설명 |
|------|------|
| `ForeachFile` | 파일 스트림 처리 |
| `NDJSONProcessor` | NDJSON/JSONL 프로세서 |
| `JSONLWriter` | JSONL 라이터 |

#### 검증

| 함수 | 설명 |
|------|------|
| `Valid` | JSON 검증 |
| `ValidateSchema` | Schema 검증 (`Schema` 타입과 함께 사용) |

## 명명 규칙

라이브러리는 다음 명명 규칙을 따릅니다:

| 패턴 | 설명 | 예제 |
|------|------|------|
| `Get{Type}` | 지정 타입 가져오기 (defaultValue 지원) | `GetString`, `GetInt` |
| `GetTyped[T]` | 제네릭 가져오기, T 반환 | `GetTyped[User]` |
| `New{Type}` | 인스턴스 생성 | `New` (*Processor 반환), `NewEncoder` |
| `Default{Type}` | 기본 설정 | `DefaultConfig` |
| `{Type}Config` | 설정 프리셋 | `SecurityConfig`, `PrettyConfig` |

## 관련 문서

- [빠른 시작](../getting-started) -- 설치 및 기본 사용법
- [경로 표현식 문법](../path-syntax) -- 경로 쿼리 문법
- [사용 예제](../examples) -- 실전 코드 예제
- [대용량 파일 처리](../large-files) -- 스트림 처리 가이드
