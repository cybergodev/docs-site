---
sidebar_label: "프로덕션 체크리스트"
title: "프로덕션 체크리스트 - CyberGo DD | 보안 출시 체크리스트"
description: "CyberGo DD 로그 라이브러리의 프로덕션 환경 배포 전 완전한 보안 체크리스트입니다. 기본 구성 항목 검증, 민감 데이터 필터 규칙 활성화와 테스트 검증, 감사 로그 스위치 확인, 파일 로테이션 정책 설정, HMAC 무결성 서명 구성, 성능 벤치마크 튜닝 등 핵심 검사 항목을 다루어 로그 시스템이 안전하고 신뢰할 수 있으며 규정을 준수하여 출시되도록 보장합니다."
sidebar_position: 3
---

# 프로덕션 체크리스트

출시 전에 다음 보안 구성을 항목별로 점검하여 로그 시스템이 안전하고 신뢰할 수 있도록 보장하세요.

## 기본 구성

- [ ] **로그 레벨** -- 프로덕션 환경을 `LevelInfo` 이상으로 설정
- [ ] **출력 형식** -- `FormatJSON` 사용으로 로그 수집과 분석 용이
- [ ] **파일 로테이션** -- 합리적인 크기 제한과 보존 정책 구성
- [ ] **버퍼 flush** -- 프로그램 종료 전 `Flush()` 또는 `Close()` 호출 보장

```go
logger, _ := dd.New(dd.Config{
    Level:  dd.LevelInfo,
    Format: dd.FormatJSON,
})
defer logger.Close()
```

## 보안 필터

- [ ] **민감 데이터 필터 활성화** -- `DefaultSecurityConfig()` 이상 사용
- [ ] **커스텀 패턴** -- 비즈니스에 맞춰 특정 민감 필드 패턴 추가
- [ ] **필터 통계 모니터링** -- 정기적으로 필터 통계 점검, 이상 발견

```go
logger.SetSecurityConfig(dd.DefaultSecurityConfig())
```

## 파일 보안

- [ ] **로그 권한** -- 파일 권한 `0600`, 디렉터리 권한 `0700`(라이브러리 기본값; 디렉터리는 진입하려면 실행 권한 필요)
- [ ] **경로 검증** -- 로그 경로가 사용자 입력으로 제어 불가능하도록 보장
- [ ] **심볼릭 링크** -- 프로덕션 환경에서 심볼릭 링크 금지
- [ ] **디스크 공간** -- 로테이션 정책으로 디스크 가득 참 방지

## 감사와 무결성

- [ ] **감사 로그** -- 보안 이벤트 기록용 감사 로그 활성화
- [ ] **무결성 서명** -- HMAC 서명 활성화로 로그 변조 불가 보장
- [ ] **감사 로그 분리 저장** -- 감사 로그와 비즈니스 로그를 분리하여 저장

```go
audit, _ := dd.NewAuditLogger(dd.DefaultAuditConfig())
defer audit.Close()

cfg, _ := dd.DefaultIntegrityConfigSafe()
signer, _ := dd.NewIntegritySigner(cfg)
```

## 성능

- [ ] **샘플링 정책** -- 고처리량 시나리오에서 로그 샘플링 활성화 고려
- [ ] **버퍼 쓰기** -- `BufferedWriter` 사용으로 I/O 횟수 감소
- [ ] **동기 쓰기 인지** -- 기본 쓰기 경로는 동기; 고처리량 시나리오에서는 `BufferedWriter`로 시스템 콜 감소
- [ ] **메모리 모니터링** -- 로그 관련 메모리 사용 모니터링

## 라이프사이클

- [ ] **우아한 종료** -- `Close()` 대신 `Shutdown(ctx)` 사용(주의: `Shutdown`은 필터 goroutine을 내부적으로 대기하지 않으며, `Close`는 `WaitForFilterGoroutines`를 호출함. 전환 전에 명시적으로 `logger.WaitForFilterGoroutines(...)`를 호출해 writer가 닫힌 후에도 필터 goroutine이 접근하여 발생하는 경쟁을 회피해야 함)
- [ ] **타임아웃 설정** -- 합리적인 종료 타임아웃 설정(권장 5-10초)
- [ ] **전역 로거** -- 반복 생성 대신 `SetDefault()`로 교체

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
logger.Shutdown(ctx)
```

## 규정 준수 검사

- [ ] **HIPAA** -- 의료 산업은 `HealthcareConfig()` 사용
- [ ] **PCI-DSS** -- 금융 산업은 `FinancialConfig()` 사용
- [ ] **GDPR** -- 개인 식별 정보(PII)를 기록하지 않도록 보장
- [ ] **데이터 보존** -- 규정에 부합하는 로그 보존 기간 구성

## 모니터링 알림

- [ ] **쓰기 오류** -- `SetWriteErrorHandler`로 쓰기 실패 모니터링 구성
- [ ] **필터 goroutine** -- `ActiveFilterGoroutines()` 수량 모니터링
- [ ] **감사 통계** -- 정기적으로 감사 이벤트 통계 점검
- [ ] **오류 코드 알림** -- `PATH_TRAVERSAL`, `REDOS_PATTERN` 등 보안 오류 코드에 대해 알림

```go
logger.SetWriteErrorHandler(func(w io.Writer, err error) {
    metrics.WriteErrors.Inc()
    alert("로그 쓰기 실패: " + err.Error())
})
```

## 다음 단계

- [보안 개요](./) -- 보안 기능 총관
- [보안 필터 API](../api-reference/security-audit/security) -- 구성 레퍼런스
- [성능 최적화](../advanced/performance) -- 성능 튜닝
