---
sidebar_label: "빠른 시작"
title: "빠른 시작 - CyberGo DD | 5분 입문 가이드"
description: "고성능 구조화 로그 라이브러리 CyberGo DD의 완전한 입문 튜토리얼입니다. 의존성 설치부터 첫 로그 출력까지, 로거 생성, 출력 대상 및 파일 로테이션 정책 구성, 구조화 필드로 요청 컨텍스트 정보 기록, 훅 시스템 확장까지 단계별로 학습합니다. 5분이면 핵심 사용법을 익혀 실제 프로젝트에 적용할 수 있습니다."
sidebar_position: 1
---

# 빠른 시작

## 1. 로거 생성

DD는 다양한 시나리오 요구를 충족하는 여러 편의 생성자를 제공합니다.

```go
package main

import (
    "log"

    "github.com/cybergodev/dd"
)

func main() {
    // 방법 1: 기본 전역 로거(제로 구성)
    dd.Info("전역 로거 사용")

    // 방법 2: 개발 모드(DEBUG 레벨, caller 포함)
    dev, err := dd.New(dd.DevelopmentConfig())
    if err != nil {
        log.Fatal(err)
    }
    defer dev.Close()
    dev.Info("개발 모드 출력")

    // 방법 3: 파일 출력
    file, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    if err != nil {
        log.Fatal(err)
    }
    defer file.Close()
    file.Info("파일 출력")

    // 방법 4: 콘솔과 파일에 동시 출력
    all, err := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer all.Close()
    all.Info("이중 대상 출력")

    // 방법 5: JSON 형식 이중 대상 출력
    jsonLogger, err := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    defer jsonLogger.Close()
    jsonLogger.Info("JSON 형식 출력")
}
```

:::warning 경고 제로값 Config 함정
위 방법 3/4/5는 `dd.Config{...}` 리터럴을 직접 사용해 `Targets`/`Format`만 명시적으로 설정했을 뿐, 나머지 필드는 제로값을 유지합니다. `Level=Debug`(필터링 없음), `IncludeTime=false`(타임스탬프 없음), `IncludeLevel=false`(레벨 없음), `DynamicCaller=false`(caller 없음), `Security=nil`(`DefaultSecurityConfig()` 기본 필터로 폴백, 약 36종의 마스킹은 여전히 활성화됨; 완전히 끄려면 `&dd.SecurityConfig{}` 또는 `SecurityLevelDevelopment` 명시 필요). 출력에 타임스탬프와 레벨 같은 핵심 정보가 누락됩니다.

**프로덕션 권장**: `dd.DefaultConfig()`를 기반으로 필드를 수정하면 타임스탬프, 레벨, caller, 기본 보안 필터를 한 번에 얻을 수 있습니다.

```go
cfg := dd.DefaultConfig()                 // Level=Info, Format=Text, 시간/레벨/caller/Security 포함
cfg.Targets = []dd.OutputTarget{dd.FileOutput("logs/app.log")}
logger, err := dd.New(cfg)
```

마찬가지로 `dd.DevelopmentConfig()`(DEBUG+caller)와 `dd.JSONConfig()`(DEBUG+JSON+RFC3339)도 완전한 필드 집합이 사전 설정된 편의 시작점입니다.
:::

## 2. 로그 레벨

DD는 낮은 것부터 높은 순으로 5개의 로그 레벨을 지원합니다.

```go
dd.Debug("디버그 정보")   // LevelDebug
dd.Info("일반 정보")      // LevelInfo(기본)
dd.Warn("경고 정보")      // LevelWarn
dd.Error("오류 정보")     // LevelError
dd.Fatal("치명적 오류")   // LevelFatal(os.Exit 호출)
```

포맷팅 버전:

```go
dd.Debugf("사용자 %s 로그인, 소요 시간 %dms", name, elapsed)
dd.Infof("요청 처리 완료: status=%d", status)
dd.Warnf("연결 풀 사용률 %d%%", usage)
dd.Errorf("데이터베이스 쿼리 실패: %v", err)
```

## 3. 구조화 로그

타입 안전한 필드 생성자를 사용합니다.

```go
dd.InfoWith("요청 처리 완료",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

출력 예(기본 텍스트 형식):

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 요청 처리 완료 method=GET path=/api/users status=200 elapsed=150ms
```

:::tip 팁 JSON 형식 출력
기본 전역 로거는 텍스트 형식을 사용합니다. JSON 형식 출력이 필요하면 `dd.New(dd.JSONConfig())`로 JSON 형식 로거를 생성하세요.
:::

## 4. 필드 체인 전달

```go
// 사전 설정 필드를 가진 Entry 생성
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// 매 로그마다 사전 설정 필드 자동 포함
requestLogger.Info("서비스 시작")
requestLogger.InfoWith("라우트 등록 완료",
    dd.Int("routes", 42),
)
```

## 5. 파일 로테이션

`FileWriter`로 로테이션 정책을 구성합니다.

```go
// 기본값 100MB, 30일, 10개 백업
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, err := dd.NewFileWriter("logs/app.log", fwCfg)
if err != nil {
    log.Fatal(err)
}
logger, err := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

logger.Info("hello world")
```

## 6. 민감 데이터 필터링

DD는 기본적으로 기본 민감 데이터 필터링이 활성화됩니다(비밀번호, API Key, 신용카드 번호 등 자동 마스킹).

```go
// 기본 구성에는 기본 보안 필터가 포함되어 있습니다
logger, err := dd.New(dd.DefaultConfig())
if err != nil {
    log.Fatal(err)
}
defer logger.Close()

// 비밀번호 필드 자동 마스킹
logger.InfoWith("사용자 로그인",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 출력: [REDACTED]
)
```

## 다음 단계

- [핵심 개념](../guides/core-concepts) -- Logger 체계와 처리 파이프라인 이해
- [구조화 로그](../guides/structured-logging) -- 필드 사용 상세
- [파일 출력과 로테이션](../guides/file-output) -- FileWriter 상세
- [민감 데이터 필터링](../guides/sensitive-filtering) -- 보안 필터 실전
- [치트시트](./cheatsheet) -- 자주 사용하는 API 빠른 참조
