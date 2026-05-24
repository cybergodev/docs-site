---
title: "보안 개요 - HTML"
description: "CyberGo HTML 라이브러리 보안 보호 개요, 입력 크기 제한(기본 50MB), DOM 깊이 제한(기본 500), 경로 순회 방지, 패닉 복구 메커니즘, 처리 타임아웃 제어, 콘텐츠 정제 기능과 플러그형 감사 시스템을 포함하며, 모든 보안 위반은 errors.Is와 errors.As 오류 판별을 지원합니다."
---

# 보안 개요

HTML 라이브러리는 설계 시 보안을 최우선으로 고려하여 다층 보호 메커니즘을 내장합니다.

## 보안 기능

### 입력 크기 제한

기본 최대 입력은 50MB이며, 메모리 고갈을 방지합니다:

```go
cfg := html.DefaultConfig()
cfg.MaxInputSize = 10 * 1024 * 1024 // 10MB로 조정
```

### DOM 깊이 제한

기본 최대 깊이는 500이며, 재귀 폭탄 공격을 방지합니다:

```go
cfg.MaxDepth = 200 // 제한 강화
```

### 경로 순회 방지

파일 작업은 경로 순회 시도(예: `../../../etc/passwd`)를 자동으로 감지하고 차단하며, 감사 시스템을 통해 기록합니다.

### 패닉 복구

모든 추출 작업에는 패닉 복구 메커니즘이 내장되어 있어 `ErrInternalPanic` 오류를 반환하며, 악의적인 입력으로 인해 서비스가 중단되지 않습니다.

### 처리 타임아웃

설정 가능한 처리 타임아웃으로, 악의적인 HTML이 무한 처리를 유발하는 것을 방지합니다:

```go
cfg.ProcessingTimeout = 10 * time.Second
```

### 콘텐츠 정제

선택적 콘텐츠 정제 기능으로, 잠재적으로 악의적인 태그와 속성을 제거합니다:

```go
cfg.EnableSanitization = true
```

## 감사 시스템

자세한 보안 감사 설정은 [감사 시스템](../api-reference/audit)을 참조하세요.

감사 시스템은 다음과 같은 보안 이벤트를 기록할 수 있습니다:

| 이벤트 | 설명 |
|------|------|
| `AuditEventBlockedTag` | 차단된 HTML 태그 |
| `AuditEventBlockedAttr` | 차단된 속성 |
| `AuditEventBlockedURL` | 차단된 URL |
| `AuditEventInputViolation` | 입력 크기 위반 |
| `AuditEventDepthViolation` | DOM 깊이 위반 |
| `AuditEventPathTraversal` | 경로 순회 시도 |
| `AuditEventTimeout` | 처리 타임아웃 |
| `AuditEventEncodingIssue` | 인코딩 이상 |

## 고보안 설정

```go
cfg := html.HighSecurityConfig()
// 자동 활성화: 축소된 제한, 더 짧은 타임아웃, 전체 감사
```

## 오류 처리

모든 보안 위반은 명확한 오류를 반환하며, `errors.Is` / `errors.As` 판별을 지원합니다:

```go
result, err := html.Extract(data)
if err != nil {
    switch {
    case errors.Is(err, html.ErrInputTooLarge):
        // 기록 후 거부
    case errors.Is(err, html.ErrMaxDepthExceeded):
        // 악의적으로 구성되었을 수 있음
    case errors.Is(err, html.ErrInternalPanic):
        // 패닉 복구, 입력 확인
    }
}
```
