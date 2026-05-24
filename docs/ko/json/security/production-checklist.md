---
title: "프로덕션 체크리스트 - CyberGo JSON | 보안 배포"
description: "CyberGo JSON 프로덕션 환경 보안 배포 체크리스트: 보안 설정 SecurityConfig, MaxNestingDepthSecurity 리소스 제한, 입력 검증 전략, 오류 처리 메커니즘, 모니터링 알림 설정 및 성능과 보안 균형의 모범 사례를 다루어 프로덕션 환경의 안전성과 신뢰성을 보장합니다."
---

# 프로덕션 체크리스트

프로덕션 환경에 배포하기 전에 다음 보안 항목을 확인하세요.

## 설정 확인

### 리소스 제한

- [ ] `MaxNestingDepthSecurity` 설정으로 깊은 중첩 공격 방지
- [ ] `MaxJSONSize` 설정으로 단일 값 크기 제한
- [ ] `MaxMemory` 설정으로 전체 메모리 사용량 제한

```go
cfg := json.DefaultConfig()
cfg.MaxNestingDepthSecurity = 50
cfg.MaxJSONSize = 10 * 1024 * 1024
cfg.MaxMemory = 100 * 1024 * 1024
```

## 입력 검증

### 필수 필드

- [ ] 모든 필수 필드가 존재하는지 확인
- [ ] 필드 타입이 올바른지 확인

```go
// 커스텀 검증기 예제
type RequiredFieldValidator struct{}

func (v *RequiredFieldValidator) Validate(jsonStr string) error {
    // 필수 필드 존재 여부 확인
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}
```

### 형식 검증

- [ ] 이메일 형식 검증
- [ ] URL 형식 검증
- [ ] 커스텀 형식 검증

```go
// 커스텀 형식 검증기
type EmailValidator struct{}

func (v *EmailValidator) Validate(jsonStr string) error {
    var data map[string]any
    if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
        return nil
    }
    email, _ := data["email"].(string)
    matched, _ := regexp.MatchString(`^\w+@\w+\.\w+$`, email)
    if !matched {
        return errors.New("invalid email format")
    }
    return nil
}

cfg := json.DefaultConfig()
cfg.CustomValidators = append(cfg.CustomValidators, &EmailValidator{})
```

### 범위 검증

- [ ] 숫자 범위 검증
- [ ] 문자열 길이 검증
- [ ] 배열 길이 검증

```go
// Schema를 사용한 범위 검증
schema := &json.Schema{
    Type: "object",
    Properties: map[string]*json.Schema{
        "age":  {Type: "number", Minimum: 0, Maximum: 100},
        "name": {Type: "string", MinLength: 1, MaxLength: 255},
    },
}
```

## 민감 데이터 처리

### 민감 필드 필터링

- [ ] 비밀번호 필터링
- [ ] 토큰 필터링
- [ ] 기타 민감 데이터 필터링

```go
// Hook으로 민감 필드 필터링
type SensitiveFilterHook struct {
    fields map[string]bool
}

func (h *SensitiveFilterHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *SensitiveFilterHook) After(ctx json.HookContext, result any, err error) (any, error) {
    if m, ok := result.(map[string]any); ok {
        for field := range h.fields {
            delete(m, field)
        }
    }
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&SensitiveFilterHook{fields: map[string]bool{
    "password": true,
    "token":    true,
    "api_key":  true,
    "secret":   true,
}})
```

### 로그 마스킹

- [ ] 로그에 민감 데이터를 기록하지 않음
- [ ] 오류 메시지에 민감 정보를 포함하지 않음

## 오류 처리

### 안전한 오류 응답

- [ ] 내부 오류 세부 정보 노출 금지
- [ ] 일반적인 오류 메시지 사용
- [ ] 상세 오류를 로그에 기록

```go
if err != nil {
    log.Error("상세 오류", "error", err)
    return errors.New("작업 실패, 잠시 후 다시 시도해 주세요")
}
```

## 모니터링 및 감사

### 성능 모니터링

- [ ] 파싱 시간 모니터링
- [ ] 메모리 사용량 모니터링
- [ ] 알림 임계값 설정

```go
// Hook으로 성능 모니터링
type MetricsHook struct{}

func (h *MetricsHook) Before(ctx json.HookContext) error {
    return nil
}

func (h *MetricsHook) After(ctx json.HookContext, result any, err error) (any, error) {
    log.Info("operation", "op", ctx.Operation)
    return result, err
}

cfg := json.DefaultConfig()
cfg.AddHook(&MetricsHook{})
```

### 감사 로그

- [ ] 핵심 작업 기록
- [ ] 비정상 입력 기록
- [ ] 정기 로그 검토

## 테스트 커버리지

### 보안 테스트

- [ ] 깊은 중첩 테스트
- [ ] 대용량 파일 처리 테스트
- [ ] 잘못된 입력 테스트
- [ ] 경계 조건 테스트

### 성능 테스트

- [ ] 동시성 처리 테스트
- [ ] 대용량 데이터 테스트
- [ ] 메모리 누수 테스트

## 빠른 확인 명령

```bash
# 민감 필드 확인
grep -r "password\|token\|secret" --include="*.go"

# 하드코딩된 설정 확인
grep -r "MaxNestingDepthSecurity\|MaxMemory" --include="*.go"

# 보안 테스트 실행
go test -run Security ./...
```

## 체크리스트 템플릿

```go
// 프로덕션 설정 템플릿
func ProductionConfig() json.Config {
    cfg := json.SecurityConfig()

    // 리소스 제한 (SecurityConfig에 보안 기본값이 미리 설정됨)
    cfg.MaxMemory = 100 * 1024 * 1024

    // 커스텀 검증기
    cfg.CustomValidators = []json.Validator{&RequiredFieldValidator{}}

    // 감사 Hook
    cfg.Hooks = []json.Hook{&AuditHook{logger: prodLogger}}

    return cfg
}
```

## 관련 문서

- [보안 개요](./)
- [Config 설정](../api-reference/config)
