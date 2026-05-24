---
title: "API 레퍼런스 - CyberGo DD | 개요"
description: "CyberGo DD 구조화된 로그 라이브러리 전체 API 레퍼런스 문서 개요. Logger 핵심 로거, Config 설정 옵션, Writers 출력 대상, Security 보안 필터링, Audit 감사 로그, Hooks 훅 시스템, Integrity 무결성 서명 등 핵심 기능 모듈을 포괄적으로 다룹니다."
---

# API 레퍼런스

DD 로그 라이브러리는 풍부한 API 인터페이스를 제공하며, 기능 모듈별로 구성되어 있습니다:

## 핵심 컴포넌트

| 모듈 | 설명 | 문서 |
|------|------|------|
| **패키지 함수** | 전역 로그 함수, 편의 생성자 | [패키지 함수](./functions) |
| **Logger** | 핵심 로거 및 메서드 | [Logger](./logger) |
| **LoggerEntry** | 사전 설정 필드가 있는 로그 Entry | [LoggerEntry](./entry) |
| **Config** | 설정 구조체와 사전 설정 | [설정](./config) |
| **인터페이스** | CoreLogger, LogProvider 등 인터페이스 | [인터페이스 정의](./interfaces) |

## 출력과 작성

| 모듈 | 설명 | 문서 |
|------|------|------|
| **Writers** | FileWriter, BufferedWriter, MultiWriter | [출력 대상](./writers) |
| **컨텍스트** | Context 통합과 ContextExtractor | [컨텍스트 통합](./context) |

## 확장 기능

| 모듈 | 설명 | 문서 |
|------|------|------|
| **Fields** | 구조화된 필드 생성자 (20개 이상의 타입) | [구조화된 필드](./fields) |
| **Hooks** | 라이프사이클 훅 시스템 | [훅 시스템](./hooks) |
| **Security** | 민감 데이터 필터링과 보안 설정 | [보안 필터](./security) |
| **Audit** | 감사 로그와 감사 이벤트 | [감사 로그](./audit) |
| **Integrity** | 로그 무결성 서명과 검증 | [무결성 서명](./integrity) |

## 보조 도구

| 모듈 | 설명 | 문서 |
|------|------|------|
| **Debug Visual** | Print/JSON/Text/Exit 디버그 함수 | [디버그 출력](./debug-visual) |
| **Recorder** | 테스트 보조 로거 | [테스트 보조](./recorder) |
| **Constants** | 로그 레벨, 형식, 오류 코드 | [상수와 오류](./constants) |

## 빠른 탐색

```go
// 기본 사용
dd.Info("message")                        // → 패키지 함수
dd.InfoWith("msg", dd.String("k", "v"))   // → 패키지 함수 + Fields

// 커스텀 로거 생성
logger, _ := dd.New(dd.DefaultConfig())    // → 패키지 함수 + Config
logger.WithFields(fields).Info("msg")      // → Logger + Entry

// 파일 출력
fw, _ := dd.NewFileWriter("logs/app.log", dd.DefaultFileWriterConfig())  // → Writers

// 보안
sec := dd.DefaultSecurityConfig()          // → Security
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())  // → Audit
```

## 다음 단계

- [패키지 함수](./functions) -- 전역 함수와 생성자
- [Logger](./logger) -- 핵심 로거 상세 가이드
- [설정](./config) -- 설정 옵션
