---
title: "프로덕션 체크리스트 - HTML"
description: "CyberGo HTML 라이브러리 프로덕션 환경 배포 보안 체크리스트, 기본 보안 설정 항목(HighSecurityConfig 프리셋), Processor 라이프사이클 관리, 감사와 모니터링 설정, 컨텍스트 타임아웃 제어, 오류 처리 모범 사례, 리소스 관리와 파일 처리 보안 주의사항을 포함합니다."
---

# 프로덕션 체크리스트

## 기본 설정

- [ ] `HighSecurityConfig()` 또는 커스텀 보안 설정 사용
- [ ] 비즈니스 요구에 따라 적절한 `MaxInputSize` 설정
- [ ] 장시간 차단을 방지하기 위해 `ProcessingTimeout` 설정
- [ ] DOM 깊이를 제한하는 `MaxDepth` 설정
- [ ] 콘텐츠 정제를 위해 `EnableSanitization` 활성화

## Processor 라이프사이클

- [ ] `defer p.Close()`를 사용하여 Processor가 올바르게 해제되도록 보장
- [ ] 종료 후 Processor를 계속 사용하지 않기
- [ ] 리소스를 재사용하기 위해 싱글톤 Processor 사용 고려

```go
p, err := html.New(html.HighSecurityConfig())
if err != nil {
    log.Fatal(err)
}
defer p.Close()
```

## 감사와 모니터링

- [ ] 감사 시스템 활성화
- [ ] 적절한 감사 레벨 필터링 설정
- [ ] `WriterAuditSink`를 사용하여 감사 로그 영구 저장
- [ ] `GetStatistics()`의 오류 카운트 모니터링
- [ ] `ErrInternalPanic` 오류와 `AuditEventPathTraversal` 감사 이벤트에 주의

```go
auditFile, _ := os.OpenFile("audit.jsonl", os.O_APPEND|os.O_CREATE, 0644)
defer auditFile.Close()

cfg := html.HighSecurityConfig()
cfg.Audit.Sink = html.NewWriterAuditSink(auditFile)
```

## 컨텍스트와 타임아웃

- [ ] 모든 추출 작업에 `WithContext` 버전 사용
- [ ] 적절한 컨텍스트 타임아웃 설정
- [ ] 배치 작업에 취소가 포함된 컨텍스트 사용

```go
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
result, err := html.ExtractWithContext(ctx, data)
```

## 오류 처리

- [ ] 비즈니스 오류와 보안 오류 구분
- [ ] 모든 `ErrInputTooLarge`와 `ErrMaxDepthExceeded` 기록
- [ ] `ErrInternalPanic` 발생 빈도 모니터링
- [ ] `ErrFileNotFound`에 대해 원시 오류 메시지 대신 `SafePath()` 확인

## 리소스 관리

- [ ] 배치 작업은 한 번에 10000건을 초과하지 않기
- [ ] `WorkerPoolSize`를 적절하게 설정
- [ ] 정기적으로 `ClearCache()`를 호출하여 캐시 해제
- [ ] 메모리 사용량과 캐시 적중률 모니터링

## 파일 처리

- [ ] 파일 경로 출처 검증(사용자가 경로를 제어하지 못하도록 방지)
- [ ] 파일 읽기 디렉토리 제한
- [ ] 파일 크기를 먼저 확인한 후 처리
