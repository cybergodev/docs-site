---
title: "HTTP 클라이언트 - HTTPC"
description: "CyberGo HTTPC는 Go 언어용 안전하고 고성능인 HTTP 클라이언트 라이브러리로, TLS 1.2+ 암호화, SSRF 방어, 스마트 지수 백오프 재시도, 양파 모델 미들웨어 체인과 Result 객체 풀 재사용을 내장하여 마이크로서비스 및 고동시성 시나리오에 적합합니다."
---

# HTTPC

안전한 HTTP 클라이언트 라이브러리, 기본 보안, 스마트 재시도·미들웨어 체인·객체 풀 재사용 내장.

## 특징

- **TLS 1.2+** - 최소 TLS 버전 강제, 기본 TLS 1.2-1.3
- **SSRF 방어** - 기본적으로 사설 IP 연결 차단, 면제 CIDR 설정 가능
- **스마트 재시도** - 지수 백오프 + 지터, 커스텀 재시도 전략 지원
- **연결 풀 관리** - 고성능 연결 재사용, HTTP/2 지원
- **미들웨어 체인** - 로깅, 감사, 메트릭, 복구, 요청 ID 등 내장 미들웨어
- **파일 다운로드** - 이어받기, 진행률 콜백, 체크섬 검증 지원
- **DNS-over-HTTPS** - 내장 DoH 리졸버, DNS 하이재킹 위험 감소
- **객체 풀 재사용** - 내장 sync.Pool로 메모리 할당 감소, GC 부하 절감

## 설치

```bash
go get github.com/cybergodev/httpc
```

## 30초 체험

```go
package main

import (
    "fmt"
    "github.com/cybergodev/httpc"
)

func main() {
    result, err := httpc.Get("https://httpbin.org/get")
    if err != nil {
        panic(err)
    }
    defer httpc.ReleaseResult(result)

    fmt.Println(result.StatusCode()) // 200
}
```

## 시작하기

목적에 따라 읽기 경로를 선택하세요:

| 목적 | 추천 |
|------|------|
| 5분 만에 시작하기 | [빠른 시작](./getting-started) |
| 30분 실전 연습 | [실전 튜토리얼](./guides/tutorial) |
| 특정 사용법 찾기 | [치트시트](./cheatsheet) |
| 보안 기능 알아보기 | [보안 개요](./security/) |
| API 시그니처 확인 | [API 레퍼런스](./api-reference/) |

## 핵심 개념

HTTPC는 간단한 것부터 유연한 것까지 세 가지 사용 방식을 제공합니다:

```text
패키지 레벨 함수        클라이언트 인스턴스              도메인 클라이언트
httpc.Get()  →  client, _ := httpc.New()  →  dc, _ := httpc.NewDomain(url)
일회성 요청       커스텀 설정/미들웨어       세션 관리/Cookie 자동 유지
```

### 설정 프리셋

| 프리셋 | 적용 시나리오 |
|--------|---------------|
| `DefaultConfig()` | 일반 시나리오, 안전한 기본값 |
| `SecureConfig()` | 보안 민감 시나리오, 엄격한 타임아웃 |
| `PerformanceConfig()` | 높은 처리량, 대규모 연결 풀 |
| `TestingConfig()` | 테스트 환경, 보안 검사 비활성화 |
| `MinimalConfig()` | 경량 스크립트, 재시도·리다이렉트 없음 |
