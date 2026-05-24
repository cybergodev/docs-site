---
title: "HTML - 프로덕션급 HTML 콘텐츠 추출 도구"
description: "CyberGo HTML은 Go 언어 기반의 고성능 HTML 콘텐츠 추출 및 정제 도구 라이브러리로, 스마트 문서 인식, 자동 인코딩 감지(15+ 인코딩), 독립 링크 추출, 동시성 배치 처리 및 플러그형 감사 파이프라인을 제공하며, 순수 텍스트, Markdown, JSON 다중 형식 출력을 지원하여 웹 콘텐츠 스크래핑, 데이터 정제, 문서 분석 등 프로덕션급 애플리케이션 시나리오에 적합합니다."
---

# HTML

프로덕션급 HTML 콘텐츠 추출 도구로, 자동 인코딩 감지(15+ 인코딩), 스마트 문서 인식, 링크/미디어 추출 및 다중 형식 출력을 지원합니다.

## 특징

- **스마트 문서 인식** - 페이지의 본문 콘텐츠를 자동으로 식별하고 추출하며, 내비게이션, 광고 등 노이즈를 제거합니다
- **콘텐츠 정제** - HTML을 자동으로 정제하여 위험한 태그와 속성을 제거하고 XSS 공격을 방지합니다
- **메타데이터 추출** - 제목, 이미지, 링크, 비디오, 오디오 등 구조화된 정보를 자동으로 추출합니다
- **다중 형식 출력** - 순수 텍스트, Markdown, JSON 세 가지 출력 형식
- **자동 인코딩 감지** - UTF-8, GBK, Shift_JIS, Windows-1252 등 15+ 인코딩 지원
- **배치 처리** - 동시성 배치 추출, 내장 Processor 객체 풀 재사용
- **링크 추출** - 독립적인 링크 추출 API, 유형별 그룹화 지원
- **감사 시스템** - 플러그형 감사 파이프라인, 다중 Sink, 이벤트 필터링 지원
- **보안防护** - 입력 크기 제한, 깊이 제한, 경로 순회 방지, 패닉 복구

## 설치

```bash
go get github.com/cybergodev/html
```

## 빠른 시작

```go
package main

import (
    "fmt"
    "log"

    "github.com/cybergodev/html"
)

func main() {
    data := []byte(`<html><head><title>예시</title></head>
        <body><h1>제목</h1><p>본문 내용</p></body></html>`)

    result, err := html.Extract(data)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(result.Title) // 출력: 예시
    fmt.Println(result.Text)  // 출력: 제목\n\n본문 내용
}
```

## 아키텍처 개요

HTML 라이브러리는 세 가지 핵심 타입을 중심으로 구축됩니다:

```text
                Config
                  │
                  ▼
             Processor ──→ Result
              │    │         │
              │    │         ├── Text / Title
              │    │         ├── Images / Videos / Audios
              │    │         ├── Links
              │    │         └── WordCount / ReadingTime
              │    │
              │    ├── Cache（캐시）
              │    ├── Statistics（통계）
              │    └── AuditLog（감사）
              │
              ├── Scorer（커스텀 평가 ── 확장 가능）
              └── AuditSink（감사 출력 ── 확장 가능）
```

| 타입 | 역할 | 설명 |
|------|------|------|
| `Config` | 설정 | 모든 동작의 제어 센터, 4가지 프리셋 제공 |
| `Processor` | 엔진 | 상태가 있는 처리 엔진, 캐시, 통계, 감사 관리 |
| `Result` | 결과 | 추출된 구조화된 출력, 텍스트와 모든 메타데이터 포함 |

### Processor vs 패키지 함수

| | 패키지 함수 | Processor |
|---|---|---|
| 호출 방식 | `html.Extract(data)` | `p, _ := html.New(cfg); p.Extract(data)` |
| 캐시 | 없음(매번 내부 임시 풀 사용) | 있음, TTL 및 용량 설정 가능 |
| 통계 | 없음 | 있음, 적중률 등 지표 조회 가능 |
| 감사 | 없음 | 있음, 감사 파이프라인 설정 가능 |
| 라이프사이클 | 관리 불필요 | `defer p.Close()` 필요 |
| 동시성 안전 | 예 | 예 |

:::tip 선택 가이드
- **일회성 추출**(CLI 도구, 스크립트) → 패키지 함수
- **서버 고빈도 호출**(웹 서비스, 크롤러) → Processor
- **감사/모니터링 필요** → Processor
:::

| 단계 | 페이지 | 배울 내용 |
|------|------|----------|
| 입문 | [빠른 시작](./getting-started) | 설치, 기본 사용법, 두 가지 호출 방식 |
| 핵심 | [콘텐츠 추출](./guides/content-extraction) | Extract 전체 패밀리, Config 설정, Result 해석 |
| 형식 | [출력 형식](./guides/output-formats) | Markdown / JSON 출력, 커스텀 템플릿 |
| 성능 | [캐시와 재사용](./guides/processor-cache) | Processor 라이프사이클, 캐시 튜닝, 배치 처리 |
| 확장 | [링크 추출](./guides/link-extraction) | 링크 추출, 그룹화, 리소스 발견 |
| 보안 | [감사 파이프라인](./guides/audit-pipeline) | 감사 시스템, 커스텀 Sink, 보안 모니터링 |
| 고급 | [테스트와 커스터마이징](./guides/testing-custom) | 커스텀 Scorer, ContentNode, 테스트 모드 |
| 참조 | [치트시트](./cheatsheet) | 자주 사용하는 API 한눈에 보기 |

## 다음 단계

- [빠른 시작](./getting-started) - 5분 입문 튜토리얼
- [치트시트](./cheatsheet) - 자주 사용하는 작업 빠른 참조
- [API 레퍼런스](./api-reference/) - 전체 API 문서
