---
title: "디버그 출력 - CyberGo DD | Print/JSON/Text/Exit"
description: "CyberGo DD 디버그 시각화 출력 함수 전체 API 문서. Print 포맷팅 인쇄, JSON 구조화된 출력, Text 일반 텍스트 출력, Exit 치명적 종료 등 빠른 디버그 함수를 포함하며, Logger 인스턴스를 생성할 필요 없이 패키지 수준 함수로 직접 호출할 수 있어 개발 디버그 과정을 크게 간소화합니다."
---

# 디버그 출력

DD는 개발 및 디버그 단계에서 데이터 시각화를 위한 빠른 디버그 출력 함수 세트를 제공합니다.

## 패키지 수준 디버그 함수

`dd.` 접두사로 직접 호출:

### Print 시리즈

| 함수 | 서명 | 설명 |
|------|------|------|
| `Print` | `(args ...any)` | 전역 로거의 Writer에 출력 (LevelInfo, 보안 필터링 적용) |
| `Println` | `(args ...any)` | Print와 동일 (내부 Log()가 자동 줄바꿈, 보안 필터링 적용) |
| `Printf` | `(format string, args ...any)` | 포맷팅 출력 (LevelInfo, 보안 필터링 적용) |

```go
dd.Print("값:", 42, true)
dd.Println("Print와 동일한 동작")
dd.Printf("사용자: %s, ID: %d", name, id)
```

:::tip 보안 필터링
`Print` 시리즈 함수는 민감 데이터 필터링을 거치므로, 민감 정보가 포함될 수 있는 디버그 데이터 출력에 적합합니다.
:::

### JSON 출력

| 함수 | 서명 | 설명 |
|------|------|------|
| `JSON` | `(data ...any)` | stdout에 간결한 JSON 형식 출력 (호출자 정보 포함) |
| `JSONF` | `(format string, args ...any)` | 포맷팅 문자열을 stdout에 간결한 JSON으로 출력 (호출자 정보 포함) |

```go
user := map[string]any{"name": "admin", "role": "super"}
dd.JSON(user)
// 출력: main.go:42 {"name":"admin","role":"super"}
```

:::warning 보안 필터링 미적용
`JSON`/`JSONF`는 원본 데이터를 직접 출력하며 **보안 필터링을 거치지 않습니다**. 프로덕션 환경에서 사용하지 마세요.
:::

### Text 출력

| 함수 | 서명 | 설명 |
|------|------|------|
| `Text` | `(data ...any)` | stdout에 예쁘게 인쇄된 형식 출력 |
| `Textf` | `(format string, args ...any)` | stdout에 포맷팅 텍스트 출력 |

```go
dd.Text(complexData)
dd.Textf("처리 결과: %+v", result)
```

### Exit 함수

| 함수 | 서명 | 설명 |
|------|------|------|
| `Exit` | `(data ...any)` | 호출자 정보가 포함된 텍스트 출력 후 종료 (exit code 0), 복잡한 타입은 자동 예쁘게 인쇄, 보안 필터링 미적용 |
| `Exitf` | `(format string, args ...any)` | 호출자 정보가 포함된 포맷팅 출력 후 종료 (exit code 0), 보안 필터링 미적용 |

```go
dd.Exit("디버그 중단점", someData)
// 호출자 정보가 포함된 텍스트 출력 (복잡한 타입은 자동 예쁘게 인쇄) 후 os.Exit(0) 호출
```

## Logger 메서드

Logger 인스턴스도 동일한 이름의 메서드를 제공합니다 (Exit/Exitf는 예외로, 패키지 수준 함수만 사용 가능):

```go
logger := dd.Default()

// Print 시리즈는 설정된 Writer에 기록 (보안 필터링 적용)
logger.Print("인스턴스 메서드")

// JSON/Text는 stdout에 직접 출력 (보안 필터링 미적용)
logger.JSON(data)
logger.Text(data)
```

:::warning Logger 메서드와 패키지 수준 함수의 차이
`logger.Print()`는 현재 Logger 인스턴스에 설정된 Writer를 통해 출력하고 보안 필터링을 거치며, `dd.Print()`는 전역 로거의 Writer를 통해 출력하고 보안 필터링을 거칩니다. 두 동작은 유사하지만 출력 대상이 다를 수 있습니다. `logger.JSON()`과 `logger.Text()`는 `dd.JSON()`과 `dd.Text()`와 마찬가지로 stdout에 직접 출력하며 **보안 필터링을 거치지 않습니다**.
:::

## 적용 시나리오

| 시나리오 | 권장 함수 |
|------|----------|
| 값 빠르게 출력 | `dd.Print()` |
| 구조체 확인 | `dd.JSON()` |
| 포맷팅 출력 | `dd.Text()` |
| 디버그 중단점 | `dd.Exit()` |
| 민감 정보 포함 가능 | `dd.Print()` (자동 필터링) |
| 성능 분석 데이터 | `dd.JSON()` |

:::danger 디버그 전용
이 함수들은 개발 디버그용으로 설계되었으며, **프로덕션 코드에서 사용하지 마세요**. 프로덕션 환경에서는 `Info`, `Error` 등 표준 로그 메서드를 사용하세요.
:::

## 다음 단계

- [Logger](./logger) -- Logger 디버그 메서드
- [패키지 함수](./functions) -- 전역 함수
- [테스트 보조](./recorder) -- LoggerRecorder 테스트 도구
