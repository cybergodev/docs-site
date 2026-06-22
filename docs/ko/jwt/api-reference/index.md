---
title: "API 레퍼런스 - CyberGo JWT | 전체 인터페이스 문서"
description: "CyberGo JWT API 레퍼런스 색인: 패키지 함수, Processor 메서드, Config와 BlacklistConfig, Claims와 RegisteredClaims, 확장 인터페이스, 19 센티넬 오류의 전체 내비게이션."
---

# API 레퍼런스

CyberGo JWT 라이브러리는 완전한 JWT 토큰 라이프사이클 관리 API를 제공합니다.

## 모듈 구조

| 모듈 | 설명 | 상세 |
|------|------|------|
| [패키지 함수](./functions) | `New`, `DefaultConfig`, `NewRateLimiter` 등 팩토리 함수 | 생성 및 초기화 |
| [Processor](./processor) | 토큰 생성, 검증, 갱신, 취소 등 핵심 메서드 | 핵심 작업 |
| [Config](./config) | `Config`, `BlacklistConfig` 설정 구조체 | 설정 관리 |
| [Claims](./claims) | `Claims`, `RegisteredClaims` 선언 타입 | 토큰 선언 |
| [인터페이스 정의](./interfaces) | `TokenManager`, `CustomClaims`, `BlacklistStore` 등 | 확장 인터페이스 |
| [타입과 상수](./types) | 서명 알고리즘 상수, `NumericDate`, `StringOrSlice` 등 | 보조 타입 |
| [오류](./errors) | **19**개 센티넬 오류, `ValidationError` | 오류 처리 |

## 빠른 찾기

### 사용 시나리오별

| 시나리오 | 관련 API |
|----------|----------|
| Processor 생성 | [`jwt.New()`](./functions#new), [`jwt.DefaultConfig()`](./functions#defaultconfig) |
| 토큰 발급 | [`Processor.Create()`](./processor#create), [`Processor.CreateRefresh()`](./processor#createrefresh) |
| 토큰 검증 | [`Processor.Validate()`](./processor#validate), [`Processor.ValidateInto()`](./processor#validateinto) |
| 토큰 갱신 | [`Processor.Refresh()`](./processor#refresh), [`Processor.RefreshInto()`](./processor#refreshinto) |
| 토큰 취소 | [`Processor.Revoke()`](./processor#revoke), [`Processor.IsRevoked()`](./processor#isrevoked) |
| 서명 알고리즘 설정 | [`Config.SigningMethod`](./config#config) |
| 커스텀 Claims | [`CustomClaims`](./interfaces#customclaims) 인터페이스 |
| 블랙리스트 관리 | [`BlacklistStore`](./interfaces#blackliststore) 인터페이스 |
| 속도 제한 | [`RateLimitProvider`](./interfaces#ratelimitprovider) 인터페이스 |
| 오류 처리 | [센티넬 오류](./errors#센티넬-오류) |
