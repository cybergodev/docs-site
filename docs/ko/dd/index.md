---
sidebar_label: "개요"
title: "구조화 로그 - CyberGo DD | 고성능 Go 로그 라이브러리"
description: "CyberGo DD는 CyberGo 조직의 고성능 Go 구조화 로그 라이브러리로, 스레드 안전한 로깅, 유연한 출력 대상 구성, 파일 자동 로테이션, 민감 데이터 자동 필터링, 비동기 감사 로그, HMAC 무결성 서명, 저할당 최적화를 제공하여 안전하고 신뢰할 수 있는 로깅 시스템을 빠르게 구축할 수 있도록 돕습니다."
---

# DD

DD(소스 주석에서 "data-driven" 또는 "distributed debugger"로 읽음)는 CyberGo 조직의 고성능 구조화 로그 라이브러리로, 스레드 안전한 로깅, 유연한 출력 대상 구성, 포괄적인 보안 보호 기능을 제공합니다.

## 특징

- **구조화 로그** -- 타입 안전한 필드 기록, 선택적 JSON 형식 출력
- **다중 출력 대상** -- 콘솔, 파일, 사용자 정의 `io.Writer`에 동시 출력
- **파일 로테이션** -- 크기 기반 자동 로테이션, 백업 수량 제한 및 시간 보존 정책 지원
- **민감 데이터 필터링** -- 내장 정규식 패턴으로 비밀번호, 키, Token 등 민감 정보 자동 마스킹
- **감사 로그** -- 비동기 감사 이벤트 기록, HMAC 무결성 서명 및 시퀀스 번호 지원
- **훅 시스템** -- BeforeLog, AfterLog, OnRotate 등 라이프사이클 훅
- **컨텍스트 통합** -- TraceID/SpanID/RequestID용 context 도구 및 ContextExtractor 확장점 제공 (로그 메서드는 ctx를 받지 않으며, WithFields로 필드를 전달해야 함)
- **로그 샘플링** -- 고처리량 시나리오에서 선택적 로그 샘플링 전략
- **저할당 최적화** -- 핫 패스의 메모리 할당을 최소화하여 뛰어난 성능 제공

## 설치

```bash
go get github.com/cybergodev/dd
```

## 빠른 시작

```go
package main

import (
    "time"

    "github.com/cybergodev/dd"
)

func main() {
    // 기본 로거 사용
    dd.Info("서비스 시작")

    // 구조화 로그
    dd.InfoWith("요청 처리 완료",
        dd.String("method", "GET"),
        dd.Int("status", 200),
        dd.Duration("elapsed", 150*time.Millisecond),
    )

    // 커스텀 로거 생성
    logger, _ := dd.New(dd.DefaultConfig())
    defer logger.Close()

    logger.Info("커스텀 로거가 생성되었습니다")
}
```

## 모듈 탐색

| 모듈 | 설명 |
|------|------|
| [핵심 개념](./guides/core-concepts) | Logger 체계, 처리 파이프라인, 인터페이스 계층 |
| [구조화 로그](./guides/structured-logging) | 필드 생성자, 체인 호출 |
| [파일 출력과 로테이션](./guides/file-output) | FileWriter, BufferedWriter |
| [민감 데이터 필터링](./guides/sensitive-filtering) | 자동 마스킹, 보안 등급 |
| [감사 로그](./guides/audit-logging) | 비동기 감사 이벤트, 무결성 서명 |
| [훅 시스템](./guides/hooks) | 라이프사이클 훅 확장 |

## 다음 단계

- [빠른 시작](./getting-started/) -- 5분 입문 가이드
- [핵심 개념](./guides/core-concepts) -- DD 아키텍처 이해
- [마이그레이션 가이드](./guides/migration) -- log/slog/zap/logrus에서 마이그레이션
- [치트시트](./getting-started/cheatsheet) -- 자주 사용하는 API 빠른 참조
- [API 레퍼런스](./api-reference/) -- 전체 API 문서
- [기본 예제](./examples/basic-usage) -- 실용 코드 예제
