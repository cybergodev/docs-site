---
title: env - 환경 변수 관리
description: CyberGo env는 고보안 Go 환경 변수 관리 라이브러리로, .env, JSON, YAML 다중 포맷 파일 로드 및 자동 감지를 지원하며, 타입 안전 변환, 스레드 안전 동시 접근, 메모리 안전 저장소 보호 및 완전한 감사 로그 기능을 제공하여 웹 서비스, CLI 도구, 컨테이너 배포 등 Go 애플리케이션 시나리오에 적합합니다.
---

# env

고보안 Go 환경 변수 관리 라이브러리. `.env`, JSON, YAML 다중 포맷을 지원하며, 스레드 안전, 감사 로그 및 보안 저장소 기능을 제공합니다.

## 핵심 기능

- **다중 포맷 지원** - `.env`, JSON, YAML 자동 감지
- **타입 안전** - 자동 타입 변환 및 검증
- **스레드 안전** - 분할 락 기반 스레드 안전 동시 접근
- **보안 저장소** - 민감 값 메모리 잠금, 자동 초기화
- **감사 로그** - 완전한 작업 추적
- **변수 확장** - `${VAR}` 문법 지원
- **구조체 매핑** - 태그 기반 설정 바인딩

## 주요 기능 개요

| 기능 | 설명 |
|------|------|
| [타입 변환](/ko/env/getting-started) | GetString, GetInt, GetBool, GetDuration, GetSlice |
| [구조체 매핑](/ko/env/guides/struct-mapping) | 태그 기반 설정 바인딩 |
| [보안 저장소](/ko/env/api-reference/secure-value) | 민감 값 메모리 보호 |
| [다중 포맷 로드](/ko/env/guides/multi-format) | .env, JSON, YAML |

## 빠른 탐색

<div class="vp-features">

### 시작하기
- [빠른 시작](/ko/env/getting-started) - 5분 실습 튜토리얼
- [치트시트](/ko/env/cheatsheet) - 자주 사용하는 코드 조각

### API 레퍼런스
- [패키지 함수](/ko/env/api-reference/functions) - 완전한 API 문서
- [Loader](/ko/env/api-reference/loader) - 로더 메서드
- [SecureValue](/ko/env/api-reference/secure-value) - 보안 값 처리

### 보안
- [보안 개요](/ko/env/security/) - 보안 아키텍처 및 모범 사례

</div>
