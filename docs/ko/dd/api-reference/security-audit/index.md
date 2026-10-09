---
sidebar_label: "개요"
title: "보안과 감사 - CyberGo DD | API 개요"
description: "CyberGo DD 보안 및 감사 API 개요. SensitiveDataFilter 민감 데이터 필터링, AuditLogger 비동기 감사 로그, IntegritySigner HMAC 무결성 서명 세 가지 핵심 컴포넌트의 역할과 관계, 적용 시나리오를 다룹니다."
sidebar_position: 1
---

# 보안과 감사

DD 의 보안 체계는 세 가지 독립적이면서도 상호 보완적인 컴포넌트로 구성되며, 데이터 마스킹부터 감사 추적까지 전체 흐름을 아우릅니다.

## 컴포넌트 개요

| 컴포넌트 | 담당 역할 | 일반적 사용 사례 |
|----------|----------|-----------------|
| [SensitiveDataFilter](./security) | 로그 내 민감 정보 자동 감지 및 마스킹 | 비밀번호, API Key, 신용카드 번호의 로그 유출 방지 |
| [AuditLogger](./audit) | 보안 관련 이벤트 비동기 기록 | 규정 준수 감사, 보안 분석, 침입 탐지 |
| [IntegritySigner](./integrity) | HMAC 서명으로 로그 변조 방지 | 로그 변조 방지, 사후 포렌식, 규정 준수 증빙 |

## 세 컴포넌트의 관계

```text
로그 기록 흐름:

  Logger.InfoWith(...)
       │
       ├─→ SensitiveDataFilter ──→ 필드 값 마스킹 (비밀번호 → [REDACTED])
       │         │
       │         └─→ AuditLogger ──→ 마스킹 이벤트 비동기 기록 (어떤 로그에서 무엇이 필터링되었는지)
       │
       └─→ 포맷 출력

  AuditLogger (선택적 IntegritySigner) ──→ 감사 이벤트 HMAC 서명 (변조 방지)
```

- **SensitiveDataFilter** 는 로그 기록 **전**에 민감 데이터를 가로챕니다
- **AuditLogger** 는 보안 이벤트를 비동기로 기록하여 주 로그 성능에 영향을 주지 않습니다
- **IntegritySigner** 는 일반 로그 쓰기 경로에 연결되지 **않습니다**: 오직 **감사 이벤트**에만 서명하며 (`AuditConfig.IntegritySigner`로 연결), 또는 사용자가 `Sign`/`SignFields`로 임의 내용에 수동 서명합니다

## 빠른 선택

| 요구사항 | 추천 컴포넌트 |
|----------|-------------|
| 비밀번호/키 유출 방지 | [SensitiveDataFilter](./security) |
| 누가 언제 무엇을 했는지 기록 | [AuditLogger](./audit) |
| 로그가 변조되지 않았는지 보장 | [IntegritySigner](./integrity) |
| HIPAA/PCI-DSS 규정 준수 | 세 가지 모두 함께 사용 — [업계 규정 준수 구성](../../guides/security/compliance) 참조 |

## 관련 가이드

- [민감 데이터 필터링](../../guides/security/sensitive-filtering) -- 자동 마스킹 구성 튜토리얼
- [감사 로그](../../guides/security/audit-logging) -- 보안 감사 실전 가이드
- [HMAC 서명 실전](../../guides/security/integrity) -- 무결성 서명 심화
- [업계 규정 준수 구성](../../guides/security/compliance) -- HIPAA/PCI-DSS 사전 설정
- [프로덕션 체크리스트](../../guides/security/production-checklist) -- 출시 전 보안 점검

## 다음 단계

- [보안 필터링](./security) -- SensitiveDataFilter 전체 API
- [감사 로그](./audit) -- AuditLogger 전체 API
- [무결성 서명](./integrity) -- IntegritySigner 전체 API
