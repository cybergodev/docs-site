---
title: "빠른 시작 - CyberGo DD | 5분 입문 가이드"
description: "CyberGo DD 고성능 구조화된 로그 라이브러리 빠른 시작 가이드. 의존성 설치부터 첫 로그 출력까지, 로거 생성, 출력 대상 및 파일 순환 전략 구성, 구조화된 필드로 요청 컨텍스트 정보 기록 및 훅 시스템 확장 기능 사용법을 단계별로 학습합니다. 5분이면 핵심 사용법을 마스터하고 실제 프로젝트에 적용할 수 있습니다."
---

# 빠른 시작

## 1. 로거 생성

DD는 다양한 시나리오를 충족하는 여러 편의 생성자를 제공합니다:

```go
package main

import (
    "github.com/cybergodev/dd"
)

func main() {
    // 방법 1: 기본 전역 로거 (제로 설정)
    dd.Info("전역 로거 사용")

    // 방법 2: 개발 모드 (DEBUG 레벨, caller 포함)
    dev, _ := dd.New(dd.DevelopmentConfig())
    defer dev.Close()
    dev.Info("개발 모드 출력")

    // 방법 3: 파일 출력
    file, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{dd.FileOutput("logs/app.log")},
    })
    defer file.Close()
    file.Info("파일 출력")

    // 방법 4: 콘솔과 파일 동시 출력
    all, _ := dd.New(dd.Config{
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.log"),
        },
    })
    defer all.Close()
    all.Info("이중 대상 출력")

    // 방법 5: JSON 형식 이중 대상 출력
    jsonLogger, _ := dd.New(dd.Config{
        Format: dd.FormatJSON,
        Targets: []dd.OutputTarget{
            dd.ConsoleOutput(),
            dd.FileOutput("logs/app.json"),
        },
    })
    defer jsonLogger.Close()
    jsonLogger.Info("JSON 형식 출력")
}
```

## 2. 로그 레벨

DD는 낮은 순서부터 높은 순서로 5개의 로그 레벨을 지원합니다:

```go
dd.Debug("디버그 정보")   // LevelDebug
dd.Info("일반 정보")    // LevelInfo (기본값)
dd.Warn("경고 정보")    // LevelWarn
dd.Error("오류 정보")   // LevelError
dd.Fatal("치명적 오류")   // LevelFatal (os.Exit 호출)
```

포맷팅 버전:

```go
dd.Debugf("사용자 %s 로그인, 소요 시간 %dms", name, elapsed)
dd.Infof("요청 처리 완료: status=%d", status)
dd.Warnf("연결 풀 사용률 %d%%", usage)
dd.Errorf("데이터베이스 쿼리 실패: %v", err)
```

## 3. 구조화된 로그

타입 안전한 필드 생성자 사용:

```go
dd.InfoWith("요청 처리 완료",
    dd.String("method", "GET"),
    dd.String("path", "/api/users"),
    dd.Int("status", 200),
    dd.Duration("elapsed", 150*time.Millisecond),
)
```

출력 예시 (기본 텍스트 형식):

```text
[2026-04-16T21:16:48+08:00   INFO] main.go:13 요청 처리 완료 method=GET path=/api/users status=200 elapsed=150ms
```

:::tip JSON 형식 출력
기본 전역 로거는 텍스트 형식을 사용합니다. JSON 형식 출력이 필요한 경우 `dd.New(dd.JSONConfig())`로 JSON 형식 로거를 생성하세요.
:::

## 4. 필드 체인 전달

```go
// 사전 설정된 필드가 있는 Entry 생성
requestLogger := dd.WithFields(
    dd.String("service", "api-gateway"),
    dd.String("version", "1.0.0"),
)

// 매번 로그에 사전 설정 필드가 자동 포함
requestLogger.Info("서비스 시작")
requestLogger.InfoWith("라우트 등록 완료",
    dd.Int("routes", 42),
)
```

## 5. 파일 순환

`FileWriter`로 순환 전략 구성:

```go
// 기본 100MB, 30일, 10개 백업
fwCfg := dd.DefaultFileWriterConfig()
fwCfg.MaxBackups = 3
fwCfg.MaxSizeMB = 1
fwCfg.Compress = true

fw, _ := dd.NewFileWriter("logs/app.log", fwCfg)
logger, _ := dd.New(dd.Config{
    Level: dd.LevelInfo,
    Targets: []dd.OutputTarget{dd.CustomOutput(fw)},
})

logger.Info("hello world")
```

## 6. 민감 데이터 필터링

DD는 기본적으로 기본 민감 데이터 필터링이 활성화되어 있습니다 (비밀번호, API Key, 신용카드 번호 등 자동 마스킹):

```go
// 기본 설정에 기본 보안 필터링 포함
logger, _ := dd.New(dd.DefaultConfig())

// 비밀번호 필드 자동 마스킹
logger.InfoWith("사용자 로그인",
    dd.String("username", "admin"),
    dd.String("password", "s3cr3t"),  // 출력: [REDACTED]
)
```

## 다음 단계

- [핵심 개념](./guides/core-concepts) -- Logger 체계와 처리 파이프라인 이해
- [구조화된 로그](./guides/structured-logging) -- 필드 사용 상세 가이드
- [파일 출력과 순환](./guides/file-output) -- FileWriter 상세 가이드
- [민감 데이터 필터링](./guides/sensitive-filtering) -- 보안 필터링 실전
- [치트시트](./cheatsheet) -- 자주 사용하는 API 빠른 참조
