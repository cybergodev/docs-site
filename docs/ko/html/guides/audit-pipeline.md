---
title: "감사 시스템 실전 - HTML"
description: "CyberGo HTML 감사 시스템 실전 가이드, 기본 활성화부터 다층 감사 파이프라인 구축까지, 감사 이벤트 유형 상세 설명, 내장 Sink 선택 비교, LevelFilteredSink 레벨 필터링, 커스텀 Sink 구현, FilteredSink 이벤트 필터링, 프로덕션 환경 감사 모니터링 모범 사례를 포함합니다."
---

# 감사 시스템 실전

감사 시스템은 HTML 처리 과정에서 보안 이벤트를 기록하여, 잠재적 위험을 모니터링하고 해결하는 데 도움을 줍니다.

## 빠른 활성화

3줄의 코드로 감사를 활성화하는 가장 간단한 설정:

```go
cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true

p, _ := html.New(cfg)
defer p.Close()
```

활성화하면 보안 이벤트가 `[AUDIT] JSON` 형식으로 표준 오류에 출력됩니다.

## 감사 이벤트 유형

| 이벤트 | 상수 | 레벨 | 트리거 조건 |
|------|------|------|----------|
| 태그 차단 | `blocked_tag` | warning | 위험한 태그가 제거됨(예: `<script>`) |
| 속성 차단 | `blocked_attr` | warning | 위험한 속성이 제거됨(예: `onclick`) |
| URL 차단 | `blocked_url` | warning | 위험한 URL이 차단됨 |
| 입력 위반 | `input_violation` | critical | 입력이 크기 제한을 초과함 |
| 깊이 위반 | `depth_violation` | warning | DOM 중첩이 제한을 초과함 |
| 처리 타임아웃 | `timeout` | warning | 단일 처리가 타임아웃됨 |
| 인코딩 문제 | `encoding_issue` | info | 인코딩 감지 실패 |
| 경로 순회 | `path_traversal` | critical | 파일 경로에 `..` 포함 |

## 감사 레벨

```text
info < warning < critical
```

- **info**: 정보성 이벤트(인코딩 문제), 알림 불필요
- **warning**: 주의가 필요한 이상(타임아웃, 깊이 위반)
- **critical**: 보안 위협(입력 위반, 경로 순회)

## 내장 Sink 타입

### LoggerAuditSink(기본값)

`[AUDIT]` 접두사와 함께 표준 오류로 출력:

```go
// 기본적으로 stderr로 출력
sink := html.NewLoggerAuditSink()

// 커스텀 Writer로 출력
sink := html.NewLoggerAuditSinkWithWriter(os.Stdout)
```

### WriterAuditSink

JSON Lines를 `io.Writer`에 쓰며, 파일 영구 저장에 적합:

```go
file, _ := os.Create("audit.jsonl")
defer file.Close()

sink := html.NewWriterAuditSink(file)
```

출력 형식(줄당 하나의 JSON):

```json
{"timestamp":"2026-04-30T10:00:00Z","event_type":"blocked_tag","level":"warning","message":"Blocked dangerous HTML tag: script","tag":"script"}
```

### ChannelAuditSink

채널로 비동기 전송, 외부 시스템 통합에 적합:

```go
sink := html.NewChannelAuditSink(100)

// 감사 이벤트 소비
go func() {
    for entry := range sink.Channel() {
        sendToSIEM(entry)
    }
}()

// 유실된 이벤트 확인(채널이 가득 차면 자동 폐기)
fmt.Printf("폐기됨: %d\n", sink.DroppedCount())
```

### MultiSink

여러 Sink로 팬아웃:

```go
sink := html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)
```

### FilteredSink

조건으로 이벤트 필터링:

```go
// critical 레벨 이벤트만 기록
sink := html.NewFilteredSink(
    fileSink,
    func(e html.AuditEntry) bool {
        return e.Level == html.AuditLevelCritical
    },
)
```

### LevelFilteredSink

최소 레벨로 필터링:

```go
// warning 이상만 기록
sink := html.NewLevelFilteredSink(fileSink, html.AuditLevelWarning)
```

## 감사 파이프라인 구축

### 시나리오 1: 파일 영구 저장

```go
func newAuditPipeline() html.AuditSink {
    file, _ := os.OpenFile("audit.jsonl", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    return html.NewWriterAuditSink(file)
}

cfg := html.DefaultConfig()
cfg.Audit = html.DefaultAuditConfig()
cfg.Audit.Enabled = true
cfg.Audit.Sink = newAuditPipeline()
```

### 시나리오 2: 계층별 라우팅

critical 이벤트는 알림 시스템으로, 나머지 이벤트는 파일에 기록:

```go
func newTieredPipeline() html.AuditSink {
    file, _ := os.Create("audit.jsonl")

    return html.NewMultiSink(
        // 모든 이벤트를 파일에 기록
        html.NewWriterAuditSink(file),
        // critical 이벤트만 추가로 알림 전송
        html.NewFilteredSink(
            html.NewChannelAuditSink(50),
            func(e html.AuditEntry) bool {
                return e.Level == html.AuditLevelCritical
            },
        ),
    )
}
```

### 시나리오 3: 고보안 모드

`HighSecurityConfig`와 `HighSecurityAuditConfig` 사용:

```go
cfg := html.HighSecurityConfig()
cfg.Audit = html.HighSecurityAuditConfig()
cfg.Audit.Sink = html.NewMultiSink(
    html.NewWriterAuditSink(file),
    html.NewLoggerAuditSink(),
)

p, _ := html.New(cfg)
```

고보안 모드의 감사 특징:
- 감사 자동 활성화
- 모든 이벤트 유형 기록
- 원시 값 포함(`IncludeRawValues = true`), 포렌식 분석에 편리
- 원시 값 최대 길이 500자

## 감사 로그 조회

Processor 메서드를 통해 수집된 이벤트를 조회합니다:

```go
p, _ := html.New(cfg)
defer p.Close()

// 콘텐츠 처리
p.Extract(data)

// 감사 로그 가져오기
entries := p.GetAuditLog()
for _, entry := range entries {
    fmt.Printf("[%s] %s: %s\n", entry.Level, entry.EventType, entry.Message)
}

// 로그 지우기
p.ClearAuditLog()
```

:::tip 메모리 내 로그는 Processor 인스턴스에만 해당
`GetAuditLog()`는 Processor 메모리에 수집된 이벤트를 반환합니다. 영구 저장이 필요하면 Sink를 설정하세요.
:::

## 커스텀 Sink

`AuditSink` 인터페이스를 구현하여 감사 이벤트를 원하는 대상으로 전송:

```go
type slackSink struct {
    webhook string
}

func (s *slackSink) Write(entry html.AuditEntry) {
    if entry.Level != html.AuditLevelCritical {
        return // critical만 전송
    }
    msg := fmt.Sprintf("[AUDIT] %s: %s", entry.EventType, entry.Message)
    http.Post(s.webhook, "text/plain", strings.NewReader(msg))
}

func (s *slackSink) Close() error {
    return nil
}
```

## 다음 단계

- [API 레퍼런스: 감사 시스템](../api-reference/audit) - 전체 API 시그니처
- [보안](../security/) - 보안 기능 개요
- [프로덕션 체크리스트](../security/production-checklist) - 배포 전 확인
