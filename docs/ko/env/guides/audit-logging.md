---
title: "감사 로그 - CyberGo env | 보안 감사 구성"
description: "CyberGo env 라이브러리 감사 로그 완전 구성 가이드, JSON 파일 핸들러, 표준 로그 핸들러 및 채널 핸들러의 생성과 구성 방법을 다루며, 커스텀 AuditHandler 인터페이스를 구현하여 감사 로직을 확장하는 방법을 소개하고, 모든 환경 변수의 로딩, 읽기, 수정, 삭제 작업을 기록하여 보안 규정 준수 검사 및 프로덕션 환경 문제 해결 요구를 충족합니다."
---

# 감사 로그

감사 로그 기능은 모든 환경 변수 작업을 기록하여 보안 감사, 규정 준수 검사 및 문제 해결에 사용됩니다.

## 감사 활성화

### 구성으로 활성화

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### 구성 프리셋

| 프리셋 | 감사 상태 |
|------|----------|
| `DefaultConfig()` | 비활성화 |
| `DevelopmentConfig()` | 비활성화 |
| `TestingConfig()` | 비활성화 |
| `ProductionConfig()` | 활성화 |

---

## 감사 핸들러

### JSONAuditHandler

JSON 형식 로그 출력:

```go
import (
    "os"
    "github.com/cybergodev/env"
)

cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)
```

**출력 예시:**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"get","key":"API_KEY","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

---

### LogAuditHandler

표준 log 패키지 사용 출력:

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**출력 예시:**

```text
[AUDIT] 2024/01/15 10:30:00 load .env (1.23ms)
[AUDIT] 2024/01/15 10:30:01 get API_KEY (masked)
[AUDIT] 2024/01/15 10:30:02 set CUSTOM_VAR
```

---

### ChannelAuditHandler

채널로 비동기 처리:

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 비동기 감사 이벤트 처리
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**사용 시나리오:**
- 원격 로그 서비스 전송
- 데이터베이스 기록
- 실시간 모니터링 알림

---

### NopAuditHandler

아무 작업도 수행하지 않는 핸들러, 모든 이벤트 폐기:

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**사용 시나리오:**
- 일시적으로 감사 비활성화
- 테스트 환경

---

## 감사 이벤트

### AuditEvent 구조체

```go
type AuditEvent struct {
    Timestamp time.Time   // 타임스탬프
    Action    AuditAction // 작업 유형
    Key       string      // 키 이름
    File      string      // 파일 이름
    Reason    string      // 사유
    Success   bool        // 성공 여부
    Masked    bool        // 마스킹 여부
    Details   string      // 상세 정보
    Duration  int64       // 소요 시간 (나노초)
}
```

### AuditAction 작업 유형

| 상수 | 값 | 설명 |
|------|---|------|
| `ActionLoad` | `load` | 파일 로딩 |
| `ActionParse` | `parse` | 파싱 작업 |
| `ActionGet` | `get` | 변수 읽기 |
| `ActionSet` | `set` | 변수 설정 |
| `ActionDelete` | `delete` | 변수 삭제 |
| `ActionValidate` | `validate` | 검증 작업 |
| `ActionExpand` | `expand` | 변수 확장 |
| `ActionSecurity` | `security` | 보안 이벤트 |
| `ActionError` | `error` | 오류 이벤트 |
| `ActionFileAccess` | `file_access` | 파일 접근 |

---

## 커스텀 핸들러

### FullAuditLogger 인터페이스 구현

`FullAuditLogger`는 최소 인터페이스 `AuditLogger`(`LogError` 메서드만 포함)를 확장한 완전한 감사 로그 인터페이스입니다:

```go
type FullAuditLogger interface {
    AuditLogger  // 최소 인터페이스 임베딩 (LogError)
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### 예시: 데이터베이스 감사 핸들러

```go
package myhandler

import (
    "database/sql"
    "time"
    "github.com/cybergodev/env"
)

type DatabaseAuditHandler struct {
    db *sql.DB
}

