---
title: 감사 로그 - CyberGo env | 보안 감사 설정
description: CyberGo env 라이브러리 감사 로그 설정 및 사용 완전 가이드입니다. 내장 JSON 파일 처리기, 표준 로그 처리기 및 Channel 처리기의 구성 방법과 커스텀 AuditHandler 감사 처리기 확장 개발을 다루며, 모든 환경 변수 작업을 기록하여 Go 애플리케이션 보안 규정 준수 검사 및 실행 문제 해결에 활용합니다.
---

# 감사 로그

감사 로그 기능은 모든 환경 변수 작업을 기록하여 보안 감사, 규정 준수 검사 및 문제 해결에 사용됩니다.

## 감사 활성화

### 설정 활성화

```go
cfg := env.ProductionConfig()
cfg.AuditEnabled = true
cfg.AuditHandler = env.NewJSONAuditHandler(os.Stdout)

loader, _ := env.New(cfg)
```

### 설정 프리셋

| 프리셋 | 감사 상태 |
|------|----------|
| `DefaultConfig()` | 비활성화 |
| `DevelopmentConfig()` | 비활성화 |
| `TestingConfig()` | 비활성화 |
| `ProductionConfig()` | 활성화 |

---

## 감사 처리기

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

**출력예제：**

```json
{"timestamp":"2024-01-15T10:30:00Z","action":"load","file":".env","success":true,"duration":1234567}
{"timestamp":"2024-01-15T10:30:01Z","action":"get","key":"API_KEY","success":true,"masked":true}
{"timestamp":"2024-01-15T10:30:02Z","action":"set","key":"CUSTOM_VAR","success":true}
```

---

### LogAuditHandler

표준 log 패키지로 출력:

```go
import (
    "log"
    "os"
    "github.com/cybergodev/env"
)

logger := log.New(os.Stderr, "[AUDIT] ", log.LstdFlags)
cfg.AuditHandler = env.NewLogAuditHandler(logger)
```

**출력예제：**

```text
[AUDIT] 2024/01/15 10:30:00 load .env (1.23ms)
[AUDIT] 2024/01/15 10:30:01 get API_KEY (masked)
[AUDIT] 2024/01/15 10:30:02 set CUSTOM_VAR
```

---

### ChannelAuditHandler

채널로 비동기 처리를 위해 전송:

```go
ch := make(chan env.AuditEvent, 100)
cfg.AuditHandler = env.NewChannelAuditHandler(ch)

// 비동기 처리감사이벤트
go func() {
    for event := range ch {
        processAuditEvent(event)
    }
}()
```

**사용 시나리오：**
- 원격 로그 서비스로 전송
- 데이터베이스에 기록
- 실시간 모니터링 알림

---

### NopAuditHandler

빈 작업 처리기, 모든 이벤트 폐기:

```go
cfg.AuditHandler = env.NewNopAuditHandler()
```

**사용 시나리오：**
- 임시로 감사 비활성화
- 테스트 환경

---

## 감사이벤트

### AuditEvent 구조

```go
type AuditEvent struct {
    Timestamp time.Time   // 타임스탬프
    Action    AuditAction // 작업타입
    Key       string      // 키 이름
    File      string      // 파일 이름
    Reason    string      // 원인
    Success   bool        // 성공 여부
    Masked    bool        // 마스크 여부
    Details   string      // 상세 정보
    Duration  int64       // 소요 시간 (나노초)
}
```

### AuditAction 작업타입

| 상수 | 값 | 설명 |
|------|---|------|
| `ActionLoad` | `load` | 파일로드 |
| `ActionParse` | `parse` | 파싱작업 |
| `ActionGet` | `get` | 변수읽기 |
| `ActionSet` | `set` | 변수설정 |
| `ActionDelete` | `delete` | 변수삭제 |
| `ActionValidate` | `validate` | 검증작업 |
| `ActionExpand` | `expand` | 변수확장 |
| `ActionSecurity` | `security` | 안전이벤트 |
| `ActionError` | `error` | 잘못됨이벤트 |
| `ActionFileAccess` | `file_access` | 파일접근 |

---

## 커스텀 처리기

### 구현 FullAuditLogger 인터페이스

`FullAuditLogger`는 완전한 감사 로그 인터페이스로, 최소 인터페이스 `AuditLogger`(`LogError` 메서드만 포함)를 확장합니다:

```go
type FullAuditLogger interface {
    AuditLogger  // 최소 인터페이스 포함 (LogError)
    Log(action AuditAction, key, reason string, success bool) error
    LogWithFile(action AuditAction, key, file, reason string, success bool) error
    LogWithDuration(action AuditAction, key, reason string, success bool, duration time.Duration) error
    Close() error
}
```

### 예제: 데이터베이스 감사 처리기

```go
package main

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

## 완전한 예제

### 프로덕션 환경 설정

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

    // 설정
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

    // 설정 로드
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
    // 생성감사이벤트채널
    auditChan := make(chan env.AuditEvent, 1000)

    // 비동기 처리기 시작
    go processAuditEvents(auditChan)

    // 설정
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
        // 필터, 집계 등 논리를 추가할 수 있음
        if event.Action == env.ActionError {
            log.Printf("Audit error: %+v", event)
        }

        encoder.Encode(event)
    }
}
```

---

## 보안 주의사항

### 민감 값 자동 마스크

감사 로그는 민감 키의 값을 자동으로 마스크합니다:

```go
// 민감 값 가져올 때 자동 마스크
secret := loader.GetSecure("API_KEY")
// 감사기록: {"action":"get","key":"API_KEY","masked":true}
```

### 감사 로그권한

```bash
# 감사 로그 파일 권한 설정
chmod 600 /var/log/app/env-audit.log

# 애플리케이션 사용자만 읽기/쓰기 가능한지 확인
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

- [보안 개요](/ko/env/security/) - 보안 아키텍처와 핵심 기능
- [프로덕션검사체크리스트](/ko/env/security/production-checklist) - 감사설정검사
- [인터페이스정의](/ko/env/api-reference/interfaces) - AuditLogger 인터페이스
- [컴포넌트 팩토리](/ko/env/api-reference/factory) - 감사 처리기 팩토리
