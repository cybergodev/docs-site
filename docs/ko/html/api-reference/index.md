---
title: "API 레퍼런스 - CyberGo HTML | 전체 모듈 인덱스"
description: "CyberGo HTML 전체 API 인덱스: 패키지 함수와 Processor 두 방식으로 콘텐츠 추출, 출력, 링크, 배치, 설정, 감사, 타입 등 모든 모듈을 안내합니다."
---

# API 레퍼런스

HTML 라이브러리는 다음 핵심 컴포넌트를 제공합니다:

| 컴포넌트 | 설명 | 문서 |
|------|------|------|
| 패키지 함수 | 편의 함수, 일회성 호출에 적합 | [패키지 함수](./functions) |
| Processor | 프로세서 인스턴스, 리소스 및 캐시 재사용 | [Processor](./processor) |
| Config | 설정 구조체와 프리셋 | [설정](./config) |
| 출력 형식 | Markdown, JSON 출력 | [출력 형식](./output) |
| 링크 추출 | 독립적인 링크 추출 API | [링크 추출](./links) |
| 배치 처리 | 동시성 배치 추출 | [배치 처리](./batch) |
| 인터페이스 | Extractor, StatsProvider 등 | [인터페이스 정의](./interfaces) |
| 타입 | Result, ImageInfo 등 | [타입 정의](./types) |
| 상수와 오류 | 기본값, 센티넬 오류 | [상수와 오류](./constants) |
| 감사 시스템 | 감사 파이프라인과 Sink | [감사 시스템](./audit) |

## API 개요

### 두 가지 호출 모드

```text
┌─────────────────────────────────────────┐
│         패키지 함수(편의 모드)              │
│  html.Extract(data) → *Result, error    │
│  내부적으로 sync.Pool로 Processor 재사용   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        Processor(인스턴스 모드)            │
│  p, _ := html.New(cfg)                  │
│  defer p.Close()                        │
│  result, err := p.Extract(data)         │
│  ✓ 캐시 재사용  ✓ 통계 수집  ✓ 감사 로그    │
└─────────────────────────────────────────┘
```

### 함수 명명 규칙

| 모드 | 명명 | 예시 |
|------|------|------|
| 기본 | `Extract*` | `Extract`, `ExtractText` |
| 파일에서 | `Extract*FromFile` | `ExtractFromFile` |
| 컨텍스트 포함 | `Extract*WithContext` | `ExtractWithContext` |
| 파일+컨텍스트 | `Extract*FromFileWithContext` | `ExtractFromFileWithContext` |

### 모듈 정보

- **모듈 경로**: `github.com/cybergodev/html`
- **Go 버전**: 1.25+
- **의존성**: `golang.org/x/net`, `golang.org/x/text`