func NewDatabaseAuditHandler(db *sql.DB) *DatabaseAuditHandler {
    return &DatabaseAuditHandler{db: db}
}

func (h *DatabaseAuditHandler) Log(action env.AuditAction, key, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success)
        VALUES (?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogError(action env.AuditAction, key, errMsg string) error {
    return h.Log(action, key, errMsg, false)
}

func (h *DatabaseAuditHandler) LogWithFile(action env.AuditAction, key, file, reason string, success bool) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, file, reason, success)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, file, reason, success)
    return err
}

func (h *DatabaseAuditHandler) LogWithDuration(action env.AuditAction, key, reason string, success bool, duration time.Duration) error {
    _, err := h.db.Exec(`
        INSERT INTO audit_log (timestamp, action, key, reason, success, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
    `, time.Now(), string(action), key, reason, success, duration.Milliseconds())
    return err
}

func (h *DatabaseAuditHandler) Close() error {
    return nil
}
```

---

## 전체 예시

### 프로덕션 환경 구성

```go
package main

import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 감사 로그 파일 생성
    auditFile, err := os.OpenFile("/var/log/app/env-audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    if err != nil {
        log.Fatal(err)
    }
    defer auditFile.Close()

    // 구성
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewJSONAuditHandler(auditFile)
    cfg.RequiredKeys = []string{"DB_HOST", "API_KEY"}

    // 로더 생성
    loader, err := env.New(cfg)
    if err != nil {
        log.Fatal(err)
    }
    defer loader.Close()

    // 설정 로딩
    err = loader.LoadFiles(".env")
    if err != nil {
        log.Fatal(err)
    }

    // 검증
    err = loader.Validate()
    if err != nil {
        log.Fatal(err)
    }

    // 설정 사용
    log.Println("Configuration loaded successfully")
}
```

### 비동기 감사 처리

```go
package main

import (
    "encoding/json"
    "log"
    "os"
    "github.com/cybergodev/env"
)

func main() {
    // 감사 이벤트 채널 생성
    auditChan := make(chan env.AuditEvent, 1000)

    // 비동기 프로세서 시작
    go processAuditEvents(auditChan)

    // 구성
    cfg := env.ProductionConfig()
    cfg.AuditEnabled = true
    cfg.AuditHandler = env.NewChannelAuditHandler(auditChan)

    loader, _ := env.New(cfg)
    defer loader.Close()

    // 정상 사용...
}

func processAuditEvents(ch chan env.AuditEvent) {
    file, _ := os.OpenFile("/var/log/app/audit.log",
        os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
    defer file.Close()

    encoder := json.NewEncoder(file)

    for event := range ch {
        // 필터링, 집계 등 로직 추가 가능
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## 보안 주의 사항

### 민감 값 자동 마스킹

감사 로그는 민감한 키의 값을 자동으로 마스킹합니다:

```go
// 민감 값 가져오기 시 자동 마스킹
secret := loader.GetSecure("API_KEY")
// 감사 기록: {"action":"get","key":"API_KEY","masked":true}
```

### 감사 로그 권한

```bash
# 감사 로그 파일 권한 설정
chmod 600 /var/log/app/env-audit.log

# 애플리케이션 사용자만 읽기/쓰기 가능하도록 설정
chown app:app /var/log/app/env-audit.log
```

### 로그 순환

logrotate를 사용하여 감사 로그를 관리하는 것이 좋습니다:

```bash
# /etc/logrotate.d/app-env-audit
/var/log/app/env-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 app app
}
```

---

## 관련 문서

- [보안 개요](/ko/env/security/) - 보안 아키텍처 및 핵심 기능
- [프로덕션 체크리스트](/ko/env/security/production-checklist) - 감사 구성 확인
- [인터페이스 정의](/ko/env/api-reference/interfaces) - AuditLogger 인터페이스
- [컴포넌트 팩토리](/ko/env/api-reference/factory) - 감사 핸들러 팩토리
